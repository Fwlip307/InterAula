import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type {
  LearningSpaceOverview,
  LearningSpaceConfig,
  LearningPath,
  StudyTask,
  TopicAssessment,
  AdaptiveExplanation,
  ExplanationMode,
  LearningPace,
} from '../types/learningSpace';

const LOCAL_STORAGE_KEY = 'interaula_learning_space_v1';

const DEFAULT_CONFIG: LearningSpaceConfig = {
  onboardingCompleted: false,
  shareWithTutors: false,
  explanationStyle: ['step_by_step', 'practical_examples'],
  organizationStyle: ['short_tasks', 'frequent_breaks'],
  communicationStyle: ['message_first', 'individual_tutoring'],
  environmentStyle: ['calm_interface', 'untimed_practice'],
  defaultStudyIntervalMinutes: 20,
  defaultBreakMinutes: 5,
  subjectsToReinforce: [],
  learningGoalSummary: '',
};

function loadLocalFallback(): LearningSpaceOverview {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        paths: Array.isArray(parsed.paths) ? parsed.paths : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
      };
    }
  } catch {
    // Ignorar error de lectura local
  }
  return {
    config: { ...DEFAULT_CONFIG },
    paths: [],
    tasks: [],
    assessments: [],
  };
}

function saveLocalFallback(overview: LearningSpaceOverview): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overview));
  } catch {
    // Ignorar error de escritura local
  }
}

