import { Router } from 'express';
import { tutoringController } from '../controllers/tutoring.controller.js';
import { requireAuth,optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {createRateLimiter} from '../middlewares/rateLimit.middleware.js';
import {tutorRecommendationsService,tutorRecommendationQuery,tutorDemoQuery,type TutorRecommendationFilters} from '../services/tutorRecommendations.service.js';
import type {AuthenticatedRequest} from '../types/index.js';
import type {TutorPriority} from '../services/tutorClustering.service.js';
import {reputationService} from '../services/reputation.service.js';
import {z} from 'zod';
import {
  requestSessionSchema,
  updateSessionStatusSchema,
  submitReviewSchema,
  registerAttendanceSchema,
  updateSessionPrepSchema,
  classroomSignalSchema,
} from '../schemas/tutoring.schema.js';

const router = Router();

const recommendationLimit=createRateLimiter(60);
router.get('/recommendations',requireAuth,recommendationLimit,validateRequest({query:tutorRecommendationQuery}),async(req,res,next)=>{
 try{res.json({success:true,data:await tutorRecommendationsService.list((req as AuthenticatedRequest).user!.id,req.query as unknown as TutorRecommendationFilters,(req as AuthenticatedRequest).token)});}
 catch(error){next(error);}
});
router.get('/recommendations/demo',requireAuth,recommendationLimit,validateRequest({query:tutorDemoQuery}),async(req,res,next)=>{
 try{res.json({success:true,data:await tutorRecommendationsService.demo(req.query.priority as TutorPriority)});}
 catch(error){next(error);}
});

// Explorar tutores disponibles
router.get('/tutors', optionalAuth,tutoringController.getAvailableTutors);

// Sesiones del usuario autenticado (estudiante o tutor)
router.get('/my-sessions', requireAuth, tutoringController.getMySessions);

router.get('/sessions/:id', requireAuth, tutoringController.getSessionById);

router.get('/reputation/:id',requireAuth,validateRequest({params:z.object({id:z.string().uuid()})}),async(req,res,next)=>{
 try{res.json({success:true,data:await reputationService.read(req.params.id,(req as AuthenticatedRequest).token!)});}catch(error){next(error);}
});
router.post('/sessions/:id/confirm-completion',requireAuth,createRateLimiter(30),
 validateRequest({params:z.object({id:z.string().uuid()}),body:z.object({}).strict()}),async(req,res,next)=>{
  try{const {tutoringBackendService}=await import('../services/tutoring.service.js');const auth=req as AuthenticatedRequest;
   res.json({success:true,data:await tutoringBackendService.confirmCompletion(auth.user!,auth.token!,req.params.id)});
  }catch(error){next(error);}
 });

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

// Guion anticipado, reglas de participación y material anticipado de sesión 1:1
router.patch(
  '/sessions/:id/prep',
  requireAuth,
  validateRequest({ body: updateSessionPrepSchema }),
  tutoringController.updateSessionPrep
);

// Semáforo de comunicación en Aula Virtual (privado a participantes de la sala)
router.get('/rooms/:roomId/signals', requireAuth, tutoringController.getRoomSignals);
router.put(
  '/rooms/:roomId/signals',
  requireAuth,
  validateRequest({ body: classroomSignalSchema }),
  tutoringController.setRoomSignal
);

export default router;
