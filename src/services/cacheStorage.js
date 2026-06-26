/**
 * IndexedDB 本地快取儲存
 *
 * 用於保存從 GitHub Pages 拉取的行情快取，離線時仍可使用。
 * 純 Web API，不需 Capacitor Filesystem 套件。
 */

const DB_NAME = 'vage-cache';
const DB_VERSION = 1;
const STORE = 'prices';
const KEY = 'prices_cache';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      // 第一次開啟時建 store
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 從 IndexedDB 讀取上次快取的 cache
 * @returns {Promise<object|null>} prices_cache JSON（含 lastUpdated + data），失敗回 null
 */
export async function getFromIDB() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const get = tx.objectStore(STORE).get(KEY);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    });
  } catch (err) {
    console.warn('[IDB] 讀取失敗:', err.message);
    return null;
  }
}

/**
 * 寫入 cache 到 IndexedDB
 * @param {object} data - prices_cache 完整 JSON
 * @returns {Promise<boolean>} 成功回 true，失敗回 false
 */
export async function saveToIDB(data) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IDB] 寫入失敗:', err.message);
    return false;
  }
}