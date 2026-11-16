# InterAula: revisión integral y siguientes iteraciones

Revisión del 15 de noviembre de 2026, contrastada con el documento APT compartido y con el enfoque acordado: estudiantes de educación superior, con apoyos opcionales para TEA, TDAH y dislexia. Este informe no reproduce los antecedentes personales del documento.

**Iteración posterior completada:** incorporado un piloto K-Means al buscador de tutores con Python/scikit-learn, preferencias explícitas y DEMO aislado. La suite actual pasa 62 pruebas frontend, 125 backend y 9 Python. [Implementación, pruebas y límites actuales](KMEANS_TUTORES.md). Los resultados de la revisión integral que siguen corresponden a su ejecución anterior.

## Resultado de esta revisión

Se corrigieron problemas reales del ciclo de tutorías, la valoración, la navegación y los estados de error. Se ejecutaron 179 pruebas automáticas (62 frontend y 117 backend), un recorrido de navegador con 35 rutas internas y 6 públicas, y comprobaciones de las correcciones en escritorio y móvil. Las pruebas SQL usaron PostgreSQL WASM en memoria y datos ficticios, sin conexión a Supabase.

Se consultó la estructura del Supabase configurado mediante SELECT limit(0): las 19 tablas/vistas comprobadas y sus campos requeridos respondieron correctamente. No se descargaron registros ni se ejecutaron escrituras o RPC. Esto confirma disponibilidad de estructura; no confirma por sí solo los flujos de cuentas reales, todos los permisos de cada rol ni la activación de la nueva protección SQL.

Docker fue reconstruido y ambos servicios quedaron saludables. La aplicación se abre en http://localhost. No se creó un commit ni se publicó en GitHub.

## Correcciones realizadas

| Problema reproducible o verificado en el código | Comportamiento corregido |
| --- | --- |
| La interfaz pedía comunicación, dominio y puntualidad de 1 a 10, pero enviaba nombres de columnas distintos, reducía a 1–5 y trataba dominio como empatía. | Se envían los tres criterios originales de 1–10 hasta PostgreSQL. El promedio lo calcula la columna generada de la base. |
| Todas las valoraciones empezaban en 10; el usuario podía enviar sin elegir. | Tres selectores sin puntuación inicial, selección requerida y comentario opcional. El formulario conserva las elecciones si falla el envío. |
| Un intento de valoración duplicada mostraba un error genérico. | La API informa que la tutoría ya tiene una valoración, sin insertar otra. Solo el estudiante participante puede valorar una sesión completada. |
| La tarjeta ofrecía completar la sesión al estudiante, pero el servidor exige al tutor; algunos botones ni siquiera tenían una acción asignada. | Finalizar aparece para el tutor con acción disponible y hora alcanzada. El reloj se actualiza; el estudiante valora después. Se reconoce el estado «En curso». |
| Gestión de tutorías conservaba un formulario para publicar materias sin acreditación y las presentaba como activas. | Gestión, perfil público y catálogo usan materias acreditadas. La gestión comparte el listado de solo lectura del perfil y enlaza a la acreditación real. No se borraron materias ni acreditaciones de la base. |
| Los enlaces de talleres dentro de Mi agenda llevaban al buscador de tutores. | Los accesos llevan explícitamente a Talleres o a Encontrar un tutor según su finalidad. Las tarjetas se ajustan a móvil. |
| Una búsqueda lenta podía sobrescribir los resultados de otra más reciente. | Apuntes, foro, tutores y talleres descartan respuestas de solicitudes anteriores y después de desmontar el componente. |
| Fallos de apuntes o talleres podían parecer listas vacías; fallos al abrir foro/proyectos escapaban del manejador. | Se muestran errores y se conserva la navegación. El perfil público diferencia un fallo de carga de un usuario inexistente y permite reintentar. |
| Abrir una conversación del foro dependía de hacer clic en una tarjeta sin acceso de teclado al título. | El título tiene un botón real, accesible con teclado. |
| La API y la base permitían intentar reservar una asignatura no acreditada mediante llamadas directas. | La API exige is_verified=true. La migración 025 añade la protección también al INSERT directo en PostgreSQL; el usuario confirmó su activación remota con proteccion_activada=true. |

El formulario de valoración usa diálogo nativo: foco contenido, Escape, etiquetas explícitas y estado de guardado. Se comprobó en 320, 390, 768 y 1440 px, en claro, oscuro y Calma. La orientación se suspende durante ese diálogo igual que ante otras ventanas modales.

## Matriz por módulo

