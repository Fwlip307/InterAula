# Ensayo de InterAula — demo del 17 de noviembre de 2026

Este paquete prepara **datos dentro de la aplicación**, no una presentación nueva. El caso es ficticio y conecta estudio, apoyo humano, comunidad y confianza.

## Antes de proyectar

1. Iniciar Docker con `docker-start.bat` y abrir http://localhost.
2. Abrir en privado **ACCESOS_DEMO.local**, en esta misma carpeta. Contiene los accesos de Camila, Diego y Valentina en formato legible. El archivo CUENTAS_PRIVADAS.local conserva las siete identidades para los scripts; ambos están excluidos de Git. No hay claves de API en ese archivo. Cerrar el archivo antes de compartir pantalla.
3. Usar navegadores o perfiles independientes: **Camila** en uno, **Diego** en otro y **Valentina** cuando corresponda. Dos pestañas del mismo perfil comparten la sesión y no permiten representar dos personas a la vez.
4. Las cuatro cuentas `historia2` a `historia5` solo aportan historial ficticio para la reputación. No hace falta iniciar sesión con ellas durante la demo.
5. Abrir **RECORRIDO_DEMO.html** para tener los enlaces y marcar lo que ya ensayaron. **MATRIZ_DE_ENSAYO.csv** sirve como lista de pruebas editable.

## Historia que van a demostrar

**Camila** quiere preparar una evaluación de Cálculo y prefiere instrucciones claras, tareas breves y pausas. **Diego** ofrece apoyo en las asignaturas ficticias del escenario. **Valentina** coordina un proyecto de agenda accesible.

No es necesario atribuir diagnósticos a las personas ficticias. Los apoyos se eligen según sus preferencias, sin exigir TEA, TDAH o dislexia para utilizarlos.

### Recorrido principal

La sesión que permite demostrar la confirmación también tiene una previsualización de aula virtual con cámara opcional. Ver esa pantalla no implica entrar a una videollamada; conectar audio/vídeo es una prueba adicional de red y permisos.

1. **Camila → Inicio:** mostrar las cuatro áreas principales y recomendaciones por Matemáticas y Python.
2. **Estudiar:** abrir su ruta, tareas y práctica adaptativa. El historial ficticio contiene una dificultad en regla de la cadena; mostrar cómo se propone un prerrequisito y por qué. La práctica es un piloto de Cálculo y no acredita tutores.
3. **Pedir apoyo:** encontrar a **[DEMO] Diego Tutor**, consultar sus materias y revisar la preparación de la próxima clase. Como Diego, aceptar la solicitud de Valentina. Como Camila, inscribirse en el taller de Python.
4. **Comunidad:** leer la guía de derivadas, abrir el PDF, revisar la pregunta del foro y el proyecto Agenda de estudio accesible. Como Valentina, aceptar la postulación de Diego.
5. **Cerrar el ciclo:** confirmar la sesión preparada desde Camila y Diego; valorar como Camila; revisar el hito de 10 tutorías en Diego.
6. **Confianza:** ver avisos y el reporte ficticio pendiente. Explicar que una denuncia o nota baja no equivale a una sanción.

El caso muestra la utilidad de la aplicación: **saber qué estudiar, cómo avanzar y con quién apoyarse dentro de un mismo recorrido**. No hace falta recorrer todos los formularios para que esa idea se entienda.

## Datos incluidos

- Siete cuentas ficticias, con tres papeles principales y cuatro participantes de historial.
- Dos asignaturas dedicadas `[DEMO 17]`, ofrecidas solo por Diego dentro de este escenario.
- Nueve tutorías históricas ficticias, nueve reseñas de cinco estudiantes y el primer hito. La siguiente confirmación permite mostrar el hito de diez desde el flujo real.
- Tres sesiones adicionales: una ya habilitada para confirmar, una próxima de Cálculo y una solicitud pendiente de Python.
- Dos talleres futuros, con cupos y dos inscripciones preparadas.
- Una ruta con tres etapas, tareas con subtareas, una idea y una dificultad de comprensión.
- Progreso adaptativo ficticio coherente con una respuesta incorrecta y el modelo del piloto.
- Seis materiales de semilla: editor, compartido, privado y borrador. La verificación añade un PDF real de prueba mediante Storage y la API: habrá **siete materiales** cuando ese paso termine.
- Dos hilos de foro, una respuesta preparada, tres proyectos, vacantes, integrantes, una postulación pendiente y un entregable.
- Avisos y un reporte pendiente, sin responsables asignados ni sanciones ficticias.

Las ofertas y el historial de Diego son **fixtures de demostración**, no acreditaciones o evaluaciones reales. Los nombres, biografías, materiales, sesiones y proyectos lo indican con DEMO. No presentar las reseñas como evidencia real de calidad del producto.

## Qué pueden probar en vivo

