import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from '../components/routing/ProtectedRoute';
import PublicOnlyRoute from '../components/routing/PublicOnlyRoute';

import Home from '../pages/Home';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import UpdatePassword from '../pages/auth/UpdatePassword';
import AuthCallback from '../pages/auth/AuthCallback';
import Dashboard from '../pages/Dashboard';

// Configuración de enrutamiento para InterAula
export default function AppRouter() {
  return (
    <Routes>
      {/* Ruta principal */}
      <Route path="/" element={<Home />} />

      {/* Rutas de autenticación dentro del layout */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPassword />
            </PublicOnlyRoute>
          }
        />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>

      {/* Ruta privada protegida */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback para cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