| Módulo | Comprobación realizada | Alcance o validación que sigue pendiente |
| --- | --- | --- |
| Acceso, registro y recuperación | Renderizado de pantallas, salida y redirección de rutas privadas; la suite prueba rechazo de tokens ausentes/falsos. | Correos reales, recuperación completa, confirmación de cuenta y OAuth con cuentas de prueba del proyecto. No se enviaron correos. |
| Inicio y búsqueda global | Resumen, accesos, rutas y buscador; pruebas previas conservadas de navegación por teclado y diseño. | Validar si estudiantes nuevos identifican su siguiente acción sin ayuda. |
| Perfil e intereses | Secciones, preferencias, privacidad y recomendaciones por cuenta; 22 temas y escenarios sintéticos en la suite. | Usabilidad con intereses reales y perfiles con información incompleta. |
| Comunidad y cercanía | Pantalla de institución/sede/modalidad; pruebas de afinidad y coincidencia geográfica. | Calidad de resultados de una comunidad real. No usa GPS ni identifica una ubicación residencial. |
| Rutas de aprendizaje y tareas | Navegación; creación/avance, subtareas, persistencia y conversión de ideas en las pruebas API/SQL. | Medir si la secuencia y el volumen de información resultan adecuados para cada usuario. |
| Explicaciones y comprensión | Pantallas, generación por acción expresa y pruebas de servicios. | Revisión docente del contenido de materias y validación de comprensión con estudiantes. La IA puede equivocarse. |
| Práctica adaptativa | Grafo de diez conceptos de Cálculo, cuarenta ejercicios, BKT, pistas, idempotencia y privacidad mediante pruebas automáticas. | Es un piloto de Cálculo; no implica cobertura de todas las asignaturas ni eficacia educativa demostrada. |
| Apoyos y Ajustes | Navegación y preferencias; temas, lectura y contraste en revisión visual y pruebas existentes. | Evaluación con teclado/lector de pantalla y participación voluntaria de estudiantes con distintas necesidades de apoyo. |
| Acreditación de materias | Pruebas existentes de intentos privados, tiempos, integridad, respuestas y permisos; materias aprobadas en las pantallas. | Ensayo completo con docentes/estudiantes en los dispositivos de la presentación. Los controles del navegador no impiden todas las capturas ni el uso de otro dispositivo. |
| Formación inclusiva | Pantalla y pruebas de evidencia privada, validación y revisión independiente. | Continúa pendiente designar responsables autorizados; las solicitudes no deben autoaprobarse. |
| Tutorías individuales | Finalización por tutor, posterior valoración, reserva válida, rechazo de materia no acreditada y solapamientos en PostgreSQL temporal; activación remota de 025 confirmada por el usuario. | Un ciclo completo entre dos cuentas reales. |
| Reputación e insignias | HTTP → inserción SQL real en memoria: notas 9/8/7 conservadas, promedio 8, rechazo de duplicados y de campos privilegiados, estadísticas e hitos 1/10/25/50. | Comprobar uso real, prácticas de abuso y representatividad de las reseñas. Una insignia por cantidad de sesiones no es una certificación de calidad docente. |
| Talleres y aula | Pestañas, agenda, navegación y pruebas existentes de cupos, estados, señales y preparación. | Videollamada, permisos de cámara/micrófono, reconexión y asistencia entre dos dispositivos reales. No se emitió audio ni vídeo real en el navegador de pruebas. |
| Apuntes | Explorar/míos/borradores, búsqueda fuera de orden, error y recuperación; suite de privacidad, versiones, HTML y descargas. | Archivos reales de distintos formatos y tamaños, con cuentas de prueba. |
| Foro | Lista/conversación, controles, búsquedas y errores; suite de publicaciones/respuestas/votos/solución y permisos. | Moderación y calidad de aportes de una comunidad real. |
| Proyectos | Explorar/míos/postulaciones, errores de detalle; suite CRUD, roles, cupos y privacidad. | Colaboración completa con dos cuentas y entregables reales. La plataforma registra acuerdos declarados, no procesa pagos. |
| Orientador IA | Integración y controles de sesión/alcance en la suite; se conserva la evidencia reciente de Gemini real y del tutorial visual. | Probar lenguaje espontáneo con estudiantes, disponibilidad/cuota del proveedor y revisión de respuestas. No consulta automáticamente apuntes ni historial académico. |

## Correspondencia con el documento APT

