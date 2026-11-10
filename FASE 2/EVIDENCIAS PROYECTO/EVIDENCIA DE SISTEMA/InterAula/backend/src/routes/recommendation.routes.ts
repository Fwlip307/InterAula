import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { recommendationService as service } from '../services/recommendation.service.js';
import { recommendationPreferencesSchema, recommendationFeedQuery, recommendationItemSchema } from '../schemas/recommendation.schema.js';
const router=Router();
router.get('/topics',async(_req,res,next)=>{try{res.json({success:true,data:await service.topics()});}catch(error){next(error);}});
router.use(requireAuth,createRateLimiter(60));
router.get('/preferences',async(req:AuthenticatedRequest,res,next)=>{try{
  res.json({success:true,data:await service.preferences(req.token!)});
}catch(error){next(error);}});
router.put('/preferences',validateRequest({body:recommendationPreferencesSchema}),async(req:AuthenticatedRequest,res,next)=>{try{
  res.json({success:true,data:await service.savePreferences(req.token!,req.body)});
}catch(error){next(error);}});
router.get('/feed',validateRequest({query:recommendationFeedQuery}),async(req:AuthenticatedRequest,res,next)=>{try{
  res.json({success:true,data:await service.feed(req.user!.id,req.token!,Number(req.query.limit))});
}catch(error){next(error);}});
router.post('/dismissals',validateRequest({body:recommendationItemSchema}),async(req:AuthenticatedRequest,res,next)=>{try{
  res.json({success:true,data:await service.dismiss(req.user!.id,req.token!,req.body.kind,req.body.id)});
}catch(error){next(error);}});
router.delete('/dismissals',async(req:AuthenticatedRequest,res,next)=>{try{
  res.json({success:true,data:await service.restore(req.user!.id,req.token!)});
}catch(error){next(error);}});
router.delete('/dismissals/:kind/:id',validateRequest({params:recommendationItemSchema}),async(req:AuthenticatedRequest,res,next)=>{try{
  const {kind,id}=recommendationItemSchema.parse(req.params);
  res.json({success:true,data:await service.restore(req.user!.id,req.token!,kind,id)});
}catch(error){next(error);}});
export default router;
