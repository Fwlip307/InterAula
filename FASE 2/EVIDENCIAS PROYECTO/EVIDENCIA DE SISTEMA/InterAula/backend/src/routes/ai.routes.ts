import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { aiEvaluateAnswerSchema } from '../schemas/ai.schema.js';

const router = Router();

// Evaluación semántica segura de respuestas de acreditación (requiere sesión)
router.post(
  '/evaluate-answer',
  requireAuth,
  validateRequest({ body: aiEvaluateAnswerSchema }),
  aiController.evaluateAnswer
);

export default router;
