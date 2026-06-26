import { useState } from 'react';
import { MARKET_IDS } from '../../services/api';
import { getFairness } from '../../utils/dateUtils';
import { isPeakSeason } from '../../utils/aggregation';

const MARKET_ORDER = ['台北二', '台中市', '高雄市'];
const UNITS = ['斤', '包', 'kg', '磅', '盎司'];

const CONV = {
  '斤': v => v * 0.5,
  '包': v => v * 0.45,
  'kg': v => v,
  '磅': v => v * 0.453592,
  '盎司': v => v * 0.0283495,
};

export default function DetailModal({ crop, rawData, onClose }) {
  const [unit, setUnit] = useState('斤');
  const [inputVal, setInputVal] = useState('');
  const [result, setResult] = useState(null);

  const avg = crop.avgPrice;

  // 7-day trend
  const trendMap = {};
  for (const r of rawData) {
    if (r.作物名稱 !== crop.cropName) continue;
    const d = r.交易日期;
    if (!trendMap[d]) trendMap[d] = [];
    const p = parseFloat(r.平均價);
    if (!isNaN(p) && p > 0) trendMap[d].push(p);
  }
  const trendDates = Object.keys(trendMap).sort().slice(-7);
  const trendPoints = trendDates.map(d => ({
    date: d,
    avg: trendMap[d].reduce((a, b) => a + b, 0) / trendMap[d].length,
  }));
  const maxTrend = Math.max(...trendPoints.map(p => p.avg), 1);

  function handleInput(val) {
    setInputVal(val);
    if (!val) { setResult(null); return; }
    const num = parseFloat(val);
    if (isNaN(num)) { setResult(null); return; }
    const pricePerKg = CONV[unit](num);
    const fair = getFairness(pricePerKg, avg);
    const diff = pricePerKg - avg;
    const hint = diff < -avg * 0.2
      ? '比批發價還低，建議多買'
      : diff > avg * 0.3
      ? '高於高級超市價，留意是否被當冤大頭'
      : '在合理範圍內';
    setResult({ ...fair, hint, diff });
  }

  const allMarkets = MARKET_ORDER
    .map(name => ({ name, ...crop.markets[name] }))
    .filter(m => m.avg != null)
    .sort((a, b) => a.avg - b.avg);

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="detail-modal">
        <div className="modal-header">
          <div>
            <h3>{crop.cropName}</h3>
            {crop.plv2_name && (
              <span className="plv2-tag" style={{ marginTop: 4, display: 'inline-block' }}>
                {crop.plv2_name}
              </span>
            )}
            {isPeakSeason(crop.cropName) && (
              <span className={`season-tag ${isPeakSeason(crop.cropName)}`} style={{ marginTop: 4, marginLeft: 6, display: 'inline-block' }}>
                {isPeakSeason(crop.cropName) === 'peak' ? '產季中' : '非產季'}
              </span>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {/* 市場行情 */}
          <div className="market-list">
            <h4 className="section-title">市場行情（元/公斤）</h4>
            {allMarkets.map((m) => (
              <div className="market-row" key={m.name}>
                <span className="market-name">{m.name}</span>
                <span className="market-avg price-num">${m.avg}</span>
                <span className="market-unit">/ kg</span>
              </div>
            ))}
          </div>

          {/* 全部市場加權均價 */}
          <div className="fair-indicator-large">
            <span>三市場加權均價</span>
            <span className="badge" style={{ fontSize: 18, fontWeight: 700 }}>
              ${avg} 元/kg
            </span>
          </div>

          {/* 價格階梯 */}
          <div className="price-ladder">
            <h4 className="section-title">參考價格帶（傳統市場零售）</h4>
            {[
              { label: '批發均價', price: avg },
              { label: '傳統市場', price: avg * 1.3 },
              { label: '大賣場', price: avg * 1.6 },
              { label: '高級超市', price: avg * 2.0 },
            ].map(({ label, price }) => (
              <div className="ladder-item" key={label}>
                <span>{label}</span>
                <span className="price-num">${price.toFixed(0)} 元/斤</span>
              </div>
            ))}
          </div>

          {/* 划算計算 */}
          <div className="price-input-section">
            <h4 className="section-title">我看到的價格</h4>
            <div className="price-input-wrapper">
              <input
                type="number"
                placeholder="輸入價格"
                value={inputVal}
                onInput={e => handleInput(e.target.value)}
              />
              <div className="unit-toggle">
                {UNITS.map(u => (
                  <button
                    key={u}
                    className={`unit-toggle-btn ${unit === u ? 'active' : ''}`}
                    onClick={() => { setUnit(u); handleInput(inputVal); }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {result && (
              <div className="your-price-result" style={{ background: `${result.color}15`, borderRadius: 10, padding: '12px' }}>
                <p style={{ color: result.color, fontWeight: 700, fontSize: 16 }}>{result.label}</p>
                <p className="result-hint">{result.hint}</p>
              </div>
            )}
          </div>

          {/* 7天趨勢 */}
          {trendPoints.length > 1 && (
            <div className="trend-section">
              <h4 className="section-title">近七天趨勢</h4>
              <div className="trend-bars">
                {trendPoints.map(({ date, avg: avgVal }) => (
                  <div key={date} className="trend-bar-wrap">
                    <div
                      className="trend-bar"
                      style={{ height: `${Math.max(4, (avgVal / maxTrend) * 72)}px` }}
                      title={`$${avgVal.toFixed(1)}`}
                    />
                    <span className="trend-date">{date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
