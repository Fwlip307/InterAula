import { Router } from 'express';
import { tutoringController } from '../controllers/tutoring.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  requestSessionSchema,
  updateSessionStatusSchema,
  submitReviewSchema,
  registerAttendanceSchema,
} from '../schemas/tutoring.schema.js';

const router = Router();

// Explorar tutores disponibles
router.get('/tutors', tutoringController.getAvailableTutors);

// Sesiones del usuario autenticado (estudiante o tutor)
router.get('/my-sessions', requireAuth, tutoringController.getMySessions);

// Solicitar nueva sesión de tutoría (con validación anti-solapamiento)
router.post(
  '/sessions',
  requireAuth,
  validateRequest({ body: requestSessionSchema }),
  tutoringController.requestSession
);

// Actualizar estado de sesión (aceptar, rechazar, completar, cancelar con autorización estricta)
router.patch(
  '/sessions/:id/status',
  requireAuth,
  validateRequest({ body: updateSessionStatusSchema }),
  tutoringController.updateSessionStatus
);

// Enviar reseña y calificación tras sesión completada
router.post(
  '/sessions/:id/reviews',
  requireAuth,
  validateRequest({ body: submitReviewSchema }),
  tutoringController.submitReview
);

// Registrar asistencia / heartbeat en aula virtual
router.post(
  '/sessions/attendance',
  requireAuth,
  validateRequest({ body: registerAttendanceSchema }),
  tutoringController.registerAttendance
);

export default router;
