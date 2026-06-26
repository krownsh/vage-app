import { useState } from 'react';

export default function CheckerModal({ onClose }) {
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
    const ratio = perKg / 50; // 假設均價 50 元/kg 作為範例
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
      <div className="detail-modal" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <button className="sheet-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="sheet-header">
          <h3 className="sheet-title">划算計算機</h3>
        </div>

        <div style={{ marginTop: 26 }}>
          <div className="price-input-row">
            <input
              type="number"
              inputMode="decimal"
              placeholder="輸入價格"
              value={price}
              onInput={(e) => setPrice(e.target.value)}
            />
            <span className="price-input-unit">元/{unit}</span>
          </div>
          <div className="unit-toggle">
            {['斤', '包', 'kg', '磅', '盎司'].map((u) => (
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

        <button
          className="fab"
          style={{
            position: 'relative',
            right: 'auto',
            bottom: 'auto',
            marginTop: 20,
            width: '100%',
            height: 56,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 800,
          }}
          onClick={check}
        >
          評估
        </button>

        {result && (
          <div
            style={{
              background: `${result.color}20`,
              color: result.color,
              padding: 14,
              borderRadius: 16,
              marginTop: 16,
              textAlign: 'center',
              fontSize: 16,
            }}
          >
            <strong style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>
              {result.label}
            </strong>
            <p>相當於 {result.perKg.toFixed(1)} 元/公斤</p>
          </div>
        )}
      </div>
    </>
  );
}