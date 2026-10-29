/**
 * Catálogo centralizado de endpoints del Backend REST propio de InterAula.
 * Elimina URLs hardcodeadas y duplicadas a lo largo de los servicios del frontend.
 */

export const API_ENDPOINTS = {
  // Estado del servidor
  HEALTH: '/health',

  // Perfiles de usuario y asignaturas
  PROFILES: {
    ME: '/profiles/me',
    BY_ID: (id: string) => `/profiles/${id}`,
    OFFERED_SUBJECTS: '/profiles/offered-subjects',
    OFFERED_SUBJECT_BY_ID: (subjectId: string) => `/profiles/offered-subjects/${subjectId}`,
    NEEDED_SUBJECTS: '/profiles/needed-subjects',
    NEEDED_SUBJECT_BY_ID: (subjectId: string) => `/profiles/needed-subjects/${subjectId}`,
  },

  // Sesiones de tutoría individual
  TUTORING: {
    SESSIONS: '/tutoring/sessions',
    MY_SESSIONS: '/tutoring/my-sessions',
    SESSION_STATUS: (sessionId: string) => `/tutoring/sessions/${sessionId}/status`,
    SESSION_REVIEWS: (sessionId: string) => `/tutoring/sessions/${sessionId}/reviews`,
    ATTENDANCE: '/tutoring/attendance',
  },

  // Talleres grupales
  WORKSHOPS: {
    BASE: '/workshops',
    BY_ID: (id: string) => `/workshops/${id}`,
    ENROLL: (id: string) => `/workshops/${id}/enroll`,
    STATUS: (id: string) => `/workshops/${id}/status`,
    ME_AS_STUDENT: '/workshops/me/as-student',
    ME_AS_TUTOR: '/workshops/me/as-tutor',
  },

  // Verificación y acreditación docente
  VERIFICATION: {
    REQUESTS: '/verification/requests',
    REQUEST_BY_ID: (requestId: string) => `/verification/requests/${requestId}`,
    MY_REQUESTS: '/verification/my-requests',
    FOR_VALIDATOR: '/verification/for-validator',
    BOT_GRANT: '/verification/bot-grant',
    CERTIFICATE: (requestId: string) => `/verification/requests/${requestId}/certificate`,
    CERTIFICATE_EXTRACTION: '/verification/certificate-extraction',
    PRACTICAL_EXERCISE: (requestId: string) => `/verification/requests/${requestId}/practical-exercise`,
    PRACTICAL_SUBMIT: (requestId: string) => `/verification/requests/${requestId}/practical-submission`,
    REVIEW: (requestId: string) => `/verification/requests/${requestId}/review`,
  },

  // Foro de dudas académicas
  FORUM: {
    POSTS: '/forum/posts',
    POST_BY_ID: (postId: string) => `/forum/posts/${postId}`,
    UPVOTE: (postId: string) => `/forum/posts/${postId}/upvote`,
    SOLVED: (postId: string) => `/forum/posts/${postId}/solved`,
    REPLIES: (postId: string) => `/forum/posts/${postId}/replies`,
    REPLY_BY_ID: (replyId: string) => `/forum/replies/${replyId}`,
    ACCEPT_REPLY: (postId: string, replyId: string) => `/forum/posts/${postId}/replies/${replyId}/solution`,
  },

  // Biblioteca y Editor de Apuntes Académicos
  NOTES: {
    BASE: '/notes',
    ME: '/notes/me',
    BY_ID: (noteId: string) => `/notes/${noteId}`,
    DOWNLOAD: (noteId: string) => `/notes/${noteId}/download`,
  },

  // Proyectos colaborativos
  PROJECTS: {
    BASE: '/projects',
    BY_ID: (projectId: string) => `/projects/${projectId}`,
    ME: '/projects/me',
    MY_APPLICATIONS: '/projects/my-applications',
    POSITIONS: (projectId: string) => `/projects/${projectId}/positions`,
    POSITION_BY_ID: (projectId: string, positionId: string) => `/projects/${projectId}/positions/${positionId}`,
    POSITION_STATUS: (projectId: string, positionId: string) => `/projects/${projectId}/positions/${positionId}/status`,
    MEMBERS: (projectId: string) => `/projects/${projectId}/members`,
    MEMBER_BY_ID: (projectId: string, profileId: string) => `/projects/${projectId}/members/${profileId}`,
    PROJECT_APPLICATIONS: (projectId: string) => `/projects/${projectId}/applications`,
    APPLY: (projectId: string, positionId: string) => `/projects/${projectId}/positions/${positionId}/apply`,
    WITHDRAW: (applicationId: string) => `/projects/applications/${applicationId}/withdraw`,
    REVIEW_APPLICATION: (applicationId: string) => `/projects/applications/${applicationId}/review`,
    APPLICATION_STATUS: (applicationId: string) => `/projects/applications/${applicationId}/status`,
    MILESTONES: (projectId: string) => `/projects/${projectId}/milestones`,
  },

  // Inteligencia artificial y evaluación semántica
  AI: {
    STATUS: '/ai/status',
    GENERATE_QUESTIONS: '/ai/generate-questions',
    GENERATE_QUIZ: '/ai/generate-quiz',
    EVALUATE_ANSWER: '/ai/evaluate-answer',
  },
} as const;
