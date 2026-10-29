/**
 * Constantes y reglas de negocio centralizadas del dominio InterAula (Backend).
 * Evita la dispersión de números mágicos y límites hardcodeados en controladores o servicios.
 */

export const BUSINESS_RULES = {
  // Acreditación de tutores mediante Bot Técnico
  VERIFICATION: {
    MIN_BOT_ACCREDITATION_SCORE: 70, // Porcentaje mínimo de aprobación (70%)
    MAX_BOT_SCORE: 100,
    MIN_QUESTIONS: 1,
    MAX_NOTES_LENGTH: 1000,
    PRACTICAL_EXERCISE: {
      MIN_TITLE_LENGTH: 3,
      MAX_TITLE_LENGTH: 300,
      MIN_SUBMISSION_LENGTH: 5,
      MIN_DEFENSE_LENGTH: 5,
      MIN_FEEDBACK_LENGTH: 3,
      MAX_FEEDBACK_LENGTH: 2000,
    },
    DOCUMENT: {
      MIN_GRADE: 1.0,
      MAX_GRADE: 7.0,
    },
  },

  // Talleres y clases grupales
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

  // Foro estudiantil
  FORUM: {
    POST: {
      MIN_TITLE_LENGTH: 5,
      MAX_TITLE_LENGTH: 200,
      MIN_DESCRIPTION_LENGTH: 10,
      MAX_DESCRIPTION_LENGTH: 5000,
      MAX_TAGS: 10,
      TYPES: ['pregunta', 'discusion', 'duda', 'recurso'] as const,
    },
    REPLY: {
      MIN_CONTENT_LENGTH: 2,
      MAX_CONTENT_LENGTH: 3000,
    },
  },

  // Biblioteca y Editor de Apuntes Académicos
  NOTES: {
    MIN_TITLE_LENGTH: 2,
    MAX_TITLE_LENGTH: 200,
    MAX_SUMMARY_LENGTH: 600,
    MAX_CONTENT_LENGTH: 250000,
    MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
    ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.txt', '.md'] as const,
    VISIBILITIES: ['private', 'shared', 'public'] as const,
  },

  // Proyectos colaborativos
  PROJECTS: {
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 150,
    MIN_MEMBERS: 1,
    MAX_MEMBERS: 50,
    DEFAULT_MEMBERS: 4,
    MIN_PITCH_LENGTH: 5,
    MAX_PITCH_LENGTH: 1500,
    POSITION: {
      MIN_TITLE_LENGTH: 2,
      MAX_TITLE_LENGTH: 100,
      MIN_SLOTS: 1,
      MAX_SLOTS: 20,
    },
  },
} as const;
