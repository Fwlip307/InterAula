// Tipos de dominio para el módulo de Perfiles, Inclusión y Accesibilidad de InterAula

export type AcademicLevel = 'basic' | 'intermediate' | 'advanced';

// Preferencias de aprendizaje voluntarias y privadas (Sección 3.4)
export type LearningPreference =
  | 'step_by_step'
  | 'practical_examples'
  | 'summarized_material'
  | 'conceptual_diagrams'
  | 'visual_support'
  | 'structured_sessions'
  | 'paced_rhythm'
  | 'low_stimulus'
  | 'active_challenges'
  | 'written_support'
  | 'message_communication'
  | 'individual_sessions'
  | 'extra_response_time';

export interface LearningPreferenceOption {
  id: LearningPreference;
  label: string;
  description: string;
}

export const LEARNING_PREFERENCES: readonly LearningPreferenceOption[] = [
  {
    id: 'written_support',
    label: 'Prefiero explicaciones escritas',
    description: 'Apoyo mediante notas en chat, pizarra o resúmenes escritos claros.',
  },
  {
    id: 'practical_examples',
    label: 'Prefiero ejemplos prácticos',
    description: 'Casos aplicados a situaciones reales y resolución guiada de ejercicios.',
  },
  {
    id: 'visual_support',
    label: 'Prefiero contenido visual',
    description: 'Esquemas visuales, diagramas y demostraciones paso a paso en pantalla.',
  },
  {
    id: 'step_by_step',
    label: 'Prefiero instrucciones paso a paso',
    description: 'Desglose secuencial y estructurado de procedimientos complejos.',
  },
  {
    id: 'message_communication',
    label: 'Prefiero comunicarme mediante mensajes',
    description: 'Interacción prioritaria por chat escrito y pizarra, sin obligar a usar cámara o voz.',
  },
  {
    id: 'individual_sessions',
    label: 'Prefiero sesiones individuales (1 a 1)',
    description: 'Espacios de estudio personalizados con un solo tutor para mayor concentración.',
  },
  {
    id: 'extra_response_time',
    label: 'Necesito más tiempo para leer y responder',
    description: 'Pausas de asimilación sin presión de tiempo durante tutorías y cuestionarios.',
  },
  {
    id: 'low_stimulus',
    label: 'Ambiente de baja carga sensorial (Modo Calma)',
    description: 'Sesiones despejadas, predecibles y sin distractores visuales innecesarios.',
  },
  {
    id: 'structured_sessions',
    label: 'Sesiones con agenda anticipada',
    description: 'Conocer de antemano los temas y pasos que se abordarán en la sesión.',
  },
  {
    id: 'summarized_material',
    label: 'Material resumido y síntesis clave',
    description: 'Fórmulas esenciales, puntos clave y guía de repaso al finalizar.',
  },
  {
    id: 'conceptual_diagrams',
    label: 'Mapas y esquemas conceptuales',
    description: 'Relaciones lógicas mediante diagramas de flujo o mapas mentales.',
  },
  {
    id: 'paced_rhythm',
    label: 'Ritmo flexible y adaptable',
    description: 'Avanzar paso a paso verificando la comprensión antes de pasar al siguiente bloque.',
  },
  {
    id: 'active_challenges',
    label: 'Práctica interactiva y micro-retos',
    description: 'Comprobar lo aprendido con cuestionarios breves adaptados a mis intereses.',
  },
] as const;

// Preferencias transversales de accesibilidad (Sección 3.1 y 3.2)
export type FontSizeScale = 'normal' | 'large' | 'xlarge';
export type ContrastLevel = 'standard' | 'high';
export type SpacingMode = 'standard' | 'spacious';
export type VisualThemeMode = 'light' | 'dark' | 'calm';

export interface AccessibilityPreferences {
  themeMode?: VisualThemeMode;
  darkMode?: boolean;
  calmMode: boolean;
  fontSize: FontSizeScale;
  contrast: ContrastLevel;
  reduceMotion: boolean;
  spacing: SpacingMode;
  untimedQuizzes: boolean;
  quietNotifications: boolean;
  emailTutoring: boolean;
  emailProjects: boolean;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  themeMode: 'light',
  darkMode: false,
  calmMode: false,
  fontSize: 'normal',
  contrast: 'standard',
  reduceMotion: false,
  spacing: 'standard',
  untimedQuizzes: true,
  quietNotifications: false,
  emailTutoring: true,
  emailProjects: true,
};

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  institution: string | null;
  career: string | null;
  bio: string | null;
  location: string | null;
  profile_completed: boolean;
  available_for_tutoring: boolean;
  available_for_projects?: boolean;
  project_bio?: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  learning_preferences?: LearningPreference[];
  accessibility_preferences?: Partial<AccessibilityPreferences> | null;
  phone?: string | null;
  show_email?: boolean;
  show_phone?: boolean;
  created_at: string;
  updated_at: string;
}

export type UpdateProfileDTO = Partial<
  Omit<Profile, 'id' | 'email' | 'created_at' | 'updated_at'>
>;

export interface Subject {
  id: string;
  name: string;
  category: string | null;
  is_pilot?: boolean;
  pilot_priority?: number;
  created_at: string;
}

export interface OfferedSubject {
  profile_id: string;
  subject_id: string;
  level: AcademicLevel;
  description: string | null;
  is_verified?: boolean;
  verified_at?: string | null;
  created_at: string;
  subject?: Subject;
}

export interface NeededSubject {
  id?: string;
  profile_id: string;
  subject_id: string;
  current_level: AcademicLevel | null;
  notes: string | null;
  created_at: string;
  subject?: Subject;
}

export interface Skill {
  id: string;
  name: string;
  category: string | null;
  created_at: string;
}

export interface ProfileSkill {
  profile_id: string;
  skill_id: string;
  level: AcademicLevel;
  created_at: string;
  skill?: Skill;
}

export interface ProjectInterest {
  id: string;
  name: string;
  created_at: string;
}

export interface ProfileProjectInterest {
  profile_id: string;
  interest_id: string;
  created_at: string;
  interest?: ProjectInterest;
}
