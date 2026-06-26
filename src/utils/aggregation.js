import { buildCropIndex, lookupCrop, splitMarketName } from './cropIndex.js';

// 產季地圖（月份 1-12）
// 來源：手寫預設值（無現成政府開放資料）
// 後續計畫：用 LLM 批次補完（每個 catalog 品項 + 對應產期月份）
// 詳見 待討論事項.md #5
const SEASON_MAP = {
  '甘藍':        [10, 11, 12, 1, 2],
  '小白菜':      [11, 12, 1, 2, 3],
  '青江白菜':    [3, 4, 5, 6],
  '蕹菜':        [4, 5, 6, 7, 8, 9],   // 空心菜
  '油菜':        [11, 12, 1, 2, 3],
  '萵苣菜':     [3, 4, 5, 6, 7],
  '菠菜':        [10, 11, 12, 1, 2],
  '胡瓜':        [4, 5, 6, 7, 8, 9],
  '絲瓜':        [6, 7, 8, 9, 10],
  '苦瓜':        [4, 5, 6, 7, 8],
  '番茄':        [11, 12, 1, 2, 3],
  '茄子':        [5, 6, 7, 8, 9],
  '甜椒':        [5, 6, 7, 8, 9],
  '玉米':        [5, 6, 7, 8, 9, 10],
  '蘿蔔':        [10, 11, 12, 1, 2],
  '胡蘿蔔':      [10, 11, 12, 1, 2],
  '洋蔥':        [2, 3, 4, 5],
  '馬鈴薯':      [1, 2, 3, 4, 5],
  '蒜頭':        [3, 4, 5, 6],
  '荔枝':        [6, 7],
  '芒果':        [5, 6, 7, 8],
  '西瓜':        [5, 6, 7],
  '梨':          [7, 8, 9],
  '葡萄':        [6, 7, 8],
  '香蕉':        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  '鳳梨':        [3, 4, 5, 6, 7],
  '番石榴':      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  '蓮霧':        [11, 12, 1, 2],
  '金針菇':      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  '杏鮑菇':      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export function isPeakSeason(cropName) {
  const base = (cropName || '').replace(/-[^-|]+$/g, '');
  const months = SEASON_MAP[cropName] || SEASON_MAP[base];
  if (!months) return null;
  const now = new Date().getMonth() + 1;
  return months.includes(now) ? 'peak' : 'off';
}

// 將 raw API records 聚合成作物清單
export function aggregatePrices(records, catalog = []) {
  const index = buildCropIndex(catalog);

  // 第一階段：依 (cropName, marketName) 彙總單一變體 × 市場的價格
  const variantMap = {};

  for (const r of records) {
    const name = (r.作物名稱 || '').trim();
    const market = (r.市場名稱 || '未知').trim();
    const price = parseFloat(r.平均價);
    if (!name || isNaN(price) || price <= 0) continue;

    const key = `${name}|${market}`;
    if (!variantMap[key]) {
      variantMap[key] = { cropName: name, marketName: market, total: 0, cnt: 0, upper: 0, middle: 0, lower: 0 };
    }
    if (r.上價) variantMap[key].upper += parseFloat(r.上價);
    if (r.中價) variantMap[key].middle += parseFloat(r.中價);
    if (r.下價) variantMap[key].lower += parseFloat(r.下價);
    variantMap[key].total += price;
    variantMap[key].cnt += 1;
  }

  // 第二階段：依 mainName（主品項）合併所有變體
  // 主畫面顯示一列，點開 DetailModal 才看各變體明細
  const cropMap = {};
  for (const v of Object.values(variantMap)) {
    const { cropName, marketName } = v;
    const mainName = splitMarketName(cropName).main || cropName;
    const avg = v.total / v.cnt;

    // PLV2 lookup：以 mainName 為主（玉米 vs 玉米筍 應該歸同類）
    const info = lookupCrop(mainName, index) || lookupCrop(cropName, index);

    if (!cropMap[mainName]) {
      cropMap[mainName] = {
        mainName,
        plv2: info?.plv2 || '',
        plv2_name: info?.plv2_name || '未分類',
        plv1: info?.plv1 || '',
        plv1_name: info?.plv1_name || '',
        markets: {},
        variants: new Set(), // 變體列表（給 DetailModal 顯示）
        variantMarkets: {}, // 變體 × 市場 的明細（給 DetailModal）
        totalPrice: 0,
        cnt: 0,
        avgPrice: 0,
      };
    }

    cropMap[mainName].variants.add(cropName);

    // 變體 × 市場 明細
    if (!cropMap[mainName].variantMarkets[cropName]) {
      cropMap[mainName].variantMarkets[cropName] = {};
    }
    cropMap[mainName].variantMarkets[cropName][marketName] = {
      avg: parseFloat(avg.toFixed(1)),
      upper: v.cnt > 0 ? parseFloat((v.upper / v.cnt).toFixed(1)) : null,
      middle: v.cnt > 0 ? parseFloat((v.middle / v.cnt).toFixed(1)) : null,
      lower: v.cnt > 0 ? parseFloat((v.lower / v.cnt).toFixed(1)) : null,
      cnt: v.cnt,
    };

    // 各市場彙整（用 mainName + marketName 作 key，讓跨變體同一市場平均）
    const mktKey = marketName;
    if (!cropMap[mainName].markets[mktKey]) {
      cropMap[mainName].markets[mktKey] = { total: 0, cnt: 0, upper: 0, middle: 0, lower: 0 };
    }
    cropMap[mainName].markets[mktKey].total += v.total;
    cropMap[mainName].markets[mktKey].cnt += v.cnt;
    cropMap[mainName].markets[mktKey].upper += v.upper;
    cropMap[mainName].markets[mktKey].middle += v.middle;
    cropMap[mainName].markets[mktKey].lower += v.lower;

    cropMap[mainName].totalPrice += v.total;
    cropMap[mainName].cnt += v.cnt;
  }

  // 第三階段：計算每個 crop 的 avgPrice，並把 markets 攤平
  for (const crop of Object.values(cropMap)) {
    crop.avgPrice = crop.cnt > 0
      ? parseFloat((crop.totalPrice / crop.cnt).toFixed(1))
      : 0;

    // markets 攤平為 { 市場名稱: { avg, upper, middle, lower, cnt } }
    const flatMarkets = {};
    for (const [mktName, m] of Object.entries(crop.markets)) {
      flatMarkets[mktName] = {
        avg: m.cnt > 0 ? parseFloat((m.total / m.cnt).toFixed(1)) : 0,
        upper: m.cnt > 0 ? parseFloat((m.upper / m.cnt).toFixed(1)) : null,
        middle: m.cnt > 0 ? parseFloat((m.middle / m.cnt).toFixed(1)) : null,
        lower: m.cnt > 0 ? parseFloat((m.lower / m.cnt).toFixed(1)) : null,
        cnt: m.cnt,
      };
    }
    crop.markets = flatMarkets;

    // variants Set 轉 Array 並排序
    crop.variants = [...crop.variants].sort();
  }

  return Object.values(cropMap);
}

// 過濾 + 排序
export function filterCrops(crops, { category, query, favorites = [] }) {
  let result = [...crops];

  if (category === 'fav') {
    result = result.filter(c => favorites.includes(c.mainName));
  } else if (category === 'fruit') {
    // 水果類：PLV1 = 003（果樹類）
    result = result.filter(c => c.plv1 === '003');
  } else if (category !== 'all') {
    // category key 就是 plv2（如 '01', '07'）
    result = result.filter(c => c.plv2 === category);
  }

  if (query) {
    const q = query.toLowerCase();
    result = result.filter(c => c.mainName.toLowerCase().includes(q));
  }

  // 划算優先（均價越低越前面）
  result.sort((a, b) => a.avgPrice - b.avgPrice);

  return result;
}
