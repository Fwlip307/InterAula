import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { learningSpaceController } from '../controllers/learningSpace.controller.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

// Todas las rutas de Mi espacio de aprendizaje son privadas y requieren autenticación
router.use(requireAuth);

router.get('/overview', learningSpaceController.getOverview);
router.put('/config', learningSpaceController.updateConfig);

router.post('/paths', learningSpaceController.createPath);
router.patch('/paths/:pathId', learningSpaceController.updatePath);
router.post('/paths/:pathId/stages', learningSpaceController.addStage);
router.patch('/paths/:pathId/stages/:stageId', learningSpaceController.toggleStage);
router.delete('/paths/:pathId', learningSpaceController.deletePath);

router.post('/tasks', learningSpaceController.createTask);
router.patch('/tasks/:taskId', learningSpaceController.updateTask);
router.delete('/tasks/:taskId', learningSpaceController.deleteTask);

router.post('/assessments', learningSpaceController.recordAssessment);
router.put('/topics', learningSpaceController.recordAssessment);
router.post('/explain', createRateLimiter(20), learningSpaceController.explainAdaptively);

// Bandeja de ideas y dudas para después
router.get('/ideas', learningSpaceController.listQuickIdeas);
router.post('/ideas', learningSpaceController.createQuickIdea);
router.patch('/ideas/:ideaId', learningSpaceController.updateQuickIdea);
router.delete('/ideas/:ideaId', learningSpaceController.deleteQuickIdea);
router.post('/ideas/:ideaId/convert-to-task', learningSpaceController.convertQuickIdeaToTask);

export default router;

