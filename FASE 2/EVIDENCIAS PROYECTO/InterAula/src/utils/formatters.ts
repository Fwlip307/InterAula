import type { AcademicLevel, Profile } from '../types/profile';

/**
 * Traduce los niveles académicos internos de la base de datos al español para la interfaz.
 */
export function formatAcademicLevel(level: AcademicLevel | string | null | undefined): string {
  switch (level) {
    case 'basic':
      return 'Básico';
    case 'intermediate':
      return 'Intermedio';
    case 'advanced':
      return 'Avanzado';
    default:
      return 'Nivel no especificado';
  }
}

/**
 * Obtiene el nombre preferido para mostrar de un usuario según la jerarquía de fallbacks:
 * 1. Nombres y apellidos completos del perfil.
 * 2. Solo nombres del perfil.
 * 3. Nombre de usuario / alias (display_name).
 * 4. Metadatos de autenticación (Google OAuth o registro).
 * 5. Prefijo del correo electrónico antes de la arroba.
 * 6. 'Estudiante' por defecto.
 */
export function getUserDisplayName(
  profile?: Partial<Profile> | null,
  userMetadata?: { full_name?: string; name?: string } | null,
  email?: string | null
): string {
  if (profile) {
    const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (profile.first_name?.trim()) return profile.first_name.trim();
    if (profile.display_name?.trim()) return profile.display_name.trim();
  }

  if (userMetadata?.full_name?.trim()) return userMetadata.full_name.trim();
  if (userMetadata?.name?.trim()) return userMetadata.name.trim();

  if (email) {
    const prefix = email.split('@')[0];
    if (prefix) return prefix;
  }

  return 'Estudiante';
}

/**
 * Obtiene la inicial mayúscula para avatares a partir de un nombre o correo.
 */
export function getUserInitial(nameOrEmail?: string | null): string {
  if (!nameOrEmail || !nameOrEmail.trim()) return 'U';
  return nameOrEmail.trim().charAt(0).toUpperCase();
}

/**
 * Mapeo de estados de tutoría a etiquetas legibles y clases CSS semánticas.
 */
export function formatTutoringStatus(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pendiente', className: 'status-pending' };
    case 'accepted':
      return { label: 'Aceptada', className: 'status-accepted' };
    case 'rejected':
      return { label: 'Rechazada', className: 'status-rejected' };
    case 'completed':
      return { label: 'Completada', className: 'status-completed' };
    case 'cancelled':
      return { label: 'Cancelada', className: 'status-cancelled' };
    default:
      return { label: status || 'Desconocido', className: 'status-default' };
  }
}

/**
 * Formatea fechas de tutoría para visualización amigable en español.
 */
export function formatTutoringDateTime(dateString?: string | null): string {
  if (!dateString) return 'Fecha no definida';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Fecha inválida';

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Formatea la duración en minutos a un texto legible.
 */
export function formatTutoringDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

/**
 * Formatea la modalidad de la tutoría (online o presencial).
 */
export function formatTutoringModality(modality?: string | null): string {
  switch (modality) {
    case 'online':
      return 'Online';
    case 'in_person':
      return 'Presencial';
    default:
      return modality || 'No especificada';
  }
}

/**
 * Formatea un puntaje de evaluación con 1 decimal o texto para sin evaluaciones.
 */
export function formatRating(score?: number | null): string {
  if (score === null || score === undefined || Number(score) === 0) {
    return 'Aún sin evaluaciones';
  }
  return Number(score).toFixed(1);
}

