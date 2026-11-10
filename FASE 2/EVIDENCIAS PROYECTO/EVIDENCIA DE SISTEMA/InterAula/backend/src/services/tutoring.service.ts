import type { AuthenticatedUser } from '../types/index.js';
import { HttpError } from '../lib/httpError.js';
import { clientFor, result, existing, attachProfiles } from './remote/database.js';

async function sessionsWithProfiles(rows:any[],token:string):Promise<any[]> {
  const tutors=await attachProfiles(rows,'tutor_id','tutor',token);
  const joined=await attachProfiles(tutors,'student_id','student',token);
  return joined.map(session=>({...session,review:Array.isArray(session.review)?session.review[0]||null:session.review}));
}
export const tutoringBackendService={
  async getAvailableTutors(filters?:{subjectId?:string;search?:string;onlyVerified?:boolean}):Promise<any[]> {
    const profiles:any[]=await result(clientFor().from('public_profiles').select('*').eq('available_for_tutoring',true));
    if(!profiles.length)return [];
    let query=clientFor().from('profile_offered_subjects').select('*,subject:subjects(*)').in('profile_id',profiles.map(profile=>profile.id));
    if(filters?.subjectId&&filters.subjectId!=='all')query=query.eq('subject_id',filters.subjectId);
    if(filters?.onlyVerified)query=query.eq('is_verified',true);
    const offered:any[]=await result(query);
    const term=filters?.search?.trim().toLowerCase();
    return profiles.map(profile=>({...profile,profile_offered_subjects:offered.filter(item=>item.profile_id===profile.id)}))
      .filter(profile=>profile.profile_offered_subjects.length>0)
      .filter(profile=>!term||[profile.first_name,profile.last_name,profile.display_name,profile.career,
        ...profile.profile_offered_subjects.map((item:any)=>item.subject?.name)].join(' ').toLowerCase().includes(term));
  },
  async requestSession(user:AuthenticatedUser,token:string,body:{tutor_id:string;subject_id:string;scheduled_at:string;duration_minutes:number;modality:string;notes?:string}):Promise<any> {
    if(body.tutor_id===user.id)throw new HttpError(400,'No puedes agendar una tutoría contigo mismo.');
    if(!Number.isFinite(new Date(body.scheduled_at).getTime())||new Date(body.scheduled_at).getTime()<=Date.now())throw new HttpError(400,'La fecha y hora de la tutoría deben ser en el futuro.');
    const client=clientFor(token);
    const tutor=await existing(client.from('public_profiles').select('available_for_tutoring').eq('id',body.tutor_id).maybeSingle(),'Tutor no encontrado.');
    if(!tutor.available_for_tutoring)throw new HttpError(409,'El tutor no está disponible.');
    const offered=await existing(client.from('profile_offered_subjects').select('subject_id').eq('profile_id',body.tutor_id).eq('subject_id',body.subject_id).maybeSingle(),'El tutor no ofrece esta asignatura.');
    if(!offered)throw new HttpError(400,'El tutor no ofrece esta asignatura.');
    const row=await result(client.from('tutoring_sessions').insert({...body,student_id:user.id,status:'pending'})
      .select('*,subject:subjects(*)').single(),'No se pudo solicitar la tutoría. Comprueba que el horario esté disponible.');
    return (await sessionsWithProfiles([row],token))[0];
  },
  async getSessionById(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    const session=await existing(clientFor(token).from('tutoring_sessions').select('*,subject:subjects(*),review:tutoring_reviews(*)').eq('id',id).maybeSingle(),'Sesión no encontrada.');
    if(![session.tutor_id,session.student_id].includes(user.id))throw new HttpError(403,'No perteneces a esta sesión.');
    return (await sessionsWithProfiles([session],token))[0];
  },
  async updateSessionStatus(user:AuthenticatedUser,token:string,id:string,status:'accepted'|'rejected'|'completed'|'cancelled',reason?:string):Promise<any> {
    const current=await this.getSessionById(user,token,id);
    if(status!=='cancelled'&&current.tutor_id!==user.id)throw new HttpError(403,'Solo el tutor puede aceptar, rechazar o completar la tutoría.');
    const transitions:Record<string,string[]>={pending:['accepted','rejected','cancelled'],accepted:['completed','cancelled'],in_progress:['completed','cancelled']};
    if(!transitions[current.status]?.includes(status))throw new HttpError(409,'Esta transición no está disponible para el estado actual de la tutoría.');
    await existing(clientFor(token).from('tutoring_sessions').update({status,cancellation_reason:reason?.trim()||null,updated_at:new Date().toISOString()})
      .eq('id',id).eq('status',current.status).select('id').maybeSingle(),'La tutoría cambió. Recarga antes de continuar.');
    return this.getSessionById(user,token,id);
  },
  async submitReview(user:AuthenticatedUser,token:string,id:string,review:{rating:number;comment:string;punctuality_rating?:number;clarity_rating?:number;empathy_rating?:number}):Promise<any> {
    const session=await this.getSessionById(user,token,id);
    if(session.student_id!==user.id)throw new HttpError(403,'Solo el estudiante que recibió la tutoría puede calificarla.');
    if(session.status!=='completed')throw new HttpError(409,'Solo puedes calificar una tutoría completada.');
    return result(clientFor(token).from('tutoring_reviews').insert({...review,session_id:id,student_id:user.id,tutor_id:session.tutor_id}).select('*').single());
  },
  async registerAttendance(_user:AuthenticatedUser,token:string,body:{session_id:string;action:string;elapsed_minutes?:number}):Promise<any> {
    return result(clientFor(token).rpc('register_session_attendance',{p_session_id:body.session_id,p_action:body.action,p_duration_minutes:0}));
  },
  async getMySessions(user:AuthenticatedUser,token:string,role:'student'|'tutor'):Promise<any[]> {
    const rows=await result(clientFor(token).from('tutoring_sessions').select('*,subject:subjects(*),review:tutoring_reviews(*)')
      .eq(role==='student'?'student_id':'tutor_id',user.id).order('scheduled_at',{ascending:false}));
    return sessionsWithProfiles(rows,token);
  },
};
