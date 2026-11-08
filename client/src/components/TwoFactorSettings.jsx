import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  startTwoFactorSetup,
} from '../api/twoFactorApi';
import FormError from './FormError';

// Two-factor authentication settings on the profile page.
// States: loading -> off -> setting up (QR code) -> on -> turning off -> off
//
// The QR code and setup key are only kept in this component's memory while
// setting up. They are never saved in storage and are cleared once finished.

// Keeps digits only, at most 6, so the box can only ever hold a valid code
const cleanCode = (value) => value.replace(/\D/g, '').slice(0, 6);

export default function TwoFactorSettings() {
  const { token, logout } = useAuth();

  const [enabled, setEnabled] = useState(null); // null while loading
  const [setup, setSetup] = useState(null); // { qrCode, manualEntryKey }
  const [showDisable, setShowDisable] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTwoFactorStatus(token)
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data.enabled));
      })
      .catch((err) => {
        if (cancelled) return;
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

  // Runs one request with shared busy, error and expired-session handling
  async function run(request) {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      return await request();
    } catch (err) {
      if (err.status === 401) {
        logout();
        return null;
      }
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function resetForms() {
    setSetup(null);
    setShowDisable(false);
    setCode('');
    setPassword('');
  }

  async function handleStartSetup() {
    const data = await run(() => startTwoFactorSetup(token));
    if (data) {
      setSetup({ qrCode: data.qrCode, manualEntryKey: data.manualEntryKey });
    }
  }

  async function handleEnable(event) {
    event.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    const data = await run(() => enableTwoFactor(token, code));
    if (data) {
      resetForms();
      setEnabled(true);
      setSuccess('Two-factor authentication is now on. You will need a code each time you log in.');
    } else {
      setCode('');
    }
  }

  async function handleDisable(event) {
    event.preventDefault();
    if (!password || code.length !== 6) {
      setError('Enter your password and a 6-digit code to turn two-factor authentication off.');
      return;
    }
    const data = await run(() => disableTwoFactor(token, { password, code }));
    if (data) {
      resetForms();
      setEnabled(false);
      setSuccess('Two-factor authentication is now off.');
    } else {
      setCode('');
      setPassword('');
    }
  }

  function handleCancel() {
    resetForms();
    setError('');
  }

  return (
    <section className="card card-wide two-factor" aria-labelledby="two-factor-heading">
      <h2 id="two-factor-heading">Two-factor authentication</h2>
      <p className="hint">
        Adds a second step to logging in: after your password, you enter a 6-digit
        code from an authenticator app (Google Authenticator, Microsoft
        Authenticator or Authy). A stolen password alone is then not enough.
      </p>

      <FormError message={error} />
      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      {enabled === null && !error && <p className="muted">Loading…</p>}

      {enabled === false && !setup && (
        <>
          <p>
            Status: <strong>Off</strong>
          </p>
          <button type="button" className="btn btn-inline" onClick={handleStartSetup} disabled={busy}>
            {busy ? 'Preparing…' : 'Turn on two-factor authentication'}
          </button>
        </>
      )}

      {enabled === false && setup && (
        <form onSubmit={handleEnable} noValidate>
          <ol className="two-factor-steps">
            <li>Open your authenticator app and add a new account.</li>
            <li>
              Scan this QR code:
              <img
                className="two-factor-qr"
                src={setup.qrCode}
                alt="QR code to add HustleHub+ to your authenticator app"
                width="220"
                height="220"
              />
              <span className="hint">
                Can&apos;t scan it? Type this key into the app instead:{' '}
                <code className="two-factor-key">{setup.manualEntryKey}</code>
              </span>
            </li>
            <li>Enter the 6-digit code the app shows to finish.</li>
          </ol>

          <div className="field">
            <label htmlFor="two-factor-enable-code">6-digit code</label>
            <input
              id="two-factor-enable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
            />
          </div>

          <div className="two-factor-actions">
            <button type="submit" className="btn btn-inline" disabled={busy}>
              {busy ? 'Checking…' : 'Confirm and turn on'}
            </button>
            <button type="button" className="btn btn-inline btn-secondary" onClick={handleCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {enabled === true && !showDisable && (
        <>
          <p>
            Status: <strong>On</strong>
          </p>
          <button
            type="button"
            className="btn btn-inline btn-secondary"
            onClick={() => {
              setShowDisable(true);
              setSuccess('');
            }}
          >
            Turn off two-factor authentication
          </button>
        </>
      )}

      {enabled === true && showDisable && (
        <form onSubmit={handleDisable} noValidate>
          <p className="hint">
            For your safety, turning this off needs your password and a current code.
          </p>

          <div className="field">
            <label htmlFor="two-factor-disable-password">Password</label>
            <input
              id="two-factor-disable-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="two-factor-disable-code">6-digit code</label>
            <input
              id="two-factor-disable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
            />
          </div>

          <div className="two-factor-actions">
            <button type="submit" className="btn btn-inline btn-danger" disabled={busy}>
              {busy ? 'Checking…' : 'Turn off'}
            </button>
            <button type="button" className="btn btn-inline btn-secondary" onClick={handleCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
