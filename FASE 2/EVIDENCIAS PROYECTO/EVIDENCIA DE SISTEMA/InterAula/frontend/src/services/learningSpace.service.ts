import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { LearningSpaceOverview, LearningSpaceConfig, LearningPath, StudyTask, TopicAssessment, AdaptiveExplanation, ExplanationMode, LearningPace } from '../types/learningSpace';

// Private learning data is read from the active session; failed writes remain failures.
export const learningSpaceService = {
  getOverview(): Promise<LearningSpaceOverview> { return apiClient.get(API_ENDPOINTS.LEARNING_SPACE.OVERVIEW); },
  updateConfig(config: Partial<LearningSpaceConfig>): Promise<LearningSpaceConfig> { return apiClient.put(API_ENDPOINTS.LEARNING_SPACE.CONFIG, config); },
  async createLearningPath(params: { subject_id?: string | null; subject_name: string; title: string; goal: string; pace?: LearningPace; preferred_mode?: ExplanationMode }): Promise<LearningPath> {
    if (!params.subject_name || params.subject_name.trim().length < 2) throw new Error('Debes seleccionar o indicar una asignatura válida.');
    if (!params.title || params.title.trim().length < 3) throw new Error('El título de la ruta debe tener al menos 3 caracteres.');
    if (!params.goal || params.goal.trim().length < 5) throw new Error('Describe brevemente el objetivo que deseas alcanzar.');
    return apiClient.post(API_ENDPOINTS.LEARNING_SPACE.PATHS, params);
  },
  updateLearningPath(id: string, update: Partial<Pick<LearningPath, 'subject_name' | 'title' | 'goal' | 'pace' | 'preferred_mode' | 'status'>>): Promise<LearningPath> {
    return apiClient.patch(API_ENDPOINTS.LEARNING_SPACE.PATH_BY_ID(id), update);
  },
  addStageToPath(id: string, stage: { title: string; description?: string; content_topic?: string; practice_prompt?: string }): Promise<LearningPath> {
    return apiClient.post(API_ENDPOINTS.LEARNING_SPACE.ADD_STAGE(id), stage);
  },
  toggleStage(id: string, stageId: string, completed: boolean): Promise<LearningPath> { return apiClient.patch(API_ENDPOINTS.LEARNING_SPACE.TOGGLE_STAGE(id, stageId), { completed }); },
  async deleteLearningPath(id: string): Promise<void> { await apiClient.delete(API_ENDPOINTS.LEARNING_SPACE.PATH_BY_ID(id)); },
  async createStudyTask(params: { subject_name: string; title: string; priority?: 'baja' | 'media' | 'alta'; study_interval_minutes?: number; break_minutes?: number; subtasks?: Array<{ title: string; completed?: boolean }> }): Promise<StudyTask> {
    if (!params.title || params.title.trim().length < 3) throw new Error('El título de la tarea debe tener al menos 3 caracteres.');
    return apiClient.post(API_ENDPOINTS.LEARNING_SPACE.TASKS, params);
  },
  updateStudyTask(id: string, update: Partial<Pick<StudyTask, 'title' | 'subject_name' | 'priority' | 'status' | 'study_interval_minutes' | 'break_minutes' | 'subtasks'>>): Promise<StudyTask> { return apiClient.patch(API_ENDPOINTS.LEARNING_SPACE.TASK_BY_ID(id), update); },
  async deleteStudyTask(id: string): Promise<void> { await apiClient.delete(API_ENDPOINTS.LEARNING_SPACE.TASK_BY_ID(id)); },
  recordTopicAssessment(params: { subject_name: string; topic_name: string; score: number; total_questions: number; recurring_errors?: string[] }): Promise<TopicAssessment> { return apiClient.post(API_ENDPOINTS.LEARNING_SPACE.ASSESSMENTS, params); },
  getAdaptiveExplanation(params: { subject_name: string; topic: string; mode: ExplanationMode; goal?: string }): Promise<AdaptiveExplanation> { return apiClient.post(API_ENDPOINTS.LEARNING_SPACE.EXPLAIN, params); },
};
