import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { linksForRole } from '../navigation';

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          HustleHub+
        </NavLink>

        {isAuthenticated && (
          <nav aria-label="Main">
            <ul className="nav-links">
              {linksForRole(user.role).map((link) => (
                <li key={link.to}>
                  {/* "end" stops "/" from looking active on every page */}
                  <NavLink to={link.to} end>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="nav-user">
          {isAuthenticated ? (
            <>
              <span className="role-badge">{user.role}</span>
              <button type="button" className="btn-link" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}