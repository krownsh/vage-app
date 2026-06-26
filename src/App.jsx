import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header/Header';
import CategoryTabs from './components/CategoryTabs/CategoryTabs';
import ProductCard from './components/ProductCard/ProductCard';
import DetailModal from './components/DetailModal/DetailModal';
import CheckerModal from './components/CheckerModal/CheckerModal';
import FAB from './components/FAB/FAB';
import { fetchPrices, loadCropCatalog, loadMarketAlias } from './services/api';
import { aggregatePrices, filterCrops, setMarketAlias } from './utils/aggregation';
import { useFavorites } from './hooks/useFavorites';

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [detailCrop, setDetailCrop] = useState(null);
  const [showChecker, setShowChecker] = useState(false);
  const [cacheMeta, setCacheMeta] = useState(null);
  const { favorites, toggleFavorite } = useFavorites();

  // 計算資料距今幾天（用字串比對，避免時鐘誤差）
  function calcStaleDays(lastUpdatedStr) {
    if (!lastUpdatedStr) return null;
    const last = new Date(lastUpdatedStr);
    if (isNaN(last.getTime())) return null;
    const now = new Date();
    const diff = Math.floor((now - last) / 86400000);
    return Math.max(0, diff);
  }

  // 並行：載入作物目錄 + 行情資料 + 市場別名
  useEffect(() => {
    Promise.all([
      loadCropCatalog(),
      fetchPrices(),
      loadMarketAlias(),
    ])
      .then(([cat, priceResult, alias]) => {
        setCatalog(cat);
        setRawData(priceResult?.data || []);
        setMarketAlias(alias); // 寫入 aggregation module
        setCacheMeta({
          lastUpdated: priceResult?.lastUpdated || null,
          source: priceResult?.source || 'unknown',
          staleDays: calcStaleDays(priceResult?.lastUpdated),
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const crops = useMemo(() => aggregatePrices(rawData, catalog), [rawData, catalog]);

  const filtered = useMemo(() => {
    const base = filterCrops(crops, { category, query, favorites });
    return [...base].sort((a, b) => {
      const countA = Object.values(a.markets || {}).filter((m) => m?.avg != null).length;
      const countB = Object.values(b.markets || {}).filter((m) => m?.avg != null).length;
      return countB - countA;
    });
  }, [crops, category, query, favorites]);

  return (
    <div className="app">
      <Header query={query} onQueryChange={setQuery} />
      <CategoryTabs value={category} onChange={setCategory} />
      <main>
        {loading && (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>讀取行情資料...</span>
          </div>
        )}
        {cacheMeta?.lastUpdated && !loading && (
          <div className="cache-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15.5 14" />
            </svg>
            <span>行情更新於 {cacheMeta.lastUpdated}</span>
            {cacheMeta.staleDays > 1 && (
              <span className="stale-warn">（已是 {cacheMeta.staleDays} 天前資料，建議連網更新）</span>
            )}
          </div>
        )}
        {error && <div className="error-banner">載入失敗：{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="no-results">
            <p>找不到符合的商品</p>
          </div>
        )}
        {!loading && !error && filtered.map((crop) => (
          <ProductCard
            key={crop.mainName}
            crop={crop}
            onOpenDetail={() => setDetailCrop(crop)}
          />
        ))}
      </main>

      {detailCrop && (
        <DetailModal
          crop={detailCrop}
          rawData={rawData}
          onClose={() => setDetailCrop(null)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {showChecker && <CheckerModal onClose={() => setShowChecker(false)} />}

      <FAB onClick={() => setShowChecker(true)} />
    </div>
  );
}
