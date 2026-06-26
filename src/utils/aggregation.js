import { buildCropIndex, lookupCrop, splitMarketName } from './cropIndex.js';

// 產季地圖（月份 1-12）
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

  const map = {};

  for (const r of records) {
    const name = (r.作物名稱 || '').trim();
    const market = (r.市場名稱 || '未知').trim();
    const price = parseFloat(r.平均價);
    if (!name || isNaN(price) || price <= 0) continue;

    const key = `${name}|${market}`;
    if (!map[key]) {
      map[key] = { cropName: name, marketName: market, total: 0, cnt: 0, upper: 0, middle: 0, lower: 0 };
    }
    if (r.上價) map[key].upper += parseFloat(r.上價);
    if (r.中價) map[key].middle += parseFloat(r.中價);
    if (r.下價) map[key].lower += parseFloat(r.下價);
    map[key].total += price;
    map[key].cnt += 1;
  }

  // 依作物名稱合併跨市場均價
  const cropMap = {};
  for (const v of Object.values(map)) {
    const { cropName, marketName } = v;
    const avg = v.total / v.cnt;

    // 用 fuzzy lookup 找 PLV2
    const info = lookupCrop(cropName, index);

    if (!cropMap[cropName]) {
      cropMap[cropName] = {
        cropName,
        plv2: info?.plv2 || '',
        plv2_name: info?.plv2_name || '未分類',
        plv1: info?.plv1 || '',
        plv1_name: info?.plv1_name || '',
        markets: {},
        totalPrice: 0,
        cnt: 0,
        avgPrice: 0,
      };
    }

    cropMap[cropName].markets[marketName] = {
      avg: parseFloat(avg.toFixed(1)),
      upper: v.cnt > 0 ? parseFloat((v.upper / v.cnt).toFixed(1)) : null,
      middle: v.cnt > 0 ? parseFloat((v.middle / v.cnt).toFixed(1)) : null,
      lower: v.cnt > 0 ? parseFloat((v.lower / v.cnt).toFixed(1)) : null,
      cnt: v.cnt,
    };
    cropMap[cropName].totalPrice += v.total;
    cropMap[cropName].cnt += v.cnt;
  }

  for (const crop of Object.values(cropMap)) {
    crop.avgPrice = crop.cnt > 0
      ? parseFloat((crop.totalPrice / crop.cnt).toFixed(1))
      : 0;
    // 提供 mainName（去掉變體後的主品項），供 DetailModal 跨變體彙整趨勢用
    crop.mainName = splitMarketName(crop.cropName).main;
  }

  return Object.values(cropMap);
}

// 過濾 + 排序
export function filterCrops(crops, { category, query, favorites = [] }) {
  let result = [...crops];

  if (category === 'fav') {
    result = result.filter(c => favorites.includes(c.cropName));
  } else if (category === 'fruit') {
    // 水果類：PLV1 = 003（果樹類）
    result = result.filter(c => c.plv1 === '003');
  } else if (category !== 'all') {
    // category key 就是 plv2（如 '01', '07'）
    result = result.filter(c => c.plv2 === category);
  }

  if (query) {
    const q = query.toLowerCase();
    result = result.filter(c => c.cropName.toLowerCase().includes(q));
  }

  // 划算優先（均價越低越前面）
  result.sort((a, b) => a.avgPrice - b.avgPrice);

  return result;
}
