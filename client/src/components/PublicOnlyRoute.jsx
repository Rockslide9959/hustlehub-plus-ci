import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Login and Register make no sense when already logged in.
// If ProtectedRoute sent the user here, return them to the page they wanted;
// otherwise go to the dashboard.
export default function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const redirectTo = location.state?.from?.pathname || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}