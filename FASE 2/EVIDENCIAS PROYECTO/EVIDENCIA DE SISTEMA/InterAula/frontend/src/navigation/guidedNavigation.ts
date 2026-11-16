import type { LearningPath, StudyTask } from '../types/learningSpace';

export const MAIN_DESTINATIONS = [
  { href: '/dashboard', label: 'Inicio', paths: ['/dashboard'] },
  { href: '/learning-space', label: 'Estudiar', paths: ['/learning-space', '/learning'] },
  { href: '/tutoring', label: 'Pedir apoyo', paths: ['/tutoring', '/my-tutoring', '/tutor'] },
  { href: '/participate', label: 'Comunidad', paths: ['/participate', '/resources', '/projects', '/forum', '/community'] },
] as const;

export function isDestinationActive(pathname: string, paths: readonly string[]) {
  return paths.some(path => pathname === path || pathname.startsWith(path + '/'));
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

