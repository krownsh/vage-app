export function toRocDate(dateStr) {
  // "2025-06-24" → "114.06.24"
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y) return dateStr;
  return `${parseInt(y) - 1911}.${m}.${d}`;
}

export function getCurrentRocDate() {
  const d = new Date();
  const y = d.getFullYear() - 1911;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function getLast4Days() {
  const days = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(toRocDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    ));
  }
  return days;
}

export function formatPrice(val) {
  return parseFloat(val || 0).toFixed(1);
}

export function getFairness(marketPrice, avg) {
  const ratio = marketPrice / avg;
  if (ratio < 0.8) return { label: '極便宜', class: 'cheap', color: '#22C55E' };
  if (ratio < 1.0) return { label: '便宜', class: 'cheap', color: '#86EFAC' };
  if (ratio < 1.1) return { label: '正常', class: 'normal', color: '#9CA3AF' };
  if (ratio < 1.3) return { label: '偏貴', class: 'expensive', color: '#F97316' };
  return { label: '極貴', class: 'expensive', color: '#EF4444' };
}

export function getFairBadgeClass(marketPrice, avg) {
  if (marketPrice < avg * 0.9) return 'cheap';
  if (marketPrice > avg * 1.1) return 'expensive';
  return 'normal';
}
