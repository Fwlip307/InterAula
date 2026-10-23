import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { supabasePublic, getAuthenticatedSupabase } from '../lib/supabase.js';

/**
 * Middleware que verifica de forma oficial y estricta el token JWT de Supabase Auth.
 * Rechaza cualquier solicitud sin token o con token expirado/adulterado.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: Se requiere una sesión activa con token Bearer.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: Formato de autorización inválido.',
      });
      return;
    }

    // Verificación criptográfica oficial con el servidor de Supabase Auth
    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: Sesión inválida o expirada. Por favor inicie sesión nuevamente.',
      });
      return;
    }

    // Inyectar usuario verificado e inmutable en la petición
    req.user = {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
      app_metadata: data.user.app_metadata,
    };
    req.token = token;

    next();
  } catch {
    res.status(500).json({
      success: false,
      error: 'Error interno verificando la autenticación del usuario.',
    });
  }
}

/**
 * Middleware opcional: si el cliente envía token, lo valida y adjunta el usuario.
 * Si no lo envía, permite continuar como usuario anónimo.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const { data, error } = await supabasePublic.auth.getUser(token);
    if (!error && data?.user) {
      req.user = {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
        app_metadata: data.user.app_metadata,
      };
      req.token = token;
    }
  } catch {
    // Si falla la verificación opcional, continúa como anónimo
  }

  next();
}

/**
 * Middleware que verifica si el usuario autenticado posee rol de tutor verificado
 * o validador académico en la base de datos antes de permitir una operación sensible.
 */
export async function requireVerifiedTutorOrValidator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.token) {
    res.status(401).json({ success: false, error: 'No autenticado.' });
    return;
  }

  try {
    const client = getAuthenticatedSupabase(req.token);

    // 1. Comprobar si tiene al menos una materia acreditada
    const { data: offered } = await client
      .from('profile_offered_subjects')
      .select('id')
      .eq('profile_id', req.user.id)
      .eq('is_verified', true)
      .limit(1);

    if (offered && offered.length > 0) {
      return next();
    }

    // 2. Comprobar si es validador académico
    const { data: validator } = await client
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', req.user.id)
      .limit(1);

    if (validator && validator.length > 0) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'Acceso denegado: Esta operación requiere acreditación formal como tutor o validador docente.',
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Error verificando privilegios del tutor.',
    });
  }
}

/**
 * Middleware que verifica si el usuario autenticado posee rol de docente validador académico
 * registrado en la tabla academic_validators o rol administrativo.
 */
export async function requireAcademicValidator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.token) {
    res.status(401).json({ success: false, error: 'No autenticado.' });
    return;
  }

  // Bypass para roles administrativos o docentes verificados por metadatos del token
  if (req.user.role === 'admin' || req.user.role === 'teacher') {
    return next();
  }

  try {
    const client = getAuthenticatedSupabase(req.token);
    const { data: validator } = await client
      .from('academic_validators')
      .select('profile_id')
      .eq('profile_id', req.user.id)
      .limit(1);

    if (validator && validator.length > 0) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'Acceso denegado: Se requiere rol de docente validador académico.',
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Error verificando privilegios de validador académico.',
    });
  }
}

