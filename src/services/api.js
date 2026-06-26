// 政府開放資料：農業部農產品交易行情 API
const BASE = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';

// 公開 cache URL（GitHub Pages，由 .github/workflows/daily-cache.yml 每日更新）
const REMOTE_CACHE_URL = 'https://krownsh.github.io/vage-app/data/prices_cache.json';
const BUILTIN_CACHE_URL = '/data/prices_cache.json';
const REMOTE_TIMEOUT_MS = 10000;

// 北中南三個代表市場（單一真源）
export const MARKET_IDS = {
  north:   { id: '104', name: '台北二' },
  central: { id: '400', name: '台中市' },
  south:   { id: '800', name: '高雄市' },
};

// 由 MARKET_IDS 推導，避免與其他元件重複定義
export const MARKET_ORDER = Object.values(MARKET_IDS).map(m => m.name);

// 過濾規則（與 scripts/daily_cache.cjs 對齊）
const ALLOWED_CATEGORY_CODES = new Set(['N04', 'N05']); // 蔬菜 + 水果
const ALLOWED_MARKET_IDS = Object.values(MARKET_IDS).map(m => m.id);

const FETCH_TIMEOUT_MS = 15000;
const SEGMENT_DAYS = 7;
const MAX_RETRIES = 1;
const MAX_DAYS = 30;

function toRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 抓取單一日期區間，附 timeout 與 retry
async function fetchSegment(start, end, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const url = `${BASE}?StartDate=${start}&EndDate=${end}&$top=9999&$skip=0`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`[fetchSegment] ${start}~${end} 失敗，重試中 (${attempt + 1}/${MAX_RETRIES}):`, err.message);
      return fetchSegment(start, end, attempt + 1);
    }
    console.error(`[fetchSegment] ${start}~${end} 最終失敗:`, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// 套用過濾規則（市場 + 種類代碼 + 市場名稱健全性）
function applyFilters(records) {
  return records.filter((r) =>
    ALLOWED_MARKET_IDS.includes(r.市場代號) &&
    ALLOWED_CATEGORY_CODES.has(r.種類代碼) &&
    r.市場名稱 &&
    !r.市場名稱.includes('�')
  );
}

// 以「日期|作物|市場名稱」三元組去重（slim 後市場代號已移除）
function dedupeByKey(records) {
  const map = new Map();
  for (const r of records) {
    const key = `${r.交易日期}|${r.作物代號}|${r.市場名稱}`;
    if (!map.has(key)) map.set(key, r);
  }
  return [...map.values()];
}

/**
 * 即時抓取行情（fallback 用，正常情況下前端不應直接呼叫）
 * @param {object} opts
 * @param {number} opts.days - 向回抓幾天（預設 30 天）
 */
async function fetchPricesLive({ days = MAX_DAYS } = {}) {
  const today = new Date();
  const totalDays = Math.min(Math.max(days, 1), MAX_DAYS);

  const segments = [];
  for (let off = 0; off < totalDays; off += SEGMENT_DAYS) {
    const segEndOffset = off;
    const segStartOffset = Math.min(off + SEGMENT_DAYS - 1, totalDays - 1);
    const segStart = new Date(today - segStartOffset * 86400000);
    const segEnd = new Date(today - segEndOffset * 86400000);
    segments.push([toRocDate(segStart), toRocDate(segEnd)]);
  }

  try {
    const results = await Promise.all(segments.map(([s, e]) => fetchSegment(s, e)));
    const all = results.flat();
    const filtered = applyFilters(all);
    const deduped = dedupeByKey(filtered);
    return deduped;
  } catch (err) {
    console.error('[fetchPricesLive] 整體失敗:', err.message);
    return [];
  }
}

// 載入本地快取（由 scripts/daily_cache.cjs 每日產出）
let _pricesCache = null;

// 從 GitHub Pages 拉取最新 cache
async function fetchRemoteCache() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const res = await fetch(REMOTE_CACHE_URL, {
      cache: 'no-cache',  // 避免 webview cache 舊版
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.data)) throw new Error('格式錯誤：缺少 data 陣列');
    return data;
  } catch (err) {
    console.warn('[fetchRemoteCache] 失敗:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 讀取 APK 內建靜態 cache（最後的離線 fallback）
async function fetchBuiltinCache() {
  try {
    const res = await fetch(BUILTIN_CACHE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.data) ? json : null;
  } catch (err) {
    console.warn('[fetchBuiltinCache] 失敗:', err.message);
    return null;
  }
}

/**
 * 抓取行情資料（四層 fallback chain）
 *   ① 遠端 GitHub Pages（阻塞首屏，保證最新）
 *   ② IndexedDB 本地（離線可用）
 *   ③ APK 內建靜態（首次安裝時）
 *   ④ 即時抓 4 天（以上都失敗時）
 *
 * 成功取得遠端時會順便寫入 IDB。
 * @returns {Promise<{ data: Array, lastUpdated: string|null, source: string }>}
 */
export async function fetchPrices() {
  // ① 遠端
  const remote = await fetchRemoteCache();
  if (remote) {
    const { saveToIDB } = await import('./cacheStorage.js');
    await saveToIDB(remote);
    _pricesCache = remote;
    return { data: remote.data, lastUpdated: remote.lastUpdated, source: 'remote' };
  }

  // ② IndexedDB
  const { getFromIDB } = await import('./cacheStorage.js');
  const local = await getFromIDB();
  if (local?.data) {
    console.log('[fetchPrices] 使用 IndexedDB 本地 cache');
    _pricesCache = local;
    return { data: local.data, lastUpdated: local.lastUpdated || null, source: 'idb' };
  }

  // ③ APK 內建靜態
  const builtin = await fetchBuiltinCache();
  if (builtin) {
    console.log('[fetchPrices] 使用 APK 內建靜態');
    _pricesCache = builtin;
    return { data: builtin.data, lastUpdated: builtin.lastUpdated || null, source: 'builtin' };
  }

  // ④ 真的都沒有 → 即時抓 4 天
  console.warn('[fetchPrices] fallback: 即時抓 4 天');
  const live = await fetchPricesLive({ days: 4 });
  return { data: live, lastUpdated: null, source: 'live' };
}

// 載入本地作物目錄（純靜態，不依賴網路）
let _catalogCache = null;
export async function loadCropCatalog() {
  if (_catalogCache) return _catalogCache;
  try {
    const res = await fetch('/data/crop_catalog.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _catalogCache = await res.json();
    return _catalogCache;
  } catch {
    return [];
  }
}

// 使用者導向分類
// PLV1: 001=稻米類(已過濾), 002=蔬菜類, 003=果樹類, 004=花卉類(已過濾), 005=雜糧類
// PLV2: 01=葉菜, 02=漿果, 03=莖菜, 04=根菜, 05=花菜/堅果, 06=豆菜,
//        07=瓜菜, 08=果菜, 09=芽菜, 10=菇蕈, 99=其他
export const CATEGORY_LABELS = [
  { key: 'all',   label: '全部' },
  { key: '01',    label: '葉菜類' },
  { key: '02',    label: '漿果類' },
  { key: '03',    label: '莖菜類' },
  { key: '04',    label: '根菜類' },
  { key: '05',    label: '花菜類' },
  { key: '06',    label: '豆菜類' },
  { key: '07',    label: '瓜菜類' },
  { key: '08',    label: '果菜類' },
  { key: '09',    label: '芽菜類' },
  { key: '10',    label: '菇蕈類' },
  { key: '99',    label: '其他菜' },
  { key: 'fruit', label: '水果類' },
  { key: 'fav',   label: '我的最愛' },
];