import { useState, useEffect, useRef } from 'react';
import { splitMarketName } from '../../utils/cropIndex';
import { getCropWeight } from '../../utils/cropWeights';
import { getSeasonStatus, getCropSeason } from '../../utils/cropSeasons';
import CropIcon from '../CropIcon/CropIcon';
import TrendChart from '../TrendChart/TrendChart';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// 實際 API key → 顯示名稱
const MARKET_KEY = {
  '台北': '台北二',
  '台中': '台中市',
  '高雄': '高雄市',
};
const PREFERRED_DISPLAY = ['台北', '台中', '高雄'];

export default function DetailModal({ crop, rawData, onClose, favorites, onToggleFavorite }) {
  const [weightInfo, setWeightInfo] = useState(null);
  const [seasonStatus, setSeasonStatus] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const sheetRef = useRef(null);
  const touchStartY = useRef(0);
  const translateY = useRef(0);

  const avg = crop.avgPrice;
  const mainName = crop.mainName;

  // 鎖住背景滾動
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (mainName) {
      getCropWeight(mainName).then(setWeightInfo);
      getSeasonStatus(mainName).then(setSeasonStatus);
      getCropSeason(mainName).then(setSeasonData);
    }
  }, [mainName]);

  // 30 天趨勢
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

  // 監控是否已滾到最頂
  function handleScroll(e) {
    setIsAtTop(e.target.scrollTop === 0);
  }

  // 下滑關閉（僅在 sheet 滾到頂時啟動）
  function handleTouchStart(e) {
    if (!isAtTop) return;
    touchStartY.current = e.touches[0].clientY;
    translateY.current = 0;
  }

  function handleTouchMove(e) {
    if (!isAtTop) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && sheetRef.current) {
      translateY.current = delta;
      sheetRef.current.style.transform = `translateX(-50%) translateY(${delta}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }

  function handleTouchEnd() {
    if (!isAtTop) return;
    if (translateY.current > 120) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateX(-50%) translateY(0)';
      sheetRef.current.style.transition = 'transform 0.25s ease-out';
      translateY.current = 0;
    }
  }

  // 各市場行情（只留北/中/南）
  const preferredMarkets = PREFERRED_DISPLAY.map((display) => ({
    display,
    ...(crop.markets?.[MARKET_KEY[display]] || { avg: null }),
  }));

  // 品種明細表
  const variantRows = (crop.variants || []).map((variantName) => {
    const vm = crop.variantMarkets?.[variantName] || {};
    return {
      name: variantName,
      台北: vm[MARKET_KEY['台北']]?.avg ?? null,
      台中: vm[MARKET_KEY['台中']]?.avg ?? null,
      高雄: vm[MARKET_KEY['高雄']]?.avg ?? null,
    };
  });

  const isFav = favorites?.includes(mainName);
  const perUnit = weightInfo?.avgWeightKg ? (avg * weightInfo.avgWeightKg).toFixed(1) : null;
  const unitLabel = !weightInfo ? ''
    : weightInfo.weightUnit === 'perBundle' ? '束'
      : weightInfo.weightUnit === 'perPiece' ? '顆'
        : 'kg';

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        className="detail-modal"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-handle" />

        <button className="sheet-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="sheet-header">
          <div className="detail-title-row">
            <h3 className="sheet-title">{mainName}</h3>
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
            <button
              className={`icon-btn fav-btn ${isFav ? 'active' : ''}`}
              onClick={() => onToggleFavorite(mainName)}
              aria-label={isFav ? '取消收藏' : '收藏'}
              aria-pressed={isFav}
            >
              <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>
          </div>

          {/* 產季月份 */}
          {seasonData?.seasonMonths?.length > 0 && (
            <div className="season-months">
              {seasonData.seasonMonths.map((m) => {
                const isPeak = seasonData.peakMonths?.includes(m);
                return (
                  <span
                    key={m}
                    className={`season-month ${isPeak ? 'peak' : 'in'}`}
                  >
                    {MONTHS[m - 1]}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* 均價 Summary */}
        <div className="summary-card">
          <div className="summary-icon">
            <CropIcon name={mainName} size={64} charSize={26} />
          </div>
          <div className="summary-body">
            <span className="summary-label">北中南均價</span>
            <div className="summary-price">
              <span className="summary-price-num">${avg}</span>
              <span className="summary-price-unit">元/kg</span>
            </div>
          </div>
          {weightInfo?.avgWeightKg && (
            <div className="summary-per-unit">
              <span className="summary-per-unit-wt">
                約{Math.round(weightInfo.avgWeightKg * 1000)}克
                {weightInfo.confidence === 'low' && <span className="wt-low">（參考）</span>}
              </span>
              <span className="summary-per-unit-price">${perUnit}{unitLabel}</span>
            </div>
          )}
        </div>

        {/* 市場行情（北/中/南） */}
        <h4 className="section-title">市場行情</h4>
        <div className="market-table">
          {preferredMarkets.map((m) => (
            <div className="market-row" key={m.display}>
              <span className="market-name">{m.display}</span>
              <span className="market-price">${m.avg ?? '—'}</span>
              <span className="market-unit">/kg</span>
            </div>
          ))}
        </div>

        {/* 品種明細表 */}
        {variantRows.length > 1 && (
          <>
            <h4 className="section-title">品種明細（{variantRows.length} 種）</h4>
            <div className="variant-table">
              {variantRows.map((v) => (
                <div className="variant-row" key={v.name}>
                  <span className="variant-name">{v.name}</span>
                  <span className="variant-prices-compact">
                    {['台北', '台中', '高雄'].map((mkt) => {
                      const short = mkt === '台北' ? '北' : mkt === '台中' ? '中' : '南';
                      const val = v[mkt];
                      return (
                        <span key={mkt} className={`compact-price ${val == null ? 'nodata' : ''}`}>
                          {short}：{val != null ? `$${val}` : '—'}
                        </span>
                      );
                    })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 30 天趨勢 */}
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
