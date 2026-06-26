import { MARKET_ORDER } from '../../services/api';
import CropIcon from '../CropIcon/CropIcon';

export default function ProductCard({ crop, favorites, onToggleFavorite, onOpenDetail }) {
  const avg = crop.avgPrice;
  // 主品項名稱（去除變體後綴）：crop.mainName 由 aggregation.js 在 build 時填入
  // 例：「玉米-白玉米」→ mainName =「玉米」
  const displayName = crop.mainName;
  const isFav = favorites.includes(crop.mainName);

  function handleShare(e) {
    e.stopPropagation();
    const msg = [
      `【${displayName}】`,
      ...MARKET_ORDER
        .map((name) => ({ name, ...(crop.markets[name] || { avg: null }) }))
        .filter((m) => m.avg != null)
        .map((m) => `  ${m.name}: $${m.avg} 元/kg`),
      `  平均: $${avg} 元/kg`,
      `  #菜價行情`,
    ].join('\n');
    if (navigator.share) {
      navigator.share({ title: displayName, text: msg });
    } else {
      navigator.clipboard?.writeText(msg);
    }
  }

  return (
    <article className="product-card" onClick={onOpenDetail}>
      <CropIcon name={displayName} />

      <div className="crop-body">
        <div className="crop-name-row">
          <span className="crop-name">{displayName}</span>
          {crop.plv2_name && (
            <span className="plv2-tag" data-cat={crop.plv2 || ''}>
              {crop.plv2_name}
            </span>
          )}
        </div>
        <div className="crop-price-row">
          <span className="crop-price">${avg}</span>
          <span className="crop-price-unit">元/kg</span>
        </div>
      </div>

      <div className="crop-actions">
        <button
          className={`icon-btn fav-btn ${isFav ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(crop.mainName);
          }}
          aria-label={isFav ? '取消收藏' : '收藏'}
          aria-pressed={isFav}
        >
          <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeLinejoin="round">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
        <button className="icon-btn share-btn" onClick={handleShare} aria-label="分享">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
    </article>
  );
}