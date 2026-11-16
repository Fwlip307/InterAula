import {Router} from 'express';
import type {AuthenticatedRequest} from '../types/index.js';
import {adaptiveLearningService as service,adaptiveGoalSchema,adaptiveAnswerSchema,adaptiveAttemptId} from '../services/adaptiveLearning.service.js';
import {createRateLimiter} from '../middlewares/rateLimit.middleware.js';
const router=Router();
// Mounted below the authenticated learning-space router.
router.use(createRateLimiter(90));
router.get('/overview',async(req:AuthenticatedRequest,res,next)=>{try{res.json({success:true,data:await service.getOverview(req.user!.id)});}catch(error){next(error);}});
router.get('/demo',(_req,res)=>res.json({success:true,data:service.demo()}));
router.put('/goal',async(req:AuthenticatedRequest,res,next)=>{try{const body=adaptiveGoalSchema.parse(req.body);res.json({success:true,data:await service.setGoal(req.user!.id,body.goal_skill_id)});}catch(error){next(error);}});
router.post('/practice',async(req:AuthenticatedRequest,res,next)=>{try{res.json({success:true,data:await service.start(req.user!.id)});}catch(error){next(error);}});
router.post('/practice/:id/hint',async(req:AuthenticatedRequest,res,next)=>{try{const id=adaptiveAttemptId.parse(req.params.id);res.json({success:true,data:await service.hint(req.user!.id,id)});}catch(error){next(error);}});
router.post('/practice/:id/answer',async(req:AuthenticatedRequest,res,next)=>{try{const id=adaptiveAttemptId.parse(req.params.id),body=adaptiveAnswerSchema.parse(req.body);res.json({success:true,data:await service.answer(req.user!.id,req.token!,id,body.answer)});}catch(error){next(error);}});
export default router;
