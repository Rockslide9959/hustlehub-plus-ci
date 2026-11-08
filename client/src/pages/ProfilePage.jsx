import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { getProfile } from '../api/authApi';
import FormError from '../components/FormError';
import TwoFactorSettings from '../components/TwoFactorSettings';

export default function ProfilePage() {
  const { user, token, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // ignore the result if the user leaves the page first

    getProfile(token)
      .then((data) => {
        if (!cancelled) setProfile(data.user);
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 = token rejected (expired or tampered). Log out; ProtectedRoute
        // then sends the user to the login page.
        if (err.status === 401) {
          logout();
          return;
        }
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  return (
    <section className="page">
      <h1>Your profile</h1>
      <FormError message={error} />

      {!profile && !error && <p className="muted">Loading…</p>}

      {profile && (
        <dl className="details">
          <dt>Name</dt>
          <dd>{user.fullName}</dd>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Role</dt>
          <dd>{profile.role}</dd>
          <dt>Session expires</dt>
          <dd>{new Date(profile.exp * 1000).toLocaleTimeString()}</dd>
        </dl>
      )}

      <p className="hint">
        These details were returned by the protected <code>/api/auth/profile</code> route,
        which only responds to requests with a valid token.
      </p>

      {profile && <TwoFactorSettings />}
    </section>
  );
}