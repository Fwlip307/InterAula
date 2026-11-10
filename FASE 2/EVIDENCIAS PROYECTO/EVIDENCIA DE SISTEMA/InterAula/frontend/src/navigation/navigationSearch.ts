export interface NavigationDestination {
  id: string;
  title: string;
  module: string;
  description: string;
  href: string;
  keywords: string;
}

// Navigation only: no personal data, remote requests or user-provided URLs.
export const NAVIGATION_DESTINATIONS: readonly NavigationDestination[] = [
  {id:'interests',title:'Mis intereses',module:'Perfil',description:'Perfil → Mis intereses. Elegir temas y personalizar sugerencias.',href:'/profile?tab=interests',keywords:'temas gustos preferencias recomendaciones personalizar'},
  {id:'interest-learn',title:'Quiero aprender',module:'Intereses',description:'Perfil → Mis intereses → Quiero aprender.',href:'/profile?tab=interests&intent=learn',keywords:'aprender estudiar seleccionar intereses necesito ayuda'},
  {id:'interest-teach',title:'Puedo compartir',module:'Intereses',description:'Perfil → Mis intereses → Puedo compartir.',href:'/profile?tab=interests&intent=teach',keywords:'ensenar enseñar conocimientos habilidades compartir enseñar tutor'},
  {id:'interest-like',title:'Me interesa',module:'Intereses',description:'Perfil → Mis intereses → Me interesa.',href:'/profile?tab=interests&intent=interest',keywords:'gustos temas elegir marcar seleccionar'},
  {id:'for-you',title:'Para ti',module:'Inicio',description:'Inicio → Para ti. Contenidos y personas relacionados contigo.',href:'/dashboard#para-ti',keywords:'recomendaciones sugerencias afinidad personas descubrir'},
  {id:'dashboard',title:'Inicio',module:'Portal',description:'Resumen de tu actividad y accesos a los módulos.',href:'/dashboard',keywords:'dashboard portal principal resumen panel'},
  {id:'learning',title:'Mi espacio de aprendizaje',module:'Aprendizaje',description:'Organización del estudio y próximos pasos.',href:'/learning-space?tab=overview',keywords:'estudio aprender espacio resumen'},
  {id:'tutors',title:'Buscar tutores',module:'Tutorías',description:'Tutorías → Tutores. Encontrar apoyo por asignatura.',href:'/tutoring?tab=tutors',keywords:'profesor ayuda tutor solicitar reservar apoyo materias'},
  {id:'notes',title:'Apuntes y biblioteca',module:'Comunidad',description:'Apuntes → Comunidad. Explorar materiales compartidos.',href:'/resources?tab=community',keywords:'recursos biblioteca documentos archivos pdf materiales leer'},
  {id:'projects',title:'Proyectos',module:'Comunidad',description:'Proyectos → Explorar. Encontrar equipos y vacantes.',href:'/projects?tab=explore',keywords:'hub colaboracion colaboración equipos participar vacantes'},
  {id:'forum',title:'Foro',module:'Comunidad',description:'Publicaciones, preguntas, dudas y debates académicos.',href:'/forum',keywords:'foro publicaciones preguntas respuestas dudas debate estudiantes'},
  {id:'workshops',title:'Talleres y clases en vivo',module:'Tutorías',description:'Tutorías → Talleres y clases en vivo.',href:'/tutoring?tab=workshops',keywords:'taller clases grupales ayudantias ayudantías inscribirme cupos'},
  {id:'paths',title:'Rutas de aprendizaje',module:'Aprendizaje',description:'Mi espacio → Rutas. Organizar metas y etapas.',href:'/learning-space?tab=paths',keywords:'ruta plan metas etapas objetivos estudiar'},
  {id:'explanations',title:'Explicaciones adaptables',module:'Aprendizaje',description:'Mi espacio → Aprende a tu manera.',href:'/learning-space?tab=explain',keywords:'explicar explicacion explicación aprende a tu manera ejemplos paso a paso ia'},
  {id:'tasks',title:'Mis tareas de estudio',module:'Aprendizaje',description:'Mi espacio → Tareas. Subtareas, pausas y temporizador.',href:'/learning-space?tab=tasks',keywords:'tarea pendientes lista organizar pomodoro tiempo pausas intervalos'},
  {id:'reinforce',title:'Refuerzo y comprensión',module:'Aprendizaje',description:'Mi espacio → Refuerzo. Revisar comprensión de temas.',href:'/learning-space?tab=reinforce',keywords:'reforzar practicar comprension comprensión evaluar dominio'},
  {id:'learning-profile',title:'Perfil de aprendizaje',module:'Aprendizaje',description:'Mi espacio → Perfil. Ajustar cómo estudias.',href:'/learning-space?tab=profile',keywords:'configurar ritmo organizacion organización comunicacion entorno estilo aprendizaje'},
  {id:'classes',title:'Mis clases como estudiante',module:'Tutorías',description:'Tutorías → Mis clases e inscripciones.',href:'/tutoring?tab=my_classes',keywords:'clases inscripciones estudiante reservas proximas próximas'},
  {id:'quizzes',title:'Quizzes y retos',module:'Tutorías',description:'Tutorías → Quizzes. Practicar con preguntas.',href:'/tutoring?tab=quizzes',keywords:'quiz cuestionario prueba preguntas retos practicar test ejercicios'},
  {id:'study-materials',title:'Materiales de estudio',module:'Tutorías',description:'Tutorías → Materiales. Explorar recursos de apoyo.',href:'/tutoring?tab=materials',keywords:'material estudio recursos lecturas apoyo'},
  {id:'my-tutoring',title:'Mis tutorías y solicitudes',module:'Gestión de tutorías',description:'Gestionar solicitudes de apoyo recibidas.',href:'/my-tutoring?tab=requests',keywords:'solicitudes recibidas aceptar rechazar tutorias tutorías gestionar'},
  {id:'confirmed',title:'Sesiones confirmadas',module:'Gestión de tutorías',description:'Mis tutorías → Confirmadas.',href:'/my-tutoring?tab=confirmed',keywords:'sesiones confirmadas agenda calendario proximas próximas'},
  {id:'student-sessions',title:'Tutorías que solicité',module:'Gestión de tutorías',description:'Mis tutorías → Mis sesiones como estudiante.',href:'/my-tutoring?tab=student_sessions',keywords:'mis solicitudes estudiante sesiones solicitadas pendientes'},
  {id:'history',title:'Historial de tutorías',module:'Gestión de tutorías',description:'Mis tutorías → Historial.',href:'/my-tutoring?tab=history',keywords:'historial completadas anteriores calificaciones reseñas'},
  {id:'hosted-workshops',title:'Mis talleres',module:'Gestión de tutorías',description:'Mis tutorías → Talleres que organizo.',href:'/my-tutoring?tab=workshops',keywords:'talleres creados organizar anfitrion anfitrión'},
  {id:'offerings',title:'Mis materias ofrecidas',module:'Gestión de tutorías',description:'Mis tutorías → Materias que enseño.',href:'/my-tutoring?tab=offerings',keywords:'asignaturas materias ofertas enseñar ensenar publicar tutoria'},
  {id:'tutor-materials',title:'Mis materiales de tutoría',module:'Gestión de tutorías',description:'Mis tutorías → Material compartido.',href:'/my-tutoring?tab=materials',keywords:'materiales tutor adjuntos recursos subidos'},
  {id:'my-notes',title:'Mis apuntes',module:'Apuntes',description:'Apuntes → Mis apuntes publicados.',href:'/resources?tab=mine',keywords:'documentos propios mis publicaciones subidos editar apuntes'},
  {id:'drafts',title:'Borradores de apuntes',module:'Apuntes',description:'Apuntes → Borradores.',href:'/resources?tab=drafts',keywords:'borradores sin publicar pendientes editor guardar'},
  {id:'my-projects',title:'Mis proyectos',module:'Proyectos',description:'Proyectos → Mis proyectos.',href:'/projects?tab=my_projects',keywords:'creados propios equipo administrar liderar'},
  {id:'applications',title:'Mis postulaciones',module:'Proyectos',description:'Proyectos → Mis postulaciones a vacantes.',href:'/projects?tab=my_applications',keywords:'postulaciones aplicaciones vacantes solicitudes enviadas equipo'},
  {id:'profile',title:'Mi perfil',module:'Perfil',description:'Información personal y académica.',href:'/profile?tab=personal',keywords:'perfil universidad institucion institución carrera nombre datos personales'},
  {id:'edit-profile',title:'Editar mis datos',module:'Perfil',description:'Perfil → Editar información personal y académica.',href:'/profile?tab=personal&edit=true',keywords:'editar actualizar cambiar nombre carrera universidad foto biografia'},
  {id:'needed-subjects',title:'Materias que quiero reforzar',module:'Perfil',description:'Perfil → Lo que quiero aprender. Registrar asignaturas.',href:'/profile?tab=learning',keywords:'materias asignaturas necesito ayuda apoyo reforzar agregar eliminar'},
  {id:'accreditation',title:'Acreditarme como tutor',module:'Perfil',description:'Perfil → Tutorías. Evaluación y respaldo docente.',href:'/profile?tab=tutoring',keywords:'acreditacion acreditación certificado certificacion verificacion examen validar docente enseñar'},
  {id:'settings',title:'Configuración',module:'Ajustes',description:'Preferencias de accesibilidad, aprendizaje y cuenta.',href:'/settings',keywords:'ajustes configuracion configuración opciones preferencias'},
  {id:'accessibility',title:'Accesibilidad y apariencia',module:'Ajustes',description:'Configuración → Accesibilidad. Tema, tamaño de texto y contraste.',href:'/settings#accessibility',keywords:'modo calma claro oscuro dark theme tema fuente letra contraste tamaño movimiento'},
  {id:'learning-preferences',title:'Mi forma de aprender',module:'Ajustes',description:'Configuración → Preferencias privadas de aprendizaje.',href:'/settings#learning-preferences',keywords:'preferencias aprendizaje visual escrito ejemplos ritmo instrucciones'},
  {id:'notifications',title:'Notificaciones',module:'Ajustes',description:'Configuración → Avisos y notificaciones.',href:'/settings#notifications',keywords:'notificaciones avisos correos email silencio'},
  {id:'security',title:'Seguridad de la cuenta',module:'Ajustes',description:'Configuración → Seguridad y autenticación.',href:'/settings#security',keywords:'seguridad contrasena contraseña correo cuenta autenticacion'},
  {id:'presentation',title:'Presentación de InterAula',module:'Inicio',description:'Conocer el propósito y las funciones de InterAula.',href:'/',keywords:'presentacion presentación ayuda como funciona acerca inicio publico'},
];

export const normalizeNavigationQuery=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');

export function searchNavigation(query:string): NavigationDestination[] {
  const text=normalizeNavigationQuery(query.slice(0,120));
  if(!text)return [...NAVIGATION_DESTINATIONS];
  const tokens=text.split(' ');
  return NAVIGATION_DESTINATIONS.map((entry,index)=>{
    const title=normalizeNavigationQuery(entry.title);
    const aliases=normalizeNavigationQuery(entry.keywords);
    const full=normalizeNavigationQuery([entry.title,entry.module,entry.description,entry.keywords].join(' '));
    if(!tokens.every(token=>full.includes(token)))return {entry,index,score:0};
    const score=(title===text?1000:title.startsWith(text)?700:title.includes(text)?500:aliases.includes(text)?250:100)
      +tokens.reduce((sum,token)=>sum+(title.includes(token)?40:aliases.includes(token)?15:5),0);
    return {entry,index,score};
  }).filter(result=>result.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(result=>result.entry);
}
