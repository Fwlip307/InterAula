import { Router } from 'express';
import { workshopController } from '../controllers/workshop.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createWorkshopSchema,
  updateWorkshopStatusSchema,
} from '../schemas/workshop.schema.js';

const router = Router();

// Próximos talleres (público / auth opcional para marcar is_enrolled)
router.get('/', optionalAuth, workshopController.getUpcomingWorkshops);

// Mis talleres inscritos (como estudiante)
router.get('/me/as-student', requireAuth, workshopController.getMyWorkshopsAsStudent);

// Mis talleres creados (como tutor)
router.get('/me/as-tutor', requireAuth, workshopController.getMyWorkshopsAsTutor);

// Detalle de taller por ID o room_id
router.get('/:id', optionalAuth, workshopController.getWorkshopById);

// Crear nuevo taller (requiere autenticación)
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createWorkshopSchema }),
  workshopController.createWorkshop
);

// Inscribirse en taller (con validación de cupo y anti-dueño)
router.post('/:id/enroll', requireAuth, workshopController.enroll);

// Cancelar inscripción en taller
router.delete('/:id/enroll', requireAuth, workshopController.unenroll);

// Cambiar estado del taller
router.patch(
  '/:id/status',
  requireAuth,
  validateRequest({ body: updateWorkshopStatusSchema }),
  workshopController.updateStatus
);

// Eliminar taller programado
router.delete('/:id', requireAuth, workshopController.deleteWorkshop);

export default router;
