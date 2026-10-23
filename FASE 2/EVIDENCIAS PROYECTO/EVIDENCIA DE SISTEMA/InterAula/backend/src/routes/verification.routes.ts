import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller.js';
import { requireAuth, optionalAuth, requireAcademicValidator } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createVerificationRequestSchema,
  botGrantVerificationSchema,
  assignPracticalExerciseSchema,
  submitPracticalEvaluationSchema,
  reviewVerificationRequestSchema,
  saveCertificateExtractionSchema,
} from '../schemas/verification.schema.js';

const router = Router();

// Comprobar si un usuario es validador
router.get('/check-validator', optionalAuth, verificationController.checkIsValidator);

// Mis solicitudes de acreditación como tutor
router.get('/my-requests', requireAuth, verificationController.getMyRequests);

// Solicitudes para el panel docente del validador académico (restringido a validadores)
router.get(
  '/for-validator',
  requireAuth,
  requireAcademicValidator,
  verificationController.getRequestsForValidator
);

// Crear nueva solicitud de acreditación
router.post(
  '/requests',
  requireAuth,
  validateRequest({ body: createVerificationRequestSchema }),
  verificationController.createRequest
);

// Concesión de acreditación con validación estricta de puntaje del bot (score >= 70%)
router.post(
  '/bot-grant',
  requireAuth,
  validateRequest({ body: botGrantVerificationSchema }),
  verificationController.botGrant
);

// Validador docente asigna ejercicio práctico (restringido a validadores)
router.post(
  '/requests/:id/practical-exercise',
  requireAuth,
  requireAcademicValidator,
  validateRequest({ body: assignPracticalExerciseSchema }),
  verificationController.assignPracticalExercise
);

// Tutor postulante envía entrega práctica y defensa
router.post(
  '/requests/:id/practical-submission',
  requireAuth,
  validateRequest({ body: submitPracticalEvaluationSchema }),
  verificationController.submitPracticalEvaluation
);

// Validador docente emite dictamen (approved/rejected/requires_reevaluation) (restringido a validadores)
router.post(
  '/requests/:id/review',
  requireAuth,
  requireAcademicValidator,
  validateRequest({ body: reviewVerificationRequestSchema }),
  verificationController.reviewRequest
);

// Guardar datos de extracción del certificado académico
router.post(
  '/requests/:id/certificate',
  requireAuth,
  validateRequest({ body: saveCertificateExtractionSchema }),
  verificationController.saveCertificateExtraction
);

// Cancelar solicitud pendiente
router.delete('/requests/:id', requireAuth, verificationController.cancelRequest);

export default router;
