/**
 * 作物目錄對照表
 * 建立快速查詢用的 reverse index，處理三種 naming mismatch：
 * 1. Catalog 用「小果番茄」，行情 API 用「小番茄」
 * 2. Catalog 用「-{品種}進口」（無 hyphen），行情 API 用「-{品種}」
 * 3. Catalog 用「-{品種}進口」（無 hyphen），行情 API 用「-{進口}」（有 hyphen）
 */

// 標準化作物名稱
function normalizeName(name) {
  if (!name) return '';

  let s = name.trim();

  // 案例 2 & 3：處理 -{進口} 後綴（行情 API 有 hyphen，Catalog 無）
  // 例如 榴槤-進口 → 榴槤、萵苣-廣東菜進口 → 萵苣-廣東菜
  const hyphenImportIdx = s.indexOf('-進口');
  if (hyphenImportIdx !== -1) {
    s = s.slice(0, hyphenImportIdx);
  } else {
    // 案例 3：去除純「進口」尾碼（Catalog: 榴槤進口）
    s = s.replace(/進口$/, '');
  }

// 案例 1：小果 → 小（小果番茄 → 小番茄，發生在任何位置）
  s = s.replace(/小果/g, '小');

  // 去除全形/半形括號
  s = s.replace(/[（()）]/g, '');

  // 去除末端多餘 hyphen
  s = s.replace(/-+$/, '').trim();

  return s;
}

// 建立 reverse index
export function buildCropIndex(catalog) {
  const index = new Map();       // 精確匹配（標準化）
  const prefixIndex = new Map();  // 前綴匹配（取 dash 前段）

  for (const item of catalog) {
    const stdName = normalizeName(item.name);
    if (!stdName) continue;

    const existing = index.get(stdName);
    const newCode = parseInt(item.code || 0);
    const oldCode = existing ? parseInt(existing.code || 0) : -1;
    if (!existing || newCode > oldCode) {
      index.set(stdName, item);
    }

    // 前綴索引：取 dash 或 hyphen 前段
    const dashIdx = stdName.search(/[-–]/);
    if (dashIdx > 0) {
      const prefix = stdName.slice(0, dashIdx);
      const ep = prefixIndex.get(prefix);
      if (!ep || newCode > parseInt(ep.code || 0)) {
        prefixIndex.set(prefix, item);
      }
    }
  }

  return { index, prefixIndex };
}

// 查詢作物分類
export function lookupCrop(name, index, prefixIndex) {
  if (!name) return null;
  const std = normalizeName(name);

  // 1. 精確匹配
  if (index.has(std)) return index.get(std);

  // 2. 去尾綴後再試（去掉 -{品種}）
  const lastDash = std.lastIndexOf('-');
  if (lastDash > 0) {
    const base = std.slice(0, lastDash);
    if (prefixIndex.has(base)) return prefixIndex.get(base);
  }

  return null;
}
