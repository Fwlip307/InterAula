import crypto from 'node:crypto';
import { HttpError } from '../../lib/httpError.js';
import { clientFor, result, existing } from './database.js';
import { DEFAULT_CONFIG, buildDefaultStagesForGoal } from '../learningSpace.service.js';
import type { UpdateLearningSpaceConfigInput, CreateLearningPathInput, UpdateLearningPathInput, AddLearningStageInput, CreateStudyTaskInput, UpdateStudyTaskInput, RecordTopicAssessmentInput, CreateQuickIdeaInput, UpdateQuickIdeaInput } from '../../schemas/learningSpace.schema.js';
import type { LearningPathWithStages } from '../learningSpace.service.js';
import type { StoredLearningSpaceConfig, StoredStudyTask, StoredTopicAssessment, StoredQuickIdea } from '../../lib/persistentStore.js';

async function pathDetail(userId:string,token:string,id:string):Promise<LearningPathWithStages> {
  const path=await existing(clientFor(token).from('learning_paths').select('*').eq('id',id).eq('user_id',userId).maybeSingle(),'Ruta de aprendizaje no encontrada o sin permisos.');
  const stages=await result(clientFor(token).from('learning_path_stages').select('*').eq('path_id',id).order('order_index'));
  return {...path,stages};
}
export const remoteLearningSpaceService = {
  async getConfig(userId:string,token:string):Promise<StoredLearningSpaceConfig> {
    const profile=await existing(clientFor(token).from('profiles').select('learning_space_config').eq('id',userId).maybeSingle(),'Perfil no encontrado.');
    return {...DEFAULT_CONFIG,...profile.learning_space_config,user_id:userId};
  },
  async updateConfig(userId:string,token:string,input:UpdateLearningSpaceConfigInput):Promise<StoredLearningSpaceConfig> {
    const config=await result(clientFor(token).rpc('update_learning_config',{p_config:input}));
    return {...DEFAULT_CONFIG,...config,user_id:userId};
  },
  async listLearningPaths(userId:string,token:string):Promise<LearningPathWithStages[]> {
    const paths=await result(clientFor(token).from('learning_paths').select('*').eq('user_id',userId).order('updated_at',{ascending:false}));
    if(!paths.length)return [];
    const stages=await result(clientFor(token).from('learning_path_stages').select('*').in('path_id',paths.map((p:any)=>p.id)).order('order_index'));
    return paths.map((path:any)=>({...path,stages:stages.filter((stage:any)=>stage.path_id===path.id)}));
  },
  async createLearningPath(userId:string,token:string,input:CreateLearningPathInput):Promise<LearningPathWithStages> {
    const stages=input.stages?.length?input.stages:buildDefaultStagesForGoal(input.subject_name,input.title,input.goal);
    const id=await result(clientFor(token).rpc('create_learning_path',{p_payload:input,p_stages:stages}));
    return pathDetail(userId,token,id);
  },
  async updateLearningPath(userId:string,token:string,id:string,input:UpdateLearningPathInput):Promise<LearningPathWithStages> {
    await existing(clientFor(token).from('learning_paths').update({...input,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('id').maybeSingle(),'Ruta de aprendizaje no encontrada o sin permisos.');
    return pathDetail(userId,token,id);
  },
  async addStageToPath(userId:string,token:string,id:string,input:AddLearningStageInput):Promise<LearningPathWithStages> {
    await result(clientFor(token).rpc('add_learning_stage',{p_path_id:id,p_stage:input}));
    return pathDetail(userId,token,id);
  },
  async toggleStageCompletion(userId:string,token:string,id:string,stageId:string,completed:boolean):Promise<LearningPathWithStages> {
    await pathDetail(userId,token,id);
    await existing(clientFor(token).from('learning_path_stages').update({completed,completed_at:completed?new Date().toISOString():null})
      .eq('id',stageId).eq('path_id',id).select('id').maybeSingle(),'Etapa no encontrada.');
    return pathDetail(userId,token,id);
  },
  async deleteLearningPath(userId:string,token:string,id:string):Promise<void> {
    await existing(clientFor(token).from('learning_paths').delete().eq('id',id).eq('user_id',userId).select('id').maybeSingle(),'Ruta no encontrada o sin permisos.');
  },
  async listStudyTasks(userId:string,token:string):Promise<StoredStudyTask[]> {
    return result(clientFor(token).from('study_tasks').select('*').eq('user_id',userId).order('created_at',{ascending:false}));
  },
  async createStudyTask(userId:string,token:string,input:CreateStudyTaskInput):Promise<StoredStudyTask> {
    const subtasks=(input.subtasks?.length?input.subtasks:[{title:'Revisar los conceptos principales'},{title:'Resolver un ejercicio guiado'},{title:'Anotar dudas y comprobar lo aprendido'}])
      .map(subtask=>({...subtask,id:crypto.randomUUID(),completed:false}));
    return result(clientFor(token).from('study_tasks').insert({...input,user_id:userId,subtasks,status:'pending'}).select('*').single());
  },
  async updateStudyTask(userId:string,token:string,id:string,input:UpdateStudyTaskInput):Promise<StoredStudyTask> {
    const current=await existing(clientFor(token).from('study_tasks').select('*').eq('id',id).eq('user_id',userId).maybeSingle(),'Tarea no encontrada o sin permisos.');
    let status=input.status||current.status;
    if(input.subtasks&&!input.status){
      const done=input.subtasks.length>0&&input.subtasks.every(subtask=>subtask.completed);
      status=done?'completed':current.status==='completed'?'in_progress':current.status;
    }
    return existing(clientFor(token).from('study_tasks').update({...input,status,updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',userId).eq('updated_at',current.updated_at).select('*').maybeSingle(),'La tarea cambió. Recarga antes de guardar.');
  },
  async deleteStudyTask(userId:string,token:string,id:string):Promise<void> {
    await existing(clientFor(token).from('study_tasks').delete().eq('id',id).eq('user_id',userId).select('id').maybeSingle(),'Tarea no encontrada o sin permisos.');
  },
  async listTopicAssessments(userId:string,token:string):Promise<StoredTopicAssessment[]> {
    const rows: StoredTopicAssessment[] = await result(clientFor(token).from('topic_assessments').select('*').eq('user_id',userId).order('last_practiced_at',{ascending:false}));
    const latest = new Map<string, StoredTopicAssessment>();
    for (const row of rows) {
      const key = row.subject_name.toLowerCase() + ':' + row.topic_name.toLowerCase();
      if (!latest.has(key)) latest.set(key, row);
    }
    return [...latest.values()];
  },
  async recordTopicAssessment(_userId:string,token:string,input:RecordTopicAssessmentInput):Promise<StoredTopicAssessment> {
    if(input.score>input.total_questions)throw new HttpError(400,'El puntaje no puede superar el total de preguntas.');
    return result(clientFor(token).rpc('record_learning_assessment',{p_payload:input}));
  },
  async listQuickIdeas(userId:string,token:string):Promise<StoredQuickIdea[]> {
    return result(clientFor(token).from('quick_ideas').select('*').eq('user_id',userId).order('created_at',{ascending:false}));
  },
  async createQuickIdea(userId:string,token:string,input:CreateQuickIdeaInput):Promise<StoredQuickIdea> {
    return result(clientFor(token).from('quick_ideas').insert({user_id:userId,context_type:input.context_type||'learning_space',context_id:input.context_id||null,content:input.content.trim(),resolved:false}).select('*').single());
  },
  async updateQuickIdea(userId:string,token:string,id:string,input:UpdateQuickIdeaInput):Promise<StoredQuickIdea> {
    return existing(clientFor(token).from('quick_ideas').update({...input,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('*').maybeSingle(),'Idea rápida no encontrada.');
  },
  async deleteQuickIdea(userId:string,token:string,id:string):Promise<void> {
    await existing(clientFor(token).from('quick_ideas').delete().eq('id',id).eq('user_id',userId).select('id').maybeSingle(),'Idea rápida no encontrada.');
  },
  async convertQuickIdeaToTask(userId:string,token:string,id:string):Promise<{idea:StoredQuickIdea;task:StoredStudyTask}> {
    const idea=await existing(clientFor(token).from('quick_ideas').select('*').eq('id',id).eq('user_id',userId).maybeSingle(),'Idea rápida no encontrada.');
    const task=await remoteLearningSpaceService.createStudyTask(userId,token,{title:idea.content.slice(0,180),subject_name:'General',priority:'media'});
    const updatedIdea=await existing(clientFor(token).from('quick_ideas').update({resolved:true,converted_task_id:task.id,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('*').maybeSingle(),'No se pudo actualizar la idea.');
    return {idea:updatedIdea,task};
  },
};
