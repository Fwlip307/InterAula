import {z} from 'zod';
import {clientFor} from './remote/database.js';
import {HttpError} from '../lib/httpError.js';

const count=z.coerce.number().int().min(0);
const score=z.coerce.number().min(1).max(10).nullable();
const schema=z.object({profile_id:z.string().uuid(),valid_sessions:count,legacy_sessions:count,recent_reviews:count,recent_reviewers:count,
 communication_average:score,knowledge_average:score,punctuality_average:score,communication_adjusted:score,knowledge_adjusted:score,punctuality_adjusted:score,
 communication_highlight:z.boolean(),knowledge_highlight:z.boolean(),punctuality_highlight:z.boolean()}).strict();
const isMissing=(code:unknown)=>['PGRST205','PGRST202','42P01','42883','42703','PGRST204'].includes(String(code));
export const reputationService={
 async read(profileId:string,token:string){
  const {data,error}=await clientFor(token).from('tutor_reputation_public').select('*').eq('profile_id',profileId).maybeSingle();
  if(error){if(isMissing(error.code))return {status:'activation_required' as const,reputation:null};
   throw new HttpError(503,'No pudimos cargar la reputación. Intenta nuevamente.');}
  return {status:'ready' as const,reputation:data?schema.parse(data):null,
   policy:{version:1,windowDays:90,minReviews:10,minReviewers:5,threshold:8.5,priorMean:7,priorWeight:5}};
 },
 async confirm(sessionId:string,token:string){
  const {error}=await clientFor(token).rpc('confirm_tutoring_completion',{p_session_id:sessionId});
  if(error){
   if(isMissing(error.code))throw new HttpError(503,'La confirmación de sesiones necesita activar ACTIVAR_REPUTACION.sql en Supabase.','REPUTATION_NOT_READY');
   if(error.code==='42501')throw new HttpError(403,'No puedes confirmar esta sesión.');
   if(error.code==='23514')throw new HttpError(409,'Confirma una sesión aceptada, después de al menos 15 minutos desde el horario acordado.');
   throw new HttpError(503,'No se pudo registrar tu confirmación. Puedes reintentar.');
  }
 },
};
