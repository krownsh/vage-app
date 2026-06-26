import { useState } from 'react';

export default function CheckerModal({ onClose }) {
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('斤');
  const [result, setResult] = useState(null);

  function convertToKg(val, u) {
    switch (u) {
      case '斤': return val * 0.5;
      case '包': return val * 0.45;
      case 'kg': return val;
      case '磅': return val * 0.453592;
      case '盎司': return val * 0.0283495;
      default: return val * 0.5;
    }
  }

  function check() {
    if (!price) return;
    const num = parseFloat(price);
    if (isNaN(num)) return;
    const perKg = convertToKg(num, unit);
    const ratio = perKg / 50; // 假設均價 50 元/kg作為範例
    let label, cls, color;
    if (ratio < 0.8)      { label = '便宜'; cls = 'cheap'; color = '#22C55E'; }
    else if (ratio < 1.0) { label = '正常'; cls = 'normal'; color = '#9CA3AF'; }
    else if (ratio < 1.2) { label = '偏貴'; cls = 'expensive'; color = '#F97316'; }
    else                  { label = '極貴'; cls = 'expensive'; color = '#EF4444'; }
    setResult({ label, cls, color, perKg });
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="checker-modal">
        <div className="checker-header">
          <h3>划算計算機</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="checker-content">
          <div className="checker-section">
            <label>輸入你看到的價格</label>
            <div className="price-input-wrapper">
              <input
                type="number"
                placeholder="0"
                value={price}
                onInput={e => setPrice(e.target.value)}
              />
              <div className="unit-toggle">
                {['斤', '包', 'kg', '磅', '盎司'].map(u => (
                  <button
                    key={u}
                    className={`unit-toggle-btn ${unit === u ? 'active' : ''}`}
                    onClick={() => setUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="check-btn" onClick={check}>評估</button>
          {result && (
            <div className="checker-result" style={{ background: `${result.color}20`, color: result.color }}>
              <strong>{result.label}</strong>
              <p>相當於 {result.perKg.toFixed(1)} 元/公斤</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
