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

const reviewScore=z.number().int().min(T_RULES.RATING.MIN).max(T_RULES.RATING.MAX);
export const submitReviewSchema=z.object({
 communication_score:reviewScore,
 knowledge_score:reviewScore,
 punctuality_score:reviewScore,
 comment:z.string().trim().max(1000).nullable().optional(),
}).strict();

export const registerAttendanceSchema = z
  .object({
    session_id: z.string().uuid('ID de sesión inválido'),
    action: z.enum(['join', 'leave', 'heartbeat']),
    elapsed_minutes: z.number().min(0).max(T_RULES.MAX_DURATION_MINUTES).optional(),
  })
  .strict();

export const agendaPreviewSchema = z
  .object({
    what_we_will_see: z.string().trim().min(2).max(600),
    step_by_step: z.string().trim().min(2).max(1200),
    how_it_ends: z.string().trim().min(2).max(600),
  })
  .strict();

export const anticipatedMaterialItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(2).max(180),
    kind: z.enum(['resumen', 'diapositivas', 'guia', 'temario', 'pdf', 'complementario']).default('guia'),
    file_url: z.string().trim().max(500).optional(),
    file_name: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(400).optional(),
    added_at: z.string().optional(),
  })
  .strict();

export const updateSessionPrepSchema = z
  .object({
    agenda_preview: agendaPreviewSchema.nullable().optional(),
    camera_policy: z.enum(['optional', 'recommended', 'required', 'off']).optional(),
    participation_mode: z.enum(['mixed', 'chat_first', 'voice_or_chat', 'chat_only', 'chat_or_voice', 'voice_preferred']).transform(value => ({chat_only:'chat_first',chat_or_voice:'mixed',voice_preferred:'voice_or_chat'} as Record<string,string>)[value] || value).optional(),
    participation_rules: z.string().trim().max(600).nullable().transform(value => value ?? '').optional(),
    anticipated_materials: z.array(z.union([z.string().trim().min(1).max(500), anticipatedMaterialItemSchema.transform(item => item.file_url || item.title)])).max(15).optional(),
  })
  .strict();

export const classroomSignalSchema = z
  .object({
    signal: z.enum(['green', 'yellow', 'blue', 'red']),
  })
  .strict();
