import { useState } from 'react';
import { MARKET_IDS } from '../../services/api';
import { getFairBadgeClass } from '../../utils/dateUtils';
import { isPeakSeason } from '../../utils/aggregation';
import { shareCropInfo } from '../../utils/shareUtils';

const MARKET_ORDER = ['台北二', '台中市', '高雄市'];

export default function ProductCard({ crop, favorites, onToggleFavorite, onOpenDetail }) {
  const [inputVal, setInputVal] = useState('');
  const [calcResult, setCalcResult] = useState('');

  const avg = crop.avgPrice; // 三市場加權均價

  // 各市場均價（固定三個）
  const marketPrices = MARKET_ORDER.map(name => ({
    name,
    ...(crop.markets[name] || { avg: null }),
  }));

  // 三市場均價均值當參照
  const threeAvg = marketPrices
    .filter(m => m.avg != null)
    .reduce((s, m) => s + m.avg, 0)
    / marketPrices.filter(m => m.avg != null).length || avg;

  const badge = getFairBadgeClass(threeAvg, avg);
  const labels = { cheap: '划算', normal: '正常', expensive: '偏貴' };
  const season = isPeakSeason(crop.cropName);

  // 最低價市場
  const cheapest = marketPrices
    .filter(m => m.avg != null)
    .sort((a, b) => a.avg - b.avg)[0];

  function handleCalc(e) {
    const val = parseFloat(e.target.value);
    setInputVal(e.target.value);
    if (isNaN(val) || val <= 0) { setCalcResult(''); return; }
    const pricePerKg = val * 0.5; // 元/斤 → 元/kg
    const ratio = pricePerKg / avg;
    let label, cls;
    if (ratio < 0.8)      { label = '極便宜'; cls = 'cheap'; }
    else if (ratio < 1.0) { label = '便宜';   cls = 'cheap'; }
    else if (ratio < 1.1) { label = '正常';   cls = 'normal'; }
    else if (ratio < 1.3) { label = '偏貴';   cls = 'expensive'; }
    else                   { label = '極貴';   cls = 'expensive'; }
    setCalcResult({ label, cls });
  }

  function handleShare(e) {
    e.stopPropagation();
    const msg = [
      `【${crop.cropName}】`,
      ...marketPrices.filter(m => m.avg != null).map(m => `  ${m.name}: $${m.avg} 元/kg`),
      `  平均: $${avg} 元/kg`,
      `  #菜價行情`,
    ].join('\n');
    if (navigator.share) {
      navigator.share({ title: crop.cropName, text: msg });
    }
  }

  return (
    <article className="product-card" onClick={onOpenDetail}>
      <div className="card-header">
        <div className="product-name-row">
          <h3 className="product-name">{crop.cropName}</h3>
          {crop.plv2_name && (
            <span className="plv2-tag">{crop.plv2_name}</span>
          )}
          <button
            className={`fav-btn ${favorites.includes(crop.cropName) ? 'active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite(crop.cropName); }}
            aria-label="收藏"
          >
            <svg viewBox="0 0 24 24" fill={favorites.includes(crop.cropName) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
          <button className="share-btn" onClick={handleShare} aria-label="分享">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
        <div className="card-tags">
          {cheapest && (
            <span className="cheapest-tag">最低 $-cheapest.name $${cheapest.avg}</span>
          )}
          <span className={`fair-badge ${badge}`}>{labels[badge]}</span>
          {season && (
            <span className={`season-tag ${season}`}>
              {season === 'peak' ? '產季' : '非產季'}
            </span>
          )}
        </div>
      </div>

      {/* 三市場行情 */}
      <div className="card-price triple">
        {marketPrices.map(m => (
          <div key={m.name} className={`market-col ${m.avg == null ? 'nodata' : ''}`}>
            <span className="market-col-name">{m.name}</span>
            <span className="market-col-price price-num">
              {m.avg != null ? `$${m.avg}` : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* 即時划算計算 */}
      <div className="card-calculator" onClick={e => e.stopPropagation()}>
        <div className="calc-row">
          <span className="calc-label">我看到</span>
          <input
            type="number"
            className="calc-input"
            placeholder="輸入價格"
            value={inputVal}
            onInput={handleCalc}
          />
          <span className="calc-unit">元/斤</span>
        </div>
        {calcResult && (
          <div className={`calc-result ${calcResult.cls}`}>{calcResult.label}</div>
        )}
      </div>
    </article>
  );
}
