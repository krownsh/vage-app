/**
 * Catalog 產季資料載入
 *
 * 來源：public/data/crop_seasons.json（由 scripts/estimate_crop_seasons.cjs 產出）
 * 用途：判斷主品項是否在產季（顯示「產季中」標籤）
 *
 * Schema: [{ name: '玉米', seasonMonths: [5,6,7,8,9,10], peakMonths: [6,7,8], confidence: 'high' }, ...]
 */

let _seasonsCache = null;

async function loadSeasons() {
  if (_seasonsCache !== null) return _seasonsCache;
  try {
    const res = await fetch('/data/crop_seasons.json');
    if (!res.ok) {
      _seasonsCache = {};
      return _seasonsCache;
    }
    const list = await res.json();
    const map = {};
    if (Array.isArray(list)) {
      for (const s of list) {
        if (s.name && Array.isArray(s.seasonMonths)) {
          map[s.name] = s;
        }
      }
    }
    _seasonsCache = map;
    return map;
  } catch {
    _seasonsCache = {};
    return _seasonsCache;
  }
}

/**
 * 取得主品項的產季月份
 * @param {string} mainName
 * @returns {Promise<{seasonMonths: number[], peakMonths: number[], confidence: string} | null>}
 */
export async function getCropSeason(mainName) {
  const seasons = await loadSeasons();
  return seasons[mainName] || null;
}

/**
 * 判斷現在是否為產季
 * @param {string} mainName
 * @param {number} [month] - 預設當月
 * @returns {Promise<'peak' | 'in-season' | 'off-season' | null>}
 *   peak: 旺季
 *   in-season: 產季但非旺季
 *   off-season: 非產季
 *   null: 沒資料
 */
export async function getSeasonStatus(mainName, month = new Date().getMonth() + 1) {
  const season = await getCropSeason(mainName);
  if (!season) return null;
  const isPeak = season.peakMonths?.includes(month);
  if (isPeak) return 'peak';
  const isInSeason = season.seasonMonths?.includes(month);
  if (isInSeason) return 'in-season';
  return 'off-season';
}