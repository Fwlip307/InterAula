import { Navigate } from 'react-router-dom';

/**
 * Componente heredado de redirección.
 * La edición de perfil se encuentra totalmente unificada en ProfileView (/profile?edit=true).
 */
export default function ProfileEdit() {
  return <Navigate to="/profile?edit=true" replace />;
}
