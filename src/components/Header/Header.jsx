export default function Header({ query, onQueryChange }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <h1>菜價行情</h1>
        <span className="agriculture-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c4.97 0 9-4.03 9-9 0-4-3-8.5-9-13-6 4.5-9 9-9 13 0 4.97 4.03 9 9 9z" />
            <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="currentColor" stroke="none" />
          </svg>
          農業部資料
        </span>
        {/* 右上插圖佔位 — 主人之後提供手繪蔬菜籃插圖時，把這個 div 內部換成 <img src="..." /> */}
        <div className="header-illustration" aria-hidden="true">
          蔬菜籃插圖
        </div>
      </div>
      <div className="search-row">
        <input
          type="search"
          placeholder="搜尋作物..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="search-input"
        />
      </div>
    </header>
  );
}