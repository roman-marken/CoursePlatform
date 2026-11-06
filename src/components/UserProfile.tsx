import { useEffect, useState } from 'react';
import { errorMessage } from '../api/axiosInstance';
import { logout, restoreSession } from '../api/userApi';
import { AuthForm } from './AuthForm';
import type { UserDto } from '../types/user';

interface Props {
  user: UserDto | null;
  reloadKey: number;
  onUserChange: (user: UserDto | null) => void;
}

export function UserProfile({ user, reloadKey, onUserChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    restoreSession(controller.signal)
      .then((user) => { if (!controller.signal.aborted) onUserChange(user); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey, onUserChange]);

  async function handleLogout() {
    setLoading(true);
    setError('');
    try { await logout(); onUserChange(null); }
    catch (error: unknown) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }

  const initials = user?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <aside className="profile panel" aria-labelledby="profile-title" aria-busy={loading}>
      <span className="eyebrow">Профіль користувача</span>
      <h2 id="profile-title">{user ? 'Мій профіль' : 'Особистий кабінет'}</h2>
      {loading && !user ? <p className="muted" role="status">Завантажуємо профіль…</p> : user ? <>
        <div className="avatar" aria-hidden="true">{initials}</div>
        <span className="session-badge">Ви увійшли</span>
        <h3>{user.name}</h3>
        <p className="muted">{user.email}</p>
        <div className="profile-stat"><strong>{user.enrolledCourseIds.length}</strong><span>обрано для навчання</span></div>
        <button className="button secondary full" onClick={handleLogout} disabled={loading}>Вийти з профілю</button>
      </> : <AuthForm onSuccess={(user) => { setError(''); onUserChange(user); }} />}
      {loading && user && <p role="status">Оновлюємо профіль…</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </aside>
  );
}
