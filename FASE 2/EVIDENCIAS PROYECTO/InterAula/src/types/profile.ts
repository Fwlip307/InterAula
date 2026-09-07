// Tipos de dominio para el módulo de Perfiles de InterAula

export type AcademicLevel = 'basic' | 'intermediate' | 'advanced';

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
  created_at: string;
}

export interface OfferedSubject {
  profile_id: string;
  subject_id: string;
  level: AcademicLevel;
  description: string | null;
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
