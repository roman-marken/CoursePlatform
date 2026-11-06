import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { UserDto } from '../src/types/user.ts';

interface StoredUser extends UserDto { passwordHash: string }

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

function publicUser(user: StoredUser): UserDto {
  return { id: user.id, name: user.name, email: user.email, enrolledCourseIds: [...user.enrolledCourseIds] };
}

export class UserStore {
  private file: string;
  private users: StoredUser[];

  constructor(file = resolve('demo/.data/users.json')) {
    this.file = file;
    const data: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    if (!Array.isArray(data) || !data.every((user: unknown) => {
      if (typeof user !== 'object' || user === null) return false;
      return 'id' in user && Number.isInteger(user.id) && 'name' in user && typeof user.name === 'string'
        && 'email' in user && typeof user.email === 'string' && 'passwordHash' in user && typeof user.passwordHash === 'string'
        && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.passwordHash)
        && 'enrolledCourseIds' in user && Array.isArray(user.enrolledCourseIds) && user.enrolledCourseIds.every(Number.isInteger);
    })) throw new Error('Некоректний файл користувачів. Відновіть demo/.data/users.json із резервної копії.');
    this.users = data as StoredUser[];
  }

  private save(users: StoredUser[]) {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = this.file + '.tmp';
    writeFileSync(temporary, JSON.stringify(users, null, 2), { mode: 0o600 });
    renameSync(temporary, this.file);
    this.users = users;
  }

  async register(name: string, email: string, password: string): Promise<UserDto> {
    const salt = randomBytes(16).toString('hex');
    const hash = await derive(password, salt);
    if (this.users.some((user) => user.email === email)) throw new HttpError(409, 'Ця електронна адреса вже зареєстрована. Увійдіть у свій профіль.');
    const user: StoredUser = {
      id: Math.max(0, ...this.users.map((user) => user.id)) + 1,
      name, email, passwordHash: `${salt}:${hash.toString('hex')}`, enrolledCourseIds: [],
    };
    this.save([...this.users, user]);
    return publicUser(user);
  }

  async login(email: string, password: string): Promise<UserDto> {
    const user = this.users.find((user) => user.email === email);
    // Обчислення відбувається й для невідомого email, без швидкої перевірки існування акаунта.
    const [salt, expected] = user?.passwordHash.split(':') ?? ['0'.repeat(32), '0'.repeat(128)];
    const actual = await derive(password, salt);
    if (!user || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new HttpError(401, 'Неправильна електронна адреса або пароль.');
    return publicUser(user);
  }

  get(id: number): UserDto {
    const user = this.users.find((user) => user.id === id);
    if (!user) throw new HttpError(401, 'Увійдіть у свій профіль.');
    return publicUser(user);
  }

  enroll(id: number, courseId: number) {
    const user = this.get(id);
    if (user.enrolledCourseIds.includes(courseId)) throw new HttpError(409, 'Ви вже записані на цей курс.');
    this.save(this.users.map((item) => item.id === id ? { ...item, enrolledCourseIds: [...item.enrolledCourseIds, courseId] } : item));
  }
}
