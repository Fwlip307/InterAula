import type { AuthenticatedUser } from '../types/index.js';
import { HttpError } from '../lib/httpError.js';
import { clientFor, result, existing, attachProfiles } from './remote/database.js';

async function sessionsWithProfiles(rows:any[],token:string):Promise<any[]> {
  const tutors=await attachProfiles(rows,'tutor_id','tutor',token);
  const joined=await attachProfiles(tutors,'student_id','student',token);
  return joined.map(session=>({...session,review:Array.isArray(session.review)?session.review[0]||null:session.review}));
}
export const tutoringBackendService={
  async getAvailableTutors(filters?:{subjectId?:string;search?:string;onlyVerified?:boolean;onlyInclusive?:boolean}):Promise<any[]> {
    const profiles:any[]=await result(clientFor().from('public_profiles').select('*').eq('available_for_tutoring',true));
    if(!profiles.length)return [];
    let query=clientFor().from('profile_offered_subjects').select('*,subject:subjects(*)').in('profile_id',profiles.map(profile=>profile.id));
    if(filters?.subjectId&&filters.subjectId!=='all')query=query.eq('subject_id',filters.subjectId);
    if(filters?.onlyVerified)query=query.eq('is_verified',true);
    const offered:any[]=await result(query);
    let inclusiveMap = new Map<string, { training_name: string; verified_at: string | null }>();
    try {
      const { data: accData } = await clientFor()
        .from('inclusive_tutor_accreditations')
        .select('tutor_id, training_name, verified_at')
        .eq('status', 'approved')
        .in('tutor_id', profiles.map((p) => p.id));
      if (Array.isArray(accData)) {
        for (const row of accData) {
          inclusiveMap.set(row.tutor_id, {
            training_name: row.training_name,
            verified_at: row.verified_at || null,
          });
        }
      }
    } catch {
      // Tabla opcional aún no migrada en entornos antiguos
    }
    const term=filters?.search?.trim().toLowerCase();
    return profiles.map(profile=>({
      ...profile,
      profile_offered_subjects:offered.filter(item=>item.profile_id===profile.id),
      inclusive_accredited: inclusiveMap.has(profile.id),
      inclusive_training_name: inclusiveMap.get(profile.id)?.training_name || null,
    }))
      .filter(profile=>profile.profile_offered_subjects.length>0)
      .filter(profile=>!filters?.onlyInclusive || profile.inclusive_accredited)
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

  async updateSessionPrep(
    user: AuthenticatedUser,
    token: string,
    id: string,
    body: {
      agenda_preview?: { what_we_will_see: string; step_by_step: string; how_it_ends: string } | null;
      camera_policy?: 'optional' | 'recommended' | 'required';
      participation_mode?: 'chat_only' | 'chat_or_voice' | 'voice_preferred';
      participation_rules?: string;
      anticipated_materials?: any[];
    }
  ): Promise<any> {
    const current = await this.getSessionById(user, token, id);
    if (current.tutor_id !== user.id) {
      throw new HttpError(403, 'Solo el tutor puede configurar el guion y material anticipado de la sesión.');
    }
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.agenda_preview !== undefined) patch.agenda_preview = body.agenda_preview;
    if (body.camera_policy !== undefined) patch.camera_policy = body.camera_policy;
    if (body.participation_mode !== undefined) patch.participation_mode = body.participation_mode;
    if (body.participation_rules !== undefined) patch.participation_rules = body.participation_rules;
    if (body.anticipated_materials !== undefined) patch.anticipated_materials = body.anticipated_materials;

    await existing(
      clientFor(token).from('tutoring_sessions').update(patch).eq('id', id).select('id').maybeSingle(),
      'No se pudo actualizar la preparación de la sesión.'
    );
    return this.getSessionById(user, token, id);
  },

  async getRoomSignals(_user: AuthenticatedUser, token: string, roomId: string): Promise<any[]> {
    const client = clientFor(token);
    const { data, error } = await client
      .from('virtual_classroom_signals')
      .select('id, room_id, user_id, signal, updated_at')
      .eq('room_id', roomId)
      .order('updated_at', { ascending: false });
    if (error) {
      if (['PGRST205', '42P01'].includes(String(error.code))) return [];
      throw new HttpError(403, 'No tienes acceso a las señales de esta sala.');
    }
    const rows = Array.isArray(data) ? data : [];
    const withProfiles = await attachProfiles(rows, 'user_id', 'participant', token);
    return withProfiles.filter((r: any) => Boolean(r.user_id));
  },

  async setRoomSignal(
    user: AuthenticatedUser,
    token: string,
    roomId: string,
    signal: 'green' | 'yellow' | 'blue' | 'red'
  ): Promise<any> {
    const client = clientFor(token);
    const row = await result(
      client
        .from('virtual_classroom_signals')
        .upsert(
          {
            room_id: roomId,
            user_id: user.id,
            signal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_id,user_id' }
        )
        .select('*')
        .single(),
      'No se pudo registrar tu estado en la sala.'
    );
    return row;
  },
};
