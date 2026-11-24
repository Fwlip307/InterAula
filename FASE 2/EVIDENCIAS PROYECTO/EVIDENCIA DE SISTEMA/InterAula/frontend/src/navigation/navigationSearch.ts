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
  {id:'support',title:'Notificaciones y avisos',module:'Mi cuenta',description:'Bandeja privada, reportes, seguimiento y apelaciones.',href:'/support',keywords:'incidencias reportar denuncia problema apelacion apelación avisos notificaciones bandeja revisión ayuda'},
  {id:'orientation',title:'Orientador paso a paso',module:'Aprender',description:'Conversación opcional, instrucciones por voz y controles señalados en pantalla.',href:'/dashboard?orientador=1',keywords:'orientador chatbot asistente guiar pasos clicar ayuda guiada acompañamiento audio voz'},
  {id:'guide',title:'Cómo usar InterAula',module:'Aprender',description:'Qué puedes hacer, ejemplos y accesos a todas las herramientas.',href:'/guide',keywords:'guia guía ayuda tutorial empezar funciones como funciona qué puedo hacer instrucciones explicacion'},
  {id:'participate',title:'Participar en la comunidad',module:'Comunidad',description:'Foro académico, mensajería directa y talleres comunitarios.',href:'/participate',keywords:'comunidad participar compartir conversar equipo navegar foro mensajes'},
  {id:'messages',title:'Mensajería',module:'Comunidad',description:'Conversaciones directas en tiempo real con tutores, estudiantes y equipos.',href:'/messages',keywords:'mensajeria mensajería mensajes chat conversar directo bandeja inbox hablar tutor equipo'},
  {id:'adaptive',title:'Ruta adaptativa',module:'Aprender',description:'Mi espacio → Ruta adaptativa. Mapa de conceptos y práctica personalizada de Cálculo.',href:'/learning-space?tab=adaptive',keywords:'grafo conocimientos calculo cálculo derivadas adaptativo adaptativa BKT bayesiano motor próximo paso refuerzo'},
  {id:'community',title:'Mi comunidad académica',module:'Comunidad',description:'Elegir institución, sede, comuna y modalidad para tus sugerencias.',href:'/community',keywords:'comunidad universidad instituto campus sede cerca ubicacion ubicación comuna region presencial online distancia institución'},
  {id:'supports',title:'Mis apoyos para aprender',module:'Mi cuenta',description:'Mi espacio → Perfil. Elegir apoyos y con quién compartirlos.',href:'/learning-space?tab=profile',keywords:'pasaporte ficha apoyos compartir preferencias tutor aprendizaje'},
  {id:'one-step',title:'Un paso a la vez',module:'Aprender',description:'Mi espacio → Tareas. Pasos pequeños para estudiar.',href:'/learning-space?tab=tasks',keywords:'pasos tarea organizar estudio foco'},
  {id:'quick-ideas',title:'Ideas y dudas para después',module:'Aprender',description:'Mi espacio → Tareas. Anotar ideas y convertirlas en tareas.',href:'/learning-space?tab=tasks',keywords:'bandeja ideas notas dudas recordar dictar'},
  {id:'interests',title:'Mis intereses',module:'Mi cuenta',description:'Perfil → Mis intereses. Elegir temas y personalizar sugerencias.',href:'/profile?tab=interests',keywords:'temas gustos preferencias recomendaciones personalizar'},
  {id:'interest-learn',title:'Quiero aprender',module:'Mi cuenta',description:'Perfil → Mis intereses → Quiero aprender.',href:'/profile?tab=interests&intent=learn',keywords:'aprender estudiar seleccionar intereses necesito ayuda'},
  {id:'interest-teach',title:'Puedo compartir',module:'Mi cuenta',description:'Perfil → Mis intereses → Puedo compartir.',href:'/profile?tab=interests&intent=teach',keywords:'ensenar enseñar conocimientos habilidades compartir enseñar tutor'},
  {id:'interest-like',title:'Me interesa',module:'Mi cuenta',description:'Perfil → Mis intereses → Me interesa.',href:'/profile?tab=interests&intent=interest',keywords:'gustos temas elegir marcar seleccionar'},
  {id:'for-you',title:'Para ti',module:'Inicio',description:'Inicio → Para ti. Contenidos y personas relacionados contigo.',href:'/dashboard#para-ti',keywords:'recomendaciones sugerencias afinidad personas descubrir'},
  {id:'dashboard',title:'Inicio',module:'Portal',description:'Resumen de tu actividad y accesos a los módulos.',href:'/dashboard',keywords:'dashboard portal principal resumen panel'},
  {id:'learning',title:'Mi espacio de aprendizaje',module:'Aprender',description:'Organización del estudio, rutas y próximos pasos.',href:'/learning-space?tab=overview',keywords:'estudio aprender espacio resumen'},
  {id:'tutors',title:'Explorar tutorías y buscar tutores',module:'Tutorías',description:'Tutorías → Encontrar apoyo por asignatura y solicitar sesiones.',href:'/tutoring?tab=tutors',keywords:'profesor ayuda tutor solicitar reservar apoyo materias explorar buscar'},
  {id:'notes',title:'Biblioteca de recursos y apuntes',module:'Aprender',description:'Biblioteca → Comunidad. Explorar materiales compartidos.',href:'/resources?tab=community',keywords:'recursos biblioteca documentos archivos pdf materiales leer apuntes'},
  {id:'projects',title:'Hub de Proyectos',module:'Proyectos',description:'Proyectos → Explorar. Encontrar equipos y vacantes.',href:'/projects?tab=explore',keywords:'hub colaboracion colaboración equipos participar vacantes proyectos'},
  {id:'create-project',title:'Crear proyecto',module:'Proyectos',description:'Publicar una nueva iniciativa y definir roles requeridos.',href:'/projects?tab=explore&create=1',keywords:'crear proyecto publicar iniciativa vacantes equipo roles'},
  {id:'forum',title:'Foro académico',module:'Comunidad',description:'Publicaciones, preguntas, dudas y debates académicos.',href:'/forum',keywords:'foro publicaciones preguntas respuestas dudas debate estudiantes'},
  {id:'workshops',title:'Talleres y actividades',module:'Comunidad',description:'Talleres y clases grupales en vivo.',href:'/tutoring?tab=workshops',keywords:'taller talleres clases grupales ayudantias ayudantías inscribirme cupos actividades'},
  {id:'paths',title:'Mis rutas de aprendizaje',module:'Aprender',description:'Mi espacio → Rutas. Organizar metas y etapas.',href:'/learning-space?tab=paths',keywords:'ruta rutas plan metas etapas objetivos estudiar'},
  {id:'explanations',title:'Explicaciones adaptables',module:'Aprender',description:'Mi espacio → Aprende a tu manera.',href:'/learning-space?tab=explain',keywords:'explicar explicacion explicación aprende a tu manera ejemplos paso a paso ia'},
  {id:'tasks',title:'Mis tareas de estudio',module:'Aprender',description:'Mi espacio → Tareas. Subtareas, pausas y temporizador.',href:'/learning-space?tab=tasks',keywords:'tarea pendientes lista organizar pomodoro tiempo pausas intervalos'},
  {id:'reinforce',title:'Refuerzo y comprensión',module:'Aprender',description:'Mi espacio → Refuerzo. Revisar comprensión de temas.',href:'/learning-space?tab=reinforce',keywords:'reforzar practicar comprension comprensión evaluar dominio'},
  {id:'learning-profile',title:'Mis preferencias de aprendizaje',module:'Mi cuenta',description:'Mi espacio → Perfil. Ajustar cómo estudias.',href:'/learning-space?tab=profile',keywords:'configurar ritmo organizacion organización comunicacion entorno estilo aprendizaje preferencias'},
  {id:'classes',title:'Mis clases como estudiante',module:'Tutorías',description:'Tutorías → Mis clases e inscripciones.',href:'/tutoring?tab=my_classes',keywords:'clases inscripciones estudiante reservas proximas próximas'},
  {id:'quizzes',title:'Cuestionarios y evaluaciones',module:'Aprender',description:'Práctica interactiva, cuestionarios y retos con IA.',href:'/tutoring?tab=quizzes',keywords:'quiz quizzes cuestionario cuestionarios evaluaciones prueba preguntas retos practicar test ejercicios'},
  {id:'study-materials',title:'Materiales de estudio',module:'Aprender',description:'Explorar guías y recursos de apoyo.',href:'/tutoring?tab=materials',keywords:'material estudio recursos lecturas apoyo'},
  {id:'my-tutoring',title:'Mis tutorías y solicitudes',module:'Tutorías',description:'Gestionar solicitudes de apoyo recibidas y agenda.',href:'/my-tutoring?tab=requests',keywords:'solicitudes recibidas aceptar rechazar tutorias tutorías gestionar'},
  {id:'confirmed',title:'Aula virtual y sesiones confirmadas',module:'Tutorías',description:'Mis tutorías → Sesiones confirmadas y acceso a salas.',href:'/my-tutoring?tab=confirmed',keywords:'aula virtual sesiones confirmadas agenda calendario proximas próximas videollamada'},
  {id:'student-sessions',title:'Tutorías que solicité',module:'Tutorías',description:'Mis tutorías → Mis sesiones como estudiante.',href:'/my-tutoring?tab=student_sessions',keywords:'mis solicitudes estudiante sesiones solicitadas pendientes'},
  {id:'history',title:'Historial de tutorías',module:'Tutorías',description:'Mis tutorías → Historial.',href:'/my-tutoring?tab=history',keywords:'historial completadas anteriores calificaciones reseñas'},
  {id:'hosted-workshops',title:'Mis talleres',module:'Tutorías',description:'Mis tutorías → Talleres que organizo.',href:'/my-tutoring?tab=workshops',keywords:'talleres creados organizar anfitrion anfitrión'},
  {id:'offerings',title:'Ofrecer tutorías',module:'Tutorías',description:'Mis tutorías → Materias que enseño.',href:'/my-tutoring?tab=offerings',keywords:'asignaturas materias ofertas enseñar ensenar publicar tutoria ofrecer'},
  {id:'tutor-materials',title:'Mis materiales de tutoría',module:'Tutorías',description:'Mis tutorías → Material compartido.',href:'/my-tutoring?tab=materials',keywords:'materiales tutor adjuntos recursos subidos'},
  {id:'my-notes',title:'Apuntes académicos propios',module:'Aprender',description:'Apuntes → Mis apuntes publicados y editor.',href:'/resources?tab=mine',keywords:'documentos propios mis publicaciones subidos editar apuntes propios'},
  {id:'drafts',title:'Borradores de apuntes',module:'Aprender',description:'Apuntes → Borradores.',href:'/resources?tab=drafts',keywords:'borradores sin publicar pendientes editor guardar'},
  {id:'my-projects',title:'Mis proyectos, equipos y entregables',module:'Proyectos',description:'Proyectos → Mis proyectos, integrantes y entregables.',href:'/projects?tab=my_projects',keywords:'creados propios equipo equipos entregables administrar liderar'},
  {id:'applications',title:'Mis postulaciones',module:'Proyectos',description:'Proyectos → Mis postulaciones a vacantes.',href:'/projects?tab=my_applications',keywords:'postulaciones aplicaciones vacantes solicitudes enviadas equipo'},
  {id:'profile',title:'Mi perfil',module:'Mi cuenta',description:'Información personal y académica.',href:'/profile?tab=personal',keywords:'perfil universidad institucion institución carrera nombre datos personales'},
  {id:'edit-profile',title:'Editar mis datos',module:'Mi cuenta',description:'Perfil → Editar información personal y académica.',href:'/profile?tab=personal&edit=true',keywords:'editar actualizar cambiar nombre carrera universidad foto biografia'},
  {id:'needed-subjects',title:'Materias que quiero reforzar',module:'Mi cuenta',description:'Perfil → Lo que quiero aprender. Registrar asignaturas.',href:'/profile?tab=learning',keywords:'materias asignaturas necesito ayuda apoyo reforzar agregar eliminar'},
  {id:'accreditation',title:'Acreditación de tutor',module:'Tutorías',description:'Perfil → Tutorías. Evaluación IA, certificado y respaldo docente.',href:'/profile?tab=tutoring',keywords:'acreditacion acreditación certificado certificacion verificacion examen validar docente enseñar tutor'},
  {id:'settings',title:'Configuración',module:'Mi cuenta',description:'Preferencias de accesibilidad, aprendizaje y cuenta.',href:'/settings',keywords:'ajustes configuracion configuración opciones preferencias'},
  {id:'accessibility',title:'Apoyos sensoriales y accesibilidad',module:'Mi cuenta',description:'Configuración → Accesibilidad. Tema, Crepúsculo, filtro cálido, tamaño y contraste.',href:'/settings#accessibility',keywords:'modo calma claro oscuro crepusculo crepúsculo filtro calido cálido dark theme tema fuente letra contraste tamaño movimiento apoyos sensoriales'},
  {id:'learning-preferences',title:'Mi forma de aprender',module:'Mi cuenta',description:'Configuración → Preferencias privadas de aprendizaje.',href:'/settings#learning-preferences',keywords:'preferencias aprendizaje visual escrito ejemplos ritmo instrucciones'},
  {id:'notifications',title:'Notificaciones por correo',module:'Mi cuenta',description:'Configuración → Avisos y notificaciones.',href:'/settings#notifications',keywords:'notificaciones avisos correos email silencio'},
  {id:'security',title:'Seguridad de la cuenta',module:'Mi cuenta',description:'Configuración → Seguridad y autenticación.',href:'/settings#security',keywords:'seguridad contrasena contraseña correo cuenta autenticacion'},
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
