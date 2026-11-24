import type { LearningPath, StudyTask } from '../types/learningSpace';

export type NavigationCategoryId = 'learn' | 'tutoring' | 'community' | 'projects';

export interface NavigationSubItem {
  id: string;
  label: string;
  href: string;
  description: string;
}

export interface NavigationCategory {
  id: NavigationCategoryId;
  href: string;
  label: string;
  paths: readonly string[];
  items: readonly NavigationSubItem[];
}

export const MAIN_DESTINATIONS: readonly NavigationCategory[] = [
  {
    id: 'learn',
    href: '/learning-space',
    label: 'Aprender',
    paths: ['/learning-space', '/learning', '/resources'],
    items: [
      {
        id: 'learning-space',
        label: 'Mi espacio de aprendizaje',
        href: '/learning-space',
        description: 'Centro de estudio, tareas y explicaciones adaptables',
      },
      {
        id: 'resource-library',
        label: 'Biblioteca de recursos',
        href: '/resources?tab=community',
        description: 'Material compartido y guías de estudio por asignatura',
      },
      {
        id: 'academic-notes',
        label: 'Apuntes académicos',
        href: '/resources?tab=mine',
        description: 'Editor integrado, borradores y exportación a PDF',
      },
      {
        id: 'quizzes-assessments',
        label: 'Cuestionarios y evaluaciones',
        href: '/tutoring?tab=quizzes',
        description: 'Práctica interactiva sin presión y retos con IA',
      },
      {
        id: 'learning-paths',
        label: 'Mis rutas de aprendizaje',
        href: '/learning-space?tab=paths',
        description: 'Metas por materia organizadas en etapas manejables',
      },
    ],
  },
  {
    id: 'tutoring',
    href: '/tutoring',
    label: 'Tutorías',
    paths: ['/tutoring', '/my-tutoring', '/tutor'],
    items: [
      {
        id: 'explore-tutors',
        label: 'Explorar tutorías y buscar tutores',
        href: '/tutoring?tab=tutors',
        description: 'Busca tutores pares por asignatura y solicita una sesión',
      },
      {
        id: 'offer-tutoring',
        label: 'Ofrecer tutorías',
        href: '/my-tutoring?tab=offerings',
        description: 'Publica y administra las materias que enseñas',
      },
      {
        id: 'my-tutoring',
        label: 'Mis tutorías',
        href: '/my-tutoring',
        description: 'Solicitudes recibidas, reservas e historial',
      },
      {
        id: 'tutor-accreditation',
        label: 'Acreditación de tutor',
        href: '/profile?tab=tutoring',
        description: 'Evaluación técnica, certificados y respaldo docente',
      },
      {
        id: 'virtual-classroom',
        label: 'Aula virtual',
        href: '/my-tutoring?tab=confirmed',
        description: 'Acceso a tus salas confirmadas y videollamadas',
      },
    ],
  },
  {
    id: 'community',
    href: '/participate',
    label: 'Comunidad',
    paths: ['/participate', '/forum', '/messages', '/community'],
    items: [
      {
        id: 'academic-forum',
        label: 'Foro académico',
        href: '/forum',
        description: 'Preguntas, debates y soluciones validadas entre pares',
      },
      {
        id: 'direct-messaging',
        label: 'Mensajería',
        href: '/messages',
        description: 'Conversaciones directas con tutores, estudiantes y equipos',
      },
      {
        id: 'workshops-activities',
        label: 'Talleres y actividades',
        href: '/tutoring?tab=workshops',
        description: 'Clases grupales en vivo y sesiones de repaso',
      },
    ],
  },
  {
    id: 'projects',
    href: '/projects',
    label: 'Proyectos',
    paths: ['/projects'],
    items: [
      {
        id: 'projects-hub',
        label: 'Hub de Proyectos',
        href: '/projects',
        description: 'Panorama de proyectos interdisciplinarios activos',
      },
      {
        id: 'explore-projects',
        label: 'Explorar proyectos',
        href: '/projects?tab=explore',
        description: 'Filtrar vacantes por área, modalidad y habilidades',
      },
      {
        id: 'create-project',
        label: 'Crear proyecto',
        href: '/projects?tab=explore&create=1',
        description: 'Publica una iniciativa y define los roles que buscas',
      },
      {
        id: 'my-projects',
        label: 'Mis proyectos',
        href: '/projects?tab=my_projects',
        description: 'Administra proyectos propios, vacantes y avance',
      },
      {
        id: 'my-applications',
        label: 'Mis postulaciones',
        href: '/projects?tab=my_applications',
        description: 'Estado de tus solicitudes a equipos académicos',
      },
      {
        id: 'teams-deliverables',
        label: 'Equipos y entregables',
        href: '/projects?tab=my_projects&view=team',
        description: 'Integrantes, acuerdos, hitos y entregables del equipo',
      },
    ],
  },
] as const;

export const ACCOUNT_MENU_ITEMS: readonly NavigationSubItem[] = [
  {
    id: 'my-profile',
    label: 'Mi perfil',
    href: '/profile',
    description: 'Datos académicos, intereses y materias',
  },
  {
    id: 'learning-preferences',
    label: 'Mis preferencias de aprendizaje',
    href: '/learning-space?tab=profile',
    description: 'Cómo prefieres recibir explicaciones y estudiar',
  },
  {
    id: 'sensory-accessibility',
    label: 'Apoyos sensoriales y accesibilidad',
    href: '/settings#accessibility',
    description: 'Temas, Modo Calma, filtro cálido y lectura cómoda',
  },
  {
    id: 'settings',
    label: 'Configuración',
    href: '/settings',
    description: 'Ajustes generales y seguridad de la cuenta',
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    href: '/support',
    description: 'Bandeja de avisos, alertas y seguimiento',
  },
] as const;

export function isDestinationActive(pathname: string, paths: readonly string[]) {
  return paths.some(path => pathname === path || pathname.startsWith(path + '/'));
}

export function isCategoryActive(
  category: Pick<NavigationCategory, 'id' | 'paths'>,
  pathname: string,
  search = ''
): boolean {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');

  if (pathname === '/tutoring' && tab === 'quizzes') {
    return category.id === 'learn';
  }
  if (pathname === '/tutoring' && tab === 'workshops') {
    return category.id === 'community';
  }
  if (pathname === '/profile' && tab === 'tutoring') {
    return category.id === 'tutoring';
  }

  return isDestinationActive(pathname, category.paths);
}

export function nextStudyStep(paths: LearningPath[], tasks: StudyTask[]) {
  const working = tasks.find(task => task.status === 'in_progress');
  if (working) return { title: working.title, detail: 'Tienes una tarea en curso. Puedes retomar sus pasos y pausas.', href: '/learning-space?tab=tasks', action: 'Ver mi tarea' };
  const path = paths.find(item => item.status === 'active' && item.stages.some(stage => !stage.completed));
  const stage = path?.stages.find(item => !item.completed);
  if (path && stage) return { title: stage.title, detail: 'Siguiente etapa de ' + path.title + '.', href: '/learning-space?tab=paths&path=' + encodeURIComponent(path.id), action: 'Continuar mi ruta' };
  const pending = tasks.find(task => task.status === 'pending');
  if (pending) return { title: pending.title, detail: 'Una tarea pendiente para cuando quieras empezar.', href: '/learning-space?tab=tasks', action: 'Ver mi tarea' };
  return { title: 'Elige qué quieres estudiar', detail: 'Define una materia y una meta. Te acompañamos paso a paso.', href: '/learning-space?tab=paths', action: 'Elegir una materia' };
}
