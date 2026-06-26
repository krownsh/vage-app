import { useState, useEffect } from 'react';
import { getCropWeight } from '../../utils/cropWeights';
import CropIcon from '../CropIcon/CropIcon';

export default function ProductCard({ crop, onOpenDetail }) {
  const [weightInfo, setWeightInfo] = useState(null);
  const avg = crop.avgPrice;
  const displayName = crop.mainName;

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

      {perUnit != null && (
        <div className="crop-per-unit">
          <span className="per-unit-label">攤商零批</span>
          <span className="per-unit-price">${perUnit}<span className="per-unit-unit">/{unitLabel}</span></span>
        </div>
      )}
    </article>
  );
}
