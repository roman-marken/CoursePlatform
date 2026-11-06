import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import type { CourseDto, EnrollmentResponseDto } from '../src/types/course.ts';
import type { UserDto } from '../src/types/user.ts';
import { HttpError, UserStore } from './userStore.ts';
import { AuthSessions } from './authSessions.ts';

const courses: CourseDto[] = [
  { id: 1, title: 'React: від компонента до застосунку', description: 'Зберіть інтерфейс, який реагує на дії користувача. Компоненти, стан і робота з API — на одному проєкті.', category: 'React', level: 'Для початківців', durationHours: 24, lessonsCount: 18, teacher: 'Олена Мельник' },
  { id: 2, title: 'TypeScript: більше ясності в коді', description: 'Опишіть дані, знайдіть помилки до запуску й розберіться, що саме повертає сервер.', category: 'Типізація', level: 'Базовий рівень', durationHours: 16, lessonsCount: 12, teacher: 'Андрій Коваль' },
  { id: 3, title: 'UI-дизайн: увага до деталей', description: 'Доберіть шрифти, налаштуйте відступи та зберіть у Figma макет, яким зручно користуватися.', category: 'UI-дизайн', level: 'Для початківців', durationHours: 20, lessonsCount: 15, teacher: 'Марія Бондар' },
];

function send(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16384) reject(new HttpError(413, 'Завеликий запит.'));
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
        resolve(body as Record<string, unknown>);
      } catch { reject(new HttpError(400, 'Некоректний JSON.')); }
    });
    request.on('error', reject);
  });
}

export function demoApi(): Plugin {
  const users = new UserStore(process.env.COURSE_DATA_FILE);
  const sessions = new AuthSessions();
  const attempts = new Map<string, { count: number; until: number }>();

  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/api/')) { next(); return; }

    async function handle() {
      if (request.method === 'POST' && request.headers.origin &&
        new URL(request.headers.origin).host !== request.headers.host) {
        throw new HttpError(403, 'Запит з іншого сайту відхилено.');
      }
      if (request.method === 'GET' && path === '/api/courses') { send(response, 200, courses); return; }
      if (request.method === 'GET' && /^\/api\/courses\/\d+$/.test(path)) {
        const course = courses.find((item) => item.id === Number(path.split('/').pop()));
        if (!course) throw new HttpError(404, 'Курс не знайдено.');
        send(response, 200, course);
        return;
      }
      if (request.method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login')) {
        for (const [key, value] of attempts) if (value.until <= Date.now()) attempts.delete(key);
        const ip = request.socket.remoteAddress ?? 'local';
        const limit = attempts.get(ip) ?? { count: 0, until: Date.now() + 300000 };
        attempts.set(ip, limit);
        if (++limit.count > 20) {
          response.setHeader('Retry-After', String(Math.ceil((limit.until - Date.now()) / 1000)));
          throw new HttpError(429, 'Забагато спроб. Зачекайте кілька хвилин.');
        }
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Вкажіть коректну електронну адресу.');
        if (!password || password.length > 128) throw new HttpError(400, 'Вкажіть пароль до 128 символів.');
        let user: UserDto;
        if (path === '/api/auth/register') {
          const name = typeof body.name === 'string' ? body.name.trim() : '';
          if (name.length < 2 || name.length > 80) throw new HttpError(400, 'Ім’я має містити від 2 до 80 символів.');
          if (password.length < 10) throw new HttpError(400, 'Пароль має містити щонайменше 10 символів.');
          if (body.confirmPassword !== password) throw new HttpError(400, 'Паролі не збігаються.');
          user = await users.register(name, email, password);
        } else user = await users.login(email, password);
        send(response, path.endsWith('register') ? 201 : 200, sessions.start(user.id, request, response));
        return;
      }
      if (request.method === 'POST' && path === '/api/auth/refresh') {
        send(response, 200, sessions.refresh(request));
        return;
      }
      if (request.method === 'POST' && path === '/api/auth/logout') {
        sessions.logout(request, response);
        send(response, 200, { message: 'Вихід виконано.' });
        return;
      }
      if (path !== '/api/users/me' && path !== '/api/enrollments') throw new HttpError(404, 'Endpoint не знайдено.');
      const id = sessions.userId(request);
      if (request.method === 'GET' && path === '/api/users/me') { send(response, 200, users.get(id)); return; }
      if (request.method === 'POST' && path === '/api/enrollments') {
        const body = await readJson(request);
        if (typeof body.courseId !== 'number' || !Number.isInteger(body.courseId)) throw new HttpError(400, 'Вкажіть courseId.');
        if (!courses.some((course) => course.id === body.courseId)) throw new HttpError(404, 'Курс не знайдено.');
        users.enroll(id, body.courseId);
        const enrollment: EnrollmentResponseDto = { id: randomUUID(), courseId: body.courseId, userId: id, enrolledAt: new Date().toISOString() };
        send(response, 201, enrollment);
        return;
      }
      throw new HttpError(405, 'Метод не підтримується.');
    }

    handle().catch((error: unknown) => {
      if (!response.writableEnded) send(response, error instanceof HttpError ? error.status : 500, {
        message: error instanceof HttpError ? error.message : 'Помилка сервера. Спробуйте пізніше.',
      });
    });
  };

  return {
    name: 'local-course-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
