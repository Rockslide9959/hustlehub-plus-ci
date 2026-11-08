import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { loadSession, saveSession, clearSession, getTokenExpiry } from '../auth/session';
import { loginUser, registerUser } from '../api/authApi';
import { verifyTwoFactorLogin } from '../api/twoFactorApi';

export function AuthProvider({ children }) {
  // Restore a valid session if the page is refreshed.
  const [session, setSession] = useState(() => loadSession());

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const startSession = useCallback((data) => {
    const newSession = { token: data.token, user: data.user };
    saveSession(newSession);
    setSession(newSession);
    return data.user;
  }, []);

  // Step 1: email + password. For an account with two-factor authentication
  // the API returns a short-lived challenge token instead of a login token,
  // so no session is started yet: the caller must ask for the 6-digit code.
  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, challengeToken: data.challengeToken };
    }
    return startSession(data);
  }, [startSession]);

  // Step 2 (2FA accounts only): swap the challenge token + code for a session
  const completeTwoFactorLogin = useCallback(async (challengeToken, code) => {
    const data = await verifyTwoFactorLogin({ challengeToken, code });
    return startSession(data);
  }, [startSession]);

  // Registration does not log the user in; they log in afterwards.
  const register = useCallback((details) => registerUser(details), []);

  // Log the user out automatically when their token expires.
  useEffect(() => {
    if (!session) return undefined;
    const expiry = getTokenExpiry(session.token);
    if (!expiry) return undefined;

    const timer = setTimeout(logout, Math.max(expiry - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      login,
      completeTwoFactorLogin,
      register,
      logout,
    }),
    [session, login, completeTwoFactorLogin, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}