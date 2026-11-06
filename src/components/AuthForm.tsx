import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/axiosInstance';
import { getCurrentUser, login, register } from '../api/userApi';
import type { UserDto } from '../types/user';

interface Props { onSuccess: (user: UserDto) => void }
type Field = 'name' | 'email' | 'password' | 'confirmPassword';

export function AuthForm({ onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const creating = mode === 'register';

  function changeMode(next: 'login' | 'register') {
    setMode(next); setErrors({}); setError(''); setShowPassword(false);
    setValues((current) => ({ ...current, password: '', confirmPassword: '' }));
  }

  function field(field: Field, label: string, type = 'text') {
    const password = type === 'password';
    return <div className="auth-field">
      <label htmlFor={'auth-' + field}>{label}</label>
      <div className="input-wrap">
        <input id={'auth-' + field} name={field} type={password && showPassword ? 'text' : type}
          value={values[field]} disabled={busy} required
          maxLength={field === 'name' ? 80 : field === 'email' ? 254 : 128}
          autoComplete={field === 'name' ? 'name' : field === 'email' ? 'email' : creating ? 'new-password' : 'current-password'}
          placeholder={field === 'name' ? 'Ваше ім’я' : field === 'email' ? 'you@example.com' : field === 'confirmPassword' ? 'Введіть пароль ще раз' : 'Введіть пароль'}
          aria-invalid={!!errors[field]} aria-describedby={errors[field] ? field + '-error' : field === 'password' && creating ? 'password-hint' : undefined}
          onChange={(event) => {
            setValues((current) => ({ ...current, [field]: event.target.value }));
            setErrors((current) => ({ ...current, [field]: undefined })); setError('');
          }} />
        {field === 'password' && <button type="button" className="password-toggle" aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Сховати' : 'Показати'}</button>}
      </div>
      {errors[field] && <span className="field-error" id={field + '-error'} role="alert">{errors[field]}</span>}
    </div>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    if (creating && values.name.trim().length < 2) next.name = 'Вкажіть ім’я: щонайменше 2 символи.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Перевірте електронну адресу.';
    if (!values.password) next.password = 'Введіть пароль.';
    else if (creating && values.password.length < 10) next.password = 'Використайте щонайменше 10 символів.';
    if (creating && values.confirmPassword !== values.password) next.confirmPassword = 'Паролі не збігаються.';
    setErrors(next); setError('');
    if (Object.keys(next).length) {
      document.getElementById('auth-' + Object.keys(next)[0])?.focus(); return;
    }
    setBusy(true);
    try {
      const request = { email: values.email.trim(), password: values.password };
      if (creating) await register({ ...request, name: values.name.trim(), confirmPassword: values.confirmPassword });
      else await login(request);
      onSuccess(await getCurrentUser());
    } catch (error: unknown) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <div className="auth-form">
    <div className="auth-tabs" role="group" aria-label="Спосіб входу">
      <button type="button" className={!creating ? 'active' : ''} aria-pressed={!creating} onClick={() => changeMode('login')} disabled={busy}>Вхід</button>
      <button type="button" className={creating ? 'active' : ''} aria-pressed={creating} onClick={() => changeMode('register')} disabled={busy}>Реєстрація</button>
    </div>
    <h3>{creating ? 'Створіть свій профіль' : 'Раді бачити вас знову'}</h3>
    <p className="muted">{creating ? 'Зареєструйтеся, щоб записуватися на курси.' : 'Увійдіть, щоб продовжити навчання.'}</p>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      {creating && field('name', 'Ім’я')}
      {field('email', 'Електронна пошта', 'email')}
      {field('password', 'Пароль', 'password')}
      {creating && <p className="password-hint" id="password-hint">Щонайменше 10 символів. Можна використати кілька слів.</p>}
      {creating && field('confirmPassword', 'Повторіть пароль', 'password')}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button full auth-submit" type="submit" disabled={busy}>{busy ? 'Зачекайте…' : creating ? 'Створити профіль' : 'Увійти'}</button>
    </form>
    <p className="auth-switch">{creating ? 'Уже маєте профіль?' : 'Ще немає профілю?'} <button className="text-button" onClick={() => changeMode(creating ? 'login' : 'register')} disabled={busy}>{creating ? 'Увійти' : 'Зареєструватися'}</button></p>
  </div>;
}
