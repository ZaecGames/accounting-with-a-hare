/**
 * Локально: пусто → запросы на /api (Vite proxy → :8000).
 * Vercel / прод: задайте VITE_API_URL=https://ваш-backend.onrender.com
 */
export function apiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
