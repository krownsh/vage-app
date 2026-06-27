/**
 * Catalog 重量預估 — batch 工具
 *
 * 流程：
 *   1. split：把 catalog 切成 N 個 batch JSON（每檔 30 個品項）
 *   2. run：呼叫 NVIDIA NIM Hosted API 跑每個 batch，回應存到 batches/responses/
 *   3. merge：合併 batches/responses/ 為 crop_weights.json
 *   4. status：看進度
 *
 * 環境變數：
 *   NVIDIA_ENV_PATH  .env 檔位置（預設全域 api/nvidia/.env）
 *   NVIDIA_MODEL     模型 id（預設 meta/llama-3.1-8b-instruct）
 *
 * 使用：
 *   node scripts/estimate_crop_weights.cjs split           # 切 batch
 *   node scripts/estimate_crop_weights.cjs run             # 呼叫 LLM
 *   node scripts/estimate_crop_weights.cjs merge           # 合併結果
 *   node scripts/estimate_crop_weights.cjs status          # 看進度
 *   node scripts/estimate_crop_weights.cjs test            # 單一 batch 測試（debug 用）
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.resolve(__dirname, '../public/data/crop_catalog.json');
const BATCH_DIR = path.resolve(__dirname, '../batches');
const OUTPUT_PATH = path.resolve(__dirname, '../public/data/crop_weights.json');
const PROMPT_PATH = path.resolve(__dirname, 'prompt_weight_estimation.md');

const BATCH_SIZE = 30;
const DEFAULT_ENV_PATH = 'd:/others/sideproject/vage-app/.env';
const DEFAULT_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
// 40 RPM = 每 1.5 秒一個 request（保守設 1.8 秒）
const REQUEST_INTERVAL_MS = 1800;

// ─── 共用 ───────────────────────────────────────────────────────

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function readPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^=#\s]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
  return env;
}

// 從 .env 撈所有 NVIDIA_API_KEY*
function loadApiKeys() {
  const envPath = process.env.NVIDIA_ENV_PATH || DEFAULT_ENV_PATH;
  const env = loadEnv(envPath);
  const keys = [];
  // 主要 key
  if (env.NVIDIA_API_KEY) keys.push(env.NVIDIA_API_KEY);
  // 多把：NVIDIA_API_KEY_1..20
  for (let i = 1; i <= 20; i++) {
    if (env[`NVIDIA_API_KEY_${i}`]) keys.push(env[`NVIDIA_API_KEY_${i}`]);
  }
  if (keys.length === 0) {
    console.error(`找不到 API key（檢查 ${envPath}）`);
  }
  return keys;
}

// 攤平 catalog variants，個別作為 batch 項目
function flattenCatalog(catalog) {
  const items = [];
  for (const item of catalog) {
    if (!item.name) continue;
    items.push(item.name);
  }
  return items.sort();
}

// ─── LLM 呼叫 ─────────────────────────────────────────────────

/**
 * 呼叫 NVIDIA NIM Hosted API（OpenAI compatible）
 * @param {string} apiKey
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>} 原始回應內容（可能是 JSON 字串或 markdown code block 包 JSON）
 */
async function callNvidiaNIM(apiKey, model, systemPrompt, userPrompt, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(NIM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.status === 429) {
        // RPM 撞限：等待 + retry
        const wait = 5000 * (attempt + 1);
        console.warn(`  ⚠ 429 rate limit, 等待 ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`  ⚠ ${err.message}, retry ${attempt + 1}/${maxRetries}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Lazy import helper（cjs 不能 top-level await）
let _extractJsonCache = null;
async function loadExtractJson() {
  if (!_extractJsonCache) {
    const mod = await import('./_extract_json.mjs');
    _extractJsonCache = mod.extractJson;
  }
  return _extractJsonCache;
}

// ─── Commands ───────────────────────────────────────────────────

function cmdSplit() {
  const catalog = readCatalog();
  const items = flattenCatalog(catalog);
  console.log(`總主品項: ${items.length}，每批 ${BATCH_SIZE} 筆`);

  if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true });

  const prompt = readPrompt();
  fs.writeFileSync(path.join(BATCH_DIR, '_system_prompt.txt'), prompt, 'utf8');

  let batchCount = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchNum = String(Math.floor(i / BATCH_SIZE)).padStart(3, '0');
    const filePath = path.join(BATCH_DIR, `batch_${batchNum}_input.json`);
    fs.writeFileSync(filePath, JSON.stringify(batch, null, 2), 'utf8');
    batchCount++;
    console.log(`  ✓ batch_${batchNum}_input.json (${batch.length} 項)`);
  }
  console.log(`\n共 ${batchCount} 個 batch`);
  console.log('下一步：node scripts/estimate_crop_weights.cjs run');
}

