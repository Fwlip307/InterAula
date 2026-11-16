/**
 * Tipos e interfaces del sistema central "Mi espacio de aprendizaje".
 * "InterAula: Aprender juntos, a nuestra manera."
 */

export type ExplanationMode =
  | 'sencilla'
  | 'paso_a_paso'
  | 'ejemplos'
  | 'visual'
  | 'profunda'
  | 'comprobar';

export type LearningPace = 'paso_a_paso' | 'constante' | 'intensivo';

export type TopicMasteryLevel =
  | 'consolidado'
  | 'en_desarrollo'
  | 'necesita_practicar'
  | 'pendiente';

export interface SupportPassport {
  selectedSupports: string[];
  customNotes: string;
  sharedWithTutorIds: string[];
  sharedWithProjectIds: string[];
  sharedItemKeys: string[];
}

export interface LearningSpaceConfig {
  user_id?: string;
  onboardingCompleted: boolean;
  shareWithTutors?: boolean;
  explanationStyle: string[];
  organizationStyle: string[];
  communicationStyle: string[];
  environmentStyle: string[];
  defaultStudyIntervalMinutes: number;
  defaultBreakMinutes: number;
  subjectsToReinforce: string[];
  learningGoalSummary: string;
  weeklyGoalDays?: number;
  activeStudyDates?: string[];
  supportPassport?: SupportPassport;
  updated_at?: string;
}

