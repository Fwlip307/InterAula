import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const V_RULES = BUSINESS_RULES.VERIFICATION;

export const createVerificationRequestSchema = z
  .object({
    subject_id: z.string().trim().min(1, 'El ID de la materia es obligatorio'),
  })
  .strict();

export const botGrantVerificationSchema = z
  .object({
    subject_id: z.string().trim().min(1, 'El ID de la materia es obligatorio'),
    subject_name: z.string().trim().optional(),
    score: z.number().min(0).max(V_RULES.MAX_BOT_SCORE, `El puntaje debe estar entre 0 y ${V_RULES.MAX_BOT_SCORE}`),
    level: z.enum(['basic', 'intermediate', 'advanced']),
    correct_answers: z.number().int().min(0).optional(),
    total_questions: z.number().int().min(V_RULES.MIN_QUESTIONS).optional(),
    notes: z.string().trim().max(V_RULES.MAX_NOTES_LENGTH).optional(),
  })
  .strict();

export const assignPracticalExerciseSchema = z
  .object({
    practical_exercise_title: z.string().trim().min(V_RULES.PRACTICAL_EXERCISE.MIN_TITLE_LENGTH, `El ejercicio práctico debe tener al menos ${V_RULES.PRACTICAL_EXERCISE.MIN_TITLE_LENGTH} caracteres`).max(V_RULES.PRACTICAL_EXERCISE.MAX_TITLE_LENGTH),
  })
  .strict();

export const submitPracticalEvaluationSchema = z
  .object({
    practical_submission: z.string().trim().min(V_RULES.PRACTICAL_EXERCISE.MIN_SUBMISSION_LENGTH, `La entrega práctica debe tener al menos ${V_RULES.PRACTICAL_EXERCISE.MIN_SUBMISSION_LENGTH} caracteres`),
    defense_notes: z.string().trim().min(V_RULES.PRACTICAL_EXERCISE.MIN_DEFENSE_LENGTH, `La justificación conceptual debe tener al menos ${V_RULES.PRACTICAL_EXERCISE.MIN_DEFENSE_LENGTH} caracteres`),
  })
  .strict();

export const reviewVerificationRequestSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'requires_reevaluation'], {
      errorMap: () => ({ message: 'Estado inválido. Opciones: approved, rejected, requires_reevaluation' }),
    }),
    reviewer_feedback: z.string().trim().min(V_RULES.PRACTICAL_EXERCISE.MIN_FEEDBACK_LENGTH, `La retroalimentación debe tener al menos ${V_RULES.PRACTICAL_EXERCISE.MIN_FEEDBACK_LENGTH} caracteres`).max(V_RULES.PRACTICAL_EXERCISE.MAX_FEEDBACK_LENGTH),
    practical_exercise_title: z.string().trim().max(V_RULES.PRACTICAL_EXERCISE.MAX_TITLE_LENGTH).optional(),
  })
  .strict();

export const saveCertificateExtractionSchema = z
  .object({
    request_id: z.string().uuid('ID de solicitud de verificación inválido').optional(),
    document_path: z.string().trim().min(1, 'Ruta de documento obligatoria'),
    document_filename: z.string().trim().min(1, 'Nombre de archivo obligatorio'),
    document_size_bytes: z.number().int().min(1),
    document_extraction_status: z.string().optional(),
    document_extracted_data: z.any().optional(),
    matched_subject_name: z.string().trim().optional(),
    matched_grade: z.number().min(V_RULES.DOCUMENT.MIN_GRADE).max(V_RULES.DOCUMENT.MAX_GRADE).optional(),
    matched_status: z.string().optional(),
    calculated_level: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  })
  .strict();
