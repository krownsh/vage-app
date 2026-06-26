import { CATEGORY_LABELS } from '../../services/api';

export default function CategoryTabs({ value, onChange }) {
  return (
    <div className="category-tabs">
      {CATEGORY_LABELS.map(t => (
        <button
          key={t.key}
          className={`cat-tab ${value === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
