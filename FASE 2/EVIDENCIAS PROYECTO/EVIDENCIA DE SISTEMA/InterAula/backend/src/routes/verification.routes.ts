import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller.js';
import { requireAuth, optionalAuth, requireAcademicValidator } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  createVerificationRequestSchema,
  botGrantVerificationSchema,
  assignPracticalExerciseSchema,
  submitPracticalEvaluationSchema,
  reviewVerificationRequestSchema,
  saveCertificateExtractionSchema,
  teacherEndorsementSchema,
  startAssessmentSchema,
  answerAssessmentSchema,
  inclusiveAccreditationRequestSchema,
  reviewInclusiveAccreditationSchema,
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

const assessmentLimit = createRateLimiter(60, 60_000);

// Solicitud de aval docente
router.post(
  '/endorsements',
  requireAuth,
  assessmentLimit,
  validateRequest({ body: teacherEndorsementSchema }),
  verificationController.requestTeacherEndorsement
);

// Intentos de evaluación acreditativa con corrección en servidor
router.post(
  '/attempts',
  requireAuth,
  assessmentLimit,
  validateRequest({ body: startAssessmentSchema }),
  verificationController.startAssessmentAttempt
);

router.post(
  '/attempts/:id/answers',
  requireAuth,
  assessmentLimit,
  validateRequest({ body: answerAssessmentSchema }),
  verificationController.answerAssessmentAttempt
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

// Acreditación verificable de "Tutor con formación en acompañamiento inclusivo"
router.get('/inclusive-accreditation/me', requireAuth, verificationController.getMyInclusiveAccreditation);
router.post(
  '/inclusive-accreditation',
  requireAuth,
  validateRequest({ body: inclusiveAccreditationRequestSchema }),
  verificationController.requestInclusiveAccreditation
);
router.get(
  '/inclusive-accreditation/validator',
  requireAuth,
  requireAcademicValidator,
  verificationController.listInclusiveAccreditationsForValidator
);
router.patch(
  '/inclusive-accreditation/:id/review',
  requireAuth,
  requireAcademicValidator,
  validateRequest({ body: reviewInclusiveAccreditationSchema }),
  verificationController.reviewInclusiveAccreditation
);

export default router;
