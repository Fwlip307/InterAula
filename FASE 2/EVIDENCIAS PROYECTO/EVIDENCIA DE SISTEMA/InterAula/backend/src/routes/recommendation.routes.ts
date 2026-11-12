import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { recommendationController } from '../controllers/recommendation.controller.js';
import {
  recommendationPreferencesSchema,
  recommendationFeedQuery,
  recommendationItemSchema,
} from '../schemas/recommendation.schema.js';

const router = Router();

// Consulta pública del catálogo de temas de recomendación
router.get('/topics', recommendationController.getTopics);

// Endpoints autenticados con limitador de tasa
router.use(requireAuth, createRateLimiter(60));

// Preferencias de personalización
router.get('/preferences', recommendationController.getPreferences);
router.put(
  '/preferences',
  validateRequest({ body: recommendationPreferencesSchema }),
  recommendationController.savePreferences
);

// Feed de recomendaciones personalizadas ("Para Ti")
router.get(
  '/feed',
  validateRequest({ query: recommendationFeedQuery }),
  recommendationController.getFeed
);

// Descarte de sugerencias ("No me interesa")
router.post(
  '/dismissals',
  validateRequest({ body: recommendationItemSchema }),
  recommendationController.dismiss
);
router.delete('/dismissals', recommendationController.restoreAll);
router.delete(
  '/dismissals/:kind/:id',
  validateRequest({ params: recommendationItemSchema }),
  recommendationController.restoreItem
);

export default router;
