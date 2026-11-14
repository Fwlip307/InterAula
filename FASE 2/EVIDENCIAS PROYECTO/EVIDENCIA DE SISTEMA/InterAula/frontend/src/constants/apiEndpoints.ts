/**
 * Catálogo centralizado de endpoints del Backend REST propio de InterAula.
 * Elimina URLs hardcodeadas y duplicadas a lo largo de los servicios del frontend.
 */

export const API_ENDPOINTS = {
  // Estado del servidor
  HEALTH: '/health',
  RECOMMENDATIONS: {
    TOPICS: '/recommendations/topics',
    PREFERENCES: '/recommendations/preferences',
    FEED: '/recommendations/feed',
    DISMISSALS: '/recommendations/dismissals',
    DISMISSAL: (kind: string, id: string) => `/recommendations/dismissals/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,
  },

  // Perfiles de usuario y asignaturas
  PROFILES: {
    ME: '/profiles/me',
    SUBJECTS: '/profiles/catalog/subjects',
    BY_ID: (id: string) => `/profiles/${id}`,
    OFFERED_SUBJECTS: '/profiles/offered-subjects',
    OFFERED_SUBJECT_BY_ID: (subjectId: string) => `/profiles/offered-subjects/${subjectId}`,
    NEEDED_SUBJECTS: '/profiles/needed-subjects',
    NEEDED_SUBJECT_BY_ID: (subjectId: string) => `/profiles/needed-subjects/${subjectId}`,
  },

  // Sesiones de tutoría individual
  TUTORING: {
    SESSIONS: '/tutoring/sessions',
    TUTORS: '/tutoring/tutors',
    SESSION_BY_ID: (id: string) => `/tutoring/sessions/${id}`,
    MY_SESSIONS: '/tutoring/my-sessions',
    SESSION_STATUS: (sessionId: string) => `/tutoring/sessions/${sessionId}/status`,
    SESSION_PREP: (sessionId: string) => `/tutoring/sessions/${sessionId}/prep`,
    ROOM_SIGNALS: (roomId: string) => `/tutoring/rooms/${roomId}/signals`,
    SESSION_REVIEWS: (sessionId: string) => `/tutoring/sessions/${sessionId}/reviews`,
    ATTENDANCE: '/tutoring/sessions/attendance',
  },

  // Talleres grupales
  WORKSHOPS: {
    BASE: '/workshops',
    BY_ID: (id: string) => `/workshops/${id}`,
    ENROLL: (id: string) => `/workshops/${id}/enroll`,
    STATUS: (id: string) => `/workshops/${id}/status`,
    PREP: (id: string) => `/workshops/${id}/prep`,
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
    ATTEMPTS: '/verification/attempts',
    ANSWERS: (id: string) => `/verification/attempts/${id}/answers`,
    ENDORSEMENTS: '/verification/endorsements',
    CERTIFICATE: (requestId: string) => `/verification/requests/${requestId}/certificate`,
    CERTIFICATE_EXTRACTION: '/verification/certificate-extraction',
    PRACTICAL_EXERCISE: (requestId: string) => `/verification/requests/${requestId}/practical-exercise`,
    PRACTICAL_SUBMIT: (requestId: string) => `/verification/requests/${requestId}/practical-submission`,
    REVIEW: (requestId: string) => `/verification/requests/${requestId}/review`,
    INCLUSIVE_ME: '/verification/inclusive-accreditation/me',
    INCLUSIVE_CREATE: '/verification/inclusive-accreditation',
    INCLUSIVE_VALIDATOR: '/verification/inclusive-accreditation/validator',
    INCLUSIVE_REVIEW: (id: string) => `/verification/inclusive-accreditation/${id}/review`,
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
    DELIVERABLES: (projectId: string) => `/projects/${projectId}/deliverables`,
    DELIVERABLE_BY_ID: (projectId: string, deliverableId: string) =>
      `/projects/${projectId}/deliverables/${deliverableId}`,
    DELIVERABLE_COMMENTS: (projectId: string, deliverableId: string) =>
      `/projects/${projectId}/deliverables/${deliverableId}/comments`,
  },

  // Inteligencia artificial y evaluación semántica
  AI: {
    STATUS: '/ai/status',
    GENERATE_QUESTIONS: '/ai/generate-questions',
    GENERATE_QUIZ: '/ai/generate-quiz',
    EVALUATE_ANSWER: '/ai/evaluate-answer',
    BREAKDOWN_TASK: '/ai/breakdown-task',
  },

  // Mi espacio de aprendizaje (Rutas personalizadas, explicaciones adaptables, tareas y refuerzo)
  LEARNING_SPACE: {
    OVERVIEW: '/learning-space/overview',
    CONFIG: '/learning-space/config',
    PATHS: '/learning-space/paths',
    PATH_BY_ID: (pathId: string) => `/learning-space/paths/${pathId}`,
    ADD_STAGE: (pathId: string) => `/learning-space/paths/${pathId}/stages`,
    TOGGLE_STAGE: (pathId: string, stageId: string) =>
      `/learning-space/paths/${pathId}/stages/${stageId}`,
    TASKS: '/learning-space/tasks',
    TASK_BY_ID: (taskId: string) => `/learning-space/tasks/${taskId}`,
    ASSESSMENTS: '/learning-space/assessments',
    EXPLAIN: '/learning-space/explain',
    IDEAS: '/learning-space/ideas',
    IDEA_BY_ID: (ideaId: string) => `/learning-space/ideas/${ideaId}`,
    IDEA_CONVERT: (ideaId: string) => `/learning-space/ideas/${ideaId}/convert-to-task`,
  },
} as const;
