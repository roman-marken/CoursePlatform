import { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../api/axiosInstance';
import { enrollInCourse, getCourse, getCourses } from '../api/courseApi';
import type { CourseDto } from '../types/course';
import type { UserDto } from '../types/user';

interface Props {
  user: UserDto | null;
  onEnrollment: () => void;
  onUnauthorized: () => void;
}

export function CourseList({ user, onEnrollment, onUnauthorized }: Props) {
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<CourseDto | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string; error: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getCourses(controller.signal)
      .then(setCourses)
      .catch((error: unknown) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (selectedId === null) return;
    const controller = new AbortController();
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);
    getCourse(selectedId, controller.signal)
      .then(setDetails)
      .catch((error: unknown) => { if (!controller.signal.aborted) setDetailsError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setDetailsLoading(false); });
    return () => controller.abort();
  }, [selectedId]);

  async function handleEnroll(course: CourseDto) {
    setPendingId(course.id);
    setNotice(null);
    try {
      await enrollInCourse({ courseId: course.id });
      setNotice({ id: course.id, text: 'Готово! Ви записані на курс.', error: false });
      onEnrollment();
    } catch (error: unknown) {
      setNotice({ id: course.id, text: errorMessage(error), error: true });
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
    } finally { setPendingId(null); }
  }

  return (
    <section aria-labelledby="courses-title">
      <div className="section-heading"><h2 id="courses-title">Каталог курсів</h2><span className="muted">Курсів: {courses.length}</span></div>
      {loading ? <div className="panel state" role="status">Завантажуємо курси…</div>
        : error ? <div className="panel state"><p className="error" role="alert">{error}</p><button className="button secondary" onClick={() => setReload(reload + 1)}>Спробувати ще раз</button></div>
        : courses.length === 0 ? <p className="panel state">Курсів поки немає. Завітайте пізніше.</p>
        : <div className="course-grid">{courses.map((course) => {
          const enrolled = user?.enrolledCourseIds.includes(course.id) ?? false;
          return <article className="course panel" key={course.id}>
            <div className={`course-art art-${course.id % 3}`} aria-hidden="true"><span>{course.category}</span><strong>{course.id === 1 ? '{ }' : course.id === 2 ? 'TS' : 'Aa'}</strong><span>КУРС / 0{course.id}</span></div>
            <div className="course-body">
              <span className="badge">{course.level}</span>
              <h3>{course.title}</h3>
              <p className="muted">{course.description}</p>
              <div className="course-meta"><span>{course.durationHours} годин</span><span>{course.lessonsCount} уроків</span></div>
              <div className="course-actions"><button className="text-button" onClick={() => setSelectedId(course.id)}>Детальніше ↗</button><button className="button" disabled={pendingId !== null || enrolled} onClick={() => handleEnroll(course)}>{enrolled ? 'Ви записані ✓' : pendingId === course.id ? 'Записуємо…' : 'Записатися'}</button></div>
              {notice?.id === course.id && <p className={notice.error ? 'error' : 'success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
            </div>
          </article>;
        })}</div>}
      {selectedId !== null && <section className="panel details" aria-label="Деталі курсу" aria-live="polite">
        <button className="text-button close" onClick={() => setSelectedId(null)}>Закрити ×</button>
        {detailsLoading ? <p role="status">Завантажуємо деталі…</p> : detailsError ? <p className="error" role="alert">{detailsError}</p> : details && <>
          <span className="eyebrow">ПРО КУРС</span><h3>{details.title}</h3><p>{details.description}</p><p className="muted">Викладач: {details.teacher} · {details.lessonsCount} уроків · {details.level}</p>
        </>}
      </section>}
    </section>
  );
}
