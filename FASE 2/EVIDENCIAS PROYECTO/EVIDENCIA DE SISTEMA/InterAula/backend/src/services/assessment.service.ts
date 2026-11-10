import crypto from 'node:crypto';
import { z } from 'zod';
import { aiBackendService, type ChallengeQuestionDTO } from './ai.service.js';
import { getAdminSupabase, getAuthenticatedSupabase } from '../lib/supabase.js';
import { HttpError } from '../lib/httpError.js';
import { result, existing } from './remote/database.js';
import type { AuthenticatedUser } from '../types/index.js';

const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const answerSchema=z.object({question_id:z.string().min(1).max(150),answer:z.string().trim().min(1).max(1500)}).strict();
export const startAssessmentSchema=z.object({subject_id:z.string().uuid()}).strict();
export const answerAssessmentSchema=answerSchema;
export const grantAssessmentSchema=z.object({attempt_id:z.string().uuid()}).strict();
function publicQuestion(question:ChallengeQuestionDTO|undefined) {
  if(!question)return null;
  return {id:question.id,type:question.type,prompt:question.prompt,options:question.options,codeSnippet:question.codeSnippet,placeholder:question.placeholder};
}
export function gradeAssessmentAnswer(question:ChallengeQuestionDTO,answer:string):boolean {
  if(question.type==='choice')return answer===question.correctOptionId;
  return (question.acceptedAnswers||[]).some(expected=>normalize(answer)===normalize(expected));
}
export const assessmentService={
  async start(user:AuthenticatedUser,token:string,subjectId:string):Promise<any> {
    const admin=getAdminSupabase();
    const offered=await existing(getAuthenticatedSupabase(token).from('profile_offered_subjects')
      .select('subject_id,is_verified,subject:subjects(name)').eq('profile_id',user.id).eq('subject_id',subjectId).maybeSingle(),
      'Primero registra esta asignatura entre las materias que puedes enseñar.');
    if(offered.is_verified)throw new HttpError(409,'Esta asignatura ya está acreditada.');
    const subjectName=offered.subject?.name;
    if(!subjectName)throw new HttpError(404,'Asignatura no encontrada.');
    const questions=aiBackendService.getAccreditationQuestions(subjectName).map(question=>({...question,id:crypto.randomUUID()}));
    if(questions.length<5)throw new HttpError(422,'Esta asignatura requiere revisión docente porque todavía no tiene un banco de acreditación validado.');
    const recent=await result(admin.from('tutor_assessment_attempts').select('id').eq('user_id',user.id)
      .gte('created_at',new Date(Date.now()-60*60*1000).toISOString()));
    if(recent.length>=3)throw new HttpError(429,'Ya iniciaste tres evaluaciones durante la última hora. Puedes volver a intentar más tarde.');
    const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString();
    const attempt=await result(admin.from('tutor_assessment_attempts').insert({user_id:user.id,subject_id:subjectId,
      level:'basic',questions,answers:[],state:'pending',expires_at:expiresAt}).select('id').single());
    return {id:attempt.id,subjectId,subjectName,level:'basic',totalQuestions:questions.length,expiresAt,question:publicQuestion(questions[0])};
  },
  async answer(user:AuthenticatedUser,id:string,body:z.infer<typeof answerSchema>):Promise<any> {
    const admin=getAdminSupabase();
    const attempt=await existing(admin.from('tutor_assessment_attempts').select('*').eq('id',id).eq('user_id',user.id).maybeSingle(),'Evaluación no encontrada.');
    if(attempt.state!=='pending')throw new HttpError(409,'Esta evaluación ya terminó.');
    if(new Date(attempt.expires_at).getTime()<=Date.now())throw new HttpError(410,'La evaluación expiró. Inicia un nuevo intento.');
    const questions:ChallengeQuestionDTO[]=attempt.questions;
    const answers:any[]=attempt.answers;
    const current=questions[answers.length];
    if(!current||current.id!==body.question_id)throw new HttpError(409,'Esta pregunta ya fue respondida o no corresponde al intento.');
    const correct=gradeAssessmentAnswer(current,body.answer);
    const nextAnswers=[...answers,{question_id:current.id,answer:body.answer,correct}];
    const finished=nextAnswers.length===questions.length;
    const score=Math.round(nextAnswers.filter(answer=>answer.correct).length/questions.length*100);
    const state=finished?(score>=70?'passed':'failed'):'pending';
    const updated=await result(admin.from('tutor_assessment_attempts').update({answers:nextAnswers,score,state,revision:attempt.revision+1,
      submitted_at:finished?new Date().toISOString():null,updated_at:new Date().toISOString()})
      .eq('id',id).eq('state','pending').eq('revision',attempt.revision).select('id').maybeSingle());
    if(!updated)throw new HttpError(409,'La respuesta ya fue procesada. Recarga la evaluación.');
    return {correct,feedback:current.explanation,score,answered:nextAnswers.length,totalQuestions:questions.length,
      finished,passed:finished&&state==='passed',nextQuestion:publicQuestion(questions[nextAnswers.length])};
  },
  async grant(user:AuthenticatedUser,attemptId:string):Promise<any> {
    return result(getAdminSupabase().rpc('grant_tutor_assessment',{p_attempt_id:attemptId,p_user_id:user.id}),
      'No fue posible confirmar la acreditación. Tu evaluación permanece guardada.');
  },
};
