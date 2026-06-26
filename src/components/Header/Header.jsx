import { MARKET_IDS } from '../../services/api';

export default function Header({ query, onQueryChange }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <h1>菜價行情</h1>
        <div className="header-actions">
          <span className="data-info">農業部資料</span>
        </div>
      </div>
      <div className="search-row">
        <input
          type="search"
          placeholder="搜尋作物..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="search-input"
        />
      </div>
      <div className="market-chips">
        {Object.values(MARKET_IDS).map(m => (
          <span key={m.id} className="market-chip">{m.name}</span>
        ))}
      </div>
    </header>
  );
}