export interface QuickIdea {
  id: string;
  user_id: string;
  context_type: 'learning_space' | 'tutoring' | 'workshop' | 'general';
  context_id?: string | null;
  content: string;
  resolved: boolean;
  converted_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const SUPPORT_PASSPORT_OPTIONS = [
  { key: 'written_instructions', label: 'Prefiero instrucciones escritas y claras antes de empezar' },
  { key: 'extra_processing_time', label: 'Agradezco unos segundos extra para procesar preguntas' },
  { key: 'camera_optional', label: 'Me siento más cómodo/a participando con cámara opcional' },
  { key: 'chat_participation', label: 'Prefiero participar por chat o mensajes antes que por voz' },
  { key: 'literal_language', label: 'Prefiero lenguaje directo y sin metáforas ambiguas' },
  { key: 'short_breaks', label: 'Necesito pausas breves en sesiones largas' },
  { key: 'anticipated_materials', label: 'Me ayuda revisar el material o agenda con anticipación' },
  { key: 'step_by_step_check', label: 'Me ayuda dividir actividades grandes en pasos pequeños' },
] as const;

export interface LearningPathStage {
  id: string;
  path_id: string;
  order_index: number;
  title: string;
  description: string;
  content_topic: string;
  practice_prompt: string;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface LearningPath {
  id: string;
  user_id: string;
  subject_id?: string | null;
  subject_name: string;
  title: string;
  goal: string;
  pace: LearningPace;
  preferred_mode: ExplanationMode;
  status: 'active' | 'completed' | 'paused';
  progress_percent: number;
  stages: LearningPathStage[];
  created_at: string;
  updated_at: string;
}

export interface StudySubtask {
  id: string;
  title: string;
  completed: boolean;
  estimated_minutes?: number;
}

export interface StudyTask {
  id: string;
  user_id: string;
  subject_name: string;
  title: string;
  priority?: 'baja' | 'media' | 'alta';
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  study_interval_minutes: number;
  break_minutes: number;
  subtasks: StudySubtask[];
  created_at: string;
  updated_at: string;
}

export interface TopicAssessment {
  id: string;
  user_id: string;
  subject_name: string;
  topic_name: string;
  mastery_level: TopicMasteryLevel;
  score: number;
  total_questions: number;
  recurring_errors: string[];
  last_practiced_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdaptiveExplanation {
  subject_name: string;
  topic: string;
  mode: ExplanationMode;
  mode_label: string;
  source?: 'ai_gemini' | 'pedagogical_engine';
  summary: string;
  key_points: string[];
  practical_example: string;
  visual_structure: string[];
  draggable_blocks?: Array<{
    id: string;
    label: string;
    detail: string;
    correctSlotId: 'input' | 'process' | 'validation' | 'output';
    categoryTag: string;
  }>;
  comprehension_check: {
    question: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    feedback: string;
  };
}

export interface LearningSpaceOverview {
  config: LearningSpaceConfig;
  paths: LearningPath[];
  tasks: StudyTask[];
  assessments: TopicAssessment[];
}

export const EXPLANATION_MODES: Array<{
  id: ExplanationMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'sencilla',
    label: 'Explicación sencilla',
    shortLabel: 'Sencilla',
    description: 'Lenguaje directo y cotidiano sin tecnicismos innecesarios.',
  },
  {
    id: 'paso_a_paso',
    label: 'Paso a paso',
    shortLabel: 'Paso a paso',
    description: 'Secuencia estructurada en etapas pequeñas y verificables.',
  },
  {
    id: 'ejemplos',
    label: 'Con ejemplos prácticos',
    shortLabel: 'Con ejemplos',
    description: 'Casos aplicados a situaciones y ejercicios reales.',
  },
  {
    id: 'visual',
    label: 'Visualmente',
    shortLabel: 'Visual',
    description: 'Esquema jerárquico de entradas, transformación y resultados.',
  },
  {
    id: 'profunda',
    label: 'Explicación profunda',
    shortLabel: 'Profunda',
    description: 'Fundamentos conceptuales, restricciones y casos borde.',
  },
  {
    id: 'comprobar',
    label: 'Comprobar comprensión',
    shortLabel: 'Comprobar',
    description: 'Recuperación activa con pregunta breve y retroalimentación.',
  },
];

export const LEARNING_PROFILE_CATEGORIES = {
  explanationStyle: {
    title: 'Forma de recibir explicaciones',
    options: [
      { id: 'step_by_step', label: 'Prefiero explicaciones paso a paso' },
      { id: 'practical_examples', label: 'Aprendo mejor con ejemplos prácticos' },
      { id: 'visual_support', label: 'Me sirve el apoyo visual o esquemas' },
      { id: 'written_support', label: 'Prefiero resúmenes antes de profundizar' },
    ],
  },
  organizationStyle: {
    title: 'Organización',
    options: [
      { id: 'short_tasks', label: 'Prefiero dividir el estudio en tareas cortas' },
      { id: 'frequent_breaks', label: 'Necesito pausas frecuentes' },
      { id: 'clear_goals', label: 'Prefiero objetivos semanales claros' },
      { id: 'guided_plans', label: 'Me sirve seguir planes guiados' },
    ],
  },
  communicationStyle: {
    title: 'Comunicación',
    options: [
      { id: 'message_first', label: 'Prefiero comunicarme primero por mensajes' },
      { id: 'individual_tutoring', label: 'Prefiero tutorías individuales' },
      { id: 'small_groups', label: 'Me acomodan grupos pequeños' },
      { id: 'extra_response_time', label: 'Necesito tiempo adicional para responder' },
    ],
  },
  environmentStyle: {
    title: 'Entorno de estudio',
    options: [
      { id: 'calm_interface', label: 'Prefiero una interfaz tranquila y con pocos estímulos' },
      { id: 'untimed_practice', label: 'Prefiero practicar sin límite de tiempo' },
      { id: 'spacious_reading', label: 'Prefiero texto más amplio y espaciado' },
    ],
  },
} as const;

export const MASTERY_LABELS: Record<
  TopicMasteryLevel,
  { label: string; badgeClass: string; description: string }
> = {
  consolidado: {
    label: 'Tema consolidado',
    badgeClass: 'status-badge--completed',
    description: 'Demuestras seguridad y precisión al resolver preguntas de este tema.',
  },
  en_desarrollo: {
    label: 'Tema en desarrollo',
    badgeClass: 'status-badge--accepted',
    description: 'Comprendes la base y estás afianzando los casos prácticos.',
  },
  necesita_practicar: {
    label: 'Necesita volver a practicarse',
    badgeClass: 'status-badge--pending',
    description: 'Conviene repasar paso a paso o solicitar una tutoría focalizada.',
  },
  pendiente: {
    label: 'Tema pendiente de revisión',
    badgeClass: 'status-badge--cancelled',
    description: 'Aún no has registrado una comprobación para este tema.',
  },
};

