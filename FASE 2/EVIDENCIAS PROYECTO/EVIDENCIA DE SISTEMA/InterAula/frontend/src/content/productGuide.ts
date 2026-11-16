export const GUIDE_INTRO = 'InterAula es un espacio de apoyo académico para universitarios. Puedes organizar tu estudio, entender temas, practicar y aprender con otras personas, eligiendo los apoyos que te resulten útiles.';

export const STARTING_STEPS = [
  { title: 'Elige lo que necesitas hoy', description: 'Retoma tu siguiente paso o entra a Estudiar, Pedir apoyo o Comunidad. Puedes usar cada herramienta por separado.' },
  { title: 'Empieza con una actividad pequeña', description: 'Por ejemplo: entender un tema, resolver un ejercicio, preparar una tarea o buscar una tutoría.' },
  { title: 'Ajusta la experiencia a tu ritmo', description: 'Puedes cambiar la lectura, elegir apoyos y hacer pausas. Personalizar tus preferencias es opcional.' },
] as const;

export const GUIDE_SECTIONS = [
  { id: 'estudiar', title: 'Organizar y entender tu estudio', description: 'En Estudiar reúnes tus materias, metas y actividades para saber por dónde seguir.',
    example: 'Tengo una prueba de Matemáticas: creo una ruta por temas y preparo una tarea para repasar.',
    links: [
      { title: 'Mis rutas y materias', description: 'Define una meta, divídela en etapas y retoma tu avance.', href: '/learning-space?tab=paths' },
      { title: 'Entender un tema', description: 'Elige una explicación sencilla, paso a paso, con ejemplos o con apoyo visual.', href: '/learning-space?tab=explain' },
      { title: 'Organizarme', description: 'Crea tareas y subtareas, usa bloques de estudio y pausas, y guarda ideas o dudas para después.', href: '/learning-space?tab=tasks' },
      { title: 'Mi actividad y reporte', description: 'Revisa tus rutas, tareas y progreso semanal, y descarga tu reporte personal en PDF.', href: '/learning-space?tab=overview' },
    ] },
  { id: 'practicar', title: 'Practicar y saber qué reforzar', description: 'Puedes comprobar tu comprensión y avanzar con preguntas, pistas y explicaciones.',
    example: 'Me cuesta una derivada: el piloto de Cálculo puede proponer reforzar un concepto previo.',
    links: [
      { title: 'Ruta adaptativa de Cálculo', description: 'Un piloto que usa tus respuestas para recomendar el siguiente concepto. Incluye mapa, pistas y práctica sin cronómetro.', href: '/learning-space?tab=adaptive' },
      { title: 'Comprobar comprensión', description: 'Revisa temas que necesitas practicar y registra tu avance.', href: '/learning-space?tab=reinforce' },
      { title: 'Quizzes y retos', description: 'Practica con los cuestionarios disponibles y consulta su retroalimentación.', href: '/tutoring?tab=quizzes' },
    ], note: 'La ruta adaptativa está disponible como piloto de Cálculo. Practicar aquí no acredita materias para impartir tutorías.' },
  { id: 'apoyo', title: 'Recibir apoyo de otras personas', description: 'En Pedir apoyo encuentras tutorías entre pares, talleres y tus actividades agendadas.',
    example: 'Necesito que alguien me explique un ejercicio: busco un tutor por materia y solicito una sesión.',
    links: [
      { title: 'Encontrar un tutor', description: 'Busca por materia y consulta su perfil y acreditaciones antes de solicitar apoyo.', href: '/tutoring?tab=tutors' },
      { title: 'Talleres', description: 'Explora clases grupales, revisa su información e inscríbete cuando haya cupos.', href: '/tutoring?tab=workshops' },
      { title: 'Mi agenda', description: 'Consulta tus clases e inscripciones y accede al aula virtual cuando corresponda.', href: '/tutoring?tab=my_classes' },
    ] },
  { id: 'comunidad', title: 'Compartir y crear en comunidad', description: 'Aprende con estudiantes de otras carreras a través de materiales, conversaciones y proyectos.',
    example: 'Quiero armar un equipo: exploro proyectos y postulo a una vacante relacionada con mis habilidades.',
    links: [
      { title: 'Apuntes', description: 'Consulta materiales compartidos, publica tus apuntes y conserva borradores antes de publicarlos.', href: '/resources?tab=community' },
      { title: 'Foro', description: 'Publica preguntas, conversa sobre temas académicos y comparte respuestas.', href: '/forum' },
      { title: 'Proyectos', description: 'Crea un proyecto, busca integrantes o postula para participar en un equipo.', href: '/projects?tab=explore' },
    ] },
  { id: 'mis-apoyos', title: 'Elegir cómo te resulta más cómodo aprender', description: 'Los apoyos son opcionales y están disponibles para cualquier estudiante, incluidas personas con TEA, TDAH o dislexia.',
    example: 'Prefiero instrucciones escritas y pausas: elijo esos apoyos y decido si quiero compartirlos con un tutor.',
    links: [
      { title: 'Mis apoyos para aprender', description: 'Configura tus preferencias y decide con quién compartir los apoyos que elijas.', href: '/learning-space?tab=profile' },
      { title: 'Lectura y apariencia', description: 'Ajusta Modo Calma, tamaño de texto, contraste y otras opciones de accesibilidad. Algunas actividades también ofrecen lectura en voz alta.', href: '/settings#accessibility' },
    ], note: 'No necesitas declarar un diagnóstico para usar estos apoyos. Tus preferencias de aprendizaje son privadas; tú eliges qué compartir.' },
  { id: 'descubrir', title: 'Encontrar contenido y personas afines', description: 'En Para ti aparecen sugerencias según tus intereses y las preferencias de comunidad que selecciones.',
    example: 'Quiero aprender Python con gente de mi institución: elijo el tema y ajusto mi comunidad académica.',
    links: [
      { title: 'Mis intereses', description: 'Distingue lo que te interesa, lo que quieres aprender y lo que puedes compartir.', href: '/profile?tab=interests' },
      { title: 'Mi institución y cercanía', description: 'Elige institución, sede, comuna y modalidad para orientar las sugerencias.', href: '/community' },
      { title: 'Para ti', description: 'Explora sugerencias de contenido y personas, y marca lo que no te interesa.', href: '/dashboard#para-ti' },
    ], note: 'Las coincidencias dependen del contenido y de los perfiles disponibles. Indicar que puedes compartir un tema no te acredita como tutor.' },
  { id: 'ensenar', title: 'Ofrecer tutorías y acreditar tus conocimientos', description: 'Para impartir tutorías debes acreditar cada materia mediante las vías disponibles en tu perfil.',
    example: 'Quiero enseñar Estadística: solicito la acreditación de esa materia antes de ofrecer tutorías.',
    links: [
      { title: 'Acreditarme como tutor', description: 'Accede a la evaluación de conocimientos o presenta respaldo docente. Solo las materias acreditadas quedan habilitadas para impartir.', href: '/profile?tab=tutoring' },
      { title: 'Gestionar mis tutorías', description: 'Revisa solicitudes, sesiones, talleres y materiales que compartes como tutor.', href: '/my-tutoring' },
    ], note: 'La formación en acompañamiento inclusivo requiere evidencia y una revisión autorizada por separado. Las solicitudes permanecen pendientes hasta ser revisadas.' },
] as const;
