import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const T_RULES = BUSINESS_RULES.TUTORING;

export const requestSessionSchema = z
  .object({
    tutor_id: z.string().uuid('Identificador de tutor inválido'),
    subject_id: z.string().trim().min(1, 'La materia es obligatoria'),
    scheduled_at: z.string().datetime({ message: 'Fecha programada debe tener formato ISO 8601' }),
    duration_minutes: z
      .number()
      .int()
      .min(T_RULES.MIN_DURATION_MINUTES, `La duración mínima es de ${T_RULES.MIN_DURATION_MINUTES} minutos`)
      .max(T_RULES.MAX_DURATION_MINUTES, `La duración máxima es de ${T_RULES.MAX_DURATION_MINUTES} minutos`)
      .default(T_RULES.DEFAULT_DURATION_MINUTES),
    modality: z.enum(['online', 'in_person', 'hybrid']).default('online'),
    notes: z.string().trim().max(1000, 'Las notas no pueden superar 1000 caracteres').optional(),
  })
  .strict();

export const updateSessionStatusSchema = z
  .object({
    status: z.enum(['accepted', 'rejected', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'Estado inválido. Opciones: accepted, rejected, completed, cancelled' }),
    }),
    cancellation_reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const submitReviewSchema = z
  .object({
    rating: z.number().int().min(T_RULES.RATING.MIN).max(T_RULES.RATING.MAX, `La calificación debe ser un entero entre ${T_RULES.RATING.MIN} y ${T_RULES.RATING.MAX}`),
    comment: z.string().trim().min(3, 'El comentario debe tener al menos 3 caracteres').max(1000),
    punctuality_rating: z.number().int().min(T_RULES.RATING.MIN).max(T_RULES.RATING.MAX).optional(),
    clarity_rating: z.number().int().min(T_RULES.RATING.MIN).max(T_RULES.RATING.MAX).optional(),
    empathy_rating: z.number().int().min(T_RULES.RATING.MIN).max(T_RULES.RATING.MAX).optional(),
  })
  .strict();

export const registerAttendanceSchema = z
  .object({
    session_id: z.string().uuid('ID de sesión inválido'),
    action: z.enum(['join', 'leave', 'heartbeat']),
    elapsed_minutes: z.number().min(0).max(T_RULES.MAX_DURATION_MINUTES).optional(),
  })
  .strict();