| Prueba | Cuenta | Dónde | Qué debe ocurrir |
| --- | --- | --- | --- |
| Cambiar intereses | Camila | Perfil → Mis intereses | Cambian las coincidencias de Para ti |
| Avanzar una etapa | Camila | Estudiar → Mis rutas | Se conserva el progreso al recargar |
| Pedir una pista | Camila | Estudiar → Practicar | Ayuda sin contabilizarla como acierto independiente |
| Conversar con IA | Camila | Orientador visible | Orientación breve sobre app o estudios |
| Usar guía por pasos | Camila | Orientador → recorrido | Se destaca el control explicado y se puede pausar |
| Leer PDF | Camila | Comunidad → Apuntes | Vista previa o descarga con acceso autorizado |
| Crear una pregunta | Camila | Foro | Aparece con su autora y permite respuestas |
| Resolver postulación | Valentina | Proyecto Agenda | Diego entra al equipo y cambia el cupo |
| Aceptar tutoría | Diego | Mis tutorías → Solicitudes | Cambia el estado y aparecen avisos |
| Inscribirse en taller | Camila | Pedir apoyo → Talleres | Aparece en su agenda |
| Confirmar y valorar | Camila + Diego | Mis tutorías | Hito y reputación siguen las reglas publicadas |

## Repetir el momento de la insignia

Antes de otro ensayo, ejecutar **supabase/REINICIAR_ESCENA_TUTORIA_DEMO.sql** en SQL Editor. Solo reinicia la sesión señalada, su reseña, los avisos asociados y el hito de diez si vuelve a haber menos de diez sesiones válidas. No reinicia perfiles, intereses, rutas ni contenidos reales.

Después de reiniciar, volver a cargar las dos cuentas. No volver a ejecutar toda la carga para reiniciar solo esa escena: la carga conserva muchas interacciones y también restaura algunos valores iniciales de los perfiles DEMO.

## Límites que conviene explicar

- **Correo:** la cola y los avisos internos están activos; Resend sigue sin configurar. Los perfiles de este conjunto nunca reciben correos reales, incluso si después se habilita el proveedor.
- **Revisión humana:** estas cuentas no son revisores ni validadores y no pueden sancionar a nadie. El reporte permanece pendiente. Para presentar una resolución real se requieren responsables autorizados; no se simula una aprobación desde una cuenta común.
- **Acreditación:** las dos materias ficticias de Diego permiten probar las reservas. La formación inclusiva verificable es otro proceso y no se concede en la semilla.
- **BKT:** diez conceptos y cuarenta ejercicios del piloto de Cálculo; parámetros iniciales pendientes de validación docente y educativa externa.
- **K-Means:** agrupa datos disponibles para ayudar a ordenar recomendaciones. La cercanía se calcula con reglas de institución/sede/comuna, no con GPS ni agrupando diagnósticos. Si faltan datos, funciona el respaldo por afinidad.
- **IA y aula online:** dependen de conexión y proveedores. La guía manual, la agenda, los apuntes y el caso de confirmación entre participantes permiten continuar si hay un fallo externo.

Ya existen productos relacionados: [Knack](https://help.joinknack.com/en/articles/3636894-knack-tutoring) ofrece tutorías universitarias entre pares; [Canvas Mastery Paths](https://community.instructure.com/en/en/kb/articles/662760-unknown) diferencia contenidos según resultados; [Moodle](https://docs.moodle.org/en/Competencies) dispone de competencias y planes. La propuesta de InterAula es su combinación y recorrido enfocado en apoyo universitario inclusivo. No afirmar que ninguna otra aplicación ofrece tutorías, adaptación o accesibilidad, ni que se demostró eficacia clínica.

## Retirar los datos después

1. Ejecutar `node backend/node_modules/tsx/dist/cli.mjs backend/src/scripts/removePresentationFiles.ts` para retirar únicamente la carpeta de archivos creada por este paquete en las cuentas DEMO.
2. Ejecutar **supabase/RETIRAR_DEMO_PRESENTACION.sql** en SQL Editor. Solo selecciona las identidades server-owned de esta presentación. Se detiene si hay permisos elevados, medidas, archivos restantes o participación de personas ajenas.
3. El archivo local de contraseñas no se borra automáticamente. Retirarlo cuando el equipo ya no lo necesite.

No ejecutar el retiro durante el ensayo. Tampoco ejecutar scripts genéricos de borrado de usuarios. Los datos antiguos `[DEMO]` de intereses tienen otro conjunto y no se eliminan con este paquete.

## Estado comprobado

Carga remota confirmada: 7 cuentas, 12 sesiones, 6 materiales de semilla y 3 proyectos. Se añadió además un PDF mediante el flujo real de subida y publicación, por lo que ahora hay 7 materiales de esta presentación. Se comprobaron 26 casos de API, 19 comprobaciones de pantalla de estudiante/guía, 5 de tutor/propietaria y la previsualización del aula. La IA respondió a una pregunta genérica; no se enviaron correos. Pasaron 149 pruebas de backend. Las acciones de aceptación, confirmación, valoración y resolución de postulación se dejaron pendientes para el equipo.

Durante el ensayo se corrigieron la compatibilidad de prioridad de tareas en el esquema remoto y el catálogo de tutores, que ahora conserva el JWT validado al consultar materias con RLS. No se abrieron permisos públicos de materias ni se concedieron roles de revisión a las cuentas ficticias.
