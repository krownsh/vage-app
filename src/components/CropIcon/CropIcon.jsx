/**
 * 作物插圖元件
 *
 * 目前策略：「奶油底圓 + 中文首字」作為 placeholder。
 * 主人之後提供真實手繪插圖時，只需把這支檔的 render 換成 <img />，
 * 外層 .crop-icon-wrap 的尺寸與背景由 index.css 統一管理，不影響呼叫端。
 *
 * 呼叫端目前：
 *   <CropIcon name={mainName} />             → 列表卡片 (68x68)
 *   <CropIcon name={mainName} size={64} />   → Bottom Sheet Summary (64x64)
 */
export default function CropIcon({ name, size = 68, charSize }) {
  const firstChar = (name || '').trim().charAt(0) || '?';
  return (
    <div
      className="crop-icon-wrap"
      style={{ width: size, height: size }}
    >
      <span className="crop-icon-char" style={charSize ? { fontSize: charSize } : undefined}>
        {firstChar}
      </span>
    </div>
  );
}