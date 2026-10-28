import { z } from 'zod';

export const aiGenerateQuestionsSchema = z
  .object({
    subject_id: z.string().trim().optional(),
    subject_name: z.string().trim().min(1, 'Se requiere el nombre de la asignatura'),
    level: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate'),
    count: z.number().int().min(1).max(20).default(10),
    context: z
      .object({
        institution: z.string().trim().optional(),
        career: z.string().trim().optional(),
      })
      .optional(),
  });

export const aiGenerateQuizSchema = z
  .object({
    subject_name: z.string().trim().min(1, 'Se requiere el nombre de la asignatura'),
    theme_id: z.string().trim().min(1, 'Se requiere el identificador de temática'),
    count: z.number().int().min(1).max(10).default(3),
  });

export const aiEvaluateAnswerSchema = z
  .object({
    question: z.string().trim().min(3, 'Pregunta requerida'),
    answer: z.string().trim().min(1, 'Respuesta requerida'),
    rubric: z.string().trim().optional(),
    level: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  });
