import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const W_RULES = BUSINESS_RULES.WORKSHOPS;

export const createWorkshopSchema = z
  .object({
    subject_id: z.string().trim().min(1, 'La materia es obligatoria'),
    title: z.string().trim().min(4, 'El título debe tener al menos 4 caracteres').max(150),
    description: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres').max(2000).optional(),
    scheduled_at: z.string().datetime({ message: 'Fecha programada debe tener formato ISO 8601' }),
    duration_minutes: z.number().int().min(W_RULES.MIN_DURATION_MINUTES).max(W_RULES.MAX_DURATION_MINUTES).default(W_RULES.DEFAULT_DURATION_MINUTES),
    max_students: z.number().int().min(W_RULES.MIN_CAPACITY, `Debe admitir al menos ${W_RULES.MIN_CAPACITY} estudiantes`).max(W_RULES.MAX_CAPACITY).optional(),
    max_participants: z.number().int().min(W_RULES.MIN_CAPACITY).max(W_RULES.MAX_CAPACITY).optional(),
    modality: z.enum(['online', 'in_person', 'hybrid']).default('online').optional(),
    location_details: z.string().trim().max(300).optional(),
  })
  .strict();

export const updateWorkshopStatusSchema = z
  .object({
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'Estado inválido. Opciones: scheduled, in_progress, completed, cancelled' }),
    }),
  })
  .strict();
