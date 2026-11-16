export interface InclusiveResourceItem {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  internalPath: string;
  internalLabel: string;
}

export const INCLUSIVE_SUPPORT_RESOURCES: InclusiveResourceItem[] = [
  {
    id: 'one-step',
    title: 'Reducir sobrecarga: Un paso a la vez',
    summary:
      'Cuando una tarea se siente demasiado grande, enfócate solo en la primera acción concreta de 5 a 15 minutos.',
    steps: [
      'Abre Mi espacio de aprendizaje -> Tareas.',
      'Activa el Modo "Un paso a la vez".',
      'Usa "Dividir tarea con IA" o escribe 2 o 3 pasos cortos.',
    ],
    internalPath: '/learning-space?tab=tasks',
    internalLabel: 'Ir a Un paso a la vez',
  },
  {
    id: 'sensory-calm',
    title: 'Bajar estímulos visuales y animaciones',
    summary:
      'Puedes activar el Modo Calma, filtro cálido suave, tipografía de lectura fácil y desactivar destellos desde el menú de Modo en la barra superior.',
    steps: [
      'Haz clic en el botón "Modo" en la barra superior.',
      'Selecciona "Modo Calma" y activa "Filtro cálido suave" o "Sin destellos".',
      'Si lees textos largos, activa la "Regla de lectura guiada".',
    ],
    internalPath: '/settings',
    internalLabel: 'Abrir ajustes visuales',
  },
  {
    id: 'tutoring-prep',
    title: 'Preparar una tutoría con anticipación',
    summary:
      'Antes de entrar al Aula Virtual puedes revisar el guion anticipado, las reglas de participación y el uso opcional de cámara.',
    steps: [
      'Revisa la previsualización antes de entrar a la sala.',
      'Usa el Semáforo de comunicación (1 clic) si prefieres chat o ir más despacio.',
      'Usa tu Ficha "Mis apoyos para aprender" solo si decides compartirla.',
    ],
    internalPath: '/tutoring',
    internalLabel: 'Explorar tutorías',
  },
];

