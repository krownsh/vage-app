/**
 * Catalog 產季預估 — batch 工具
 *
 * 對每個主品項，估計「哪幾個月是產季（1-12）」
 *
 * 流程：
 *   1. split：把 catalog 切成 N 個 batch JSON
 *   2. run：呼叫 NVIDIA NIM 跑每個 batch，回應存到 batches_seasons/responses/
 *   3. merge：合併 → public/data/crop_seasons.json
 *
 * 用法（與 estimate_crop_weights 對稱）：
 *   node scripts/estimate_crop_seasons.cjs split
 *   node scripts/estimate_crop_seasons.cjs run
 *   node scripts/estimate_crop_seasons.cjs merge
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.resolve(__dirname, '../public/data/crop_catalog.json');
const BATCH_DIR = path.resolve(__dirname, '../batches_seasons');
const OUTPUT_PATH = path.resolve(__dirname, '../public/data/crop_seasons.json');

const BATCH_SIZE = 30;
const DEFAULT_ENV_PATH = 'd:/others/sideproject/vage-app/.env';
const DEFAULT_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const REQUEST_INTERVAL_MS = 1800;

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
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

function loadApiKeys() {
  const envPath = process.env.NVIDIA_ENV_PATH || DEFAULT_ENV_PATH;
  const env = loadEnv(envPath);
  const keys = [];
  if (env.NVIDIA_API_KEY) keys.push(env.NVIDIA_API_KEY);
  for (let i = 1; i <= 20; i++) {
    if (env[`NVIDIA_API_KEY_${i}`]) keys.push(env[`NVIDIA_API_KEY_${i}`]);
  }
  if (keys.length === 0) console.error(`找不到 API key（檢查 ${envPath}）`);
  return keys;
}

function flattenCatalog(catalog) {
  const map = new Map();
  for (const item of catalog) {
    if (!item.name) continue;
    const main = item.name.split(/[-–\/]/)[0].trim();
    if (!map.has(main)) {
      map.set(main, { mainName: main, plv3_name: item.plv3_name || main, variants: [] });
    }
    map.get(main).variants.push(item.name);
  }
  return [...map.values()].sort((a, b) => a.mainName.localeCompare(b.mainName));
}

async function callNvidiaNIM(apiKey, model, systemPrompt, userPrompt, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(NIM_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.0,
          max_tokens: 4000,
        }),
      });
      if (res.status === 429) {
        const wait = 5000 * (attempt + 1);
        console.warn(`  ⚠ 429, 等待 ${wait}ms`);
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

const SYSTEM_PROMPT = `你是台灣農產品的產季專家。請根據台灣常見生產季節，估計每個品項的「產季月份」（1-12 月）。

回傳格式：JSON 陣列，每筆：
{
  "name": "品項名",
  "seasonMonths": [3, 4, 5],          // 月份數字陣列
  "peakMonths": [4, 5],                // 旺季（產量最高）
  "confidence": "high|medium|low",
  "note": "簡短說明，例如：3-5 月盛產，冬季需進口"
}

規則：
1. 只回 JSON 陣列，不要其他文字
2. seasonMonths 是所有有產季的月份（可能全年或部分月份）
3. peakMonths 是產量最高的月份（subset of seasonMonths）
4. 沒把握的 seasonMonths 填 []
5. 台灣本產為主，進口供應不算
6. 同 plv3 主品項的不同變體，產季通常相同（以主品項為單位）`;

function cmdSplit() {
  const items = flattenCatalog(readCatalog());
  console.log(`總主品項: ${items.length}，每批 ${BATCH_SIZE} 筆`);

  if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true });

  let batchCount = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchNum = String(Math.floor(i / BATCH_SIZE)).padStart(3, '0');
    fs.writeFileSync(path.join(BATCH_DIR, `batch_${batchNum}_input.json`), JSON.stringify(batch, null, 2));
    batchCount++;
    console.log(`  ✓ batch_${batchNum}_input.json (${batch.length} 項)`);
  }
  console.log(`\n共 ${batchCount} 個 batch`);
}

async function cmdRun() {
  const responseDir = path.join(BATCH_DIR, 'responses');
  if (!fs.existsSync(responseDir)) fs.mkdirSync(responseDir, { recursive: true });

  const inputFiles = fs.readdirSync(BATCH_DIR)
    .filter((f) => f.startsWith('batch_') && f.endsWith('_input.json'))
    .sort();

  const keys = loadApiKeys();
  if (keys.length === 0) process.exit(1);

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

  // Parallel：所有 batch 同時跑
  const tasks = pending.map((f, idx) => {
    const batchNum = f.match(/batch_(\d+)/)?.[1];
    const key = keys[idx % keys.length];
    return (async () => {
      const outputPath = path.join(responseDir, `batch_${batchNum}.json`);
      const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, f), 'utf8'));
      const itemsList = batch.map((b) => `- ${b.mainName}（變體：${b.variants.join('、')}）`).join('\n');
      const userPrompt = `品項清單：\n${itemsList}`;

      try {
        const t0 = Date.now();
        const content = await callNvidiaNIM(key, model, SYSTEM_PROMPT, userPrompt);
        const { extractJson } = await import('./_extract_json.mjs');
        const parsed = extractJson(content);
        fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
        completed++;
        console.log(`  ✓ batch_${batchNum}.json (${parsed.length} 筆, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
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
}

function cmdMerge() {
  const responsesDir = path.join(BATCH_DIR, 'responses');
  if (!fs.existsSync(responsesDir)) {
    console.error('找不到 batches_seasons/responses/');
    process.exit(1);
  }

  const files = fs.readdirSync(responsesDir).filter((f) => f.startsWith('batch_') && f.endsWith('.json'));
  const all = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(responsesDir, f), 'utf8'));
      if (Array.isArray(data)) all.push(...data);
    } catch {}
  }

  const valid = all.filter((s) => s.name && Array.isArray(s.seasonMonths));
  console.log(`總回應: ${all.length}，有效: ${valid.length}`);

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(valid, null, 2));
  console.log(`✓ 寫入 ${valid.length} 筆到 ${OUTPUT_PATH}`);
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

  console.log(`=== crop_seasons.json 驗證 ===\n`);
  console.log(`總筆數: ${list.length}`);

  const conf = { high: 0, medium: 0, low: 0, none: 0 };
  list.forEach((s) => conf[s.confidence] != null ? conf[s.confidence]++ : conf.none++);
  console.log(`\n信心度分布:`);
  Object.entries(conf).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // 當月產季比例
  const now = new Date().getMonth() + 1;
  const inSeasonNow = list.filter((s) => s.seasonMonths.includes(now));
  console.log(`\n當月（${now} 月）產季: ${inSeasonNow.length} 筆`);
  if (inSeasonNow.length <= 30) {
    console.log(`  ${inSeasonNow.map((s) => s.name).join(', ')}`);
  }

  // 全年 vs 季節性 vs 不知
  const fullYear = list.filter((s) => s.seasonMonths.length === 12);
  const partial = list.filter((s) => s.seasonMonths.length > 0 && s.seasonMonths.length < 12);
  const empty = list.filter((s) => s.seasonMonths.length === 0);
  console.log(`\n分佈:`);
  console.log(`  全年: ${fullYear.length}`);
  console.log(`  季節性: ${partial.length}`);
  console.log(`  無資料: ${empty.length}`);

  // Catalog 缺漏
  const catalog = readCatalog();
  const allVariants = new Set();
  for (const item of catalog) if (item.name) allVariants.add(item.name);
  const covered = new Set(list.map((s) => s.name));
  const missing = [...allVariants].filter((v) => !covered.has(v));
  console.log(`\nCatalog 變體: ${allVariants.size}，已覆蓋: ${covered.size}，缺漏: ${missing.length}`);
}

const cmd = process.argv[2];
switch (cmd) {
  case 'split': cmdSplit(); break;
  case 'run': cmdRun(); break;
  case 'merge': cmdMerge(); break;
  case 'validate': cmdValidate(); break;
  default:
    console.log('用法:');
    console.log('  node scripts/estimate_crop_seasons.cjs split');
    console.log('  node scripts/estimate_crop_seasons.cjs run');
    console.log('  node scripts/estimate_crop_seasons.cjs merge');
    console.log('  node scripts/estimate_crop_seasons.cjs validate');
}