| Afirmación o compromiso | Estado de la aplicación |
| --- | --- |
| Tutorías y materiales sin monedas ni transacciones de dinero | Corresponde al flujo académico actual. Los acuerdos declarados del Hub deben explicarse por separado para no sugerir una pasarela de cobros. |
| Valoración multicriterio 1–10 y reputación automática | La base ya lo soportaba; el contrato frontend/backend quedó corregido y probado. |
| Insignias por 10, 25 y 50 sesiones | Existen; también hay un primer hito de una sesión. Se verificó su otorgamiento con datos temporales. |
| Recomendación con K-Means/Python/scikit-learn | Implementada posteriormente como piloto en el buscador de tutores, con agrupación de promedios de valoraciones y reglas de priorización. Cuenta con DEMO y pruebas reales entre servicios; falta validar utilidad con reseñas auténticas. «Para ti» mantiene afinidad por temas y comunidad. Ver KMEANS_TUTORES.md. |
| Aprendizaje adaptativo | Existe un piloto de Cálculo con grafo y seguimiento bayesiano. Es un componente distinto de la recomendación de tutores por clustering. |
| Plataforma «descentralizada» | La interacción es entre pares; técnicamente hay backend y base de datos centralizados. Conviene describirla como comunidad colaborativa entre pares con infraestructura en la nube. |
| Reducir frustración/deserción | Es un objetivo del proyecto. Estas pruebas verifican software; no demuestran ese impacto ni eficacia clínica. |
| Apoyos inclusivos | Es parte del alcance acordado y de la aplicación actual. Conviene incorporarlo explícitamente a requerimientos, objetivos, criterios de aceptación y pruebas del informe APT. |

## Activación necesaria

Para la nueva defensa de reservas, abrir **supabase/ACTIVAR_RESERVAS_ACREDITADAS.sql** y ejecutar todo en SQL Editor del proyecto InterAula. Resultado esperado: «Reservas con materia acreditada activadas», proteccion_activada=true. El script conserva las sesiones existentes y es repetible. Docker no aplica migraciones de Supabase.

**Activación confirmada por el usuario:** informó que ejecutó el script y obtuvo «Reservas con materia acreditada activadas», proteccion_activada=true. Esta confirmación no proviene de una inspección SQL remota del agente. El ensayo de un ciclo completo entre dos cuentas reales continúa pendiente.

La corrección de notas de valoración usa las columnas existentes y no requiere una migración de notas. La comprobación remota limit(0) confirmó esas columnas.

## Orden propuesto para las siguientes iteraciones

1. Cerrar el piloto con dos cuentas: acreditar una materia, solicitar/aceptar una tutoría, entrar al aula, finalizar y valorar. Revisar estadísticas e insignias. Registrar fallos observados, sin usar la cuenta personal para datos desechables.
2. Alinear el informe APT con el alcance real: apoyos inclusivos, afinidad por intereses, piloto adaptativo y piloto K-Means de tutores ahora implementado. Actualizar las constantes antiguas y textos históricos de acreditación que siguen describiendo políticas anteriores; la política activa la determina el servidor.
3. Validar el piloto K-Means con valoraciones auténticas y comparar utilidad con orden directo por promedio y catálogo habitual. Separar datos DEMO de cualquier evidencia de calidad con usuarios reales. No agrupar por diagnósticos ni inferirlos.
4. Completar el piloto de inclusión: estudiantes que voluntariamente prueben instrucciones, ayudas, pausas, lectura y orientación; recoger observaciones sin exigir diagnósticos. Revisar especialmente la diferencia entre práctica sin tiempo y acreditación con tiempo ampliable.
5. Preparar la demostración y operación: recuperación de cuentas real, aula en dos dispositivos, costes/cuotas de IA, moderación, respaldo/restauración y evidencia de cada requisito. No presentar cuotas de IA ilimitadas ni validación institucional inexistente.

## Evidencia y reproducción

Carpeta: **docs/pulido-integral-2026-11-15/**.

- tests-iniciales.log: estado anterior a las correcciones.
- tests-finales.log: 62 pruebas frontend y 117 backend aprobadas.
- quality-test.log: repetición focalizada del ciclo SQL con reserva válida/solapamiento y badges.
- browser-fixture.mjs y browser-verification.json: componentes y cliente HTTP reales con servicios/cuentas simulados, 35 rutas internas y 6 públicas. Incluye regresiones de orden de búsqueda, valoración, permisos de finalización y recuperación de perfil.
- capturas valoracion-*.png: formulario en escritorio, móvil, oscuro y Calma.
- schema-probe.mjs y supabase-schema.json: comprobación remota de estructura con SELECT limit(0), sin registros ni escrituras.
- docker-build.log: compilación de los dos servicios.

Para repetir pruebas aisladas desde la raíz de la app: npm run test:all y npm run build:all. El navegador requiere Vite local en 127.0.0.1:5175 y Chrome con perfil separado/depuración en 9235. schema-probe.mjs necesita la configuración privada local y acceso de red; consulta solo estructura y no debe imprimirse backend/.env.
