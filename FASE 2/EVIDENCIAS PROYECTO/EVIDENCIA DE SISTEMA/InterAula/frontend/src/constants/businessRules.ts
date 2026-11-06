/**
 * Constantes y reglas de negocio centralizadas del dominio InterAula (Frontend).
 * Evita la dispersión de números mágicos, límites y porcentajes en componentes de UI.
 */

export const BUSINESS_RULES = {
  // Acreditación técnica
  VERIFICATION: {
    MIN_BOT_ACCREDITATION_SCORE: 70, // Umbral mínimo 70% de aprobación
    MAX_BOT_SCORE: 100,
    TOTAL_BOT_QUESTIONS: 10,
    PASSING_MIN_CORRECT_ANSWERS: 7, // 7 de 10 = 70%
    TIME_LIMIT_CHOICE_SECONDS: 45,
    TIME_LIMIT_REDACTION_SECONDS: 75,
  },

  // Talleres grupales
  WORKSHOPS: {
    MIN_CAPACITY: 2,
    MAX_CAPACITY: 100,
    DEFAULT_CAPACITY: 25,
    MIN_DURATION_MINUTES: 15,
    MAX_DURATION_MINUTES: 240,
    DEFAULT_DURATION_MINUTES: 60,
  },

  // Sesiones de tutoría individual
  TUTORING: {
    MIN_DURATION_MINUTES: 15,
    MAX_DURATION_MINUTES: 300,
    DEFAULT_DURATION_MINUTES: 60,
    RATING: {
      MIN: 1,
      MAX: 5,
    },
  },

  // Proyectos colaborativos
  PROJECTS: {
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 150,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 6000,
    MIN_MEMBERS: 1,
    MAX_MEMBERS: 50,
    DEFAULT_MEMBERS: 4,
    MAX_POSITIONS: 15,
    MAX_PITCH_LENGTH: 1500,
    DEFAULT_POSITIONS_TEMPLATE: 'Frontend Developer, Backend Developer',
    MODALITIES: ['online', 'presencial', 'hibrido'] as const,
    STATUSES: ['draft', 'open', 'in_progress', 'completed', 'cancelled'] as const,
    COMPENSATION_TYPES: [
      'unpaid_academic',
      'paid',
      'milestone_based',
      'revenue_share',
      'negotiable',
    ] as const,
  },

  // Foro de preguntas y respuestas
  FORUM: {
    MIN_TITLE_LENGTH: 5,
    MAX_TITLE_LENGTH: 200,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 5000,
    MIN_REPLY_LENGTH: 2,
    MAX_REPLY_LENGTH: 3000,
    MAX_TAGS: 10,
    PAGE_SIZE: 10,
    POST_TYPES: ['pregunta', 'discusion', 'duda', 'recurso'] as const,
  },

  // Biblioteca y Editor de Apuntes Académicos
  NOTES: {
    MIN_TITLE_LENGTH: 2,
    MAX_TITLE_LENGTH: 200,
    MAX_SUMMARY_LENGTH: 600,
    MAX_CONTENT_LENGTH: 250000,
    MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
    MAX_FILE_SIZE_MB: 15,
    AUTOSAVE_DEBOUNCE_MS: 2200,
    PAGE_SIZE: 12,
    ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.txt', '.md'] as const,
    ALLOWED_MIMES: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
    ] as const,
    VISIBILITIES: ['private', 'shared', 'public'] as const,
    CATEGORIES: [
      'Apunte de Clase',
      'Resumen de Certamen',
      'Guía de Ejercicios',
      'Formulario / Cheatsheet',
      'Laboratorio / Código',
      'Investigación',
    ] as const,
  },
} as const;
