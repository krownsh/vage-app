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

// MARKET_ALIAS 由 buildCropIndex 注入（從 market_alias.json runtime fetch）

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
export function buildCropIndex(catalog, marketAlias = {}) {
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

  return { cnameMap, plv3Map, catalog, marketAlias };
}

// 查詢作物分類（多級匹配）
export function lookupCrop(marketName, index) {
  if (!marketName || !index) return null;
  const { cnameMap, plv3Map, catalog } = index;

  const { main, originalStd } = splitMarketName(marketName);

  // 第一級：完整標準化名稱精確比對 CNAME
  if (cnameMap.has(originalStd)) return cnameMap.get(originalStd);

  // 第二級：主品項比對 PLV3_NAME
  if (main && plv3Map.has(main)) return plv3Map.get(main);

  // 第三級：別名表轉換後再比對
  const aliasMain = index.marketAlias[main];
  if (aliasMain && plv3Map.has(aliasMain)) return plv3Map.get(aliasMain);

  // 第四級：以 main 為關鍵字模糊搜尋 CNAME（取第一筆）
  if (main) {
    for (const [cname, item] of cnameMap.entries()) {
      if (cname === main || item.plv3_name === main) {
        return item;
      }
    }
  }

  // 第五級：MARKET_ALIAS 轉換 plv2_name 為 key 精確比對 catalog（繞過 normalizeName 的「其他」被移除問題）
  const aliasTarget = index.marketAlias[main];
  if (aliasTarget) {
    // 先嘗試找 name 完全一致
    const byName = catalog.find(item => item.name === aliasTarget && item.plv2);
    if (byName) return byName;
    // 再用 plv2_name 找（適用於 '其他柑橘' 這類只有 plv3_name 的項目）
    const byPname = catalog.find(item => item.plv2_name === aliasTarget && item.plv2);
    if (byPname) return byPname;
  }

  return null;
}
