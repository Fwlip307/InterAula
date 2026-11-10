import { z } from 'zod';
import { result, clientFor } from '../services/remote/database.js';
import { assessmentService, startAssessmentSchema, answerAssessmentSchema } from '../services/assessment.service.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
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

const assessmentLimit = createRateLimiter(60, 60_000);
const endorsementSchema=z.object({subject_id:z.string().uuid(),professor_name:z.string().trim().min(2).max(120),professor_email:z.string().trim().email().max(254),message:z.string().trim().max(1500)}).strict();
router.post('/endorsements',requireAuth,assessmentLimit,validateRequest({body:endorsementSchema}),async (req,res,next)=>{
  try {
    const {subject_id,professor_name,professor_email,message}=req.body;
    const data=await result(clientFor((req as any).token).rpc('request_teacher_endorsement',{p_subject_id:subject_id,p_name:professor_name,p_email:professor_email,p_message:message}), 'No se pudo registrar la solicitud. Comprueba que el docente sea un validador registrado y que no exista otra solicitud activa para esta asignatura.');
    res.status(201).json({success:true,data});
  } catch(error){next(error);}
});

router.post('/attempts', requireAuth, assessmentLimit, validateRequest({ body: startAssessmentSchema }), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await assessmentService.start((req as any).user, (req as any).token, req.body.subject_id) }); }
  catch (error) { next(error); }
});
router.post('/attempts/:id/answers', requireAuth, assessmentLimit, validateRequest({ body: answerAssessmentSchema }), async (req, res, next) => {
  try { res.json({ success: true, data: await assessmentService.answer((req as any).user, req.params.id, req.body) }); }
  catch (error) { next(error); }
});

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
