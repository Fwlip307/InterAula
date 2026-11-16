import {moderationService} from './moderation.service.js';
import {clientFor} from './remote/database.js';
import {HttpError} from '../lib/httpError.js';
async function rpc(token:string,name:string,args:Record<string,unknown>={}){
 const {data,error}=await clientFor(token).rpc(name,args);
 if(error){
  if(['PGRST202','PGRST205','42883','42P01'].includes(String(error.code)))throw new HttpError(503,'El centro de ayuda y la bandeja todavía no están habilitados. Puedes seguir usando el resto de InterAula.','SUPPORT_NOT_READY');
  if(error.code==='42501')throw new HttpError(403,'No tienes acceso a esta incidencia o acción.');
  if(error.code==='40001')throw new HttpError(409,'La incidencia cambió. Actualiza el seguimiento antes de enviar nuevamente.');
  if(error.code==='23514')throw new HttpError(409,'Revisa el estado, la extensión del mensaje y los límites de esta acción.');
  throw new HttpError(503,'No pudimos completar la operación. Puedes reintentar.');
 }
 return data;
}
export const supportService={
 inbox:(token:string,summary=false)=>rpc(token,'get_my_inbox',{p_include_items:!summary}),
 readNotice:(token:string,id?:string)=>rpc(token,'read_my_notice',{p_id:id||null}),
 list:(token:string,queue:string)=>rpc(token,'list_incidents',{p_queue:queue}),
 async detail(token:string,id:string){
  const detail=await rpc(token,'get_incident',{p_id:id});
  try{const context=await moderationService.context(token,id);if(context.hasMeasure&&detail.role==='reporter')detail.canAppeal=false;
   if(context.needsMeasureAppeal&&(!context.canSanction||context.measures.some((m:any)=>m.scope==='account')&&!context.canSuspendAccounts))detail.canClaim=false;}
  catch(error){if(!(error instanceof HttpError)||error.code!=='MODERATION_NOT_READY')throw error;}
  return detail;
 },
 create:(token:string,body:{kind:string;targetId:string;category:string;description:string})=>rpc(token,'create_incident',{
  p_kind:body.kind,p_target:body.targetId,p_category:body.category,p_description:body.description}),
 act:(token:string,id:string,body:{action:string;message:string;revision:number})=>rpc(token,'act_on_incident',{
  p_id:id,p_action:body.action,p_message:body.message,p_revision:body.revision}),
};
