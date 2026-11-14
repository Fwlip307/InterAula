import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { supabasePublic } from './supabase.js';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

export interface StoredForumPost {
  id: string;
  author_id: string;
  author_name: string;
  author_institution: string;
  title: string;
  description: string;
  category: string;
  post_type: 'pregunta' | 'discusion' | 'duda' | 'recurso';
  subject_id?: string | null;
  tags: string[];
  votes_count: number;
  replies_count: number;
  is_solved: boolean;
  accepted_reply_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredForumReply {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_institution: string;
  content: string;
  votes_count: number;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoredForumVote {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface StoredAcademicNote {
  id: string;
  author_id: string;
  author_name: string;
  author_institution: string;
  subject_id?: string | null;
  subject_name: string;
  career: string;
  category: string;
  folder: string;
  title: string;
  summary: string;
  content_html: string;
  content_markdown: string;
  content_json: Record<string, any>;
  source_type: 'editor' | 'upload';
  file_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number;
  file_extension?: string | null;
  tags: string[];
  visibility: 'private' | 'shared' | 'public';
  is_draft: boolean;
  downloads_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface StoredProject {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_institution: string;
  owner_career?: string;
  title: string;
  short_description: string | null;
  description: string | null;
  problem_statement: string | null;
  objectives: string | null;
  category: string;
  career: string;
  technologies: string[];
  tags: string[];
  status: 'draft' | 'open' | 'recruiting' | 'in_progress' | 'completed' | 'cancelled';
  visibility: 'public' | 'private';
  modality: 'online' | 'presencial' | 'hibrido';
  dedication_hours: number;
  max_members: number;
  requirements: string | null;
  compensation_type: 'unpaid_academic' | 'paid' | 'milestone_based' | 'revenue_share' | 'negotiable';
  compensation_amount?: number | null;
  compensation_currency?: string | null;
  compensation_periodicity?: string | null;
  compensation_notes?: string | null;
  agreements: Record<string, any>;
  external_links: Record<string, any>;
  milestones: Array<{
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    completed: boolean;
  }>;
  cover_url?: string | null;
  start_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredProjectPosition {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  skill_id: string | null;
  skills_required: string[];
  mandatory_requirements: string[];
  optional_requirements: string[];
  level_required: string;
  dedication_hours: number;
  slots: number;
  slots_filled: number;
  compensation_override?: string | null;
  status: 'open' | 'paused' | 'filled' | 'closed';
  created_at: string;
}

export interface StoredProjectApplication {
  id: string;
  project_id: string;
  position_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_institution: string;
  applicant_career?: string;
  message: string | null;
  relevant_skills: string[];
  portfolio_url?: string | null;
  availability_notes?: string | null;
  accepted_agreements: boolean;
  accepted_agreements_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  reviewer_feedback?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
  profile_name: string;
  profile_institution: string;
  position_id: string | null;
  role_name: string;
  member_role: 'owner' | 'member';
  joined_at: string;
}

export interface StoredLearningSpaceConfig {
  user_id: string;
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
  updated_at: string;
}

export interface StoredLearningPath {
  id: string;
  user_id: string;
  subject_id?: string | null;
  subject_name: string;
  title: string;
  goal: string;
  pace: 'paso_a_paso' | 'constante' | 'intensivo';
  preferred_mode: 'sencilla' | 'paso_a_paso' | 'ejemplos' | 'visual' | 'profunda' | 'comprobar';
  status: 'active' | 'completed' | 'paused';
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface StoredLearningPathStage {
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

export interface StoredStudySubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface StoredStudyTask {
  id: string;
  user_id: string;
  subject_name: string;
  title: string;
  priority?: 'baja' | 'media' | 'alta';
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  study_interval_minutes: number;
  break_minutes: number;
  subtasks: StoredStudySubtask[];
  created_at: string;
  updated_at: string;
}

export interface StoredTopicAssessment {
  id: string;
  user_id: string;
  subject_name: string;
  topic_name: string;
  mastery_level: 'consolidado' | 'en_desarrollo' | 'necesita_practicar' | 'pendiente';
  score: number;
  total_questions: number;
  recurring_errors: string[];
  last_practiced_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoredQuickIdea {
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

export interface StoredClassroomSignal {
  id: string;
  room_id: string;
  user_id: string;
  signal: 'green' | 'yellow' | 'blue' | 'red';
  updated_at: string;
}

export interface StoredInclusiveAccreditation {
  id: string;
  tutor_id: string;
  status: 'pending' | 'approved' | 'revoked';
  training_name: string;
  evidence_notes: string;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredProjectDeliverable {
  id: string;
  project_id: string;
  title: string;
  description: string;
  expected_format: string;
  assignee_id?: string | null;
  due_date?: string | null;
  status: 'pending' | 'in_progress' | 'review' | 'completed';
  comments: Array<{
    id: string;
    author_id: string;
    author_name: string;
    content: string;
    created_at: string;
  }>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface RuntimeDatabaseSchema {
  forum_posts: StoredForumPost[];
  forum_replies: StoredForumReply[];
  forum_post_votes: StoredForumVote[];
  academic_notes: StoredAcademicNote[];
  projects: StoredProject[];
  project_positions: StoredProjectPosition[];
  project_applications: StoredProjectApplication[];
  project_members: StoredProjectMember[];
  learning_space_configs: StoredLearningSpaceConfig[];
  learning_paths: StoredLearningPath[];
  learning_path_stages: StoredLearningPathStage[];
  study_tasks: StoredStudyTask[];
  topic_assessments: StoredTopicAssessment[];
  quick_ideas: StoredQuickIdea[];
  classroom_signals: StoredClassroomSignal[];
  inclusive_accreditations: StoredInclusiveAccreditation[];
  project_deliverables: StoredProjectDeliverable[];
}

const DEFAULT_DB: RuntimeDatabaseSchema = {
  forum_posts: [],
  forum_replies: [],
  forum_post_votes: [],
  academic_notes: [],
  projects: [],
  project_positions: [],
  project_applications: [],
  project_members: [],
  learning_space_configs: [],
  learning_paths: [],
  learning_path_stages: [],
  study_tasks: [],
  topic_assessments: [],
  quick_ideas: [],
  classroom_signals: [],
  inclusive_accreditations: [],
  project_deliverables: [],
};

const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 'runtime_store.json');

let memoryCache: RuntimeDatabaseSchema | null = null;

function ensureLoaded(): RuntimeDatabaseSchema {
  if (env.persistenceMode !== 'local') throw new HttpError(503, 'Esta operación requiere conexión con la base de datos.');
  if (memoryCache) return memoryCache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryCache = {
        forum_posts: Array.isArray(parsed.forum_posts) ? parsed.forum_posts : [],
        forum_replies: Array.isArray(parsed.forum_replies) ? parsed.forum_replies : [],
        forum_post_votes: Array.isArray(parsed.forum_post_votes) ? parsed.forum_post_votes : [],
        academic_notes: Array.isArray(parsed.academic_notes) ? parsed.academic_notes : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        project_positions: Array.isArray(parsed.project_positions) ? parsed.project_positions : [],
        project_applications: Array.isArray(parsed.project_applications) ? parsed.project_applications : [],
        project_members: Array.isArray(parsed.project_members) ? parsed.project_members : [],
        learning_space_configs: Array.isArray(parsed.learning_space_configs) ? parsed.learning_space_configs : [],
        learning_paths: Array.isArray(parsed.learning_paths) ? parsed.learning_paths : [],
        learning_path_stages: Array.isArray(parsed.learning_path_stages) ? parsed.learning_path_stages : [],
        study_tasks: Array.isArray(parsed.study_tasks) ? parsed.study_tasks : [],
        topic_assessments: Array.isArray(parsed.topic_assessments) ? parsed.topic_assessments : [],
        quick_ideas: Array.isArray(parsed.quick_ideas) ? parsed.quick_ideas : [],
        classroom_signals: Array.isArray(parsed.classroom_signals) ? parsed.classroom_signals : [],
        inclusive_accreditations: Array.isArray(parsed.inclusive_accreditations) ? parsed.inclusive_accreditations : [],
        project_deliverables: Array.isArray(parsed.project_deliverables) ? parsed.project_deliverables : [],
      };
      return memoryCache;
    }
  } catch (err) {
    console.warn('[persistentStore] No se pudo leer runtime_store.json, iniciando limpio:', err);
  }
  memoryCache = structuredClone(DEFAULT_DB);
  return memoryCache;
}

function flushToDisk(): void {
  if (!memoryCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const temporaryPath = STORE_PATH + '.tmp';
    fs.writeFileSync(temporaryPath, JSON.stringify(memoryCache, null, 2), 'utf-8');
    fs.renameSync(temporaryPath, STORE_PATH);
  } catch {
    throw new HttpError(503, 'No se pudieron guardar los datos locales. Intenta nuevamente.');
  }
}

export function isSchemaMissingError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    code === '42703' ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    (env.persistenceMode === 'local' && msg.includes('fetch failed'))
  );
}

export async function resolveProfileSummary(userId: string, fallbackEmail?: string): Promise<{
  id: string;
  name: string;
  institution: string;
  career: string;
}> {
  try {
    const { data } = await supabasePublic
      .from('public_profiles')
      .select('id, display_name, first_name, last_name, institution, career')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      const fullName =
        data.display_name ||
        `${data.first_name || ''} ${data.last_name || ''}`.trim() ||
        fallbackEmail?.split('@')[0] ||
        'Estudiante InterAula';
      return {
        id: userId,
        name: fullName,
        institution: data.institution || 'Duoc UC',
        career: data.career || 'Ingeniería y Tecnología',
      };
    }
  } catch {
    // Continúa con valores derivados del usuario autenticado
  }

  return {
    id: userId,
    name: fallbackEmail ? fallbackEmail.split('@')[0] : 'Estudiante InterAula',
    institution: 'Duoc UC',
    career: 'Ingeniería y Tecnología',
  };
}

export const persistentStore = {
  newId(): string {
    return crypto.randomUUID();
  },

  read(): RuntimeDatabaseSchema {
    return ensureLoaded();
  },

  write(mutator: (db: RuntimeDatabaseSchema) => void): RuntimeDatabaseSchema {
    const previous = ensureLoaded();
    const next = structuredClone(previous);
    mutator(next);
    memoryCache = next;
    try {
      flushToDisk();
      return next;
    } catch (error) {
      memoryCache = previous;
      throw error;
    }
  },

  resetForTests(): void {
    if (env.nodeEnv !== 'test') throw new Error('El reinicio de datos solo está disponible en pruebas.');
    memoryCache = structuredClone(DEFAULT_DB);
    flushToDisk();
  },
};
