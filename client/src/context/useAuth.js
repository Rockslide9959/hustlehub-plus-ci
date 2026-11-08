import { useContext } from 'react';
import { AuthContext } from './authContext';

// Any component can call useAuth() to get the user, token, login and logout.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}