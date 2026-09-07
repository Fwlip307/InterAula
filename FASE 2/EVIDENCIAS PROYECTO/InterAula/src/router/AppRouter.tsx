import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from '../components/routing/ProtectedRoute';
import PublicOnlyRoute from '../components/routing/PublicOnlyRoute';
import AppLayout from '../components/layout/AppLayout';

import Home from '../pages/Home';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import UpdatePassword from '../pages/auth/UpdatePassword';
import AuthCallback from '../pages/auth/AuthCallback';
import Dashboard from '../pages/Dashboard';
import ProfileView from '../pages/profile/ProfileView';
import ProfileEdit from '../pages/profile/ProfileEdit';
import PublicProfile from '../pages/profile/PublicProfile';
import ProjectsHub from '../pages/projects/ProjectsHub';
import TutoringExplore from '../pages/tutoring/TutoringExplore';
import MyTutoring from '../pages/tutoring/MyTutoring';
import Resources from '../pages/resources/Resources';
import Settings from '../pages/settings/Settings';

// Configuración de enrutamiento para InterAula (Sprint 1: Autenticación y Perfiles)
export default function AppRouter() {
  return (
    <Routes>
      {/* Ruta pública principal */}
      <Route path="/" element={<Home />} />

      {/* Rutas de autenticación dentro del AuthLayout */}
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

      {/* Rutas privadas protegidas dentro de AppLayout con Navbar y Footer */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<ProfileView />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/users/:id" element={<PublicProfile />} />
        <Route path="/projects" element={<ProjectsHub />} />
        <Route path="/tutoring" element={<TutoringExplore />} />
        <Route path="/my-tutoring" element={<MyTutoring />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Fallback para cualquier otra ruta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
