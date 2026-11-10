import type { AuthenticatedUser } from '../types/index.js';
import { HttpError } from '../lib/httpError.js';
import { clientFor,result,existing,attachProfiles } from './remote/database.js';
async function decorate(rows:any[],userId?:string,token?:string):Promise<any[]> {
  const joined=await attachProfiles(rows,'tutor_id','tutor',token);
  const enrolled=userId&&rows.length?await result(clientFor(token).from('workshop_enrollments').select('workshop_id').eq('student_id',userId).in('workshop_id',rows.map(row=>row.id))):[];
  const ids=new Set(enrolled.map((row:any)=>row.workshop_id));
  return joined.map(row=>({...row,is_enrolled:ids.has(row.id),enrollments_count:Number(row.enrollments_count||0)}));
}
export const workshopBackendService={
  async getUpcomingWorkshops(subjectId?:string,userId?:string,token?:string):Promise<any[]> {
    let query=clientFor(token).from('workshop_summary').select('*').in('status',['scheduled','in_progress']).order('scheduled_at');
    if(subjectId&&subjectId!=='all')query=query.eq('subject_id',subjectId);
    const rows=await result(query);
    const subjects=rows.length?await result(clientFor(token).from('subjects').select('*').in('id',[...new Set(rows.map((row:any)=>row.subject_id))])):[];
    return decorate(rows.map((row:any)=>({...row,subject:subjects.find((subject:any)=>subject.id===row.subject_id)})),userId,token);
  },
  async getWorkshopById(id:string,userId?:string,token?:string):Promise<any> {
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const row=await result(clientFor(token).from('workshop_summary').select('*').eq(uuid?'id':'room_id',id).maybeSingle());
    if(!row)return null;
    const subject=await result(clientFor(token).from('subjects').select('*').eq('id',row.subject_id).maybeSingle());
    const decorated=(await decorate([{...row,subject}],userId,token))[0];
    if(userId===row.tutor_id)decorated.enrollments=await attachProfiles(await result(clientFor(token).from('workshop_enrollments').select('*').eq('workshop_id',row.id)),'student_id','student',token);
    return decorated;
  },
  async createWorkshop(user:AuthenticatedUser,token:string,body:Record<string,any>):Promise<any> {
    if(new Date(body.scheduled_at).getTime()<=Date.now())throw new HttpError(400,'La fecha del taller debe ser futura.');
    const row=await result(clientFor(token).from('tutoring_workshops').insert({...body,tutor_id:user.id,status:'scheduled'}).select('*').single());
    return this.getWorkshopById(row.id,user.id,token);
  },
  async enroll(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await result(clientFor(token).from('workshop_enrollments').insert({workshop_id:id,student_id:user.id}));
    return {success:true,message:'Inscripción realizada con éxito'};
  },
  async unenroll(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await result(clientFor(token).from('workshop_enrollments').delete().eq('workshop_id',id).eq('student_id',user.id));
    return {success:true};
  },
  async updateStatus(user:AuthenticatedUser,token:string,id:string,status:string):Promise<any> {
    const row=await existing(clientFor(token).from('tutoring_workshops').select('status').eq('id',id).eq('tutor_id',user.id).maybeSingle(),'Taller no encontrado o sin permisos.');
    const transitions:Record<string,string[]>={scheduled:['in_progress','cancelled'],in_progress:['completed','cancelled']};
    if(!transitions[row.status]?.includes(status))throw new HttpError(409,'El taller ya terminó o esa transición no está disponible.');
    return existing(clientFor(token).from('tutoring_workshops').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('tutor_id',user.id).eq('status',row.status).select('*').maybeSingle(),'El taller cambió. Recarga antes de continuar.');
  },
  async deleteWorkshop(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await existing(clientFor(token).from('tutoring_workshops').delete().eq('id',id).eq('tutor_id',user.id).select('id').maybeSingle(),'Taller no encontrado o sin permisos.');
    return {success:true,id};
  },
  async getMyWorkshopsAsStudent(user:AuthenticatedUser,token:string):Promise<any[]> {
    const enrollments=await result(clientFor(token).from('workshop_enrollments').select('workshop_id').eq('student_id',user.id));
    if(!enrollments.length)return [];
    const rows=await result(clientFor(token).from('workshop_summary').select('*').in('id',enrollments.map((row:any)=>row.workshop_id)).order('scheduled_at',{ascending:false}));
    return decorate(rows,user.id,token);
  },
  async getMyWorkshopsAsTutor(user:AuthenticatedUser,token:string):Promise<any[]> {
    return decorate(await result(clientFor(token).from('workshop_summary').select('*').eq('tutor_id',user.id).order('scheduled_at',{ascending:false})),user.id,token);
  },
};
