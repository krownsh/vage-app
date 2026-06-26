// 政府開放資料：農業部農產品交易行情 API
const BASE = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';

// 北中南三個代表市場
export const MARKET_IDS = {
  north:   { id: '104', name: '台北二' },
  central: { id: '400', name: '台中市' },
  south:   { id: '800', name: '高雄市' },
};

export const MARKET_ORDER = ['台北二', '台中市', '高雄市'];

function toRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 抓近4天行情（一次抓全部，回傳後再依市場代號過濾）
export async function fetchPrices() {
  const today = new Date();
  const end   = toRocDate(today);
  const start = toRocDate(new Date(today - 3 * 86400000));

  const mids = Object.values(MARKET_IDS).map(m => m.id);

  const url = `${BASE}?StartDate=${start}&EndDate=${end}&$top=9999&$skip=0`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const all = Array.isArray(data) ? data : [];
    // 僅保留三個代表市場的資料
    return all.filter(r => mids.includes(r.市場代號));
  } catch {
    return [];
  }
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
// PLV1: 001=果樹類, 002=蔬菜類, 003=稻米類
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
