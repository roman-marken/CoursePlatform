import { ApiError, axiosInstance, refreshAccessToken } from './axiosInstance';
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken';
import type { LoginRequestDto, RegisterRequestDto, LoginResponseDto, UserDto } from '../types/user';

export async function getCurrentUser(signal?: AbortSignal): Promise<UserDto> {
  const response = await axiosInstance.get<UserDto>('/users/me', { signal });
  return response.data;
}

export async function restoreSession(signal: AbortSignal): Promise<UserDto | null> {
  try {
    if (!getAccessToken()) await refreshAccessToken();
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    return await getCurrentUser(signal);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(request: LoginRequestDto): Promise<void> {
  const response = await axiosInstance.post<LoginResponseDto>('/auth/login', request);
  setAccessToken(response.data.accessToken);
}

export async function register(request: RegisterRequestDto): Promise<void> {
  const response = await axiosInstance.post<LoginResponseDto>('/auth/register', request);
  setAccessToken(response.data.accessToken);
}

export async function logout(): Promise<void> {
  await axiosInstance.post('/auth/logout');
  clearAccessToken();
}
