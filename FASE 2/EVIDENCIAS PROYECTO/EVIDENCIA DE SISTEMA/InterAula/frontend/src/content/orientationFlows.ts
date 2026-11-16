export type OrientationGoal = 'learn'|'tutors'|'become-tutor'|'notes'|'projects'|'create-project'|'organize'|'supports'|'practice'|'explore';
export interface OrientationStep { title:string; instruction:string; href:string; selector:string; control:string; missing:string }
export interface OrientationFlow { title:string; introduction:string; outcome:string; steps:OrientationStep[] }
const step=(title:string,instruction:string,href:string,selector:string,control:string,missing='Si este control no aparece, vuelve a la sección o espera a que termine de cargar. Puedes continuar por tu cuenta o pausar la guía.'):OrientationStep=>({title,instruction,href,selector,control,missing});

export const ORIENTATION_FLOWS:Record<OrientationGoal,OrientationFlow>={
 learn:{title:'Entender un tema',introduction:'Vamos a elegir un tema concreto y una explicación que puedas trabajar a tu ritmo.',outcome:'Después de leer, intenta explicar el tema con tus palabras y resolver un ejemplo. Si queda una duda, puedes buscar un tutor o un apunte.',steps:[
  step('Elige tu asignatura','Escribe la materia que quieres estudiar. Por ejemplo, Matemáticas o Programación.','/learning-space?tab=explain','#explain-subject','Asignatura'),
  step('Describe una sola duda','Escribe un tema concreto. Por ejemplo, cómo resolver una ecuación de primer grado.','/learning-space?tab=explain','#explain-topic','Tema o concepto'),
  step('Pide una explicación','Revisa tu materia y tu tema. Pulsa Generar explicación cuando quieras; también puedes elegir el modo de explicación que prefieras.','/learning-space?tab=explain','[data-orientation="explain-generate"]','Generar explicación'),
  step('Comprueba qué entendiste','Lee la explicación y su ejemplo. Intenta explicarlo con tus palabras y anota qué parte aún te cuesta. Puedes cambiar el modo o buscar apoyo humano.','/learning-space?tab=explain','[data-orientation="explain-result"]','Explicación del tema','La explicación aparece después de generarla. Primero completa materia y tema y pulsa Generar explicación. Si hay un error, reintenta en esa sección.'),
 ]},
 'become-tutor':{title:'Acreditarme como tutor',introduction:'Para ofrecer tutorías necesitas acreditar una materia. Revisaremos las opciones de tu perfil; conversar aquí no concede una acreditación.',outcome:'Solo las materias aprobadas aparecen como habilitadas. La formación inclusiva tiene una revisión distinta y permanece pendiente hasta contar con un responsable autorizado.',steps:[
  step('Abre Ofrecer tutorías','Aquí están tu disponibilidad y las formas de acreditar tus conocimientos.','/profile?tab=tutoring','[data-orientation="module-tutoring"]','Ofrecer tutorías'),
  step('Elige cómo acreditar una materia','Puedes rendir la evaluación técnica o presentar respaldo docente o notas oficiales para revisión. Lee los requisitos antes de comenzar. Abrir una evaluación pausa esta guía.','/profile?tab=tutoring','[data-orientation="tutor-accreditation"]','Habilitación técnica de tutores'),
  step('Consulta tus materias acreditadas','Aquí solo aparecen materias aprobadas por evaluación o revisión de respaldo. Si no hay ninguna, primero completa una vía de acreditación.','/profile?tab=tutoring','#offered-subjects','Materias habilitadas para impartir'),
 ]},
 tutors:{title:'Encontrar un tutor',introduction:'Buscaremos apoyo por materia. Tú eliges el perfil y decides si quieres solicitar una sesión.',outcome:'La solicitud se envía desde el formulario de tutoría cuando tú la confirmas. Revisa su estado y fecha en Mi agenda.',steps:[
  step('Busca tu materia','Escribe la asignatura o el nombre de un tutor y pulsa Buscar. Puedes revisar los filtros de materias y acreditación.','/tutoring?tab=tutors','[data-orientation="tutor-search"]','Buscar tutor o materia'),
  step('Revisa las opciones','Mira los perfiles, las materias y la disponibilidad. Si no hay resultados, prueba otra búsqueda o amplía los filtros. Cuando elijas un tutor, pulsa Solicitar tutoría y revisa el formulario antes de enviarlo.','/tutoring?tab=tutors','[data-orientation="tutor-results"]','Resultados de tutores'),
  step('Consulta tu agenda','Aquí puedes revisar tus clases e inscripciones. Una solicitud pendiente necesita confirmación; comprueba el estado antes de una sesión.','/tutoring?tab=my_classes','[data-orientation="module-my_classes"]','Mi agenda'),
 ]},
 notes:{title:'Encontrar material de estudio',introduction:'Vamos a buscar un apunte relacionado con tu materia y a elegir una parte pequeña para estudiar.',outcome:'Al terminar, resume una idea del material e intenta aplicarla en un ejercicio. Si no encuentras contenido, puedes preguntar en el foro o pedir apoyo.',steps:[
  step('Busca un tema','Escribe una materia, un tema o una palabra del título. Por ejemplo, ecuaciones, Python o Estadística.','/resources?tab=community','[data-orientation="notes-search"]','Buscar apuntes'),
  step('Ajusta la asignatura','Si hay mucho contenido, filtra por asignatura. Si no encuentras resultados, vuelve a Todas las asignaturas o cambia la palabra de búsqueda.','/resources?tab=community','[data-orientation="notes-subject"]','Filtrar por asignatura'),
  step('Elige qué vas a leer','Revisa el título y el contenido de un apunte antes de usarlo. Abre un material y comienza con una sección pequeña. Si no hay resultados, prueba otra búsqueda.','/resources?tab=community','[data-orientation="notes-results"]','Apuntes disponibles'),
 ]},
 projects:{title:'Unirme a un equipo',introduction:'Podemos buscar un proyecto según un tema que te motive y lo que puedas aportar.',outcome:'Revisa el objetivo, las vacantes y las condiciones del proyecto. Postula solo cuando hayas elegido un rol y revisado tu mensaje.',steps:[
  step('Busca un proyecto','Escribe un tema, una tecnología o un problema que te interese. Por ejemplo, una app de estudio, Python o diseño.','/projects?tab=explore','[data-orientation="projects-search"]','Buscar proyectos'),
  step('Piensa qué puedes aportar','Puedes indicar una habilidad o un rol. También puedes revisar las áreas y modalidades disponibles.','/projects?tab=explore','[data-orientation="projects-skill"]','Filtrar por habilidad o rol'),
  step('Revisa un equipo','Abre un proyecto que te interese y revisa sus vacantes. Si no hay resultados, amplía los filtros o considera crear tu propia idea.','/projects?tab=explore','[data-orientation="projects-results"]','Proyectos disponibles'),
 ]},
 'create-project':{title:'Dar forma a mi proyecto',introduction:'Empieza con tres ideas: qué problema quieres resolver, qué resultado pequeño podrías crear y qué personas necesitas. Por ejemplo: una guía accesible de tu materia con un equipo de redacción y diseño.',outcome:'Antes de publicar, revisa tu idea, los entregables y las vacantes. La publicación y las invitaciones las decides tú.',steps:[
  step('Abre el formulario','Pulsa Publicar Nuevo Proyecto para describir tu idea. Todavía no se publica nada al abrirlo.','/projects?tab=explore','[data-orientation="project-create"]','Publicar Nuevo Proyecto'),
  step('Ponle un nombre concreto','Elige un título que ayude a entender tu idea. Por ejemplo: Guía visual de Estadística para primer año.','/projects?tab=explore','#proj-title','Título del proyecto','Primero pulsa Publicar Nuevo Proyecto. El título aparece dentro del formulario.'),
  step('Describe el problema','Escribe a quién quieres ayudar y qué dificultad resolverá tu proyecto. Puedes empezar con una o dos frases.','/projects?tab=explore','#proj-problem','Problema o necesidad','Abre Publicar Nuevo Proyecto para ver este campo.'),
  step('Define un resultado pequeño','Anota uno o dos entregables concretos y piensa qué roles necesitas. Revisa los demás campos y las vacantes antes de decidir si publicas.','/projects?tab=explore','#proj-objectives','Objetivos y entregables','Este campo está en el formulario de Publicar Nuevo Proyecto.'),
 ]},
 organize:{title:'Organizar una tarea',introduction:'Vamos a transformar una actividad grande en un primer paso pequeño. Puedes elegir pausas y bloques de estudio.',outcome:'Cuando guardes tu tarea, trabaja en una subtarea. Puedes usar una pausa y retomar después; terminar este recorrido no marca la tarea como completada.',steps:[
  step('Nombra tu actividad','Escribe una tarea concreta: por ejemplo, preparar la guía de Matemáticas.','/learning-space?tab=tasks','#task-title','Actividad de estudio'),
  step('Indica la materia','Escribe la asignatura relacionada para reconocer la tarea después.','/learning-space?tab=tasks','#task-subject','Asignatura de la tarea'),
  step('Divídela en pasos pequeños','Escribe subtareas que puedas hacer por separado: leer un ejemplo, resolver un ejercicio y anotar una duda. Revisa las pausas y guarda solo cuando estés conforme.','/learning-space?tab=tasks','#task-subtasks','Subtareas'),
 ]},
 supports:{title:'Elegir mis apoyos',introduction:'Puedes elegir lo que te ayuda a estudiar: instrucciones claras, pausas o formas de comunicarte. No necesitas declarar un diagnóstico.',outcome:'Puedes ajustar tus preferencias cuando quieras. Revisa qué apoyos decides compartir y con quién.',steps:[
  step('Elige cómo prefieres aprender','Revisa las opciones y marca solo las que te sirvan. Decide si quieres compartir apoyos; tus notas personales permanecen privadas.','/learning-space?tab=profile','[data-orientation="learning-supports"]','Mis apoyos para aprender'),
  step('Ajusta la lectura','Puedes modificar el tamaño de texto, el contraste o Modo Calma. Elige lo que te resulte cómodo.','/settings#accessibility','#accessibility','Lectura y apariencia'),
 ]},
 practice:{title:'Practicar Cálculo a mi ritmo',introduction:'Este piloto propone conceptos de Cálculo según tus respuestas. Puedes pedir pistas y practicar sin cronómetro.',outcome:'Las respuestas ayudan a recomendar el siguiente concepto. Si necesitas otra materia, puedes usar explicaciones, materiales o tutorías.',steps:[
  step('Elige tu objetivo','Revisa el concepto al que quieres llegar. La selección está disponible al terminar el ejercicio en curso.','/learning-space?tab=adaptive','#adaptive-goal','Objetivo de práctica'),
  step('Empieza cuando quieras','Pulsa Practicar este concepto para abrir un ejercicio. La guía no responde por ti ni inicia el ejercicio automáticamente.','/learning-space?tab=adaptive','[data-orientation="adaptive-start"]','Practicar este concepto','Si ya hay un ejercicio abierto, puedes continuarlo. Si el objetivo está consolidado, elige otro objetivo.'),
  step('Responde con calma','Lee la pregunta y las alternativas. Puedes escuchar el ejercicio, pedir una pista o elegir No lo sé todavía. Comprueba tu respuesta cuando estés listo.','/learning-space?tab=adaptive','[data-orientation="adaptive-practice"]','Ejercicio en curso','Primero inicia o retoma un ejercicio. Al terminarlo puedes continuar con el siguiente paso recomendado.'),
 ]},
 explore:{title:'Conocer InterAula',introduction:'Te mostraré las tres áreas principales. Puedes elegir una y volver al orientador cuando lo necesites.',outcome:'Elige el área que necesites hoy. El buscador de la barra superior también te lleva directamente a una herramienta.',steps:[
  step('Estudiar','Aquí encuentras rutas, explicaciones, tareas y práctica. Puedes preparar una materia y avanzar en actividades pequeñas.','/dashboard','[data-orientation="overview-study"]','Estudiar a tu ritmo'),
  step('Pedir apoyo','Aquí puedes buscar un tutor, explorar talleres y consultar tu agenda.','/dashboard','[data-orientation="overview-support"]','Pedir apoyo'),
  step('Participar','Aquí encuentras apuntes, foro y proyectos para aprender y crear con otras personas.','/dashboard','[data-orientation="overview-community"]','Participar en comunidad'),
 ]},
};

