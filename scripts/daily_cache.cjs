/**
 * 每日行情快取建構腳本
 *
 * 行為：
 *   - 首次執行（prices_cache.json 不存在）：抓近 30 天行情，過濾後整批寫入
 *   - 後續執行：只抓今日行情，過濾後 append 到 cache，移除最舊一天
 *
 * 過濾規則（與 src/services/api.js 保持一致）：
 *   - 市場：只留 104 台北二 / 400 台中市 / 800 高雄市
 *   - 種類代碼：只留 N04 蔬菜 / N05 水果（排除 N06 花卉、其他）
 *
 * 使用方式：
 *   - 首次：node scripts/daily_cache.cjs
 *   - 排程：搭配 cron / GitHub Actions / Windows Task Scheduler 每天執行
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
const CACHE_PATH = path.resolve(__dirname, '../public/data/prices_cache.json');
const UA = 'Mozilla/5.0';

// 過濾規則（與前端 src/services/api.js 的 MARKET_IDS / EXCLUDE_CATEGORY 對齊）
const ALLOWED_MARKETS = ['104', '400', '800'];
const ALLOWED_CATEGORY_CODES = new Set(['N04', 'N05']); // 蔬菜 + 水果
const EXCLUDED_CATEGORY_CODES = new Set(['N06']);       // 花卉

const MAX_DAYS = 30;
const SEGMENT_DAYS = 7;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;

// ─── 共用工具 ───────────────────────────────────────────────────

function toRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 抓取（timeout + retry）────────────────────────────────────

function fetchSegment(start, end, attempt = 0) {
  return new Promise((resolve) => {
    const url = `${API_BASE}?StartDate=${start}&EndDate=${end}&$top=9999&$skip=0`;
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        if (attempt < MAX_RETRIES) {
          console.warn(`[fetchSegment] ${start}~${end} HTTP ${res.statusCode}，重試中...`);
          return resolve(fetchSegment(start, end, attempt + 1));
        }
        console.error(`[fetchSegment] ${start}~${end} 最終失敗 HTTP ${res.statusCode}`);
        return resolve([]);
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve(Array.isArray(data) ? data : []);
        } catch (e) {
          console.error(`[fetchSegment] ${start}~${end} JSON 解析失敗:`, e.message);
          resolve([]);
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      if (attempt < MAX_RETRIES) {
        console.warn(`[fetchSegment] ${start}~${end} 失敗 (${err.message})，重試中...`);
        return resolve(fetchSegment(start, end, attempt + 1));
      }
      console.error(`[fetchSegment] ${start}~${end} 最終失敗:`, err.message);
      resolve([]);
    });
  });
}

// ─── 過濾 ─────────────────────────────────────────────────────

function applyFilters(records) {
  return records.filter((r) =>
    ALLOWED_MARKETS.includes(r.市場代號) &&
    ALLOWED_CATEGORY_CODES.has(r.種類代碼) &&
    !EXCLUDED_CATEGORY_CODES.has(r.種類代碼) &&
    r.市場名稱 &&
    !r.市場名稱.includes('�')  // 排除編碼損壞（UTF-8 取代字元）
  );
}

// 瘦身：移除前端用不到的欄位，cache 從 3.26 MB → 1.68 MB（省 48.5%）
// 移除：交易量（無用）、種類代碼（已過濾）、市場代號（市場名稱已涵蓋）
const KEEP_FIELDS = ['交易日期', '作物代號', '作物名稱', '市場名稱', '上價', '中價', '下價', '平均價'];
function slimRecords(records) {
  return records.map((r) => {
    const out = {};
    for (const k of KEEP_FIELDS) out[k] = r[k];
    return out;
  });
}

// 以「日期|作物|市場名稱」三元組去重（slim 後市場代號已移除，改用市場名稱）
function dedupeByKey(records) {
  const map = new Map();
  for (const r of records) {
    const key = `${r.交易日期}|${r.作物代號}|${r.市場名稱}`;
    if (!map.has(key)) map.set(key, r);
  }
  return [...map.values()];
}

// 移除超過 MAX_DAYS 天的舊資料
function trimToMaxDays(records, maxDays) {
  const dates = [...new Set(records.map((r) => r.交易日期))].sort();
  if (dates.length <= maxDays) return records;
  const keepDates = new Set(dates.slice(-maxDays));
  return records.filter((r) => keepDates.has(r.交易日期));
}

// ─── 抓取模式 ─────────────────────────────────────────────────

/**
 * 首次：抓近 30 天，切 7 天/段並行抓取
 */
