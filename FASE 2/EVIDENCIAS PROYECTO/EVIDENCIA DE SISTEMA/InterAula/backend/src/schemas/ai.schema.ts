import { z } from 'zod';

export const aiGenerateQuestionsSchema = z
  .object({
    subject_id: z.string().trim().min(1),
    subject_name: z.string().trim().min(1),
    level: z.enum(['basic', 'intermediate', 'advanced']),
    count: z.number().int().min(1).max(20).default(5),
  })
  .strict();

export const aiEvaluateAnswerSchema = z
  .object({
    question: z.string().trim().min(5),
    answer: z.string().trim().min(1),
    rubric: z.string().trim().optional(),
    level: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  })
  .strict();
