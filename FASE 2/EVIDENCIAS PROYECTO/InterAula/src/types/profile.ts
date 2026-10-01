// Tipos de dominio para el módulo de Perfiles de InterAula

export type AcademicLevel = 'basic' | 'intermediate' | 'advanced';

// Preferencias de aprendizaje inclusivas (estrictamente pedagógicas/metodológicas)
export type LearningPreference =
  | 'step_by_step'
  | 'practical_examples'
  | 'summarized_material'
  | 'conceptual_diagrams'
  | 'visual_support'
  | 'structured_sessions'
  | 'paced_rhythm';

export interface LearningPreferenceOption {
  id: LearningPreference;
  label: string;
  description: string;
}

export const LEARNING_PREFERENCES: readonly LearningPreferenceOption[] = [
  {
    id: 'step_by_step',
    label: 'Explicaciones paso a paso',
    description: 'Desglose detallado y secuencial de procedimientos y conceptos.',
  },
  {
    id: 'practical_examples',
    label: 'Ejemplos prácticos',
    description: 'Casos aplicados a situaciones reales o ejercicios guiados.',
  },
  {
    id: 'summarized_material',
    label: 'Material resumido',
    description: 'Síntesis claras, fórmulas clave y puntos esenciales.',
  },
  {
    id: 'conceptual_diagrams',
    label: 'Esquemas conceptuales',
    description: 'Mapas conceptuales, diagramas de flujo y relaciones lógicas.',
  },
  {
    id: 'visual_support',
    label: 'Apoyo visual',
    description: 'Gráficos, esquemas visuales y demostraciones en pantalla.',
  },
  {
    id: 'structured_sessions',
    label: 'Sesiones estructuradas',
    description: 'Agenda definida con objetivos concretos por bloque de tiempo.',
  },
  {
    id: 'paced_rhythm',
    label: 'Ritmo pausado / más tiempo',
    description: 'Espacio para asimilar conceptos antes de avanzar al siguiente tema.',
  },
] as const;

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
  available_for_projects: boolean;
  project_bio: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  learning_preferences?: LearningPreference[];
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