async function buildInitial() {
  console.log(`首次建構：抓近 ${MAX_DAYS} 天行情（${SEGMENT_DAYS} 天/段並行）`);
  const today = new Date();
  const segments = [];
  for (let off = 0; off < MAX_DAYS; off += SEGMENT_DAYS) {
    const endOffset = off;
    const startOffset = Math.min(off + SEGMENT_DAYS - 1, MAX_DAYS - 1);
    segments.push([
      toRocDate(new Date(today - startOffset * 86400000)),
      toRocDate(new Date(today - endOffset * 86400000)),
    ]);
  }
  console.log('日期分段:', segments);
  const results = await Promise.all(segments.map(([s, e]) => fetchSegment(s, e)));
  const all = results.flat();
  console.log(`原始筆數: ${all.length}`);
  const filtered = applyFilters(all);
  console.log(`過濾後筆數: ${filtered.length}`);
  const badName = all.filter(r => !r.市場名稱 || r.市場名稱.includes('�'));
  console.log(`髒市場名稱筆數: ${badName.length}`);
  const deduped = dedupeByKey(filtered);
  console.log(`去重後筆數: ${deduped.length}`);
  const slimmed = slimRecords(deduped);
  console.log(`瘦身後筆數: ${slimmed.length}`);
  return trimToMaxDays(slimmed, MAX_DAYS);
}

/**
 * 增量：讀舊 cache + 抓今日 + append + trim
 */
async function incrementalUpdate() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  console.log(`增量更新：現有 cache 筆數 ${cache.data.length}，上次更新 ${cache.lastUpdated}`);

  const todayRoc = toRocDate(new Date());
  const todayData = await fetchSegment(todayRoc, todayRoc);
  console.log(`今日原始筆數: ${todayData.length}`);
  const newFiltered = applyFilters(todayData);
  console.log(`今日過濾後筆數: ${newFiltered.length}`);

  const combined = dedupeByKey([...cache.data, ...newFiltered]);
  console.log(`合併去重後筆數: ${combined.length}`);
  const slimmed = slimRecords(combined);
  const trimmed = trimToMaxDays(slimmed, MAX_DAYS);
  console.log(`trim 到 ${MAX_DAYS} 天後筆數: ${trimmed.length}`);

  // 統計：是否有新資料、是否 trim 掉資料
  const oldDates = new Set(cache.data.map((r) => r.交易日期));
  const newDates = new Set(trimmed.map((r) => r.交易日期));
  const added = [...newDates].filter((d) => !oldDates.has(d));
  const removed = [...oldDates].filter((d) => !newDates.has(d));
  if (added.length) console.log(`新增日期: ${added.join(', ')}`);
  if (removed.length) console.log(`移除日期: ${removed.join(', ')}`);

  return trimmed;
}

// ─── 主程式 ───────────────────────────────────────────────────

async function main() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const exists = fs.existsSync(CACHE_PATH);
  let data;
  if (!exists) {
    data = await buildInitial();
  } else {
    data = await incrementalUpdate();
  }

  const result = {
    lastUpdated: isoToday(),
    lastRocDate: toRocDate(new Date()),
    recordCount: data.length,
    data,
  };

  // 寫入單行 JSON（cache 是給 fetch 讀，無需可讀性）
  fs.writeFileSync(CACHE_PATH, JSON.stringify(result), 'utf8');
  const size = (fs.statSync(CACHE_PATH).size / 1024).toFixed(1);
  console.log(`✓ 寫入 ${data.length} 筆到 ${CACHE_PATH} (${size} KB)`);
}

main().catch((err) => {
  console.error('daily_cache 失敗:', err);
  process.exit(1);
});