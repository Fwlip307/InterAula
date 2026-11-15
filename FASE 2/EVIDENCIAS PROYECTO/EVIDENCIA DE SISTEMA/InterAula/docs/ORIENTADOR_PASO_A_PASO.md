# Orientador opcional de InterAula

## Experiencia

El inicio contiene un apartado visible «¿Te acompaño paso a paso?» y el portal mantiene un botón «Orientador» en la esquina. También se encuentra buscando «chatbot», «orientador» o «ayuda guiada». El enlace /dashboard?orientador=1 abre la ayuda por elección explícita y limpia ese parámetro para evitar reaperturas involuntarias.

Está cerrado y sin audio por defecto. Se puede elegir una necesidad o escribir un mensaje. Las peticiones ambiguas ofrecen opciones. El chat utiliza Google Gemini para conversar sobre InterAula y los estudios universitarios, dar ejemplos breves y entender preguntas de seguimiento. Los temas ajenos reciben una redirección al ámbito de la app y del aprendizaje. La respuesta puede proponer un recorrido, que el estudiante elige iniciar expresamente. Durante los recorridos, la explicación aparece en una tarjeta contextual junto al control real y el entorno se oscurece, dejando visible el área señalada. La conversación normal conserva su panel y no oscurece la página. Se puede llevar el foco al control sin ejecutar acciones. El usuario realiza los clics, completa los campos y confirma las acciones.

Hay diez recorridos y 31 pasos: entender un tema, encontrar un tutor, acreditarse como tutor, buscar apuntes, unirse a un equipo, preparar una idea de proyecto, organizar una tarea, elegir apoyos, practicar Cálculo y conocer las áreas principales.

Al finalizar se proponen acciones para continuar aprendiendo. Terminar la orientación no acredita materias, no completa tareas ni registra aprendizaje. Los cierres de explicación o material invitan a explicar una idea con palabras propias, resolver un ejemplo y buscar apoyo cuando persistan dudas.

## Voz, accesibilidad y control

La voz utiliza Web Speech API y las voces del navegador o sistema. Dispone de reproducción, pausa, continuación, detención, velocidad y lectura automática de pasos con activación expresa. La alternativa escrita funciona cuando la voz no está disponible o falla.

La tarjeta del tutorial y el panel de conversación son complementarios y permiten interactuar con la página; no bloquea la navegación ni hace clic por el estudiante. Puede pausarse, cerrarse con Escape y retomarse en el mismo paso. Respeta los temas y Modo Calma. Los controles ausentes o deshabilitados muestran instrucciones, sin simular que una operación terminó.

Se suspende y detiene la voz durante evaluaciones, pantalla completa y ventanas modales. No se reactiva al cerrarlas; el usuario elige retomarlo.

## Implementación y privacidad

- frontend/src/content/orientationFlows.ts: catálogo de rutas, pasos, controles y sugerencias de intención.
- frontend/src/context/OrientationContext.tsx: conversación, elección, progreso del recorrido y suspensión.
- frontend/src/components/orientation/OrientationTour.tsx y frontend/src/utils/orientationSpotlight.ts: tarjeta contextual, posición adaptable y oscurecimiento con hueco transparente.
- frontend/src/hooks/useOrientationTarget.ts: localización y señalización de elementos reales.
- frontend/src/components/orientation/OrientationAssistant.tsx: entrada, conversación, instrucciones, audio y panel.
- frontend/src/styles/orientation.css: presentación y adaptación a pantalla pequeña.

El chat usa POST /api/ai/orientation-chat, autenticación Supabase y la clave GEMINI_API_KEY del backend existente, con GEMINI_MODEL configurado. No hay claves privadas en el frontend. El backend envía la conversación reciente a Google Gemini: hasta ocho mensajes previos y el nuevo mensaje (máximo 1600 caracteres), más la página/pestaña y el identificador/estado del recorrido actual si existe. No adjunta el perfil, correo, diagnósticos, preferencias, certificados ni registros de aprendizaje. El usuario ve un aviso antes de escribir y debe evitar datos sensibles. El historial del portal queda en memoria y se borra al recargar, salir, cambiar de cuenta o pulsar borrar; esto no equivale a borrar mensajes ya procesados por Google, cuyo tratamiento depende de las condiciones de la cuenta del proveedor.

La respuesta estructurada se valida en el servidor: solo texto, ámbito y hasta tres identificadores de un catálogo fijo. El cliente vuelve a filtrar los identificadores y renderiza el texto sin interpretar HTML ni ejecutar instrucciones. El modelo no recibe herramientas de escritura ni decide rutas arbitrarias. La conversación puede explicar una materia, pero no acredita, responde evaluaciones en curso ni modifica datos. La guía para ofrecer tutorías va a Perfil → Ofrecer tutorías; es distinta de la búsqueda de apoyo.

El servicio limita las solicitudes a 12 por minuto y cuenta, con tiempo de espera de 25 segundos. Fallos de configuración, proveedor o formato muestran un error explícito y permiten reintentar o usar los recorridos manuales. No se sustituye silenciosamente por respuestas locales ni por otro proveedor. Se cancelan solicitudes al cerrar, borrar, cambiar de cuenta o abrir una evaluación/modal; también se descartan respuestas tardías. No se registran conversaciones en la base de datos ni en logs del servicio.

El alcance se establece con instrucciones del servidor y un catálogo de información real de la app. Es una orientación generativa: puede equivocarse y no garantiza conocimiento de contenido o disponibilidad en vivo. La interfaz lo indica. Se debe comprobar la calidad con estudiantes y docentes; no se afirma eficacia clínica ni se considera una herramienta de diagnóstico.

Las páginas de destino mantienen sus lecturas normales de datos. Las acciones que el estudiante confirma en esas páginas conservan sus servicios y permisos existentes. La orientación no cambia diagnósticos, preferencias, acreditaciones o contenido. No exige declarar diagnósticos y está disponible para universitarios con distintas necesidades de apoyo.

Las explicaciones académicas ahora esperan una acción explícita de generación; escribir materia y tema no inicia solicitudes automáticamente.

## Verificación

116 pruebas de backend y 61 de frontend aprobadas. Se comprobaron autenticación, límites, contexto/historial, ámbito, salida estructurada, errores privados y cancelación. Compilación de frontend/backend y análisis estático sin errores; permanecen avisos previos del repositorio.

La revisión del navegador usa componentes reales, AppRouter y cliente HTTP, con cuenta/datos/voz/respuestas de IA simulados, sin escrituras en producción. Revisa el recorrido nuevo de acreditación, chat sin oscurecimiento, carga/error/reintento, texto seguro, historial, cierre, modales y cambio de cuenta, y tamaños 320/390/768/1440 en claro/oscuro/Calma. No verifica reproducción de audio real.

Además se hicieron solicitudes reales al modelo Gemini configurado con mensajes ficticios: “hola me hago tutor”, pedir ayuda de Matemáticas, explicar una derivada y preguntar cómo practicarla en la app. Se confirmó la separación de ambas intenciones y la continuidad de la conversación. Los resultados son ejemplos observados, no garantías de respuestas idénticas.

Evidencia actual y scripts: docs/orientador-ia-2026-11-15/. Las revisiones locales anteriores quedan como evidencia histórica en docs/tutorial-contextual-2026-11-15/ y docs/orientador-2026-11-15/. No necesita migraciones de Supabase ni claves nuevas.
