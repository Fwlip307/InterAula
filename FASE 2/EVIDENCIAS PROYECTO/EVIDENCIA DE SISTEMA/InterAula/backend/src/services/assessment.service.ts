import {z} from 'zod';
import type {ChallengeQuestionDTO} from './ai.service.js';
import {buildAccreditationQuestions,resolveSubjectContext} from './accreditationQuestions.service.js';
import {assessmentCatalog} from '../data/assessmentCatalog.js';
import {getAdminSupabase,getAuthenticatedSupabase} from '../lib/supabase.js';
import {HttpError} from '../lib/httpError.js';
import {result,existing} from './remote/database.js';
import type {AuthenticatedUser} from '../types/index.js';

export const startAssessmentSchema=z.object({subject_id:z.string().uuid().optional(),catalog_subject_id:z.string().min(1).max(200).optional(),time_mode:z.enum(['standard','extended']).default('standard')}).strict()
  .refine(value=>!!value.subject_id!==!!value.catalog_subject_id,'Selecciona exactamente una asignatura.');
export const answerAssessmentSchema=z.object({question_id:z.string().uuid(),answer:z.string().trim().max(1500),timed_out:z.boolean().optional()}).strict();
export const integrityEventSchema=z.object({event_id:z.string().uuid(),type:z.enum(['fullscreen_exit','visibility_hidden','window_blur','copy_attempt','paste_attempt','abandon'])}).strict();
export const grantAssessmentSchema=z.object({attempt_id:z.string().uuid()}).strict();
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const questionSeconds=(question:ChallengeQuestionDTO,mode:string,policyVersion=3)=>(question.type==='redaction'?(policyVersion>=3?40:90):(policyVersion>=3?20:45))*(mode==='extended'?2:1);
const incidentCount=(attempt:any)=>typeof attempt.integrity_count==='number'?attempt.integrity_count:(attempt.integrity_events||[]).filter((e:any)=>e.counted).length;
function pauseState(attempt:any) {
  const last=attempt.answers.at(-1);
  const seconds=attempt.policy_version>=4?(attempt.time_mode==='extended'?10:5):0;
  const ends=attempt.state==='pending'&&!attempt.question_deadline&&last&&seconds?new Date(Date.parse(last.answered_at)+seconds*1000).toISOString():null;
  return {pauseEndsAt:ends,pauseSeconds:seconds};
}
function publicQuestion(question:ChallengeQuestionDTO|undefined,mode='standard',policyVersion=3) {
  if(!question)return null;
  return {
    id:question.id,
    type:question.type,
    prompt:question.prompt,
    options:question.options,
    codeSnippet:question.codeSnippet,
    placeholder:question.placeholder,
    topic:question.topic,
    difficulty:question.level,
    category:question.category,
    timeLimitSeconds:questionSeconds(question,mode,policyVersion),
  };
}
export function gradeAssessmentAnswer(question:ChallengeQuestionDTO,answer:string):boolean {
  if(question.type==='choice')return answer===question.correctOptionId;
  return (question.acceptedAnswers||[]).some(expected=>normalize(answer)===normalize(expected));
}
async function getAttempt(user:AuthenticatedUser,id:string) {
  return existing(getAdminSupabase().from('tutor_assessment_attempts').select('*').eq('id',id).eq('user_id',user.id).maybeSingle(),'Evaluación no encontrada.');
}
function assertPending(attempt:any) {
  if(attempt.state!=='pending')throw new HttpError(409,'Esta evaluación ya terminó.');
  if(Date.parse(attempt.expires_at)<=Date.now())throw new HttpError(410,'El tiempo total del intento terminó. Puedes iniciar otro intento.');
}
async function updateAttempt(attempt:any,patch:Record<string,unknown>) {
  const updated=await result(getAdminSupabase().from('tutor_assessment_attempts').update({...patch,revision:attempt.revision+1,updated_at:new Date().toISOString()})
    .eq('id',attempt.id).eq('user_id',attempt.user_id).eq('state',attempt.state).eq('revision',attempt.revision).select('id').maybeSingle());
  if(!updated)throw new HttpError(409,'El intento cambió en otra solicitud. Recarga su estado para continuar.');
}
function publicState(attempt:any,subjectName:string,subjectArea?:string) {
  const pending=attempt.state==='pending';
  const last=attempt.answers.at(-1);
  const totalQuestions=attempt.questions.length;
  const answered=attempt.answers.length;
  const resolvedContext=resolveSubjectContext(subjectName,subjectArea);
  return {id:attempt.id,subjectId:attempt.subject_id,subjectName,subjectArea:resolvedContext.areaLabel,level:'basic',totalQuestions,
    answered,pendingQuestions:Math.max(0,totalQuestions-answered),progressPercent:totalQuestions?Math.round((answered/totalQuestions)*100):0,
    expiresAt:attempt.expires_at,questionExpiresAt:attempt.question_deadline,
    serverNow:new Date().toISOString(),timeMode:attempt.time_mode||'standard',source:attempt.question_source||'reviewed',
    state:attempt.state,integrityCount:incidentCount(attempt),integrityLimit:3,score:pending?undefined:attempt.score,
    needsNext:pending&&!attempt.question_deadline,...pauseState(attempt),failFast:attempt.policy_version>=5,passingScore:attempt.policy_version>=5?100:70,
    terminationReason:attempt.state==='failed'&&attempt.policy_version>=5&&last&&!last.correct?(last.timed_out?'time_expired':'incorrect_answer'):undefined,
    question:pending&&attempt.question_deadline?publicQuestion(attempt.questions[answered],attempt.time_mode,attempt.policy_version||1):null};
}
export const assessmentService={
  async start(user:AuthenticatedUser,token:string,subjectId:string|undefined,options:{catalogSubjectId?:string;timeMode?:'standard'|'extended'}={}):Promise<any> {
    const admin=getAdminSupabase();
    const recent=await result(admin.from('tutor_assessment_attempts').select('id').eq('user_id',user.id).gte('created_at',new Date(Date.now()-3_600_000).toISOString()));
    if(recent.length>=3)throw new HttpError(429,'Ya iniciaste tres evaluaciones durante la última hora. Intenta más tarde.');
    const client=getAuthenticatedSupabase(token);
    let subjectName:string;let subjectArea:string|undefined;
    if(options.catalogSubjectId) {
      const catalogSubject=assessmentCatalog.find(s=>s.id===options.catalogSubjectId);
      if(!catalogSubject)throw new HttpError(400,'La asignatura no pertenece al catálogo disponible.');
      subjectArea=catalogSubject.area;
      let subject=await result(admin.from('subjects').select('id,name,category').eq('name',catalogSubject.name).maybeSingle());
      if(!subject) {
        const allSubjects=await result(admin.from('subjects').select('id,name,category'));
        subject=(allSubjects||[]).find((s:any)=>normalize(s.name)===normalize(catalogSubject.name))||null;
      }
      if(!subject) {
        const inserted=await admin.from('subjects').insert({name:catalogSubject.name,category:catalogSubject.area}).select('id,name').single();
        if(inserted.error?.code==='23505')subject=await result(admin.from('subjects').select('id,name').eq('name',catalogSubject.name).maybeSingle());
        else subject=await result(Promise.resolve(inserted));
      }
      subjectId=subject.id;subjectName=subject.name;
    } else {
      const subject=await result(client.from('subjects').select('id,name,category').eq('id',subjectId!).maybeSingle());
      if(!subject)throw new HttpError(404,'Asignatura no encontrada.');
      subjectName=subject.name;
      subjectArea=subject.category||resolveSubjectContext(subject.name).areaSlug;
    }
    const offered=await result(client.from('profile_offered_subjects').select('subject_id,is_verified').eq('profile_id',user.id).eq('subject_id',subjectId!).maybeSingle());
    if(offered?.is_verified)throw new HttpError(409,'Esta asignatura ya está acreditada.');
    const prior=await result(admin.from('tutor_assessment_attempts').select('questions').eq('user_id',user.id).eq('subject_id',subjectId!).order('created_at',{ascending:false}).limit(10));
    const previousQuestions=prior.flatMap((attempt:any)=>attempt.questions||[]);
    const {questions,source}=await buildAccreditationQuestions(subjectName,subjectArea,previousQuestions);
    if(!offered) {
      const insertedOffer=await client.from('profile_offered_subjects').insert({profile_id:user.id,subject_id:subjectId!,level:'basic',is_verified:false});
      if(insertedOffer.error&&insertedOffer.error.code!=='23505')await result(Promise.resolve(insertedOffer));
    }
    const timeMode=options.timeMode||'standard';const now=Date.now();
    const attempt=await result(admin.from('tutor_assessment_attempts').insert({user_id:user.id,subject_id:subjectId!,
      level:'basic',questions,answers:[],state:'pending',policy_version:5,time_mode:timeMode,question_source:source,integrity_events:[],integrity_count:0,
      expires_at:new Date(now+1000*(questions.reduce((sum,q)=>sum+questionSeconds(q,timeMode),0)+questions.length*60)).toISOString(),
      question_deadline:new Date(now+questionSeconds(questions[0],timeMode)*1000).toISOString(),
    }).select('*').single());
    return publicState(attempt,subjectName,subjectArea);
  },
  async get(user:AuthenticatedUser,id:string):Promise<any> {
    const attempt=await getAttempt(user,id);
    const subject=await existing(getAdminSupabase().from('subjects').select('name,category').eq('id',attempt.subject_id).maybeSingle(),'Asignatura no encontrada.');
    if(attempt.state==='pending'&&Date.parse(attempt.expires_at)<=Date.now())throw new HttpError(410,'El intento expiró.');
    return publicState(attempt,subject.name,subject.category);
  },
  async next(user:AuthenticatedUser,id:string):Promise<any> {
    const attempt=await getAttempt(user,id);assertPending(attempt);
    const question:ChallengeQuestionDTO=attempt.questions[attempt.answers.length];
    if(!question)throw new HttpError(409,'No hay otra pregunta en este intento.');
    const pause=pauseState(attempt);
    if(pause.pauseEndsAt&&Date.parse(pause.pauseEndsAt)>Date.now())throw new HttpError(409,'La pausa breve aún no termina. Espera unos segundos y continúa.');
    if(!attempt.question_deadline) {
      attempt.question_deadline=new Date(Date.now()+1000*questionSeconds(question,attempt.time_mode,attempt.policy_version||1)).toISOString();
      await updateAttempt(attempt,{question_deadline:attempt.question_deadline});
    }
    return {question:publicQuestion(question,attempt.time_mode,attempt.policy_version||1),questionExpiresAt:attempt.question_deadline,serverNow:new Date().toISOString(),answered:attempt.answers.length};
  },
  async answer(user:AuthenticatedUser,id:string,body:z.infer<typeof answerAssessmentSchema>):Promise<any> {
    const attempt=await getAttempt(user,id);assertPending(attempt);
    const questions:ChallengeQuestionDTO[]=attempt.questions;const answers:any[]=attempt.answers;
    const current=questions[answers.length];
    if(!current||current.id!==body.question_id)throw new HttpError(409,'Esta pregunta ya fue respondida o no corresponde al intento.');
    if(attempt.policy_version>=2&&!attempt.question_deadline)throw new HttpError(409,'Primero abre la siguiente pregunta.');
    const timedOut=!!body.timed_out|| (!!attempt.question_deadline&&Date.parse(attempt.question_deadline)<=Date.now());
    if(!timedOut&&!body.answer.trim())throw new HttpError(400,'Selecciona o escribe una respuesta.');
    const correct=!timedOut&&gradeAssessmentAnswer(current,body.answer);
    const nextAnswers=[...answers,{question_id:current.id,answer:body.answer,correct,timed_out:timedOut,answered_at:new Date().toISOString()}];
    const failFast=attempt.policy_version>=5;
    const finished=(failFast&&!correct)||nextAnswers.length===questions.length;
    const score=Math.round(nextAnswers.filter(a=>a.correct).length/questions.length*100);
    const state=finished?(score>=(failFast?100:70)?'passed':'failed'):'pending';
    await updateAttempt(attempt,{answers:nextAnswers,score,state,question_deadline:null,submitted_at:finished?new Date().toISOString():null});
    return {correct,feedback:failFast&&!correct?(timedOut?'El tiempo de respuesta terminó.':'La respuesta no fue correcta.')+' Este intento terminó. La próxima evaluación tendrá preguntas nuevas.':timedOut?'El tiempo terminó o se omitió la respuesta. '+current.explanation:current.explanation,score,answered:nextAnswers.length,totalQuestions:questions.length,
      finished,passed:finished&&state==='passed',nextQuestion:null,needsNext:!finished,serverNow:new Date().toISOString(),
      terminationReason:failFast&&!correct?(timedOut?'time_expired':'incorrect_answer'):undefined,
      ...pauseState({...attempt,answers:nextAnswers,state,question_deadline:null})};
  },
  async event(user:AuthenticatedUser,id:string,body:z.infer<typeof integrityEventSchema>):Promise<any> {
    for(let retry=0;retry<3;retry++) {
      const attempt=await getAttempt(user,id);
      if(!['pending','passed'].includes(attempt.state))return {state:attempt.state,integrityCount:incidentCount(attempt),integrityLimit:3};
      const events:any[]=attempt.integrity_events||[];
      if(events.some(e=>e.event_id===body.event_id))return {state:attempt.state,integrityCount:incidentCount(attempt),integrityLimit:3};
      const last=events.at(-1);const now=Date.now();
      const counted=!last||now-Date.parse(last.recorded_at)>2000;
      const next=[...events.slice(-49),{...body,counted,recorded_at:new Date(now).toISOString()}];
      const count=incidentCount(attempt)+(counted?1:0);
      const state=body.type==='abandon'||count>=3?'failed':attempt.state;
      try {await updateAttempt(attempt,{integrity_events:next,integrity_count:count,state,...(state==='failed'?{submitted_at:new Date().toISOString()}: {})});return {state,integrityCount:count,integrityLimit:3};}
      catch(error){if(!(error instanceof HttpError)||error.status!==409||retry===2)throw error;}
    }
  },
  async grant(user:AuthenticatedUser,attemptId:string):Promise<any> {
    const attempt=await getAttempt(user,attemptId);
    if(incidentCount(attempt)>=3)throw new HttpError(409,'El intento terminó por incidencias de integridad. Inicia una nueva evaluación.');
    if(!['passed','granted'].includes(attempt.state))throw new HttpError(409,'Primero debes aprobar la evaluación completa.');
    if(attempt.policy_version>=5&&(attempt.answers.length!==attempt.questions.length||attempt.answers.some((answer:any)=>!answer.correct)||attempt.score!==100))throw new HttpError(409,'Debes completar todas las preguntas sin errores para acreditar esta evaluación.');
    if(attempt.state!=='granted'&&Date.parse(attempt.expires_at)<=Date.now())throw new HttpError(410,'El intento aprobado expiró. Inicia una nueva evaluación.');
    const admin=getAdminSupabase();
    const granted=await admin.rpc('grant_tutor_assessment',{p_attempt_id:attemptId,p_user_id:user.id});
    if(granted.error?.code==='23505') {
      // Si existía una solicitud pendiente sin resolver para la misma materia, cerrarla como superada por la evaluación aprobada y reintentar una sola vez.
      await admin
        .from('tutor_verification_requests')
        .delete()
        .eq('tutor_id',user.id)
        .eq('subject_id',attempt.subject_id)
        .in('status',['pending','practical_evaluation','under_review']);
      return result(admin.rpc('grant_tutor_assessment',{p_attempt_id:attemptId,p_user_id:user.id}),
        'No fue posible confirmar la acreditación. Tu evaluación permanece guardada.');
    }
    return result(Promise.resolve(granted),
      'No fue posible confirmar la acreditación. Tu evaluación permanece guardada.');
  },
};
