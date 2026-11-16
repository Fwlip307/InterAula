import {Router} from 'express';
import {z} from 'zod';
import {requireAuth} from '../middlewares/auth.middleware.js';
import {createRateLimiter} from '../middlewares/rateLimit.middleware.js';
import {validateRequest} from '../middlewares/validate.middleware.js';
import {moderationService} from '../services/moderation.service.js';
const router=Router(),params=z.object({id:z.string().uuid()});
router.use(requireAuth,createRateLimiter(60));
const handle=(fn:(req:any)=>Promise<any>)=>async(req:any,res:any,next:any)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
router.get('/summary',handle(req=>moderationService.summary(req.token)));
router.get('/mine',handle(req=>moderationService.mine(req.token)));
router.get('/cases/:id',validateRequest({params}),handle(req=>moderationService.context(req.token,req.params.id)));
router.post('/cases/:id/decision',createRateLimiter(10),validateRequest({params,body:z.object({revision:z.number().int().min(1),document:z.object({
 severity:z.enum(['minor','serious','precaution']),scope:z.enum(['subject','tutoring','community','account']).optional(),days:z.union([z.literal(0),z.literal(1),z.literal(7),z.literal(30)]).optional(),
 subjectId:z.string().uuid().optional(),reason:z.string().trim().min(40).max(4000),message:z.string().trim().min(20).max(4000),duplicateOf:z.string().uuid().optional(),distinctFact:z.boolean().optional(),
}).strict()}).strict()}),handle(req=>moderationService.decide(req.token,req.params.id,req.body.revision,req.body.document)));
router.post('/cases/:id/appeal-decision',createRateLimiter(10),validateRequest({params,body:z.object({revision:z.number().int().min(1),outcome:z.enum(['uphold','overturn']),reason:z.string().trim().min(40).max(4000),message:z.string().trim().min(20).max(4000)}).strict()}),handle(req=>moderationService.appeal(req.token,req.params.id,req.body)));
export default router;
