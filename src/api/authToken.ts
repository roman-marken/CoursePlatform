// Access Token живе тільки в пам'яті вкладки.
// Сесію після оновлення відновлює сервер через HttpOnly cookie, недоступну JavaScript.
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;
export const setAccessToken = (token: string): void => { accessToken = token; };
export const clearAccessToken = (): void => { accessToken = null; };
