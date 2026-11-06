import { getAuthenticatedSupabase as createSupabaseUserClient } from '../lib/supabase.js';
import { callFreeGenerativeAI, randomizeQuestionOptions } from './ai.service.js';
import {
  persistentStore,
  isSchemaMissingError,
  type StoredLearningPath,
  type StoredLearningPathStage,
  type StoredStudyTask,
  type StoredTopicAssessment,
  type StoredLearningSpaceConfig,
} from '../lib/persistentStore.js';
import type {
  UpdateLearningSpaceConfigInput,
  CreateLearningPathInput,
  UpdateLearningPathInput,
  AddLearningStageInput,
  CreateStudyTaskInput,
  UpdateStudyTaskInput,
  RecordTopicAssessmentInput,
  AdaptiveExplanationRequestInput,
} from '../schemas/learningSpace.schema.js';

export interface LearningPathWithStages extends StoredLearningPath {
  stages: StoredLearningPathStage[];
}

export interface AdaptiveDraggableBlock {
  id: string;
  label: string;
  detail: string;
  correctSlotId: 'input' | 'process' | 'validation' | 'output';
  categoryTag: string;
}

export interface AdaptiveExplanationResponse {
  subject_name: string;
  topic: string;
  mode: AdaptiveExplanationRequestInput['mode'];
  mode_label: string;
  source: 'ai_gemini' | 'pedagogical_engine';
  summary: string;
  key_points: string[];
  practical_example: string;
  visual_structure: string[];
  draggable_blocks?: AdaptiveDraggableBlock[];
  comprehension_check: {
    question: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    feedback: string;
  };
}

