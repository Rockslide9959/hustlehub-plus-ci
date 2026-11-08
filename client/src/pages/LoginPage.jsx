import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { validateLogin } from '../utils/validation';
import FormError from '../components/FormError';

// Formats seconds as m:ss for the lockout countdown (e.g. 905 -> "15:05")
function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Keeps digits only, at most 6, so the code box can only hold a valid code
const cleanCode = (value) => value.replace(/\D/g, '').slice(0, 6);

export default function LoginPage() {
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Account lockout: seconds left before this account may try again.
  // The backend enforces the lock; this only explains it and stops the user
  // from pressing "Log in" again while it cannot work.
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const isLocked = lockSecondsLeft > 0;

  // Two-factor authentication: after a correct password on a 2FA account,
  // the API returns a 5-minute challenge token and the page asks for a code.
  // The token is only kept in memory and is dropped if the user goes back.
  const [challengeToken, setChallengeToken] = useState(null);
  const [code, setCode] = useState('');

  // Count the lock down once per second until it reaches zero
  useEffect(() => {
    if (!isLocked) return undefined;
    const timer = setInterval(() => {
      setLockSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  // Set by RegisterPage after a successful registration.
  const justRegistered = location.state?.registered === true;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLocked) return;
    setFormError('');

    const errors = validateLogin(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await login(form.email.trim().toLowerCase(), form.password);
      if (result?.twoFactorRequired) {
        // Password was right; the password is not needed any more
        setChallengeToken(result.challengeToken);
        setForm((previous) => ({ ...previous, password: '' }));
        return;
      }
      goToNextPage();
    } catch (error) {
      if (error.status === 423) {
        showLocked(error);
        return;
      }
      // error.message is already a friendly message from apiRequest.
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Return the user to the page they originally wanted, or home.
  function goToNextPage() {
    const redirectTo = location.state?.from?.pathname || '/';
    navigate(redirectTo, { replace: true });
  }

  // Locked: the countdown replaces the plain error message, and the user
  // starts again from the password step once the lock is over
  function showLocked(error) {
    setLockSecondsLeft(error.retryAfterSeconds || 15 * 60);
    setForm((previous) => ({ ...previous, password: '' }));
    backToPassword();
  }

  function backToPassword() {
    setChallengeToken(null);
    setCode('');
  }

  async function handleCodeSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (code.length !== 6) {
      setFormError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSubmitting(true);
    try {
      await completeTwoFactorLogin(challengeToken, code);
      goToNextPage();
    } catch (error) {
      if (error.status === 423) {
        showLocked(error);
        return;
      }
      setCode('');
      if (error.status === 401 && error.fieldErrors?.code) {
        setFormError('That code is not valid. Check your authenticator app and try again.');
      } else if (error.status === 401) {
        // The 5-minute challenge ran out (or was rejected): start again
        backToPassword();
        setFormError('Your login session has expired. Please log in again.');
      } else {
        setFormError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (challengeToken) {
    return (
      <section className="card">
        <h1>Two-step verification</h1>
        <p className="hint">
          Open your authenticator app and enter the 6-digit code for HustleHub+.
        </p>

        <FormError message={formError} />

        <form onSubmit={handleCodeSubmit} noValidate>
          <div className="field">
            <label htmlFor="two-factor-code">6-digit code</label>
            <input
              id="two-factor-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
            />
          </div>

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <p className="form-footer">
          <button type="button" className="btn-link" onClick={backToPassword}>
            Back to log in
          </button>
        </p>
      </section>
    );
  }

  let submitLabel = 'Log in';
  if (submitting) submitLabel = 'Logging in…';
  else if (isLocked) submitLabel = 'Locked';

  return (
    <section className="card">
      <h1>Log in</h1>

      {justRegistered && (
        <div className="alert alert-success" role="status">
          Account created. You can now log in.
        </div>
      )}

      <FormError message={formError} />

      {isLocked && (
        <div className="alert alert-error" role="alert">
          <strong>Account temporarily locked.</strong> Too many failed login
          attempts were made on this account. You can try again
          in <span aria-live="off">{formatCountdown(lockSecondsLeft)}</span>.
        </div>
      )}

      {/* noValidate: use our own messages instead of the browser's pop-ups */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <span id="email-error" className="field-error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <span id="password-error" className="field-error">{fieldErrors.password}</span>
          )}
        </div>

        <button type="submit" className="btn" disabled={submitting || isLocked}>
          {submitLabel}
        </button>
      </form>

      <p className="form-footer">
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </section>
  );
}