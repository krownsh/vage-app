/**
 * Catalog 單顆重量資料載入
 *
 * 來源：public/data/crop_weights.json（由 scripts/estimate_crop_weights.cjs 產出）
 * 用途：將每個 cropName 的「元/公斤」價格換算成「元/克」或「元/顆」
 *
 * Schema: [{ name: '玉米-白玉米', avgWeightKg: 0.3, weightUnit: 'perPiece', confidence: 'high' }, ...]
 */

let _weightsCache = null;

async function loadWeights() {
  if (_weightsCache !== null) return _weightsCache;
  try {
    const res = await fetch('/data/crop_weights.json');
    if (!res.ok) {
      _weightsCache = {};
      return _weightsCache;
    }
    const list = await res.json();
    const map = {};
    if (Array.isArray(list)) {
      for (const w of list) {
        if (w.name && typeof w.avgWeightKg === 'number') {
          map[w.name] = w;
        }
      }
    }
    _weightsCache = map;
    return map;
  } catch {
    _weightsCache = {};
    return _weightsCache;
  }
}

/**
 * 取得單一 cropName 的重量資料
 * @param {string} cropName - 例：「玉米-白玉米」或「椰子」
 * @returns {Promise<{avgWeightKg: number, weightUnit: string, confidence: string} | null>}
 */
export async function getCropWeight(cropName) {
  const weights = await loadWeights();

  // 1. 精確命中
  if (weights[cropName]) return weights[cropName];

  // 2. 去除重複後綴：catalog 可能寫「西瓜-黃肉西瓜」，市場資料是「西瓜-黃肉」
  const dashIdx = cropName.lastIndexOf('-');
  if (dashIdx > 0) {
    const main = cropName.slice(0, dashIdx);        // 西瓜
    const variant = cropName.slice(dashIdx + 1);    // 黃肉
    const dedup = `${main}-${variant}${variant}`;   // 西瓜-黃肉西瓜
    if (weights[dedup]) return weights[dedup];
  }

  // 3. 只留主名稱（去除所有變體）
  const mainOnly = cropName.split(/[-–\/]/)[0].trim();
  if (mainOnly && mainOnly !== cropName && weights[mainOnly]) return weights[mainOnly];

  return null;
}

/**
 * 將「元/公斤」轉換為「元/單位」
 * @param {number} pricePerKg
 * @param {string} cropName
 * @returns {Promise<{perUnit: number|null, unit: string|null}>} 沒資料回 null
 */
export async function convertPricePerKg(pricePerKg, cropName) {
  const w = await getCropWeight(cropName);
  if (!w || !w.avgWeightKg) return { perUnit: null, unit: null };
  return {
    perUnit: pricePerKg * w.avgWeightKg,
    unit: w.weightUnit === 'perPiece' ? '顆' : w.weightUnit === 'perBundle' ? '束' : 'kg',
  };
}