const DEFAULT_CONFIG: Omit<StoredLearningSpaceConfig, 'user_id' | 'updated_at'> = {
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

function canQuerySupabase(token: string): boolean {
  return Boolean(token && token.split('.').length === 3 && !token.startsWith('mock-'));
}

const MODE_LABELS: Record<AdaptiveExplanationRequestInput['mode'], string> = {
  sencilla: 'Explicación sencilla',
  paso_a_paso: 'Paso a paso',
  ejemplos: 'Con ejemplos prácticos',
  visual: 'Visualmente',
  profunda: 'Explicación profunda',
  comprobar: 'Comprobar comprensión',
};

function buildDefaultStagesForGoal(
  subjectName: string,
  title: string,
  goal: string
): Array<{
  title: string;
  description: string;
  content_topic: string;
  practice_prompt: string;
}> {
  const cleanTopic = title.trim() || subjectName.trim();
  return [
    {
      title: `1. Fundamentos e ideas clave de ${cleanTopic}`,
      description: `Comprender qué problema resuelve ${cleanTopic} en ${subjectName} usando un lenguaje claro y sin tecnicismos innecesarios.`,
      content_topic: `Conceptos base de ${cleanTopic}`,
      practice_prompt: `Explica con tus propias palabras para qué sirve ${cleanTopic} y qué beneficio aporta.`,
    },
    {
      title: `2. Estructura y secuencia paso a paso`,
      description: `Desglosar el funcionamiento de ${cleanTopic} en pasos pequeños y ordenados para avanzar sin sobrecarga.`,
      content_topic: `Procedimiento paso a paso en ${cleanTopic}`,
      practice_prompt: `Enumera los 3 pasos principales que seguirías para aplicar ${cleanTopic} en un ejercicio básico.`,
    },
    {
      title: `3. Aplicación con casos prácticos reales`,
      description: `Conectar la teoría con tu meta: "${goal}". Analizar un caso concreto y resolver un ejercicio guiado.`,
      content_topic: `Casos aplicados de ${cleanTopic}`,
      practice_prompt: `Identifica un error frecuente al resolver problemas de ${cleanTopic} y cómo prevenirlo.`,
    },
    {
      title: `4. Comprobación de comprensión y síntesis`,
      description: `Verificar qué partes ya dominas y qué puntos conviene reforzar o conversar en una tutoría colaborativa.`,
      content_topic: `Autoevaluación de ${cleanTopic}`,
      practice_prompt: `Realiza la comprobación breve del tema y registra tu nivel de seguridad actual.`,
    },
  ];
}

function buildDefaultSubtasksForTask(title: string): Array<{ id: string; title: string; completed: boolean }> {
  const clean = title.trim();
  return [
    {
      id: persistentStore.newId(),
      title: `Revisar el objetivo principal y material base de: ${clean}`,
      completed: false,
    },
    {
      id: persistentStore.newId(),
      title: `Desarrollar la primera parte práctica a ritmo pausado`,
      completed: false,
    },
    {
      id: persistentStore.newId(),
      title: `Anotar dudas puntuales o validar el resultado obtenido`,
      completed: false,
    },
  ];
}

function computeMasteryLevel(
  score: number,
  totalQuestions: number
): StoredTopicAssessment['mastery_level'] {
  if (totalQuestions <= 0) return 'pendiente';
  const pct = Math.round((score / totalQuestions) * 100);
  if (pct >= 80) return 'consolidado';
  if (pct >= 55) return 'en_desarrollo';
  return 'necesita_practicar';
}

export const learningSpaceService = {
  /**
   * Obtener configuración del espacio de aprendizaje del estudiante
   */
  async getConfig(userId: string, token: string): Promise<StoredLearningSpaceConfig> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { data, error } = await supabase
          .from('profiles')
          .select('learning_space_config, updated_at')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data && data.learning_space_config) {
          const raw = data.learning_space_config as Record<string, any>;
          return {
            user_id: userId,
            onboardingCompleted: Boolean(raw.onboardingCompleted),
            shareWithTutors: Boolean(raw.shareWithTutors),
            explanationStyle: Array.isArray(raw.explanationStyle)
              ? raw.explanationStyle
              : DEFAULT_CONFIG.explanationStyle,
            organizationStyle: Array.isArray(raw.organizationStyle)
              ? raw.organizationStyle
              : DEFAULT_CONFIG.organizationStyle,
            communicationStyle: Array.isArray(raw.communicationStyle)
              ? raw.communicationStyle
              : DEFAULT_CONFIG.communicationStyle,
            environmentStyle: Array.isArray(raw.environmentStyle)
              ? raw.environmentStyle
              : DEFAULT_CONFIG.environmentStyle,
            defaultStudyIntervalMinutes:
              typeof raw.defaultStudyIntervalMinutes === 'number'
                ? raw.defaultStudyIntervalMinutes
                : DEFAULT_CONFIG.defaultStudyIntervalMinutes,
            defaultBreakMinutes:
              typeof raw.defaultBreakMinutes === 'number'
                ? raw.defaultBreakMinutes
                : DEFAULT_CONFIG.defaultBreakMinutes,
            subjectsToReinforce: Array.isArray(raw.subjectsToReinforce)
              ? raw.subjectsToReinforce
              : [],
            learningGoalSummary:
              typeof raw.learningGoalSummary === 'string' ? raw.learningGoalSummary : '',
            updated_at: data.updated_at || new Date().toISOString(),
          };
        }
      } catch {
        // Fallback a persistentStore
      }
    }

    const db = persistentStore.read();
    const existing = db.learning_space_configs.find((c) => c.user_id === userId);
    if (existing) {
      return {
        ...DEFAULT_CONFIG,
        ...existing,
        shareWithTutors: Boolean(existing.shareWithTutors),
      };
    }

    return {
      user_id: userId,
      ...DEFAULT_CONFIG,
      updated_at: new Date().toISOString(),
    };
  },

  /**
   * Guardar configuración del espacio de aprendizaje
   */
  async updateConfig(
    userId: string,
    token: string,
    input: UpdateLearningSpaceConfigInput
  ): Promise<StoredLearningSpaceConfig> {
    const current = await this.getConfig(userId, token);
    const now = new Date().toISOString();

    const updated: StoredLearningSpaceConfig = {
      user_id: userId,
      onboardingCompleted: input.onboardingCompleted ?? current.onboardingCompleted,
      shareWithTutors: input.shareWithTutors ?? Boolean(current.shareWithTutors),
      explanationStyle: input.explanationStyle ?? current.explanationStyle,
      organizationStyle: input.organizationStyle ?? current.organizationStyle,
      communicationStyle: input.communicationStyle ?? current.communicationStyle,
      environmentStyle: input.environmentStyle ?? current.environmentStyle,
      defaultStudyIntervalMinutes:
        input.defaultStudyIntervalMinutes ?? current.defaultStudyIntervalMinutes,
      defaultBreakMinutes: input.defaultBreakMinutes ?? current.defaultBreakMinutes,
      subjectsToReinforce: input.subjectsToReinforce ?? current.subjectsToReinforce,
      learningGoalSummary: input.learningGoalSummary ?? current.learningGoalSummary,
      updated_at: now,
    };

    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase
          .from('profiles')
          .update({
            learning_space_config: {
              onboardingCompleted: updated.onboardingCompleted,
              shareWithTutors: updated.shareWithTutors,
              explanationStyle: updated.explanationStyle,
              organizationStyle: updated.organizationStyle,
              communicationStyle: updated.communicationStyle,
              environmentStyle: updated.environmentStyle,
              defaultStudyIntervalMinutes: updated.defaultStudyIntervalMinutes,
              defaultBreakMinutes: updated.defaultBreakMinutes,
              subjectsToReinforce: updated.subjectsToReinforce,
              learningGoalSummary: updated.learningGoalSummary,
            },
            updated_at: now,
          })
          .eq('id', userId);
      } catch {
        // Continúa hacia persistentStore para garantizar persistencia
      }
    }

    persistentStore.write((db) => {
      const idx = db.learning_space_configs.findIndex((c) => c.user_id === userId);
      if (idx >= 0) {
        db.learning_space_configs[idx] = updated;
      } else {
        db.learning_space_configs.push(updated);
      }
    });

    return updated;
  },

  /**
   * Listar rutas de aprendizaje con sus etapas
   */
  async listLearningPaths(userId: string, token: string): Promise<LearningPathWithStages[]> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { data: paths, error } = await supabase
          .from('learning_paths')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (!error && Array.isArray(paths)) {
          if (paths.length === 0) {
            const local = this.listLocalLearningPaths(userId);
            if (local.length > 0) return local;
            return [];
          }

          const pathIds = paths.map((p) => p.id);
          const { data: stages } = await supabase
            .from('learning_path_stages')
            .select('*')
            .in('path_id', pathIds)
            .order('order_index', { ascending: true });

          const stagesByPath = new Map<string, StoredLearningPathStage[]>();
          for (const st of stages || []) {
            const list = stagesByPath.get(st.path_id) || [];
            list.push(st as StoredLearningPathStage);
            stagesByPath.set(st.path_id, list);
          }

          return paths.map((p) => ({
            ...(p as StoredLearningPath),
            stages: stagesByPath.get(p.id) || [],
          }));
        }
      } catch {
        // Fallback local
      }
    }

    return this.listLocalLearningPaths(userId);
  },

  listLocalLearningPaths(userId: string): LearningPathWithStages[] {
    const db = persistentStore.read();
    const userPaths = db.learning_paths
      .filter((p) => p.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    return userPaths.map((p) => ({
      ...p,
      stages: db.learning_path_stages
        .filter((s) => s.path_id === p.id)
        .sort((a, b) => a.order_index - b.order_index),
    }));
  },

  /**
   * Crear una nueva ruta de aprendizaje personalizada con sus etapas
   */
  async createLearningPath(
    userId: string,
    token: string,
    input: CreateLearningPathInput
  ): Promise<LearningPathWithStages> {
    const now = new Date().toISOString();
    const pathId = persistentStore.newId();
    const rawStages =
      input.stages && input.stages.length > 0
        ? input.stages
        : buildDefaultStagesForGoal(input.subject_name, input.title, input.goal);

    const newPath: StoredLearningPath = {
      id: pathId,
      user_id: userId,
      subject_id: input.subject_id || null,
      subject_name: input.subject_name,
      title: input.title,
      goal: input.goal,
      pace: input.pace || 'paso_a_paso',
      preferred_mode: input.preferred_mode || 'sencilla',
      status: 'active',
      progress_percent: 0,
      created_at: now,
      updated_at: now,
    };

    const newStages: StoredLearningPathStage[] = rawStages.map((st, idx) => ({
      id: persistentStore.newId(),
      path_id: pathId,
      order_index: idx + 1,
      title: st.title,
      description: st.description || '',
      content_topic: st.content_topic || input.title,
      practice_prompt: st.practice_prompt || '',
      completed: false,
      completed_at: null,
      created_at: now,
    }));

    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { error: pathErr } = await supabase.from('learning_paths').insert(newPath);
        if (!pathErr) {
          await supabase.from('learning_path_stages').insert(newStages);
        } else if (!isSchemaMissingError(pathErr)) {
          console.warn('[learningSpaceService] Error insertando ruta en Supabase:', pathErr.message);
        }
      } catch {
        // Fallback local
      }
    }

    persistentStore.write((db) => {
      db.learning_paths.push(newPath);
      db.learning_path_stages.push(...newStages);
    });

    return {
      ...newPath,
      stages: newStages,
    };
  },

  /**
   * Editar metadatos de una ruta de aprendizaje existente
   */
  async updateLearningPath(
    userId: string,
    token: string,
    pathId: string,
    input: UpdateLearningPathInput
  ): Promise<LearningPathWithStages> {
    const now = new Date().toISOString();
    let updatedResult: LearningPathWithStages | null = null;

    persistentStore.write((db) => {
      const pathObj = db.learning_paths.find((p) => p.id === pathId && p.user_id === userId);
      if (!pathObj) return;

      if (input.subject_name !== undefined) pathObj.subject_name = input.subject_name;
      if (input.title !== undefined) pathObj.title = input.title;
      if (input.goal !== undefined) pathObj.goal = input.goal;
      if (input.pace !== undefined) pathObj.pace = input.pace;
      if (input.preferred_mode !== undefined) pathObj.preferred_mode = input.preferred_mode;
      if (input.status !== undefined) pathObj.status = input.status;
      pathObj.updated_at = now;

      const stages = db.learning_path_stages
        .filter((s) => s.path_id === pathId)
        .sort((a, b) => a.order_index - b.order_index);

      updatedResult = {
        ...pathObj,
        stages,
      };
    });

    if (canQuerySupabase(token) && updatedResult) {
      try {
        const supabase = createSupabaseUserClient(token);
        const target = updatedResult as LearningPathWithStages;
        await supabase
          .from('learning_paths')
          .update({
            subject_name: target.subject_name,
            title: target.title,
            goal: target.goal,
            pace: target.pace,
            preferred_mode: target.preferred_mode,
            status: target.status,
            updated_at: now,
          })
          .eq('id', pathId)
          .eq('user_id', userId);
      } catch {
        // Persistido en persistentStore
      }
    }

    if (!updatedResult) {
      throw new Error('Ruta de aprendizaje no encontrada o sin permisos.');
    }

    return updatedResult;
  },

  /**
   * Agregar una etapa personalizada a una ruta existente y recalcular progreso
   */
  async addStageToPath(
    userId: string,
    token: string,
    pathId: string,
    input: AddLearningStageInput
  ): Promise<LearningPathWithStages> {
    const now = new Date().toISOString();
    let updatedResult: LearningPathWithStages | null = null;
    let createdStage: StoredLearningPathStage | null = null;

    persistentStore.write((db) => {
      const pathObj = db.learning_paths.find((p) => p.id === pathId && p.user_id === userId);
      if (!pathObj) return;

      const existingStages = db.learning_path_stages
        .filter((s) => s.path_id === pathId)
        .sort((a, b) => a.order_index - b.order_index);

      const nextIndex =
        existingStages.length > 0
          ? Math.max(...existingStages.map((s) => s.order_index)) + 1
          : 1;

      const newStage: StoredLearningPathStage = {
        id: persistentStore.newId(),
        path_id: pathId,
        order_index: nextIndex,
        title: input.title,
        description: input.description || '',
        content_topic: input.content_topic || input.title,
        practice_prompt: input.practice_prompt || '',
        completed: false,
        completed_at: null,
        created_at: now,
      };

      db.learning_path_stages.push(newStage);
      createdStage = newStage;

      const allStages = [...existingStages, newStage];
      const done = allStages.filter((s) => s.completed).length;
      pathObj.progress_percent =
        allStages.length > 0 ? Math.round((done / allStages.length) * 100) : 0;
      pathObj.status = pathObj.progress_percent === 100 ? 'completed' : 'active';
      pathObj.updated_at = now;

      updatedResult = {
        ...pathObj,
        stages: allStages,
      };
    });

    if (canQuerySupabase(token) && createdStage && updatedResult) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase.from('learning_path_stages').insert(createdStage);
        await supabase
          .from('learning_paths')
          .update({
            progress_percent: (updatedResult as LearningPathWithStages).progress_percent,
            status: (updatedResult as LearningPathWithStages).status,
            updated_at: now,
          })
          .eq('id', pathId)
          .eq('user_id', userId);
      } catch {
        // Persistido en persistentStore
      }
    }

    if (!updatedResult) {
      throw new Error('Ruta de aprendizaje no encontrada o sin permisos.');
    }

    return updatedResult;
  },

  /**
   * Marcar o desmarcar una etapa de la ruta y recalcular el porcentaje de avance
   */
  async toggleStageCompletion(
    userId: string,
    token: string,
    pathId: string,
    stageId: string,
    completed: boolean
  ): Promise<LearningPathWithStages> {
    const now = new Date().toISOString();

    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { data: pathRow } = await supabase
          .from('learning_paths')
          .select('*')
          .eq('id', pathId)
          .eq('user_id', userId)
          .maybeSingle();

        if (pathRow) {
          await supabase
            .from('learning_path_stages')
            .update({
              completed,
              completed_at: completed ? now : null,
            })
            .eq('id', stageId)
            .eq('path_id', pathId);

          const { data: allStages } = await supabase
            .from('learning_path_stages')
            .select('*')
            .eq('path_id', pathId)
            .order('order_index', { ascending: true });

          const stageList = (allStages || []) as StoredLearningPathStage[];
          const completedCount = stageList.filter((s) => s.completed).length;
          const progressPercent =
            stageList.length > 0 ? Math.round((completedCount / stageList.length) * 100) : 0;
          const status = progressPercent === 100 ? 'completed' : 'active';

          await supabase
            .from('learning_paths')
            .update({
              progress_percent: progressPercent,
              status,
              updated_at: now,
            })
            .eq('id', pathId);
        }
      } catch {
        // Continúa hacia persistentStore
      }
    }

    let updatedResult: LearningPathWithStages | null = null;

    persistentStore.write((db) => {
      const pathObj = db.learning_paths.find((p) => p.id === pathId && p.user_id === userId);
      if (!pathObj) return;

      const stageObj = db.learning_path_stages.find(
        (s) => s.id === stageId && s.path_id === pathId
      );
      if (stageObj) {
        stageObj.completed = completed;
        stageObj.completed_at = completed ? now : null;
      }

      const stages = db.learning_path_stages
        .filter((s) => s.path_id === pathId)
        .sort((a, b) => a.order_index - b.order_index);

      const done = stages.filter((s) => s.completed).length;
      pathObj.progress_percent = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
      pathObj.status = pathObj.progress_percent === 100 ? 'completed' : 'active';
      pathObj.updated_at = now;

      updatedResult = {
        ...pathObj,
        stages,
      };
    });

    if (updatedResult) return updatedResult;

    const allPaths = await this.listLearningPaths(userId, token);
    const found = allPaths.find((p) => p.id === pathId);
    if (!found) {
      throw new Error('Ruta de aprendizaje no encontrada.');
    }
    return found;
  },

  /**
   * Eliminar una ruta de aprendizaje
   */
  async deleteLearningPath(userId: string, token: string, pathId: string): Promise<void> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase.from('learning_paths').delete().eq('id', pathId).eq('user_id', userId);
      } catch {
        // Continúa en store local
      }
    }

    let foundAndDeleted = false;
    persistentStore.write((db) => {
      const existing = db.learning_paths.find((p) => p.id === pathId && p.user_id === userId);
      if (!existing) return;
      foundAndDeleted = true;
      db.learning_paths = db.learning_paths.filter(
        (p) => !(p.id === pathId && p.user_id === userId)
      );
      db.learning_path_stages = db.learning_path_stages.filter((s) => s.path_id !== pathId);
    });
    if (!foundAndDeleted) {
      throw new Error('Ruta no encontrada o sin permisos.');
    }
  },

  /**
   * Listar tareas de estudio del usuario
   */
  async listStudyTasks(userId: string, token: string): Promise<StoredStudyTask[]> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { data, error } = await supabase
          .from('study_tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((t: any) => ({
            ...t,
            priority: t.priority || 'media',
          })) as StoredStudyTask[];
        }
      } catch {
        // Fallback local
      }
    }

    const db = persistentStore.read();
    return db.study_tasks
      .filter((t) => t.user_id === userId)
      .map((t) => ({ ...t, priority: t.priority || 'media' }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  /**
   * Crear tarea de estudio dividida en subtareas pequeñas
   */
  async createStudyTask(
    userId: string,
    token: string,
    input: CreateStudyTaskInput
  ): Promise<StoredStudyTask> {
    const now = new Date().toISOString();
    const subtasks =
      input.subtasks && input.subtasks.length > 0
        ? input.subtasks.map((st) => ({
            id: st.id || persistentStore.newId(),
            title: st.title,
            completed: Boolean(st.completed),
          }))
        : buildDefaultSubtasksForTask(input.title);

    const newTask: StoredStudyTask = {
      id: persistentStore.newId(),
      user_id: userId,
      subject_name: input.subject_name || 'General',
      title: input.title,
      priority: input.priority || 'media',
      status: 'pending',
      study_interval_minutes: input.study_interval_minutes || 20,
      break_minutes: input.break_minutes || 5,
      subtasks,
      created_at: now,
      updated_at: now,
    };

    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase.from('study_tasks').insert(newTask);
      } catch {
        // Fallback local
      }
    }

    persistentStore.write((db) => {
      db.study_tasks.push(newTask);
    });

    return newTask;
  },

  /**
   * Actualizar estado o subtareas de una tarea de estudio
   */
  async updateStudyTask(
    userId: string,
    token: string,
    taskId: string,
    input: UpdateStudyTaskInput
  ): Promise<StoredStudyTask> {
    const now = new Date().toISOString();
    let updatedTask: StoredStudyTask | null = null;

    persistentStore.write((db) => {
      const task = db.study_tasks.find((t) => t.id === taskId && t.user_id === userId);
      if (!task) return;

      if (input.title !== undefined) task.title = input.title;
      if (input.subject_name !== undefined) task.subject_name = input.subject_name;
      if (input.priority !== undefined) task.priority = input.priority;
      if (!task.priority) task.priority = 'media';
      if (input.study_interval_minutes !== undefined) {
        task.study_interval_minutes = input.study_interval_minutes;
      }
      if (input.break_minutes !== undefined) {
        task.break_minutes = input.break_minutes;
      }
      if (input.subtasks !== undefined) {
        task.subtasks = input.subtasks;
        const allDone =
          task.subtasks.length > 0 && task.subtasks.every((st) => st.completed);
        if (allDone && !input.status) {
          task.status = 'completed';
        } else if (!allDone && task.status === 'completed' && !input.status) {
          task.status = 'in_progress';
        }
      }
      if (input.status !== undefined) {
        task.status = input.status;
      }
      task.updated_at = now;
      updatedTask = { ...task };
    });

    if (canQuerySupabase(token) && updatedTask) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase
          .from('study_tasks')
          .update({
            title: (updatedTask as StoredStudyTask).title,
            subject_name: (updatedTask as StoredStudyTask).subject_name,
            priority: (updatedTask as StoredStudyTask).priority,
            status: (updatedTask as StoredStudyTask).status,
            study_interval_minutes: (updatedTask as StoredStudyTask).study_interval_minutes,
            break_minutes: (updatedTask as StoredStudyTask).break_minutes,
            subtasks: (updatedTask as StoredStudyTask).subtasks,
            updated_at: now,
          })
          .eq('id', taskId)
          .eq('user_id', userId);
      } catch {
        // Ya persistido en persistentStore
      }
    }

    if (!updatedTask) {
      throw new Error('Tarea no encontrada o sin permisos.');
    }

    return updatedTask;
  },

  /**
   * Eliminar tarea de estudio
   */
  async deleteStudyTask(userId: string, token: string, taskId: string): Promise<void> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase.from('study_tasks').delete().eq('id', taskId).eq('user_id', userId);
      } catch {
        // Continúa en store local
      }
    }

    let deletedTask = false;
    persistentStore.write((db) => {
      const existing = db.study_tasks.find((t) => t.id === taskId && t.user_id === userId);
      if (!existing) return;
      deletedTask = true;
      db.study_tasks = db.study_tasks.filter(
        (t) => !(t.id === taskId && t.user_id === userId)
      );
    });
    if (!deletedTask) {
      throw new Error('Tarea no encontrada o sin permisos.');
    }
  },

  /**
   * Listar evaluaciones y estados de dominio por tema
   */
  async listTopicAssessments(userId: string, token: string): Promise<StoredTopicAssessment[]> {
    if (canQuerySupabase(token)) {
      try {
        const supabase = createSupabaseUserClient(token);
        const { data, error } = await supabase
          .from('topic_assessments')
          .select('*')
          .eq('user_id', userId)
          .order('last_practiced_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data as StoredTopicAssessment[];
        }
      } catch {
        // Fallback local
      }
    }

    const db = persistentStore.read();
    return db.topic_assessments
      .filter((a) => a.user_id === userId)
      .sort((a, b) => b.last_practiced_at.localeCompare(a.last_practiced_at));
  },

  /**
   * Registrar resultado de una evaluación corta de comprensión y actualizar dominio del tema
   */
  async recordTopicAssessment(
    userId: string,
    token: string,
    input: RecordTopicAssessmentInput
  ): Promise<StoredTopicAssessment> {
    const now = new Date().toISOString();
    const mastery_level = computeMasteryLevel(input.score, input.total_questions);

    let savedRecord: StoredTopicAssessment | null = null;

    persistentStore.write((db) => {
      const existing = db.topic_assessments.find(
        (a) =>
          a.user_id === userId &&
          a.subject_name.toLowerCase() === input.subject_name.toLowerCase() &&
          a.topic_name.toLowerCase() === input.topic_name.toLowerCase()
      );

      if (existing) {
        existing.score = input.score;
        existing.total_questions = input.total_questions;
        existing.mastery_level = mastery_level;
        existing.recurring_errors = input.recurring_errors || [];
        existing.last_practiced_at = now;
        existing.updated_at = now;
        savedRecord = { ...existing };
      } else {
        const created: StoredTopicAssessment = {
          id: persistentStore.newId(),
          user_id: userId,
          subject_name: input.subject_name,
          topic_name: input.topic_name,
          mastery_level,
          score: input.score,
          total_questions: input.total_questions,
          recurring_errors: input.recurring_errors || [],
          last_practiced_at: now,
          created_at: now,
          updated_at: now,
        };
        db.topic_assessments.push(created);
        savedRecord = created;
      }
    });

    if (canQuerySupabase(token) && savedRecord) {
      try {
        const supabase = createSupabaseUserClient(token);
        await supabase.from('topic_assessments').upsert(savedRecord);
      } catch {
        // Persistido localmente
      }
    }

    return savedRecord!;
  },

  /**
   * Generar explicación adaptable ("Aprende a tu manera") en 6 modos distintos
   */
  async generateAdaptiveExplanation(
    input: AdaptiveExplanationRequestInput
  ): Promise<AdaptiveExplanationResponse> {
    const modeLabel = MODE_LABELS[input.mode];
    const geminiKey = process.env.GEMINI_API_KEY;
    const randomSeed = Math.floor(Math.random() * 999999);

    const prompt = `Actúa como mentor académico inclusivo en InterAula ("Aprender juntos, a nuestra manera"). Semilla de variación #${randomSeed}.
Asignatura: "${input.subject_name}"
Tema específico: "${input.topic}"
Modo de explicación elegido por el estudiante: "${modeLabel}" (${input.mode})
Objetivo del estudiante: "${input.goal || 'Comprender el tema con claridad y aplicarlo con seguridad'}"

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (genera un ejemplo nuevo y una pregunta inédita que no se repita):
{
  "summary": "Explicación principal adaptada estrictamente al modo ${modeLabel} (3 a 5 oraciones claras, empáticas y rigurosas).",
  "key_points": [
    "Punto o paso clave 1",
    "Punto o paso clave 2",
    "Punto o paso clave 3",
    "Punto o paso clave 4"
  ],
  "practical_example": "Un ejemplo concreto y aplicado que ilustre el tema en la práctica universitaria.",
  "visual_structure": [
    "1. Entrada / Contexto -> Qué necesitamos antes de empezar",
    "2. Proceso central -> Cómo se transforma o aplica el concepto",
    "3. Resultado verificable -> Qué obtenemos y cómo comprobar que está bien"
  ],
  "draggable_blocks": [
    {"id": "blk-in-${randomSeed}", "label": "Título corto de bloque de entrada específico del tema", "detail": "Descripción breve de qué datos de entrada van aquí", "correctSlotId": "input", "categoryTag": "Contexto / Input"},
    {"id": "blk-pr-${randomSeed}", "label": "Título corto de bloque de transformación específico del tema", "detail": "Descripción breve de la regla u operación central", "correctSlotId": "process", "categoryTag": "Regla / Motor"},
    {"id": "blk-va-${randomSeed}", "label": "Título corto de validación y caso borde del tema", "detail": "Descripción de qué condición verificamos antes de terminar", "correctSlotId": "validation", "categoryTag": "Validación / Control"},
    {"id": "blk-out-${randomSeed}", "label": "Título corto de salida verificable del tema", "detail": "Descripción del resultado estructurado final", "correctSlotId": "output", "categoryTag": "Resultado / Output"}
  ],
  "comprehension_check": {
    "question": "Pregunta breve e inédita de recuperación activa sobre este tema",
    "options": [
      {"id": "a", "text": "Opción correcta y clara"},
      {"id": "b", "text": "Distractor plausible 1"},
      {"id": "c", "text": "Distractor plausible 2"}
    ],
    "correctOptionId": "a",
    "feedback": "Explicación constructiva de por qué esa opción consolida el concepto."
  }
}`;

    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.85,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        clearTimeout(timer);

        if (response.ok) {
          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);
            if (parsed && parsed.summary && Array.isArray(parsed.key_points)) {
              const fallbackCurated = this.buildCuratedAdaptiveExplanation(input);
              const rawCheck = parsed.comprehension_check || fallbackCurated.comprehension_check;
              return {
                subject_name: input.subject_name,
                topic: input.topic,
                mode: input.mode,
                mode_label: modeLabel,
                source: 'ai_gemini',
                summary: parsed.summary,
                key_points: parsed.key_points,
                practical_example: parsed.practical_example || fallbackCurated.practical_example,
                visual_structure: Array.isArray(parsed.visual_structure)
                  ? parsed.visual_structure
                  : fallbackCurated.visual_structure,
                draggable_blocks:
                  Array.isArray(parsed.draggable_blocks) && parsed.draggable_blocks.length === 4
                    ? parsed.draggable_blocks
                    : fallbackCurated.draggable_blocks,
                comprehension_check: randomizeQuestionOptions(rawCheck),
              };
            }
          }
        }
      } catch {
        // Continúa hacia el motor IA generativo libre
      }
    }

    // 2. Intentar con Motor IA Generativo en vivo (sin clave)
    try {
      const freeParsed = await callFreeGenerativeAI(prompt, 5500);
      if (freeParsed && freeParsed.summary && Array.isArray(freeParsed.key_points)) {
        const fallbackCurated = this.buildCuratedAdaptiveExplanation(input);
        const rawCheck = freeParsed.comprehension_check || fallbackCurated.comprehension_check;
        return {
          subject_name: input.subject_name,
          topic: input.topic,
          mode: input.mode,
          mode_label: modeLabel,
          source: 'ai_gemini',
          summary: String(freeParsed.summary),
          key_points: freeParsed.key_points.map((k: any) => String(k)),
          practical_example: String(freeParsed.practical_example || fallbackCurated.practical_example),
          visual_structure: Array.isArray(freeParsed.visual_structure)
            ? freeParsed.visual_structure.map((v: any) => String(v))
            : fallbackCurated.visual_structure,
          draggable_blocks:
            Array.isArray(freeParsed.draggable_blocks) && freeParsed.draggable_blocks.length === 4
              ? freeParsed.draggable_blocks
              : fallbackCurated.draggable_blocks,
          comprehension_check: randomizeQuestionOptions(rawCheck),
        };
      }
    } catch {
      // Continúa al generador dinámico local
    }

    return this.buildCuratedAdaptiveExplanation(input);
  },

  buildCuratedAdaptiveExplanation(
    input: AdaptiveExplanationRequestInput
  ): AdaptiveExplanationResponse {
    const { subject_name, topic, mode, goal } = input;
    const modeLabel = MODE_LABELS[mode];
    const cleanGoal = goal || `dominar ${topic} en ${subject_name}`;

    const modeSummaries: Record<AdaptiveExplanationRequestInput['mode'], string> = {
      sencilla: `En palabras simples, "${topic}" en ${subject_name} es una herramienta que nos permite organizar un problema complejo en partes claras y predecibles. En lugar de memorizar fórmulas o reglas aisladas, piensa en ello como un puente entre los datos que tienes al inicio y la solución que necesitas construir para ${cleanGoal}.`,
      paso_a_paso: `Para abordar "${topic}" sin abrumarte, avanzaremos en una secuencia ordenada de 4 fases. Primero identificamos qué información de entrada tenemos; segundo, aplicamos la regla principal de ${topic}; tercero, verificamos un caso pequeño; y cuarto, validamos que el resultado responda a la pregunta original.`,
      ejemplos: `La mejor forma de comprender "${topic}" en ${subject_name} es verlo funcionando en una situación real. Imagina un proyecto universitario donde necesitas organizar registros y evitar errores repetitivos: aplicar ${topic} actúa como un filtro estructurado que garantiza resultados consistentes en cada ejecución.`,
      visual: `Visualiza "${topic}" como un flujo de tres bloques conectados: un bloque de Entrada (requisitos y datos iniciales), un bloque Central de Transformación (donde actúan las reglas de ${subject_name}) y un bloque de Salida Verificable (donde comprobamos que el resultado cumple el estándar).`,
      profunda: `Desde una perspectiva técnica y conceptual en ${subject_name}, "${topic}" se fundamenta en principios de modularidad, consistencia y trazabilidad. Comprender sus casos borde y sus restricciones te permite no solo resolver ejercicios estándar, sino también justificar por qué una solución es óptima frente a alternativas menos eficientes.`,
      comprobar: `En este modo nos enfocamos en recuperar activamente lo que ya sabes sobre "${topic}". Antes de releer apuntes pasivamente, pondremos a prueba tu intuición identificando qué condición es indispensable para que ${topic} funcione correctamente dentro de ${subject_name}.`,
    };

    const modeKeyPoints: Record<AdaptiveExplanationRequestInput['mode'], string[]> = {
      sencilla: [
        `Idea central: ${topic} busca simplificar y dar orden dentro de ${subject_name}.`,
        `Qué evita: reduce errores por improvisación o pasos omitidos.`,
        `Cuándo usarlo: siempre que necesites una solución clara y fácil de revisar.`,
        `Conexión con tu meta: te da una base sólida para ${cleanGoal}.`,
      ],
      paso_a_paso: [
        `Paso 1 — Identificar: lee el enunciado y destaca los datos de entrada de ${topic}.`,
        `Paso 2 — Estructurar: elige la regla o patrón de ${subject_name} que corresponde al caso.`,
        `Paso 3 — Ejecutar en pequeño: aplica el procedimiento con un caso simple primero.`,
        `Paso 4 — Comprobar: revisa si el resultado tiene sentido lógico antes de darlo por terminado.`,
      ],
      ejemplos: [
        `Escenario base: tienes un conjunto de datos desordenados en un ejercicio de ${subject_name}.`,
        `Aplicación directa: utilizas ${topic} para separar cada caso según su función.`,
        `Resultado concreto: el problema pasa de ser confuso a tener una solución verificable en minutos.`,
        `Variante frecuente: si un dato viene vacío o incompleto, ${topic} permite detectarlo a tiempo.`,
      ],
      visual: [
        `[Nivel 1: Contexto] -> Datos iniciales y objetivo del problema en ${subject_name}.`,
        `[Nivel 2: Núcleo de ${topic}] -> Regla principal + condiciones de validación.`,
        `[Nivel 3: Salida] -> Solución estructurada lista para revisión o entrega.`,
        `[Conexión lateral] -> Si el Nivel 2 falla, volvemos al Nivel 1 para revisar los supuestos.`,
      ],
      profunda: [
        `Fundamento teórico: por qué ${topic} garantiza consistencia dentro de ${subject_name}.`,
        `Invariantes y condiciones: qué supuestos deben cumplirse siempre antes de aplicarlo.`,
        `Casos borde: qué ocurre cuando los valores están en el límite o existen excepciones.`,
        `Criterio profesional: cómo explicar y defender tu decisión técnica ante un docente o equipo.`,
      ],
      comprobar: [
        `Pregunta guía 1: ¿Podrías explicar ${topic} en una sola frase sin mirar tus apuntes?`,
        `Pregunta guía 2: ¿Cuál es el error más común al aplicar ${topic} por primera vez?`,
        `Pregunta guía 3: ¿Qué dato necesitas obligatoriamente antes de empezar un ejercicio de este tema?`,
        `Acción recomendada: responde la pregunta interactiva inferior para registrar tu avance.`,
      ],
    };

    const modeExamples: Record<AdaptiveExplanationRequestInput['mode'], string> = {
      sencilla: `Analogía cotidiana para ${subject_name}: Imagina que estás armando un mueble o siguiendo una receta. "${topic}" equivale a ordenar todas las piezas sobre la mesa antes de empezar, asegurando que cada pieza encaje en su lugar sin forzar nada.`,
      paso_a_paso: `Secuencia aplicada de "${topic}": [Fase A] Anota los valores conocidos del enunciado -> [Fase B] Aplica la operación principal de ${topic} sobre un único elemento de prueba -> [Fase C] Extiende el resultado al resto del ejercicio verificando que no existan contradicciones.`,
      ejemplos: `Caso universitario real en ${subject_name}: En un laboratorio evaluado sobre "${topic}", un equipo recibe 3 casos de prueba (uno normal, uno vacío y uno límite). Al estructurar la solución con ${topic}, el caso normal pasa directo y los dos casos especiales se controlan sin romper el resultado.`,
      visual: `Mapa mental rápido: [Entrada sin procesar] ===(${topic})===> [Estructura validada en ${subject_name}] ===> [Resultado listo para entregar]. Si observas una alerta en el bloque central, revisa únicamente la condición de entrada.`,
      profunda: `Análisis técnico en ${subject_name}: Cuando escalamos un problema de "${topic}" de 10 a 10.000 elementos, una solución improvisada pierde consistencia o rendimiento. Aplicar formalmente las propiedades de ${topic} mantiene la complejidad controlada y facilita la depuración.`,
      comprobar: `Autodiagnóstico práctico: Tapa por 15 segundos la explicación superior e intenta escribir en una línea qué entra, qué hace "${topic}" y qué devuelve en ${subject_name}. Luego compáralo con la pregunta de verificación inferior.`,
    };

    const modeVisualStructures: Record<AdaptiveExplanationRequestInput['mode'], string[]> = {
      sencilla: [
        `1. ¿Qué tengo? -> Identificar la idea básica de ${topic} sin tecnicismos`,
        `2. ¿Qué conecto? -> Relacionar el concepto con tu objetivo en ${subject_name}`,
        `3. ¿Qué logro? -> Obtener una respuesta clara que puedas explicar con tus palabras`,
      ],
      paso_a_paso: [
        `Paso 1: Leer y separar los datos de entrada del problema`,
        `Paso 2: Aplicar la regla central de ${topic} paso por paso`,
        `Paso 3: Probar con un ejemplo pequeño y confirmar coherencia`,
        `Paso 4: Redactar o entregar la solución validada`,
      ],
      ejemplos: [
        `Caso A (Estándar) -> Datos completos -> Aplicación directa de ${topic}`,
        `Caso B (Borde) -> Datos incompletos -> Validación previa antes de ejecutar`,
        `Caso C (Verificación) -> Comparación del resultado obtenido vs esperado`,
      ],
      visual: [
        `[BLOQUE ENTRADA: Datos + Supuestos en ${subject_name}]`,
        `       |---> [MOTOR CENTRAL: Reglas de ${topic}]`,
        `                    |---> [SALIDA: Solución Verificable (${cleanGoal})]`,
      ],
      profunda: [
        `1. Precondiciones e invariantes formales de ${topic}`,
        `2. Transformación estructural y manejo de casos límite en ${subject_name}`,
        `3. Postcondiciones, eficiencia y justificación técnica`,
      ],
      comprobar: [
        `1. Recordar sin apoyo -> ¿Qué problema resuelve ${topic}?`,
        `2. Detectar el error -> ¿Qué pasa si omito la condición inicial?`,
        `3. Consolidar -> Responder la pregunta interactiva y guardar dominio`,
      ],
    };

    const modeChecks: Record<
      AdaptiveExplanationRequestInput['mode'],
      AdaptiveExplanationResponse['comprehension_check']
    > = {
      sencilla: {
        question: `En palabras simples, ¿cuál es el propósito esencial de "${topic}" dentro de ${subject_name}?`,
        options: [
          {
            id: 'a',
            text: `Organizar y resolver un problema de ${subject_name} de forma clara, ordenada y predecible.`,
          },
          {
            id: 'b',
            text: 'Reemplazar el análisis del problema por reglas al azar sin verificar los datos.',
          },
          {
            id: 'c',
            text: 'Memorizar términos complejos sin conectarlos con ningún objetivo práctico.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Muy bien! Comprender la idea central de "${topic}" en lenguaje claro es el primer paso para avanzar con seguridad.`,
      },
      paso_a_paso: {
        question: `Al resolver un ejercicio de "${topic}" paso a paso, ¿qué deberías hacer inmediatamente después de identificar los datos de entrada?`,
        options: [
          {
            id: 'a',
            text: `Seleccionar la regla de ${topic} correspondiente y probarla primero en un caso pequeño y controlado.`,
          },
          {
            id: 'b',
            text: 'Escribir la conclusión final sin comprobar ningún paso intermedio.',
          },
          {
            id: 'c',
            text: 'Descartar los datos del enunciado e inventar condiciones distintas.',
          },
        ],
        correctOptionId: 'a',
        feedback: `Exacto. Avanzar validando un caso pequeño evita arrastrar errores y reduce la ansiedad frente a ejercicios largos.`,
      },
      ejemplos: {
        question: `Al aplicar "${topic}" en un caso práctico de ${subject_name}, ¿por qué es útil probar qué ocurre cuando falta un dato o hay un valor especial?`,
        options: [
          {
            id: 'a',
            text: `Porque permite detectar errores frecuentes a tiempo y asegurar que la solución funcione en escenarios reales.`,
          },
          {
            id: 'b',
            text: 'Porque los casos prácticos no requieren cumplir ninguna regla de la asignatura.',
          },
          {
            id: 'c',
            text: 'Porque así evitamos leer el objetivo del problema.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Correcto! Contrastar un ejemplo normal con un caso especial consolida tu criterio práctico en ${subject_name}.`,
      },
      visual: {
        question: `Observando el esquema visual de "${topic}" (Entrada -> Transformación -> Salida), ¿qué debes revisar si el bloque de Salida entrega un resultado incoherente?`,
        options: [
          {
            id: 'a',
            text: `Volver al bloque de Entrada y verificar si los supuestos y la regla central de ${topic} se aplicaron bien.`,
          },
          {
            id: 'b',
            text: 'Ignorar la incoherencia y entregar el resultado sin revisar el flujo.',
          },
          {
            id: 'c',
            text: 'Eliminar el bloque de Entrada para no tener datos que validar.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Excelente lectura visual! Pensar en bloques conectados te permite ubicar rápidamente dónde ajustar tu razonamiento.`,
      },
      profunda: {
        question: `Desde un criterio técnico profundo en ${subject_name}, ¿qué distingue un dominio sólido de "${topic}" frente a una aplicación superficial?`,
        options: [
          {
            id: 'a',
            text: `Conocer sus supuestos (precondiciones), manejar casos borde y poder justificar por qué la solución es consistente.`,
          },
          {
            id: 'b',
            text: 'Repetir una plantilla de memoria aunque no se cumplan las condiciones del problema.',
          },
          {
            id: 'c',
            text: 'Omitir el análisis de restricciones para terminar más rápido.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Dominio sobresaliente! Comprender invariantes y casos borde te prepara para certámenes exigentes y proyectos reales.`,
      },
      comprobar: {
        question: `Comprobación activa sobre "${topic}" en ${subject_name}: ¿cuál de estas acciones confirma que ya estás listo para explicar este tema a un compañero?`,
        options: [
          {
            id: 'a',
            text: `Puedo explicar qué problema resuelve ${topic}, aplicarlo paso a paso en un ejemplo y detectar un error típico.`,
          },
          {
            id: 'b',
            text: 'Solo reconozco el título del tema cuando leo los apuntes abiertos.',
          },
          {
            id: 'c',
            text: 'Prefiero adivinar la respuesta sin verificar los pasos intermedios.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Excelente! La recuperación activa demuestra que el conocimiento está consolidado y listo para aplicarse.`,
      },
    };

    // Banco de variantes dinámicas para que la pregunta de comprensión y los bloques arrastrables siempre cambien
    const dynamicCheckPool: Array<AdaptiveExplanationResponse['comprehension_check']> = [
      modeChecks[mode],
      {
        question: `Si estás trabajando en un laboratorio de ${subject_name} sobre "${topic}" y recibes un dato de entrada vacío o fuera de rango, ¿qué etapa del flujo debe activarse primero?`,
        options: [
          {
            id: 'a',
            text: `La compuerta de validación y casos borde antes de ejecutar la transformación principal de ${topic}.`,
          },
          {
            id: 'b',
            text: 'Forzar la salida final sin validar ningún supuesto de entrada.',
          },
          {
            id: 'c',
            text: 'Eliminar las reglas de la asignatura para que cualquier dato pase.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Exacto! Detectar un caso borde en la entrada previene fallos en cascada al aplicar "${topic}".`,
      },
      {
        question: `Al conectar los bloques de diseño de "${topic}" en ${subject_name}, ¿qué garantiza que el bloque de Salida sea realmente confiable?`,
        options: [
          {
            id: 'a',
            text: `Que los datos hayan pasado por la regla central de ${topic} y superado la condición de control.`,
          },
          {
            id: 'b',
            text: 'Que el resultado se escriba directamente sin procesar los datos iniciales.',
          },
          {
            id: 'c',
            text: 'Omitir las pruebas con ejemplos pequeños para ahorrar tiempo.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Muy bien! La trazabilidad entre Entrada -> Motor Central -> Control -> Salida asegura resultados verificables.`,
      },
      {
        question: `¿Cuál es la ventaja de descomponer "${topic}" (${subject_name}) en bloques pequeños y verificables en lugar de intentar resolver todo en un solo paso?`,
        options: [
          {
            id: 'a',
            text: 'Permite comprobar cada fase por separado, ubicar rápido dónde ajustar si algo falla y reducir la sobrecarga cognitiva.',
          },
          {
            id: 'b',
            text: 'Obliga a memorizar más páginas sin comprender la relación entre las partes.',
          },
          {
            id: 'c',
            text: 'Impide usar ejemplos prácticos durante el estudio.',
          },
        ],
        correctOptionId: 'a',
        feedback: `¡Excelente! Dividir el problema en bloques manejables es clave para dominar ${subject_name} con confianza.`,
      },
    ];

    const chosenCheck = randomizeQuestionOptions(
      dynamicCheckPool[Math.floor(Math.random() * dynamicCheckPool.length)]
    );

    const blockVariantIdx = Math.floor(Math.random() * 3);
    const draggableVariants: AdaptiveDraggableBlock[][] = [
      [
        {
          id: `blk-in-${Date.now()}-1`,
          label: `Identificar variables y precondiciones de ${topic}`,
          detail: `Reunir los datos iniciales y el formato requerido en ${subject_name} antes de operar.`,
          correctSlotId: 'input',
          categoryTag: '1 · Contexto / Input',
        },
        {
          id: `blk-pr-${Date.now()}-2`,
          label: `Ejecutar estructura central de ${topic}`,
          detail: `Aplicar paso a paso la regla o transformación de ${subject_name} sobre la entrada.`,
          correctSlotId: 'process',
          categoryTag: '2 · Regla / Motor',
        },
        {
          id: `blk-va-${Date.now()}-3`,
          label: `Comprobar invariantes y casos borde`,
          detail: `Verificar si el resultado parcial cumple las restricciones o requiere volver al inicio.`,
          correctSlotId: 'validation',
          categoryTag: '3 · Control / Borde',
        },
        {
          id: `blk-out-${Date.now()}-4`,
          label: `Consolidar solución verificable (${cleanGoal})`,
          detail: `Entregar la salida validada y lista para prueba o integración en ${subject_name}.`,
          correctSlotId: 'output',
          categoryTag: '4 · Resultado / Output',
        },
      ],
      [
        {
          id: `blk-in-${Date.now()}-1`,
          label: `Analizar enunciado y parámetros de entrada en ${subject_name}`,
          detail: `Separar qué datos conocemos y qué restricciones iniciales plantea "${topic}".`,
          correctSlotId: 'input',
          categoryTag: '1 · Contexto / Input',
        },
        {
          id: `blk-pr-${Date.now()}-2`,
          label: `Descomponer y procesar mediante ${topic}`,
          detail: `Transformar los datos crudos siguiendo la secuencia lógica del tema.`,
          correctSlotId: 'process',
          categoryTag: '2 · Regla / Motor',
        },
        {
          id: `blk-va-${Date.now()}-3`,
          label: `Validar con caso de prueba pequeño y caso límite`,
          detail: `Detectar posibles errores de rango o valores nulos antes de cerrar el flujo.`,
          correctSlotId: 'validation',
          categoryTag: '3 · Control / Borde',
        },
        {
          id: `blk-out-${Date.now()}-4`,
          label: `Generar respuesta trazable de ${topic}`,
          detail: `Obtener el producto final coherente con el objetivo del ejercicio.`,
          correctSlotId: 'output',
          categoryTag: '4 · Resultado / Output',
        },
      ],
      [
        {
          id: `blk-in-${Date.now()}-1`,
          label: `Preparar datos base y supuestos de "${topic}"`,
          detail: `Definir el punto de partida limpio para evitar ambigüedades en ${subject_name}.`,
          correctSlotId: 'input',
          categoryTag: '1 · Contexto / Input',
        },
        {
          id: `blk-pr-${Date.now()}-2`,
          label: `Aplicar operador o patrón técnico de ${topic}`,
          detail: `Conectar las reglas de ${subject_name} para construir la solución intermedia.`,
          correctSlotId: 'process',
          categoryTag: '2 · Regla / Motor',
        },
        {
          id: `blk-va-${Date.now()}-3`,
          label: `Auditar consistencia e integridad del resultado`,
          detail: `Si se detecta una anomalía en este bloque, retroalimentar la Fase 1.`,
          correctSlotId: 'validation',
          categoryTag: '3 · Control / Borde',
        },
        {
          id: `blk-out-${Date.now()}-4`,
          label: `Entregar salida óptima y documentada`,
          detail: `Resultado de ${topic} verificado y listo para explicar o presentar.`,
          correctSlotId: 'output',
          categoryTag: '4 · Resultado / Output',
        },
      ],
    ];

    return {
      subject_name,
      topic,
      mode,
      mode_label: modeLabel,
      source: 'pedagogical_engine',
      summary: modeSummaries[mode],
      key_points: modeKeyPoints[mode],
      practical_example: modeExamples[mode],
      visual_structure: modeVisualStructures[mode],
      draggable_blocks: draggableVariants[blockVariantIdx],
      comprehension_check: chosenCheck,
    };
  },
};
