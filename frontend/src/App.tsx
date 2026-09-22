import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { CourtsPage } from './pages/CourtsPage';
import { LoginPage } from './pages/LoginPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuth } from './useAuth';

const Loading = () => (
  <p className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</p>
);

// Sin sesión solo se ven el inicio de sesión y el registro.
const RequireAuth = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

const PublicOnly = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/canchas" replace /> : <Outlet />;
};

export const App = () => (
  <Routes>
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route path="/canchas" element={<CourtsPage />} />
      <Route path="/mis-reservas" element={<MyReservationsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/canchas" replace />} />
  </Routes>
);
