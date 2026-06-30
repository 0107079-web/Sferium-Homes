/**
 * Конфигурация API для Sferium Sync.
 * Хранит базовый URL сервера, чтобы сетевые запросы работали корректно 
 * как в локальной сети, так и в мобильных сборках через Capacitor.
 */

// Вы можете использовать переменную окружения или захардкоженный адрес
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://sferium.homes');

/**
 * Вспомогательная функция для сборки полного URL запроса.
 * Объединяет базовый URL API с переданным путем.
 */
export function getApiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://sferium.homes');
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}
