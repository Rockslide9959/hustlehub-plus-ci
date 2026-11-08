import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Wraps routes that need a logged-in user, and optionally specific roles.
// Usage in App.jsx: <Route element={<ProtectedRoute roles={['freelancer']} />}> ... </Route>
export default function ProtectedRoute({ roles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Remember where the user was going, so LoginPage can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  // <Outlet /> renders whichever child route matched.
  return <Outlet />;
}