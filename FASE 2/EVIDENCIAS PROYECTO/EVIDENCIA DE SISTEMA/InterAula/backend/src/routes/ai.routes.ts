import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  aiGenerateQuestionsSchema,
  aiGenerateQuizSchema,
  aiEvaluateAnswerSchema,
  aiBreakdownTaskSchema,
} from '../schemas/ai.schema.js';

const router = Router();

// Estado del motor de IA
router.get('/status', aiController.getStatus);
router.use(requireAuth, createRateLimiter());

// Generar preguntas de retos o acreditación técnica
router.post(
  '/generate-questions',
  validateRequest({ body: aiGenerateQuestionsSchema }),
  aiController.generateQuestions
);

// Generar micro-quizzes adaptativos DUA por temática
router.post(
  '/generate-quiz',
  validateRequest({ body: aiGenerateQuizSchema }),
  aiController.generateQuiz
);

// Evaluación semántica de respuestas redactadas
router.post(
  '/evaluate-answer',
  validateRequest({ body: aiEvaluateAnswerSchema }),
  aiController.evaluateAnswer
);

// Dividir actividad grande en microtareas con IA
router.post(
  '/breakdown-task',
  validateRequest({ body: aiBreakdownTaskSchema }),
  aiController.breakdownTask
);

export default router;