async function cmdRun() {
  const responseDir = path.join(BATCH_DIR, 'responses');
  if (!fs.existsSync(responseDir)) fs.mkdirSync(responseDir, { recursive: true });

  const inputFiles = fs.readdirSync(BATCH_DIR)
    .filter((f) => f.startsWith('batch_') && f.endsWith('_input.json'))
    .sort();

  const keys = loadApiKeys();
  if (keys.length === 0) {
    process.exit(1);
  }

  const model = process.env.NVIDIA_MODEL || DEFAULT_MODEL;

  // 過濾已存在的
  const pending = inputFiles.filter((f) => {
    const batchNum = f.match(/batch_(\d+)/)?.[1];
    const outputPath = path.join(responseDir, `batch_${batchNum}.json`);
    return !fs.existsSync(outputPath);
  });

  console.log(`找到 ${keys.length} 把 key`);
  console.log(`總 batch: ${inputFiles.length}，已存在: ${inputFiles.length - pending.length}，待跑: ${pending.length}`);
  console.log(`使用模型: ${model}\n`);

  if (pending.length === 0) {
    console.log('沒有待跑的 batch，直接執行 merge');
    return;
  }

  const startTime = Date.now();
  let completed = 0, failed = 0;

  // Parallel：所有 batch 同時跑（10 把 key 並行）
  const tasks = pending.map((f, idx) => {
    const batchNum = f.match(/batch_(\d+)/)?.[1];
    const key = keys[idx % keys.length];  // round-robin 分配 key
    return (async () => {
      const outputPath = path.join(responseDir, `batch_${batchNum}.json`);
      const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, f), 'utf8'));
      const itemsList = batch.map((b) => `- ${b}`).join('\n');
      const systemPrompt = readPrompt();
      const userPrompt = `重要：你只能回傳一個 JSON 物件，絕對不要回傳任何其他文字或解釋。\n品項清單：\n${itemsList}\n\n必須嚴格遵守以下格式：\n{"items": [{"name": "品項名", "avgWeightKg": 數字, "weightUnit": "perPiece|perBundle|perKg", "confidence": "high|medium|low", "note": "說明"}, ...]}\n\nJSON：`;

      try {
        const t0 = Date.now();
        const content = await callNvidiaNIM(key, model, systemPrompt, userPrompt);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        const extractJson = await loadExtractJson();
        const parsed = extractJson(content);
        fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
        completed++;
        console.log(`  ✓ batch_${batchNum}.json (${parsed.length} 筆, ${elapsed}s)`);
      } catch (err) {
        failed++;
        console.error(`  ✗ batch_${batchNum} 失敗: ${err.message.slice(0, 200)}`);
      }
    })();
  });

  await Promise.all(tasks);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${completed} / 失敗: ${failed}`);
  console.log(`總耗時: ${totalElapsed}s（parallel）`);
  if (failed > 0) {
    console.log('失敗的 batch 重跑：直接執行 run（已存在的會 skip）');
  } else if (completed > 0) {
    console.log('下一步：node scripts/estimate_crop_weights.cjs merge');
  }
}

function cmdMerge() {
  const responsesDir = path.join(BATCH_DIR, 'responses');
  if (!fs.existsSync(responsesDir)) {
    console.error('找不到 batches/responses/ 目錄');
    process.exit(1);
  }

  const files = fs.readdirSync(responsesDir).filter((f) => f.startsWith('batch_') && f.endsWith('.json'));
  const allWeights = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(responsesDir, f), 'utf8'));
      if (Array.isArray(data)) allWeights.push(...data);
    } catch (e) {
      console.warn(`⚠ ${f} 解析失敗:`, e.message);
    }
  }

  const valid = allWeights.filter((w) => w.name && typeof w.avgWeightKg === 'number');
  console.log(`總回應: ${allWeights.length}，有效: ${valid.length}`);

  // 去除重複（同名只留第一筆）
  const seen = new Set();
  const unique = [];
  for (const w of valid) {
    if (!seen.has(w.name)) {
      seen.add(w.name);
      unique.push(w);
    }
  }
  console.log(`去重後: ${unique.length} 筆`);

  const catalog = readCatalog();
  const allVariants = new Set();
  for (const item of catalog) if (item.name) allVariants.add(item.name);
  const covered = new Set(unique.map((w) => w.name));
  const missing = [...allVariants].filter((v) => !covered.has(v));
  console.log(`Catalog 變體總數: ${allVariants.size}，已覆蓋: ${covered.size}，缺漏: ${missing.length}`);
  if (missing.length && missing.length <= 30) {
    console.log('缺漏清單:', missing.join(', '));
  }

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(unique, null, 2));
  console.log(`✓ 寫入 ${unique.length} 筆到 ${OUTPUT_PATH}`);
}

function cmdValidate() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`找不到 ${OUTPUT_PATH}，請先 merge`);
    process.exit(1);
  }
  const list = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  if (!Array.isArray(list)) {
    console.error('格式錯誤：應為陣列');
    process.exit(1);
  }

  console.log(`=== crop_weights.json 驗證 ===\n`);
  console.log(`總筆數: ${list.length}`);

  // 信心度分布
  const conf = { high: 0, medium: 0, low: 0, none: 0 };
  list.forEach((w) => conf[w.confidence] != null ? conf[w.confidence]++ : conf.none++);
  console.log(`\n信心度分布:`);
  Object.entries(conf).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // weight 分布（合理範圍檢查）
  const weights = list.map((w) => w.avgWeightKg).filter((w) => typeof w === 'number');
  weights.sort((a, b) => a - b);
  console.log(`\n重量分布:`);
  console.log(`  最小: ${weights[0]?.toFixed(4)} kg`);
  console.log(`  P25: ${weights[Math.floor(weights.length * 0.25)]?.toFixed(4)} kg`);
  console.log(`  中位數: ${weights[Math.floor(weights.length * 0.5)]?.toFixed(4)} kg`);
  console.log(`  P75: ${weights[Math.floor(weights.length * 0.75)]?.toFixed(4)} kg`);
  console.log(`  最大: ${weights[weights.length - 1]?.toFixed(4)} kg`);

  // 異常值
  const outliers = list.filter((w) => w.avgWeightKg > 50 || w.avgWeightKg < 0.001);
  if (outliers.length) {
    console.log(`\n⚠ 異常值 (>50kg 或 <0.001kg):`);
    outliers.slice(0, 10).forEach((w) => console.log(`  ${w.name}: ${w.avgWeightKg} kg`));
    if (outliers.length > 10) console.log(`  ... 還有 ${outliers.length - 10} 筆`);
  }

  // Catalog 缺漏
  const catalog = readCatalog();
  const allVariants = new Set();
  for (const item of catalog) if (item.name) allVariants.add(item.name);
  const covered = new Set(list.map((w) => w.name));
  const missing = [...allVariants].filter((v) => !covered.has(v));
  console.log(`\nCatalog 變體: ${allVariants.size}，已覆蓋: ${covered.size}，缺漏: ${missing.length}`);
  if (missing.length && missing.length <= 30) {
    console.log(`缺漏清單（前 30）: ${missing.join(', ')}`);
  }
}

function cmdGap() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`找不到 ${OUTPUT_PATH}，請先 merge`);
    process.exit(1);
  }
  const list = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const covered = new Set(list.map((w) => w.name));

  const catalog = readCatalog();
  const allVariants = new Set();
  for (const item of catalog) if (item.name) allVariants.add(item.name);

  // 按 mainName 分組缺漏
  const missingByMain = new Map();
  for (const v of allVariants) {
    if (covered.has(v)) continue;
    const main = v.split(/[-–\/]/)[0].trim();
    if (!missingByMain.has(main)) missingByMain.set(main, []);
    missingByMain.get(main).push(v);
  }

  console.log(`=== 缺漏報告 ===\n`);
  console.log(`Catalog 變體總數: ${allVariants.size}`);
  console.log(`已覆蓋: ${covered.size}`);
  console.log(`缺漏 mainName: ${missingByMain.size}`);
  console.log(`缺漏變體: ${allVariants.size - covered.size}\n`);

  // 按缺漏變體數排序
  const sorted = [...missingByMain.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`缺漏前 20 名（按變體數）:`);
  sorted.slice(0, 20).forEach(([main, variants]) => {
    console.log(`  ${main} (${variants.length} 變體): ${variants.slice(0, 3).join(', ')}${variants.length > 3 ? '...' : ''}`);
  });

  // 寫到檔案
  const gapPath = path.resolve(__dirname, '../public/data/crop_weights_gap.json');
  const gapData = [...missingByMain.entries()].map(([main, variants]) => ({ main, variants }));
  fs.writeFileSync(gapPath, JSON.stringify(gapData, null, 2));
  console.log(`\n✓ 寫入缺漏清單到 ${gapPath}`);
}

function cmdStatus() {
  const catalog = readCatalog();
  const items = flattenCatalog(catalog);
  const totalBatches = Math.ceil(items.length / BATCH_SIZE);

  if (!fs.existsSync(BATCH_DIR)) {
    console.log('尚未執行 split');
    return;
  }

  const inputFiles = fs.readdirSync(BATCH_DIR).filter((f) => f.startsWith('batch_') && f.endsWith('_input.json'));
  console.log(`Batch 狀態: ${inputFiles.length} / ${totalBatches} 已產生`);

  const responsesDir = path.join(BATCH_DIR, 'responses');
  if (fs.existsSync(responsesDir)) {
    const respFiles = fs.readdirSync(responsesDir).filter((f) => f.startsWith('batch_') && f.endsWith('.json'));
    console.log(`LLM 回應: ${respFiles.length} / ${totalBatches}`);
    console.log(`進度: ${((respFiles.length / totalBatches) * 100).toFixed(1)}%`);
  } else {
    console.log('LLM 回應: 0');
  }
}

// Debug 工具：只跑第一個 batch，驗證 key + endpoint + 模型 + 回應格式
async function cmdTest() {
  const inputFiles = fs.readdirSync(BATCH_DIR)
    .filter((f) => f.startsWith('batch_') && f.endsWith('_input.json'))
    .sort();
  if (inputFiles.length === 0) {
    console.error('請先執行 split');
    process.exit(1);
  }
  const firstBatch = inputFiles[0];
  const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, firstBatch), 'utf8'));
  const itemsList = batch.map((b) => `- ${b}`).join('\n');
  const systemPrompt = readPrompt();
  const userPrompt = `重要：你只能回傳一個 JSON 物件，絕對不要回傳任何其他文字或解釋。\n品項清單：\n${itemsList}\n\n必須嚴格遵守以下格式：\n{"items": [{"name": "品項名", "avgWeightKg": 數字, "weightUnit": "perPiece|perBundle|perKg", "confidence": "high|medium|low", "note": "說明"}, ...]}\n\nJSON：`;
  const model = process.env.NVIDIA_MODEL || DEFAULT_MODEL;
  const keys = loadApiKeys();
  if (keys.length === 0) process.exit(1);

  console.log(`=== Test 模式 ===`);
  console.log(`Endpoint: ${NIM_ENDPOINT}`);
  console.log(`Model: ${model}`);
  console.log(`Key: ${keys[0].slice(0, 8)}...（${keys.length} 把）`);
  console.log(`Batch: ${firstBatch}（${batch.length} 項）\n`);

  try {
    const t0 = Date.now();
    const content = await callNvidiaNIM(keys[0], model, systemPrompt, userPrompt);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`回應耗時: ${elapsed}s`);
    console.log(`回應長度: ${content.length} 字元`);
    console.log(`前 500 字元:\n${content.slice(0, 500)}\n`);

    const extractJson = await loadExtractJson();
    const parsed = extractJson(content);
    console.log(`✓ JSON 解析成功，${parsed.length} 筆`);
    console.log(`前 3 筆:`);
    parsed.slice(0, 3).forEach((w) => console.log(' ', JSON.stringify(w)));

    // 不寫入檔，僅測試
  } catch (err) {
    console.error(`✗ 失敗:`, err.message);
    process.exit(1);
  }
}

const cmd = process.argv[2];
switch (cmd) {
  case 'split': cmdSplit(); break;
  case 'run': cmdRun(); break;
  case 'merge': cmdMerge(); break;
  case 'validate': cmdValidate(); break;
  case 'gap': cmdGap(); break;
  case 'status': cmdStatus(); break;
  case 'test': cmdTest(); break;
  default:
    console.log('用法:');
    console.log('  node scripts/estimate_crop_weights.cjs split     # 切 batch');
    console.log('  node scripts/estimate_crop_weights.cjs test      # 單一 batch 測試（debug）');
    console.log('  node scripts/estimate_crop_weights.cjs run       # 呼叫 NVIDIA NIM');
    console.log('  node scripts/estimate_crop_weights.cjs merge     # 合併結果');
    console.log('  node scripts/estimate_crop_weights.cjs validate  # 驗證合併結果');
    console.log('  node scripts/estimate_crop_weights.cjs gap       # 缺漏報告');
    console.log('  node scripts/estimate_crop_weights.cjs status    # 看進度');
}