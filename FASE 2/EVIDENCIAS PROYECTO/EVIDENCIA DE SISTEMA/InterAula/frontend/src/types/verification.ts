// Tipos de dominio para el módulo de Verificación Académica y Tutores Verificados
import type { Profile, Subject } from './profile';

export type VerificationRequestStatus =
  | 'pending'
  | 'practical_evaluation'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'requires_reevaluation';

export type DocumentExtractionStatus =
  | 'not_uploaded'
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'warnings'
  | 'manual_review_required';

export type MatchedStatus =
  | 'found'
  | 'not_found'
  | 'grade_below_min'
  | 'manual_review_required';

export type CalculatedTutorLevel = 'basic' | 'intermediate' | 'advanced' | null;

export interface ExtractedCertificateSubject {
  code?: string;
  name: string;
  grade: number;
  semester?: number;
  year?: number;
  character?: string;
}

export interface ExtractedCertificateData {
  student_name?: string;
  student_rut?: string;
  program?: string;
  certificate_id?: string;
  subjects: ExtractedCertificateSubject[];
  extracted_at: string;
  raw_text_length?: number;
  warnings?: string[];
  calculated_level?: CalculatedTutorLevel;
}

export interface AcademicValidator {
  profile_id: string;
  role_title: string;
  department: string | null;
  created_at: string;
  profile?: Profile;
}

export interface TutorVerificationRequest {
  id: string;
  tutor_id: string;
  subject_id: string;
  status: VerificationRequestStatus;
  practical_exercise_title: string | null;
  practical_submission: string | null;
  defense_notes: string | null;
  reviewer_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Campos del certificado académico en PDF y extracción estructurada
  document_path?: string | null;
  document_filename?: string | null;
  document_size_bytes?: number | null;
  document_uploaded_at?: string | null;
  document_extraction_status?: DocumentExtractionStatus;
  document_extracted_data?: ExtractedCertificateData | null;
  matched_subject_name?: string | null;
  matched_grade?: number | null;
  matched_status?: MatchedStatus | null;
  calculated_level?: CalculatedTutorLevel;
  tutor?: Profile;
  subject?: Subject;
  reviewer?: Profile;
}

export interface CreateVerificationRequestDTO {
  subject_id: string;
}

export interface SubmitPracticalEvaluationDTO {
  practical_submission: string;
  defense_notes: string;
}

export interface ReviewVerificationRequestDTO {
  status: 'approved' | 'rejected' | 'requires_reevaluation';
  reviewer_feedback: string;
  practical_exercise_title?: string;
}

export interface SaveCertificateExtractionDTO {
  document_path: string;
  document_filename: string;
  document_size_bytes: number;
  document_extraction_status: DocumentExtractionStatus;
  document_extracted_data: ExtractedCertificateData;
  matched_subject_name?: string | null;
  matched_grade?: number | null;
  matched_status?: MatchedStatus | null;
  calculated_level?: CalculatedTutorLevel;
}

