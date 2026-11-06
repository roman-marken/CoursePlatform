import { useState } from 'react';
import { CourseList } from './components/CourseList';
import { UserProfile } from './components/UserProfile';
import type { UserDto } from './types/user';

export default function App() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  return (
    <main className="container">
      <div className="layout">
        <CourseList user={user} onEnrollment={() => setProfileVersion((version) => version + 1)} onUnauthorized={() => setUser(null)} />
        <UserProfile user={user} reloadKey={profileVersion} onUserChange={setUser} />
      </div>
    </main>
  );
}
