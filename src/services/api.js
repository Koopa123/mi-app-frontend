const API_URL = import.meta.env.VITE_API_URL;
const BENCHMARK_URL = import.meta.env.VITE_BENCHMARK_URL;
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL;

export { API_URL, BENCHMARK_URL, REALTIME_URL };

/**
 * Hace fetch a una URL agregando automáticamente el token JWT.
 * Si la respuesta es 401, dispara un evento "auth-expired" para que
 * el AuthContext haga logout automático.
 */
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Si NO es FormData, mandar JSON
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    window.dispatchEvent(new Event("auth-expired"));
  }

  return res;
}