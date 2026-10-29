// Tipos de dominio para el módulo Hub de Proyectos Académicos y Colaborativos de InterAula
import type { AcademicLevel, Profile, Skill } from './profile';

export type ProjectStatus = 'draft' | 'open' | 'recruiting' | 'in_progress' | 'completed' | 'cancelled';
export type ProjectVisibility = 'public' | 'private';
export type ProjectModality = 'online' | 'presencial' | 'hibrido';
export type ProjectCompensationType =
  | 'unpaid_academic'
  | 'paid'
  | 'milestone_based'
  | 'revenue_share'
  | 'negotiable';
export type ProjectMemberRole = 'owner' | 'member';
export type PositionStatus = 'open' | 'paused' | 'filled' | 'closed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ProjectAgreements {
  schedule?: string;
  responsibilities?: string;
  tools?: string;
  deliverables?: string;
  intellectual_property?: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  problem_statement?: string | null;
  objectives?: string | null;
  category: string | null;
  career?: string;
  technologies?: string[];
  tags?: string[];
  status: ProjectStatus;
  visibility: ProjectVisibility;
  modality?: ProjectModality;
  dedication_hours?: number;
  max_members: number;
  requirements?: string | null;
  compensation_type?: ProjectCompensationType;
  compensation_amount?: number | null;
  compensation_currency?: string | null;
  compensation_periodicity?: string | null;
  compensation_notes?: string | null;
  agreements?: ProjectAgreements;
  external_links?: {
    github?: string;
    figma?: string;
    docs?: string;
  };
  milestones?: ProjectMilestone[];
  cover_url?: string | null;
  created_at: string;
  updated_at: string;
  owner?: Profile | { id: string; display_name?: string; first_name?: string; last_name?: string; institution?: string; career?: string };
  positions?: ProjectPosition[];
  members?: ProjectMember[];
  open_slots_count?: number;
  applications_count?: number;
}

export interface ProjectPosition {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  skill_id?: string | null;
  skills_required?: string[];
  mandatory_requirements?: string[];
  optional_requirements?: string[];
  level_required: AcademicLevel | string | null;
  dedication_hours?: number;
  slots: number;
  slots_filled?: number;
  compensation_override?: string | null;
  status: PositionStatus;
  created_at: string;
  skill?: Skill;
}

export interface ProjectMember {
  id?: string;
  project_id: string;
  profile_id: string;
  profile_name?: string;
  profile_institution?: string;
  position_id: string | null;
  role_name?: string;
  member_role: ProjectMemberRole;
  joined_at: string;
  profile?: Profile | { id: string; display_name?: string; first_name?: string; last_name?: string; institution?: string };
  position?: ProjectPosition | null;
}

export interface ProjectApplication {
  id: string;
  project_id: string;
  position_id: string;
  applicant_id: string;
  applicant_name?: string;
  applicant_institution?: string;
  applicant_career?: string;
  message: string | null;
  relevant_skills?: string[];
  portfolio_url?: string | null;
  availability_notes?: string | null;
  accepted_agreements?: boolean;
  accepted_agreements_at?: string;
  status: ApplicationStatus;
  reviewer_feedback?: string | null;
  created_at: string;
  updated_at: string;
  project?: Project | null;
  position?: ProjectPosition | null;
  applicant?: Profile | { id: string; display_name?: string; institution?: string; career?: string };
}
