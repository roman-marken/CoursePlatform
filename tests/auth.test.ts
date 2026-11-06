import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { UserStore, HttpError } from '../demo/userStore.ts';
import { AuthSessions } from '../demo/authSessions.ts';

test('Accounts persist, passwords are salted hashes, and course lists belong to each user', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'course-auth-'));
  try {
    const file = join(directory, 'users.json');
    const store = new UserStore(file);
    const first = await store.register('Олена', 'one@example.com', 'Same test password!');
    const second = await store.register('Андрій', 'two@example.com', 'Same test password!');
    assert.notEqual(first.id, second.id);
    assert.equal('passwordHash' in first, false);
    const saved = readFileSync(file, 'utf8');
    assert.equal(saved.includes('Same test password!'), false);
    const records = JSON.parse(saved) as { passwordHash: string }[];
    assert.notEqual(records[0].passwordHash, records[1].passwordHash);
    store.enroll(first.id, 1);
    const reopened = new UserStore(file);
    assert.deepEqual((await reopened.login('one@example.com', 'Same test password!')).enrolledCourseIds, [1]);
    assert.deepEqual(reopened.get(second.id).enrolledCourseIds, []);
    await assert.rejects(() => reopened.login('one@example.com', 'wrong'), (error: unknown) => error instanceof HttpError && error.status === 401);
    await assert.rejects(() => reopened.login('missing@example.com', 'wrong'), (error: unknown) => error instanceof HttpError && error.status === 401);
    assert.throws(() => reopened.enroll(first.id, 1), (error: unknown) => error instanceof HttpError && error.status === 409);
  } finally {
    const target = resolve(directory);
    assert.equal(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'), true);
    rmSync(target, { recursive: true });
  }
});

test('Concurrent registration cannot create two accounts with the same email', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'course-auth-'));
  try {
    const store = new UserStore(join(directory, 'users.json'));
    const results = await Promise.allSettled([
      store.register('Олена', 'same@example.com', 'Test long password!'),
      store.register('Олена', 'same@example.com', 'Test long password!'),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected');
    assert(rejected?.status === 'rejected' && rejected.reason instanceof HttpError && rejected.reason.status === 409);
  } finally {
    const target = resolve(directory);
    assert.equal(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'), true);
    rmSync(target, { recursive: true });
  }
});

test('Session cookie is HttpOnly; access expires, refresh restores it, logout revokes all its tokens', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const sessions = new AuthSessions();
  const request = new IncomingMessage(new Socket());
  const response = new ServerResponse(request);
  const first = sessions.start(7, request, response);
  const cookie = String(response.getHeader('Set-Cookie'));
  assert(cookie.includes('HttpOnly; SameSite=Lax; Path=/api/auth;'));
  request.headers.cookie = cookie.split(';')[0];
  request.headers.authorization = 'Bearer ' + first.accessToken;
  assert.equal(sessions.userId(request), 7);
  context.mock.timers.tick(901000);
  assert.throws(() => sessions.userId(request), HttpError);
  const refreshed = sessions.refresh(request);
  request.headers.authorization = 'Bearer ' + refreshed.accessToken;
  assert.equal(sessions.userId(request), 7);
  sessions.logout(request, response);
  assert(String(response.getHeader('Set-Cookie')).includes('Max-Age=0'));
  assert.throws(() => sessions.userId(request), HttpError);
  assert.throws(() => sessions.refresh(request), HttpError);
});
