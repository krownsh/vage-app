import { useState, useCallback } from 'react';

const FAV_KEY = 'vege_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((cropName) => {
    setFavorites((prev) => {
      const next = prev.includes(cropName)
        ? prev.filter(f => f !== cropName)
        : [...prev, cropName];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
