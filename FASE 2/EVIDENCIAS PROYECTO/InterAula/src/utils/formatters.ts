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
