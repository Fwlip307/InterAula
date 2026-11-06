import { z } from 'zod';

export const explanationModeEnum = z.enum([
  'sencilla',
  'paso_a_paso',
  'ejemplos',
  'visual',
  'profunda',
  'comprobar',
]);

export const learningPaceEnum = z.enum(['paso_a_paso', 'constante', 'intensivo']);

export const updateLearningSpaceConfigSchema = z.object({
  onboardingCompleted: z.boolean().optional(),
  shareWithTutors: z.boolean().optional(),
  explanationStyle: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  organizationStyle: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  communicationStyle: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  environmentStyle: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  defaultStudyIntervalMinutes: z.number().int().min(5).max(180).optional(),
  defaultBreakMinutes: z.number().int().min(1).max(60).optional(),
  subjectsToReinforce: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  learningGoalSummary: z.string().trim().max(500).optional(),
});

export const createLearningPathSchema = z.object({
  subject_id: z.string().trim().max(120).optional().nullable(),
  subject_name: z.string().trim().min(2, 'Debes indicar la asignatura').max(150),
  title: z.string().trim().min(3, 'El título de la ruta debe tener al menos 3 caracteres').max(180),
  goal: z.string().trim().min(5, 'Describe qué deseas lograr o reforzar').max(600),
  pace: learningPaceEnum.optional().default('paso_a_paso'),
  preferred_mode: explanationModeEnum.optional().default('sencilla'),
  stages: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(180),
        description: z.string().trim().max(600).optional().default(''),
        content_topic: z.string().trim().max(200).optional().default(''),
        practice_prompt: z.string().trim().max(400).optional().default(''),
      })
    )
    .max(12)
    .optional(),
});

export const updateLearningPathSchema = z.object({
  subject_name: z.string().trim().min(2).max(150).optional(),
  title: z.string().trim().min(3).max(180).optional(),
  goal: z.string().trim().min(5).max(600).optional(),
  pace: learningPaceEnum.optional(),
  preferred_mode: explanationModeEnum.optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
});

export const addLearningStageSchema = z.object({
  title: z.string().trim().min(2, 'El título de la etapa debe tener al menos 2 caracteres').max(180),
  description: z.string().trim().max(600).optional().default(''),
  content_topic: z.string().trim().max(200).optional().default(''),
  practice_prompt: z.string().trim().max(400).optional().default(''),
});

export const toggleLearningStageSchema = z.object({
  completed: z.boolean(),
});

export const createStudyTaskSchema = z.object({
  subject_name: z.string().trim().min(2).max(150).optional().default('General'),
  title: z.string().trim().min(3, 'El título de la tarea debe tener al menos 3 caracteres').max(200),
  priority: z.enum(['baja', 'media', 'alta']).optional().default('media'),
  study_interval_minutes: z.number().int().min(5).max(180).optional().default(20),
  break_minutes: z.number().int().min(1).max(60).optional().default(5),
  subtasks: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1).max(200),
        completed: z.boolean().optional().default(false),
      })
    )
    .max(25)
    .optional(),
});

export const updateStudyTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  subject_name: z.string().trim().min(2).max(150).optional(),
  priority: z.enum(['baja', 'media', 'alta']).optional(),
  status: z.enum(['pending', 'in_progress', 'paused', 'completed']).optional(),
  study_interval_minutes: z.number().int().min(5).max(180).optional(),
  break_minutes: z.number().int().min(1).max(60).optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        completed: z.boolean(),
      })
    )
    .max(25)
    .optional(),
});

export const recordTopicAssessmentSchema = z.object({
  subject_name: z.string().trim().min(2).max(150),
  topic_name: z.string().trim().min(2).max(180),
  score: z.number().int().min(0).max(100),
  total_questions: z.number().int().min(1).max(50),
  recurring_errors: z.array(z.string().trim().min(1).max(200)).max(15).optional().default([]),
});

export const adaptiveExplanationRequestSchema = z.object({
  subject_name: z.string().trim().min(2).max(150),
  topic: z.string().trim().min(2).max(220),
  mode: explanationModeEnum,
  goal: z.string().trim().max(400).optional(),
});

export type UpdateLearningSpaceConfigInput = z.input<typeof updateLearningSpaceConfigSchema>;
export type CreateLearningPathInput = z.input<typeof createLearningPathSchema>;
export type UpdateLearningPathInput = z.input<typeof updateLearningPathSchema>;
export type AddLearningStageInput = z.input<typeof addLearningStageSchema>;
export type CreateStudyTaskInput = z.input<typeof createStudyTaskSchema>;
export type UpdateStudyTaskInput = z.input<typeof updateStudyTaskSchema>;
export type RecordTopicAssessmentInput = z.input<typeof recordTopicAssessmentSchema>;
export type AdaptiveExplanationRequestInput = z.input<typeof adaptiveExplanationRequestSchema>;

