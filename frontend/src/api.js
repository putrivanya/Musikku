import axios from "axios";

const DEFAULT_API_URL = "http://localhost:5000/api";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
).replace(/\/+$/, "");

export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

export const TOKEN_KEY = "token";
export const USER_KEY = "user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSessionUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY) || "{}");

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));

  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem("currentUser");
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("currentUser");
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("currentUser");
}

export function notifySessionExpired() {
  clearSession();
  window.dispatchEvent(new Event("musikku:session-expired"));
}

export async function logoutSession() {
  const token = getToken();

  try {
    if (token) {
      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        }
      );
    }
  } catch (error) {
    // Token mungkin sudah kedaluwarsa; sesi lokal tetap dibersihkan.
    console.warn("Logout server tidak dapat dihubungi:", error.message);
  } finally {
    clearSession();
  }
}

export function authHeaders(extra = {}) {
  const token = getToken();

  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function getErrorMessage(error, fallback = "Terjadi kesalahan.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && getToken()) {
      notifySessionExpired();
    }

    return Promise.reject(error);
  }
);

export { api };
export default api;
