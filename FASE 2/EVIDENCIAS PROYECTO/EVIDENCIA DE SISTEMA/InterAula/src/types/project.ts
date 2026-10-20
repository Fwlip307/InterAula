// Tipos de dominio para el módulo Hub de Proyectos de InterAula
import type { AcademicLevel, Profile, Skill } from './profile';

export type ProjectStatus = 'recruiting' | 'in_progress' | 'completed' | 'cancelled';
export type ProjectVisibility = 'public' | 'private';
export type ProjectMemberRole = 'owner' | 'member';
export type PositionStatus = 'open' | 'closed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  max_members: number;
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface ProjectPosition {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  skill_id: string | null;
  level_required: AcademicLevel | null;
  slots: number;
  status: PositionStatus;
  created_at: string;
  skill?: Skill;
}

export interface ProjectMember {
  project_id: string;
  profile_id: string;
  position_id: string | null;
  member_role: ProjectMemberRole;
  joined_at: string;
  profile?: Profile;
  position?: ProjectPosition;
}

export interface ProjectApplication {
  id: string;
  project_id: string;
  position_id: string;
  applicant_id: string;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  project?: Project;
  position?: ProjectPosition;
  applicant?: Profile;
}