export const learningSpaceService = {
  /**
   * Obtiene el resumen completo de Mi espacio de aprendizaje desde el backend
   */
  async getOverview(): Promise<LearningSpaceOverview> {
    try {
      const data = await apiClient.get<LearningSpaceOverview>(
        API_ENDPOINTS.LEARNING_SPACE.OVERVIEW
      );
      if (data) {
        saveLocalFallback(data);
        return data;
      }
    } catch {
      // Fallback local resiliente
    }
    return loadLocalFallback();
  },

  /**
   * Actualiza las preferencias estructuradas del perfil de aprendizaje
   */
  async updateConfig(
    configUpdate: Partial<LearningSpaceConfig>
  ): Promise<LearningSpaceConfig> {
    try {
      const updated = await apiClient.put<LearningSpaceConfig>(
        API_ENDPOINTS.LEARNING_SPACE.CONFIG,
        configUpdate
      );
      const current = loadLocalFallback();
      current.config = updated;
      saveLocalFallback(current);
      return updated;
    } catch {
      const current = loadLocalFallback();
      current.config = {
        ...current.config,
        ...configUpdate,
        updated_at: new Date().toISOString(),
      };
      saveLocalFallback(current);
      return current.config;
    }
  },

  /**
   * Crea una ruta de aprendizaje personalizada con sus etapas
   */
  async createLearningPath(params: {
    subject_id?: string | null;
    subject_name: string;
    title: string;
    goal: string;
    pace?: LearningPace;
    preferred_mode?: ExplanationMode;
  }): Promise<LearningPath> {
    if (!params.subject_name || params.subject_name.trim().length < 2) {
      throw new Error('Debes seleccionar o indicar una asignatura válida.');
    }
    if (!params.title || params.title.trim().length < 3) {
      throw new Error('El título de la ruta debe tener al menos 3 caracteres.');
    }
    if (!params.goal || params.goal.trim().length < 5) {
      throw new Error('Describe brevemente el objetivo que deseas alcanzar.');
    }

    const created = await apiClient.post<LearningPath>(
      API_ENDPOINTS.LEARNING_SPACE.PATHS,
      params
    );
    const current = loadLocalFallback();
    current.paths = [created, ...current.paths.filter((p) => p.id !== created.id)];
    saveLocalFallback(current);
    return created;
  },

  /**
   * Edita los datos principales de una ruta de aprendizaje existente
   */
  async updateLearningPath(
    pathId: string,
    update: Partial<
      Pick<
        LearningPath,
        'subject_name' | 'title' | 'goal' | 'pace' | 'preferred_mode' | 'status'
      >
    >
  ): Promise<LearningPath> {
    const updated = await apiClient.patch<LearningPath>(
      API_ENDPOINTS.LEARNING_SPACE.PATH_BY_ID(pathId),
      update
    );
    const current = loadLocalFallback();
    current.paths = current.paths.map((p) => (p.id === pathId ? updated : p));
    saveLocalFallback(current);
    return updated;
  },

  /**
   * Agrega una etapa personalizada a una ruta de aprendizaje existente
   */
  async addStageToPath(
    pathId: string,
    stage: {
      title: string;
      description?: string;
      content_topic?: string;
      practice_prompt?: string;
    }
  ): Promise<LearningPath> {
    const updated = await apiClient.post<LearningPath>(
      API_ENDPOINTS.LEARNING_SPACE.ADD_STAGE(pathId),
      stage
    );
    const current = loadLocalFallback();
    current.paths = current.paths.map((p) => (p.id === pathId ? updated : p));
    saveLocalFallback(current);
    return updated;
  },

  /**
   * Marca o desmarca una etapa de una ruta de aprendizaje y actualiza el progreso real
   */
  async toggleStage(
    pathId: string,
    stageId: string,
    completed: boolean
  ): Promise<LearningPath> {
    const updated = await apiClient.patch<LearningPath>(
      API_ENDPOINTS.LEARNING_SPACE.TOGGLE_STAGE(pathId, stageId),
      { completed }
    );
    const current = loadLocalFallback();
    current.paths = current.paths.map((p) => (p.id === pathId ? updated : p));
    saveLocalFallback(current);
    return updated;
  },

  /**
   * Elimina una ruta de aprendizaje
   */
  async deleteLearningPath(pathId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.LEARNING_SPACE.PATH_BY_ID(pathId));
    const current = loadLocalFallback();
    current.paths = current.paths.filter((p) => p.id !== pathId);
    saveLocalFallback(current);
  },

  /**
   * Crea una tarea de estudio dividida en subtareas con intervalos configurables
   */
  async createStudyTask(params: {
    subject_name: string;
    title: string;
    priority?: 'baja' | 'media' | 'alta';
    study_interval_minutes?: number;
    break_minutes?: number;
    subtasks?: Array<{ title: string; completed?: boolean }>;
  }): Promise<StudyTask> {
    if (!params.title || params.title.trim().length < 3) {
      throw new Error('El título de la tarea debe tener al menos 3 caracteres.');
    }

    const created = await apiClient.post<StudyTask>(
      API_ENDPOINTS.LEARNING_SPACE.TASKS,
      params
    );
    const current = loadLocalFallback();
    current.tasks = [created, ...current.tasks];
    saveLocalFallback(current);
    return created;
  },

  /**
   * Actualiza el estado o las subtareas de una tarea de estudio
   */
  async updateStudyTask(
    taskId: string,
    update: Partial<
      Pick<
        StudyTask,
        | 'title'
        | 'subject_name'
        | 'priority'
        | 'status'
        | 'study_interval_minutes'
        | 'break_minutes'
        | 'subtasks'
      >
    >
  ): Promise<StudyTask> {
    const updated = await apiClient.patch<StudyTask>(
      API_ENDPOINTS.LEARNING_SPACE.TASK_BY_ID(taskId),
      update
    );
    const current = loadLocalFallback();
    current.tasks = current.tasks.map((t) => (t.id === taskId ? updated : t));
    saveLocalFallback(current);
    return updated;
  },

  /**
   * Elimina una tarea de estudio
   */
  async deleteStudyTask(taskId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.LEARNING_SPACE.TASK_BY_ID(taskId));
    const current = loadLocalFallback();
    current.tasks = current.tasks.filter((t) => t.id !== taskId);
    saveLocalFallback(current);
  },

  /**
   * Registra una comprobación corta de comprensión para seguimiento inteligente por tema
   */
  async recordTopicAssessment(params: {
    subject_name: string;
    topic_name: string;
    score: number;
    total_questions: number;
    recurring_errors?: string[];
  }): Promise<TopicAssessment> {
    const created = await apiClient.post<TopicAssessment>(
      API_ENDPOINTS.LEARNING_SPACE.ASSESSMENTS,
      params
    );
    const current = loadLocalFallback();
    const filtered = current.assessments.filter(
      (a) =>
        !(
          a.subject_name.toLowerCase() === created.subject_name.toLowerCase() &&
          a.topic_name.toLowerCase() === created.topic_name.toLowerCase()
        )
    );
    current.assessments = [created, ...filtered];
    saveLocalFallback(current);
    return created;
  },

  /**
   * Obtiene una explicación adaptable ("Aprende a tu manera") en el modo elegido
   */
  async getAdaptiveExplanation(params: {
    subject_name: string;
    topic: string;
    mode: ExplanationMode;
    goal?: string;
  }): Promise<AdaptiveExplanation> {
    return apiClient.post<AdaptiveExplanation>(
      API_ENDPOINTS.LEARNING_SPACE.EXPLAIN,
      params
    );
  },
};

