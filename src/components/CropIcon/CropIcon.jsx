/**
 * 作物插圖元件
 *
 * 圖片策略：優先從 /crops/{name}.png 載入真實插圖，
 * 載入失敗時 fallback 為「奶油底圓 + 中文首字」placeholder。
 *
 * 呼叫端目前：
 *   <CropIcon name={mainName} />             → 列表卡片 (68x68)
 *   <CropIcon name={mainName} size={64} />   → Bottom Sheet Summary (64x64)
 */
import { useState } from 'react';

export default function CropIcon({ name, size = 68, charSize }) {
  const [imgError, setImgError] = useState(false);
  const firstChar = (name || '').trim().charAt(0) || '?';
  const imgSrc = `/crops/${name}.png`;

  return (
    <div
      className="crop-icon-wrap"
      style={{ width: size, height: size }}
    >
      {!imgError ? (
        <img
          src={imgSrc}
          alt={name}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          className="crop-icon-img"
        />
      ) : (
        <span className="crop-icon-char" style={charSize ? { fontSize: charSize } : undefined}>
          {firstChar}
        </span>
      )}
    </div>
  );
}