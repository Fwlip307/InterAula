import {clientFor} from './remote/database.js';
import {HttpError} from '../lib/httpError.js';
const missing=(code:unknown)=>['PGRST202','PGRST205','42883','42P01'].includes(String(code));
async function rpc(token:string,name:string,args:Record<string,unknown>={}){
 const {data,error}=await clientFor(token).rpc(name,args);
 if(error){
  if(missing(error.code))throw new HttpError(503,'Las medidas de convivencia todavía no están activadas.','MODERATION_NOT_READY');
  if(error.code==='42501')throw new HttpError(403,'No tienes permiso para esta medida o la acción está restringida.');
  if(error.code==='40001')throw new HttpError(409,'El expediente cambió. Actualiza antes de decidir.');
  if(error.code==='23514'||error.code==='23505')throw new HttpError(409,'Revisa la decisión, los antecedentes y el estado del expediente.');
  throw new HttpError(503,'No pudimos comprobar las medidas. Intenta nuevamente.');
 }
 return data;
}
export const moderationService={
 async summary(token:string){
  const {data,error}=await clientFor(token).rpc('get_my_moderation_summary');
  // Before the atomic migration there are no measures to enforce.
  if(error&&missing(error.code))return {enabled:false,account:false,tutoring:false,community:false};
  if(error||!data||typeof data.account!=='boolean')throw new HttpError(503,'No pudimos comprobar la disponibilidad de tu cuenta.');
  return data as {enabled:boolean;account:boolean;tutoring:boolean;community:boolean};
 },
 mine:(token:string)=>rpc(token,'get_my_measures'),
 context:(token:string,id:string)=>rpc(token,'moderation_case_context',{p_id:id}),
 decide:(token:string,id:string,revision:number,document:Record<string,unknown>)=>rpc(token,'decide_moderation_measure',{p_id:id,p_revision:revision,p_document:document}),
 appeal:(token:string,id:string,body:{revision:number;outcome:string;reason:string;message:string})=>rpc(token,'decide_measure_appeal',{
  p_id:id,p_revision:body.revision,p_outcome:body.outcome,p_reason:body.reason,p_message:body.message}),
 async availability(ids:string[]){
  if(!ids.length)return [];
  const {data,error}=await clientFor().from('tutor_availability_limits').select('profile_id,tutoring_unavailable,community_unavailable,subject_ids').in('profile_id',ids);
  if(error&&missing(error.code))return [];
  if(error)throw new HttpError(503,'No pudimos comprobar la disponibilidad de las personas.');
  return (data||[]) as {profile_id:string;tutoring_unavailable:boolean;community_unavailable:boolean;subject_ids:string[]}[];
 },
};
