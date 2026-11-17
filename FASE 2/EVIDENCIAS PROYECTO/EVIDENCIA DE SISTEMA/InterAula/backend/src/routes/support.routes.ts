import {classEmailService} from '../services/classEmail.service.js';
import {Router} from 'express';
import {z} from 'zod';
import {requireAuth} from '../middlewares/auth.middleware.js';
import {createRateLimiter} from '../middlewares/rateLimit.middleware.js';
import {validateRequest} from '../middlewares/validate.middleware.js';
import type {AuthenticatedRequest} from '../types/index.js';
import {supportService} from '../services/support.service.js';
const router=Router(),params=z.object({id:z.string().uuid()});
router.use(requireAuth,createRateLimiter(90));
const handle=(fn:(req:AuthenticatedRequest)=>Promise<any>)=>async(req:any,res:any,next:any)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
router.get('/channels',handle(()=>classEmailService.channelStatus()));
router.get('/inbox',validateRequest({query:z.object({summary:z.enum(['true','false']).optional()}).strict()}),handle(req=>supportService.inbox(req.token!,req.query.summary==='true')));
router.post('/inbox/read',validateRequest({body:z.object({id:z.string().uuid().optional()}).strict()}),handle(req=>supportService.readNotice(req.token!,req.body.id)));
router.get('/cases',validateRequest({query:z.object({queue:z.enum(['mine','review']).default('mine')}).strict()}),handle(req=>supportService.list(req.token!,req.query.queue as string)));
router.post('/cases',createRateLimiter(15),validateRequest({body:z.object({kind:z.enum(['session','profile','note','post','project','workshop']),targetId:z.string().uuid(),
 category:z.enum(['no_show','agreement','harassment','fraud','content','other']),description:z.string().trim().min(20).max(4000)}).strict()}),handle(req=>supportService.create(req.token!,req.body)));
router.get('/cases/:id',validateRequest({params}),handle(req=>supportService.detail(req.token!,req.params.id)));
router.post('/cases/:id/actions',createRateLimiter(30),validateRequest({params,body:z.object({action:z.enum(['claim','reply','note','request_reply','resolve','close','appeal']),
 message:z.string().trim().max(4000).default(''),revision:z.number().int().min(1)}).strict()}),handle(req=>supportService.act(req.token!,req.params.id,req.body)));
export default router;
