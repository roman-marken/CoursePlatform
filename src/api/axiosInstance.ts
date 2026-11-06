import axios, { type InternalAxiosRequestConfig } from 'axios';
import { clearAccessToken, getAccessToken } from './authToken';
import { setAccessToken } from './authToken';
import type { LoginResponseDto } from '../types/user';

export class ApiError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<void> | null = null;

// Окремий запит без interceptors, щоб уникнути циклу 401 → refresh → 401.
export function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios.post<LoginResponseDto>('/auth/refresh', {}, {
      baseURL: axiosInstance.defaults.baseURL, timeout: 8000, withCredentials: true,
    }).then((response) => { setAccessToken(response.data.accessToken); })
      .catch((error: unknown) => {
        clearAccessToken();
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        throw new ApiError(status === 401 ? 'Сесія завершилася. Увійдіть знову.' : 'Не вдалося відновити з’єднання із сервером.', status);
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  else config.headers.delete('Authorization');
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (!axios.isAxiosError<unknown>(error)) {
      return Promise.reject(new ApiError('Сталася неочікувана помилка. Спробуйте ще раз.'));
    }

    const status = error.response?.status;
    const config = error.config as (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
    if (status === 401 && config && !config.retried && !config.url?.startsWith('/auth/')) {
      config.retried = true;
      await refreshAccessToken();
      return axiosInstance.request(config);
    }
    let message = 'Не вдалося виконати запит. Спробуйте ще раз.';
    if (status === 401) {
      clearAccessToken();
      message = 'Увійдіть у профіль, щоб продовжити. Сесія відсутня або завершилася.';
    } else if (status === 403) message = 'У вас немає доступу до цієї дії.';
    else if (status === 404) message = 'Запитувані дані не знайдено.';
    else if (status === 409) message = 'Ви вже записані на цей курс.';
    else if (status === 429) message = 'Забагато запитів. Спробуйте трохи пізніше.';
    else if (status && status >= 500) message = 'Сервіс тимчасово недоступний. Спробуйте пізніше.';
    else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') message = 'Час очікування вичерпано. Повторіть запит.';
    else if (!error.response) message = 'Немає з’єднання із сервером. Перевірте мережу.';

    // API повертає українські повідомлення валідації та помилки входу.
    const body = error.response?.data;
    if (status && [400, 401, 409].includes(status) && typeof body === 'object' && body !== null &&
      'message' in body && typeof body.message === 'string' && body.message.length <= 250) message = body.message;

    return Promise.reject(new ApiError(message, status));
  },
);

export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Сталася помилка. Спробуйте ще раз.';
