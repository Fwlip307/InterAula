import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from '../components/routing/ProtectedRoute';
import PublicOnlyRoute from '../components/routing/PublicOnlyRoute';
import AppLayout from '../components/layout/AppLayout';

// Carga diferida (lazy loading) para reducir el tamaño del bundle inicial
const Home = lazy(() => import('../pages/Home'));
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const UpdatePassword = lazy(() => import('../pages/auth/UpdatePassword'));
const AuthCallback = lazy(() => import('../pages/auth/AuthCallback'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const ProfileView = lazy(() => import('../pages/profile/ProfileView'));
const PublicProfile = lazy(() => import('../pages/profile/PublicProfile'));
const TutoringExplore = lazy(() => import('../pages/tutoring/TutoringExplore'));
const MyTutoring = lazy(() => import('../pages/tutoring/MyTutoring'));
const VirtualClassroom = lazy(() => import('../pages/tutoring/VirtualClassroom'));
const Resources = lazy(() => import('../pages/resources/Resources'));
const Settings = lazy(() => import('../pages/settings/Settings'));
const Forum = lazy(() => import('../pages/forum/Forum'));
const ProjectsHub = lazy(() => import('../pages/projects/ProjectsHub'));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: '#64748b',
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Cargando InterAula...</span>
    </div>
  );
}

// Configuración de enrutamiento para InterAula (Sprint 1: Autenticación y Perfiles)
export default function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
          <Route path="/profile/edit" element={<Navigate to="/profile?edit=true" replace />} />
          <Route path="/profile/:id" element={<PublicProfile />} />
          <Route path="/users/:id" element={<PublicProfile />} />
          <Route path="/projects" element={<ProjectsHub />} />
          <Route path="/tutoring" element={<TutoringExplore />} />
          <Route path="/learning" element={<Navigate to="/tutoring" replace />} />
          <Route path="/my-tutoring" element={<MyTutoring />} />
          <Route path="/tutor" element={<Navigate to="/my-tutoring" replace />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Aula Virtual de Tutoría (experiencia full-screen dedicada y abierta a invitados) */}
        <Route
          path="/tutoring/room/:sessionId"
          element={<VirtualClassroom />}
        />

        {/* Fallback para cualquier otra ruta */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
