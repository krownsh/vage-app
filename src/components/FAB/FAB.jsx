export default function FAB({ onClick }) {
  return (
    <button className="fab" onClick={onClick} aria-label="划算計算機">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
      </svg>
    </button>
  );
}
