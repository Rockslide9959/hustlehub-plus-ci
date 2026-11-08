import { Route, Routes } from 'react-router-dom';
import { ROLES, ALL_ROLES } from './auth/roles';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import GigsPage from './pages/GigsPage';
import GigDetailPage from './pages/GigDetailPage';
import MyGigsPage from './pages/MyGigsPage';
import GigFormPage from './pages/GigFormPage';
import BookingsPage from './pages/BookingsPage';
import IncomePage from './pages/IncomePage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          {/* Only for logged-out users */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Any logged-in user */}
          <Route element={<ProtectedRoute roles={ALL_ROLES} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/gigs" element={<GigsPage />} />
            <Route path="/gigs/:id" element={<GigDetailPage />} />
          </Route>

          {/* Freelancers only */}
          <Route element={<ProtectedRoute roles={[ROLES.FREELANCER]} />}>
          <Route path="/income" element={<IncomePage />} />
            <Route 
              path="/gigs/mine" 
              element={<MyGigsPage />}
             />
            <Route 
              path="/gigs/new" 
              element={<GigFormPage />}
             />
            <Route 
              path="/gigs/:id/edit" 
              element={<GigFormPage />}
            />
          </Route>


          {/* Clients and freelancers */}
          <Route element={<ProtectedRoute roles={[ROLES.CLIENT, ROLES.FREELANCER]} />}>
          <Route path="/bookings" element={<BookingsPage />} />
          </Route>

         {/* Admins only */}
          <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
      </main>
    </>
  );
}