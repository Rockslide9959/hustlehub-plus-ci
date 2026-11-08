import { createContext } from 'react';

// Shared "who is logged in" state. The value is provided by AuthProvider.
export const AuthContext = createContext(null);