export const ORIENTATION_CHOICES:{id:OrientationGoal;label:string}[]=[
 {id:'learn',label:'Entender un tema'},{id:'tutors',label:'Buscar un tutor'},{id:'notes',label:'Encontrar apuntes'},
 {id:'become-tutor',label:'Acreditarme como tutor'},{id:'projects',label:'Hacer un proyecto'},{id:'organize',label:'Organizarme'},{id:'explore',label:'Conocer la app'},
];

export const ORIENTATION_FOLLOW_UPS:Record<OrientationGoal,OrientationGoal[]>={
 'become-tutor':['supports','explore'],learn:['notes','tutors','organize'],tutors:['notes','organize'],notes:['learn','tutors'],projects:['create-project','organize'],
 'create-project':['organize','projects'],organize:['learn','notes'],supports:['organize','learn'],practice:['learn','tutors'],explore:['learn','tutors','projects'],
};

const normalize=(value:string)=>value.slice(0,600).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Local intent suggestions only. Unknown or ambiguous requests always stay a choice. */
export function suggestOrientationGoals(input:string):OrientationGoal[]{
 const text=normalize(input);
 if(!text)return [];
 const rules:[OrientationGoal,RegExp][]=[
  ['tutors',/\b(tutor[a-z]*|profesor[a-z]*|ayuda humana|clase particular)\b/],
  ['notes',/\b(apunte[a-z]*|material[a-z]*|biblioteca|documento[a-z]*|pdf|recurso[a-z]*)\b/],
  ['projects',/\b(proyecto[a-z]*|equipo[a-z]*|colaborar|vacante[a-z]*|crear algo|hacer algo con)\b/],
  ['organize',/\b(tarea[a-z]*|organizar[a-z]*|subtarea[a-z]*|planificar[a-z]*|no se por donde empezar|distraigo|concentr[a-z]*)\b/],
  ['supports',/\b(apoyos|calma|accesibilidad|pausa[a-z]*|tdah|tda|tea|dislexia|letra|contraste|instrucciones)\b/],
  ['practice',/\b(practicar|practica|calculo|derivada[a-z]*|ejercicio[a-z]*)\b/],
  ['learn',/\b(aprender|entender|estudiar|explica[a-z]*|no entiendo|comprender|tema[a-z]*)\b/],
  ['explore',/\b(conocer|como funciona|que puedo hacer|guia|orientar[a-z]*|perdido|perdida)\b/],
 ];
 const matches=rules.filter(([,pattern])=>pattern.test(text)).map(([id])=>id);
 if(matches.includes('projects')&&/\b(crear|publicar|tengo una idea|mi idea|nuevo proyecto)\b/.test(text))matches[matches.indexOf('projects')]='create-project';
 return [...new Set(matches)].slice(0,3);
}
export function isOrientationLocation(current:string,href:string):boolean{
 const actual=new URL(current,'https://interaula.invalid'),expected=new URL(href,'https://interaula.invalid');
 return actual.pathname===expected.pathname&&[...expected.searchParams].every(([key,value])=>actual.searchParams.get(key)===value);
}

