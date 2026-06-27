import { useState, useEffect } from 'react';
import { getCropWeight } from '../../utils/cropWeights';
import CropIcon from '../CropIcon/CropIcon';

export default function ProductCard({ crop, displayName: propDisplayName, cardType, onOpenDetail }) {
  const [weightInfo, setWeightInfo] = useState(null);
  // 優先用 propDisplayName（variant 卡），否則用 crop.mainName（main 卡）
  const displayName = propDisplayName || crop.mainName;
  const avg = crop.avgPrice;

  useEffect(() => {
    let cancelled = false;
    getCropWeight(displayName).then((w) => {
      if (!cancelled) setWeightInfo(w);
    });
    return () => { cancelled = true; };
  }, [displayName]);

  const perUnit = weightInfo?.avgWeightKg
    ? (avg * weightInfo.avgWeightKg).toFixed(1)
    : null;

  const unitLabel = !weightInfo ? ''
    : weightInfo.weightUnit === 'perBundle' ? '元/束'
    : weightInfo.weightUnit === 'perPiece' ? '元/顆'
    : '元/kg';

  return (
    <article className="product-card" onClick={onOpenDetail}>
      <CropIcon name={crop.mainName} />

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

      {perUnit != null && (
        <div className="crop-per-unit">
          <span className="per-unit-label">攤商零批</span>
          <span className="per-unit-price">${perUnit}<span className="per-unit-unit">/{unitLabel}</span></span>
        </div>
      )}
    </article>
  );
}
