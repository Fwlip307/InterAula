import type { Profile, Subject } from './profile';

export type SessionStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type SessionModality = 'online' | 'in_person';

export interface TutoringSession {
  id: string;
  student_id: string;
  tutor_id: string;
  subject_id: string;
  scheduled_at: string;
  duration_minutes: number;
  modality: SessionModality;
  location_or_link: string | null;
  notes: string | null;
  status: SessionStatus;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  room_id?: string | null;
  student_joined_at?: string | null;
  tutor_joined_at?: string | null;
  both_connected_at?: string | null;
  actual_duration_minutes?: number;
  attendance_verified?: boolean;
  student?: Profile;
  tutor?: Profile;
  subject?: Subject;
  review?: TutoringReview;
}

export interface SessionAttendanceResult {
  session_id: string;
  room_id: string | null;
  student_joined_at: string | null;
  tutor_joined_at: string | null;
  both_connected_at: string | null;
  actual_duration_minutes: number;
  attendance_verified: boolean;
}

export interface CreateTutoringSessionDTO {
  tutor_id: string;
  subject_id: string;
  scheduled_at: string;
  duration_minutes: number;
  modality: SessionModality;
  location_or_link?: string | null;
  notes?: string | null;
}

export interface TutoringReview {
  id: string;
  session_id: string;
  student_id: string;
  tutor_id: string;
  communication_score: number;
  knowledge_score: number;
  punctuality_score: number;
  overall_score: number;
  comment: string | null;
  created_at: string;
  student?: Profile;
  tutor?: Profile;
}

export interface CreateTutoringReviewDTO {
  session_id: string;
  tutor_id: string;
  communication_score: number;
  knowledge_score: number;
  punctuality_score: number;
  comment?: string | null;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_name: string;
  category: 'tutoring' | 'academic' | 'projects';
  required_count: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  profile_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge;
}

export interface TutorStatistics {
  profile_id: string;
  total_completed_tutorings: number;
  total_reviews_received: number;
  avg_communication: number;
  avg_knowledge: number;
  avg_punctuality: number;
  overall_rating: number;
}

// Modelos para Talleres y Clases Grupales en Vivo
export type WorkshopStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface TutoringWorkshop {
  id: string;
  tutor_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  max_students: number;
  room_id: string;
  status: WorkshopStatus;
  created_at: string;
  updated_at: string;
  tutor?: Profile;
  subject?: Subject;
  enrollments_count?: number;
  is_enrolled?: boolean;
  enrollments?: WorkshopEnrollment[];
}

export interface WorkshopEnrollment {
  id: string;
  workshop_id: string;
  student_id: string;
  enrolled_at: string;
  attended: boolean;
  attended_at: string | null;
  student?: Profile;
}

export interface CreateWorkshopDTO {
  subject_id: string;
  title: string;
  description?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  max_students?: number;
}
