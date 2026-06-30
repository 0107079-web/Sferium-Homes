import axios from "axios";
import { API_BASE_URL, getApiUrl } from "../apiConfig";

/**
 * Вариант 1: Настроенный клиент Axios
 * Используйте этот инстанс вместо стандартного axios.get/post в коде.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Пример перехватчиков (interceptors) при необходимости (например, для добавления токенов авторизации)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Вариант 2: Обертка над нативным Fetch API
 * Если вы предпочитаете использовать стандартный fetch.
 */
export async function customFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);
  
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("auth_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
