import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  aiGenerateQuestionsSchema,
  aiGenerateQuizSchema,
  aiEvaluateAnswerSchema,
} from '../schemas/ai.schema.js';

const router = Router();

// Estado del motor de IA
router.get('/status', aiController.getStatus);

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

export default router;
