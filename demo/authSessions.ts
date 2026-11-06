import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from './userStore.ts';

const COOKIE = 'course_session';
const ACCESS_SECONDS = 900;
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export class AuthSessions {
  private sessions = new Map<string, { userId: number; expiresAt: number }>();
  private accessTokens = new Map<string, { sessionId: string; expiresAt: number }>();

  private cookie(request: IncomingMessage): string {
    return request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? '';
  }

  private setCookie(request: IncomingMessage, response: ServerResponse, value: string, maxAge: number) {
    const secure = 'encrypted' in request.socket && request.socket.encrypted;
    response.setHeader('Set-Cookie', `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
  }

  start(userId: number, request: IncomingMessage, response: ServerResponse) {
    this.logout(request, response);
    const id = randomBytes(32).toString('hex');
    this.sessions.set(id, { userId, expiresAt: Date.now() + SESSION_SECONDS * 1000 });
    this.setCookie(request, response, id, SESSION_SECONDS);
    return this.issueAccess(id);
  }

  private issueAccess(sessionId: string) {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= Date.now()) this.sessions.delete(id);
    }
    for (const [token, access] of this.accessTokens) {
      if (access.expiresAt <= Date.now() || !this.sessions.has(access.sessionId)) this.accessTokens.delete(token);
    }
    const token = randomBytes(32).toString('hex');
    this.accessTokens.set(token, { sessionId, expiresAt: Date.now() + ACCESS_SECONDS * 1000 });
    return { accessToken: token, expiresIn: ACCESS_SECONDS };
  }

  refresh(request: IncomingMessage) {
    const id = this.cookie(request);
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) throw new HttpError(401, 'Сесія завершилася. Увійдіть знову.');
    return this.issueAccess(id);
  }

  userId(request: IncomingMessage): number {
    const authorization = request.headers.authorization ?? '';
    const access = authorization.startsWith('Bearer ') ? this.accessTokens.get(authorization.slice(7)) : undefined;
    const session = access ? this.sessions.get(access.sessionId) : undefined;
    if (!access || access.expiresAt <= Date.now() || !session || session.expiresAt <= Date.now()) throw new HttpError(401, 'Увійдіть у профіль, щоб продовжити.');
    return session.userId;
  }

  logout(request: IncomingMessage, response: ServerResponse) {
    const id = this.cookie(request);
    this.sessions.delete(id);
    for (const [token, access] of this.accessTokens) {
      if (access.sessionId === id) this.accessTokens.delete(token);
    }
    this.setCookie(request, response, '', 0);
  }
}
