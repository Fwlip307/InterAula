import { z } from 'zod';

export const aiGenerateQuestionsSchema = z
  .object({
    subject_id: z.string().trim().max(300).optional(),
    subject_name: z.string().trim().min(1, 'Se requiere el nombre de la asignatura').max(150),
    level: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate'),
    count: z.number().int().min(1).max(20).default(10),
    context: z
      .object({
        institution: z.string().trim().max(300).optional(),
        career: z.string().trim().max(300).optional(),
      })
      .optional(),
  });

export const aiGenerateQuizSchema = z
  .object({
    subject_name: z.string().trim().min(1, 'Se requiere el nombre de la asignatura').max(150),
    theme_id: z.string().trim().min(1, 'Se requiere el identificador de temática'),
    topic: z.string().trim().max(300).optional(),
    count: z.number().int().min(1).max(10).default(3),
  });

export const aiEvaluateAnswerSchema = z
  .object({
    question: z.string().trim().min(3, 'Pregunta requerida').max(3000),
    answer: z.string().trim().min(1, 'Respuesta requerida').max(6000),
    rubric: z.string().trim().max(3000).optional(),
    level: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  });

export const aiBreakdownTaskSchema = z
  .object({
    title: z.string().trim().min(3, 'Describe la actividad que deseas dividir').max(250),
    subject_name: z.string().trim().max(150).optional().default('General'),
    context: z.string().trim().max(500).optional(),
  });
