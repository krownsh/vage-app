/**
 * 作物分類匹配器
 * 建立快速查詢用的 reverse index，處理 FarmTransData 行情與官方 Catalog (LC7YWlenhLuP) 的命名對應。
 *
 * 核心邏輯：
 * 1. 行情 API 名稱標準化（去除「進口」等後綴、括號、修正「小果」等）
 * 2. 多級匹配策略：
 *    - 第一級：精確匹配 (完整標準化行情名稱 vs 官方 CNAME)
 *    - 第二級：主品項匹配 (行情名稱主品項 vs 官方 PLV3_NAME)
 *    - 第三級：市場別名比對 (北農拍賣別名 → 官方正式名稱)
 */

/**
 * 北農拍賣市場別名 → 官方 PLV3_NAME 或主品項名稱對照表
 * 當行情品名找不到直接對應時，用此表進行轉換後再比對。
 * 只有確定對應關係才加入此表，不猜測。
 */
const MARKET_ALIAS = {
  '包心白': '結球白菜',
  '包白': '結球白菜',
  '皇宮菜': '落葵',
  '格菱': '落葵',
  '蔥': '青蔥',
  '蔥頭': '洋蔥',
  '洋蔥頭': '洋蔥',
  '馬鈴薯': '馬鈴薯',
  '地瓜': '甘薯',
  '甘薯': '甘薯',
  '芋頭': '芋',
  '鳳梨': '鳳梨',
  '木瓜': '番木瓜',
  '番茄': '番茄',
  '小番茄': '番茄',
  '大番茄': '番茄',
  '聖女番茄': '番茄',
  '草莓': '草莓',
  '香瓜': '甜瓜',
  '洋香瓜': '甜瓜',
  '哈密瓜': '甜瓜',
  '苦瓜': '苦瓜',
  '佛手瓜': '佛手瓜',
  '絲瓜': '絲瓜',
  '稜角絲瓜': '絲瓜',
  '扁蒲': '葫蘆',
  '花椰菜': '花椰菜',
  '青花菜': '青花菜',
  '韭黃': '韭菜',
  '韭花': '韭菜',
  '蕹菜': '蕹菜',
  '空心菜': '蕹菜',
  '落葵': '落葵',
  '蕨菜': '蕨類',
  '過貓': '蕨類',
};

// 標準化作物名稱（主要用於行情 API 名稱清洗）
export function normalizeName(name) {
  if (!name) return '';

  let s = name.trim();

  // 去除「進口」「本土」「其他」「其它」
  s = s.replace(/(進口|本土|其他|其它)/g, '');

  // 小果 → 小（例如：小果番茄 → 小番茄）
  s = s.replace(/小果/g, '小');

  // 去除全形/半形括號與括號內文字
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/[（()）]/g, '');

  // 去除多餘的 hyphen
  s = s.replace(/-+$/, '').trim();

  return s;
}

/**
 * 拆解行情名稱，回傳 { main, sub, originalStd }
 * 例如 "甘藍-改良尖" ➔ { main: "甘藍", sub: "改良尖", originalStd: "甘藍-改良尖" }
 */
export function splitMarketName(marketName) {
  const std = normalizeName(marketName);
  const parts = std.split(/[-–/]/);
  const main = parts[0] ? parts[0].trim() : '';
  const sub = parts[1] ? parts[1].trim() : '';
  return { main, sub, originalStd: std };
}

// 建立索引，加快查詢速度
export function buildCropIndex(catalog) {
  const cnameMap = new Map();  // 官方完整名稱 CNAME
  const plv3Map = new Map();   // 官方 PLV3_NAME

  for (const item of catalog) {
    if (!item.name) continue;

    const stdCname = normalizeName(item.name);
    if (stdCname) cnameMap.set(stdCname, item);

    if (item.plv3_name) {
      const stdPlv3 = normalizeName(item.plv3_name);
      if (stdPlv3 && !plv3Map.has(stdPlv3)) {
        plv3Map.set(stdPlv3, item);
      }
    }
  }

  return { cnameMap, plv3Map };
}

// 查詢作物分類（多級匹配）
export function lookupCrop(marketName, index) {
  if (!marketName || !index) return null;
  const { cnameMap, plv3Map } = index;

  const { main, originalStd } = splitMarketName(marketName);

  // 第一級：完整標準化名稱精確比對 CNAME
  if (cnameMap.has(originalStd)) return cnameMap.get(originalStd);

  // 第二級：主品項比對 PLV3_NAME
  if (main && plv3Map.has(main)) return plv3Map.get(main);

  // 第三級：別名表轉換後再比對
  const aliasMain = MARKET_ALIAS[main];
  if (aliasMain && plv3Map.has(aliasMain)) return plv3Map.get(aliasMain);

  // 第四級：以 main 為關鍵字模糊搜尋 CNAME（取第一筆）
  if (main) {
    for (const [cname, item] of cnameMap.entries()) {
      if (cname === main || item.plv3_name === main) {
        return item;
      }
    }
  }

  return null;
}