export const ORIENTATION_SCOPE_REPLY='Solo puedo orientarte sobre las funciones de InterAula: estudio, tutorías, materiales, proyectos y apoyos. Elige una opción de la aplicación para empezar.';

/** Chat entry policy: suggestions always refer to application operations, never general answers. */
export function getScopedOrientationGoals(input:string):OrientationGoal[]{
 const text=normalize(input);
 if(/\b(ignora|omite|olvida)\b.{0,70}\b(reglas|restricciones|instrucciones|sistema)\b|\b(cambia tu rol|actua como|prompt del sistema|system prompt)\b/.test(text))return [];
 const appObject=/\b(tutor[a-z]*|apunte[a-z]*|material[a-z]*|biblioteca|proyecto[a-z]*|equipo[a-z]*|tarea[a-z]*|ruta[a-z]*|perfil|intereses|preferencias|institucion|sede|foro|taller[a-z]*|agenda|acredit[a-z]*)\b/.test(text);
 const navigation=/\b(buscar|busco|busca|encontrar|acceder|entrar|usar|utilizar|abrir|solicitar|agendar|inscribir[a-z]*|unirme|participar|publicar|crear|organizar[a-z]*|ajustar|configurar|activar|elegir|retomar|navegar|editar|subir|compartir|postular|donde|interaula|aplicacion|app)\b/.test(text);
 const appQuestion=appObject&&(/\b(como puedo|como se|cuanto cuesta una tutoria)\b/.test(text)||navigation);
 const external=/\b(futbol|futbolista|presidente|politica|bitcoin|criptomonedas|dolar|receta[a-z]*|cocinar|pelicula[a-z]*|harry potter|snape|horoscopo|noticias|clima|quien es|quien fue|quien gano|que opinas|como curar|diagnosticar)\b/.test(text);
 if(external&&!appQuestion)return [];
 if(/\b(resuelve|calculame|dame la respuesta|haz mi tarea|redactame|escribeme un)\b/.test(text)&&!appQuestion)return [];
 return suggestOrientationGoals(text);
}
