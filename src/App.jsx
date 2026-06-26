import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header/Header';
import CategoryTabs from './components/CategoryTabs/CategoryTabs';
import ProductCard from './components/ProductCard/ProductCard';
import DetailModal from './components/DetailModal/DetailModal';
import CheckerModal from './components/CheckerModal/CheckerModal';
import FAB from './components/FAB/FAB';
import { fetchPrices, loadCropCatalog, CATEGORY_LABELS } from './services/api';
import { aggregatePrices, filterCrops } from './utils/aggregation';
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
  const { favorites, toggleFavorite } = useFavorites();

  // 並行：載入作物目錄 + 行情資料
  useEffect(() => {
    Promise.all([
      loadCropCatalog(),
      fetchPrices(),
    ])
      .then(([cat, data]) => {
        setCatalog(cat);
        setRawData(data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const crops = useMemo(() => aggregatePrices(rawData, catalog), [rawData, catalog]);
  const filtered = useMemo(
    () => filterCrops(crops, { category, query, favorites }),
    [crops, category, query, favorites]
  );

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
        {error && <div className="error-banner">載入失敗：{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="no-results">
            <p>找不到符合的商品</p>
          </div>
        )}
        {!loading && !error && filtered.map((crop) => (
          <ProductCard
            key={crop.cropName}
            crop={crop}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onOpenDetail={() => setDetailCrop(crop)}
          />
        ))}
      </main>

      {detailCrop && (
        <DetailModal
          crop={detailCrop}
          rawData={rawData}
          onClose={() => setDetailCrop(null)}
        />
      )}

      {showChecker && <CheckerModal onClose={() => setShowChecker(false)} />}

      <FAB onClick={() => setShowChecker(true)} />
    </div>
  );
}
