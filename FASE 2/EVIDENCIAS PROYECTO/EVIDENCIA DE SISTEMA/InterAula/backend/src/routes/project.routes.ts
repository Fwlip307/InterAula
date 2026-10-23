import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createProjectSchema,
  applyToProjectSchema,
  reviewApplicationSchema,
} from '../schemas/project.schema.js';

const router = Router();

// Proyectos públicos activos
router.get('/', projectController.getProjects);

// Proyectos creados por el usuario
router.get('/me', requireAuth, projectController.getMyProjects);

// Postulaciones enviadas por el usuario
router.get('/my-applications', requireAuth, projectController.getMyApplications);

// Detalle de un proyecto por ID
router.get('/:id', optionalAuth, projectController.getProjectById);

// Vacantes de un proyecto
router.get('/:id/positions', projectController.getProjectPositions);

// Miembros de un proyecto
router.get('/:id/members', projectController.getProjectMembers);

// Crear proyecto colaborativo
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createProjectSchema }),
  projectController.createProject
);

// Postular a una vacante
router.post(
  '/:id/positions/:positionId/apply',
  requireAuth,
  validateRequest({ body: applyToProjectSchema }),
  projectController.applyToPosition
);

// Retirar postulación propia
router.patch('/applications/:applicationId/withdraw', requireAuth, projectController.withdrawApplication);

// Resolver postulación (solo el creador del proyecto)
router.patch(
  '/applications/:applicationId/review',
  requireAuth,
  validateRequest({ body: reviewApplicationSchema }),
  projectController.reviewApplication
);

// Eliminar proyecto (solo el creador)
router.delete('/:id', requireAuth, projectController.deleteProject);

export default router;
