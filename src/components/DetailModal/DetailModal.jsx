import { useState, useEffect } from 'react';
import { MARKET_ORDER } from '../../services/api';
import { splitMarketName } from '../../utils/cropIndex';
import { getCropWeight } from '../../utils/cropWeights';
import { getSeasonStatus } from '../../utils/cropSeasons';
import CropIcon from '../CropIcon/CropIcon';
import TrendChart from '../TrendChart/TrendChart';

const UNITS = ['斤', '包', 'kg', '磅', '盎司'];

const CONV = {
  '斤': (v) => v * 0.5,
  '包': (v) => v * 0.45,
  'kg': (v) => v,
  '磅': (v) => v * 0.453592,
  '盎司': (v) => v * 0.0283495,
};

export default function DetailModal({ crop, rawData, onClose }) {
  const [unit, setUnit] = useState('斤');
  const [inputVal, setInputVal] = useState('');
  const [result, setResult] = useState(null);
  const [weightInfo, setWeightInfo] = useState(null);
  const [seasonStatus, setSeasonStatus] = useState(null);

  const avg = crop.avgPrice;
  const mainName = crop.mainName;

  // 載入單顆重量 + 產季資料（LLM 補完結果）
  useEffect(() => {
    if (mainName) {
      getCropWeight(mainName).then(setWeightInfo);
      getSeasonStatus(mainName).then(setSeasonStatus);
    }
  }, [mainName]);

  // 30 天趨勢：以 mainName 彙整同主品項的所有變體
  const trendMap = {};
  for (const r of rawData) {
    if (splitMarketName(r.作物名稱 || '').main !== mainName) continue;
    const d = r.交易日期;
    if (!trendMap[d]) trendMap[d] = [];
    const p = parseFloat(r.平均價);
    if (!isNaN(p) && p > 0) trendMap[d].push(p);
  }
  const trendDates = Object.keys(trendMap).sort().slice(-30);
  const trendPoints = trendDates.map((d) => ({
    date: d,
    avg: trendMap[d].reduce((a, b) => a + b, 0) / trendMap[d].length,
  }));

  function handleInput(val) {
    setInputVal(val);
    if (!val) {
      setResult(null);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const pricePerKg = CONV[unit](num);
    const diff = pricePerKg - avg;
    const hint =
      diff < -avg * 0.2
        ? '比批發價還低，建議多買'
        : diff > avg * 0.3
        ? '高於三市場加權均價不少，留意'
        : '在合理範圍內';
    setResult({ hint, diff });
  }

  // 各市場彙總（跨變體平均）
  const allMarkets = MARKET_ORDER
    .map((name) => ({ name, ...(crop.markets?.[name] || { avg: null }) }))
    .filter((m) => m.avg != null)
    .sort((a, b) => a.avg - b.avg);

  // 變體明細表
  const variantRows = (crop.variants || []).map((variantName) => {
    const markets = crop.variantMarkets?.[variantName] || {};
    return {
      name: variantName,
      markets: MARKET_ORDER.map((m) => ({ name: m, ...(markets[m] || { avg: null }) })),
    };
  });

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="detail-modal" role="dialog" aria-modal="true">
        <div className="sheet-handle" />

        <button className="sheet-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="sheet-header">
          <h3 className="sheet-title">{mainName}</h3>
          <div className="sheet-tags">
            {crop.plv2_name && (
              <span className="plv2-tag" data-cat={crop.plv2 || ''}>
                {crop.plv2_name}
              </span>
            )}
            {seasonStatus && (
              <span className={`season-badge ${seasonStatus}`}>
                {seasonStatus === 'peak'
                  ? '當季盛產'
                  : seasonStatus === 'in-season'
                  ? '當季'
                  : '非當季'}
              </span>
            )}
          </div>
        </div>

        {/* 三市場加權均價 Summary */}
        <div className="summary-card">
          <div className="summary-icon">
            <CropIcon name={mainName} size={64} charSize={26} />
          </div>
          <div className="summary-body">
            <span className="summary-label">三市場加權均價</span>
            <div className="summary-price">
              <span className="summary-price-num">${avg}</span>
              <span className="summary-price-unit">元/kg</span>
            </div>
          </div>
        </div>

        {/* 各市場行情（跨變體平均） */}
        <h4 className="section-title">市場行情（元/公斤）</h4>
        <div className="market-table">
          {allMarkets.length === 0 ? (
            <div className="market-row">
              <span className="market-name">無市場資料</span>
            </div>
          ) : (
            allMarkets.map((m) => (
              <div className="market-row" key={m.name}>
                <span className="market-name">{m.name}</span>
                <span className="market-price">${m.avg}</span>
                <span className="market-unit">/kg</span>
              </div>
            ))
          )}
        </div>

        {/* 變體明細表（細品項） */}
        {variantRows.length > 1 && (
          <>
            <h4 className="section-title">變體明細（{variantRows.length} 種）</h4>
            <div className="variant-table">
              {variantRows.map((v) => (
                <div className="variant-row" key={v.name}>
                  <span className="variant-name">{v.name}</span>
                  <div className="variant-prices">
                    {v.markets.map((m) => (
                      <span
                        key={m.name}
                        className={`variant-price ${m.avg == null ? 'nodata' : ''}`}
                      >
                        {m.name}:{' '}
                        <strong>{m.avg != null ? `$${m.avg}` : '—'}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 單顆重量提示（LLM 預估，沒資料時隱藏） */}
        {weightInfo?.avgWeightKg && (
          <div className="weight-hint">
            <span>
              單
              {weightInfo.weightUnit === 'perBundle'
                ? '束'
                : weightInfo.weightUnit === 'perPiece'
                ? '顆'
                : '公斤'}
              約
            </span>
            <strong>{Math.round(weightInfo.avgWeightKg * 1000)} 克</strong>
            <span>≈</span>
            <strong>${(avg * weightInfo.avgWeightKg).toFixed(1)} 元</strong>
            {weightInfo.confidence === 'low' && (
              <span className="weight-confidence low">（參考值）</span>
            )}
          </div>
        )}

        {/* 我看到的價格 */}
        <h4 className="section-title">我看到的價格</h4>
        <div className="price-input-row">
          <input
            type="number"
            inputMode="decimal"
            placeholder="輸入價格"
            value={inputVal}
            onInput={(e) => handleInput(e.target.value)}
          />
          <span className="price-input-unit">元/{unit}</span>
        </div>
        <div className="unit-toggle">
          {UNITS.map((u) => (
            <button
              key={u}
              className={`unit-toggle-btn ${unit === u ? 'active' : ''}`}
              onClick={() => {
                setUnit(u);
                handleInput(inputVal);
              }}
            >
              {u}
            </button>
          ))}
        </div>
        {result && (
          <div className="your-price-result">
            <p className="result-hint">{result.hint}</p>
            <p className="result-diff">
              差 {result.diff > 0 ? '+' : ''}
              {result.diff.toFixed(1)} 元/kg
            </p>
          </div>
        )}

        {/* 30 天趨勢（SVG 折線圖） */}
        {trendPoints.length > 1 && (
          <div className="trend-section">
            <h4 className="section-title">近 30 天趨勢</h4>
            <div className="trend-card">
              <TrendChart points={trendPoints} embedded />
            </div>
          </div>
        )}
      </div>
    </>
  );
}