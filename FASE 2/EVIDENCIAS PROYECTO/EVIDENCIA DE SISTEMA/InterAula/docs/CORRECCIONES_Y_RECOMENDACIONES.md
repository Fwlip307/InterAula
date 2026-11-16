# Correcciones y recomendaciones por intereses

Actualizado el 9 de noviembre de 2026. Este documento complementa la revisión inicial del repositorio.

**Nueva fase implementada:** selección de intereses por usuario y sección «Para ti». Consulta [uso, activación y pruebas](INTERESES_Y_PARA_TI.md). Requiere la migración 018 además de las correcciones 016–017. La suite actual suma 87 pruebas aprobadas; los resultados de la sección de correcciones conservan su alcance anterior.

**Activación completada:** [ACTIVAR_INTERESES.sql](../supabase/ACTIVAR_INTERESES.sql) reúne 016–018 en una transacción. El usuario lo ejecutó en Supabase el 9 de noviembre; la API confirmó 22 temas y acceso a talleres con HTTP 200. Docker también se construyó y arrancó correctamente; ambos contenedores están `healthy`.

## Estado

El código está corregido y compila. Las migraciones 016–018 se probaron con PostgreSQL embebido y **el usuario ya las activó en Supabase mediante SQL Editor**. La API pública está comprobada. La clave de servicio para la acreditación automática sigue sin estar configurada en el backend local; la selección de intereses no necesita esa clave.

La aplicación local está disponible en http://localhost:5173 y la API en http://localhost:3001/api/health mientras sus procesos sigan ejecutándose. El endpoint de salud confirma que la API responde; no acredita que todas las migraciones estén instaladas.

## Cambios implementados

| Área | Comportamiento corregido |
| --- | --- |
| Proyectos | Acceso por visibilidad, propiedad o membresía; solicitudes, aceptación y cupos mediante transacciones. También se protege el respaldo usado por las pruebas. |
| Perfiles | Lectura privada limitada al titular y uso de la vista pública en descubrimiento de personas. Requiere instalar las políticas nuevas. |
| Apuntes | Sanitización del HTML en servidor y cliente; texto plano escapado; archivos privados y enlaces firmados de cinco minutos; cargas fallidas no se sustituyen por URLs temporales del navegador. |
| Persistencia | Los módulos corregidos usan PostgreSQL en ejecución normal. El JSON local queda limitado a pruebas aisladas. Los errores no se convierten en guardados ficticios. |
| Materias a reforzar | Contrato `current_level` alineado; eliminación por usuario y UUID de asignatura. Se eliminó el catálogo de respaldo con IDs inventados. |
| Aprendizaje | Eliminado el respaldo compartido entre cuentas; operaciones transaccionales de rutas, etapas y progreso; control de versiones al actualizar tareas. |
| Acreditación | Intentos privados creados por el servidor, respuestas correctas fuera del navegador, cálculo de nota y control de respuestas concurrentes. La confirmación recibe solo el ID del intento y es transaccional e idempotente. |
| IA | Autenticación, límites de solicitudes y validación de tamaños. Sin un evaluador disponible, las respuestas abiertas quedan sin evaluar; no se aprueban por longitud. |
| Revisión docente | Solicitud persistida y asignada a un docente con rol validador registrado. Se muestra en su panel. No se anuncia ni realiza envío de correo. |
| Tutorías y talleres | Reglas de transición, control de solapamientos, cupos atómicos y asistencia calculada con tiempo del servidor. Un contador enviado por el navegador no completa una tutoría. |
| Interfaz y ejecución | Errores visibles en vistas principales, evaluación sin controles de foco punitivos, navegación móvil por secciones y scripts Docker sin rutas absolutas de otro equipo. |

La evaluación automática acredita únicamente el nivel básico, requiere al menos cinco preguntas del banco de la asignatura y permite tres inicios por hora. Actualmente el banco suficiente corresponde a Programación de Algoritmos. Para las otras asignaturas se informa que hace falta revisión docente. El intento caduca a las dos horas, sin cronómetros por pregunta.

## Procedimiento de activación en Supabase

Las migraciones 016–018 ya fueron activadas por el usuario. Los pasos siguientes sirven como referencia para otros entornos; todavía corresponde configurar la acreditación automática y completar la validación con cuentas reales.

1. Instalar y conectar la integración de Supabase, y confirmar el proyecto asociado a la configuración local. No compartir claves privadas por chat.
2. Revisar el esquema y el historial remoto, conservar un respaldo y probar en una rama o entorno de pruebas si está disponible. Las migraciones antiguas 009 y 010 tienen operaciones sobre datos y cuentas concretas: no repetir todo el historial a ciegas.
3. Sobre una base compatible con las migraciones 001–015, aplicar en orden:
   - [016_privacy_and_transactional_persistence.sql](../supabase/migrations/016_privacy_and_transactional_persistence.sql)
   - [017_server_assessments_and_endorsements.sql](../supabase/migrations/017_server_assessments_and_endorsements.sql)
4. Configurar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en `backend/.env` o en los secretos del servicio backend, y reiniciarlo. No usar prefijo `VITE_`. Gemini sigue siendo opcional y no es necesario para el banco determinista.
5. Verificar con cuentas separadas de estudiante, tutor y docente: privacidad de proyectos/perfiles/archivos, materias, solicitud y aprobación docente, intento de acreditación, reservas y asistencia. Comprobar también un archivo real en Storage.

Hasta aplicar la 016, los talleres responden 503 porque falta `workshop_summary`; no se presenta una lista vacía como si la operación hubiera funcionado. Los archivos antiguos guardados como URL pública, `blob:` o `data:` necesitan volver a subirse al almacenamiento privado. Los datos de un `runtime_store.json` anterior no se importan automáticamente: si contienen información útil, requieren una importación revisada por propietario.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| Compilación frontend y backend | Correcta |
| Pruebas frontend | 39 aprobadas |
| Pruebas backend | 35 aprobadas, incluyendo regresiones y PostgreSQL embebido |
| Migraciones 001–017 en base aislada | Aplicación correcta; comprobaciones de RLS, RPC y rollback. Las 016–017 también se reaplicaron sobre datos de prueba. |
| Navegación pública con Chrome | Escritorio y móvil; sin desbordamiento horizontal ni excepciones observadas en las páginas comprobadas. |
| Componentes privados en navegador | Con respuestas sintéticas: fallo y reintento, evaluación secuencial, confirmación por ID de intento y solicitud docente persistente simulada. No usaron cuentas ni mutaciones remotas reales. |
| Sanitización en navegador | El contenido de prueba no ejecutó scripts ni conservó atributos activos; mantuvo formato permitido. |
| API local corregida | Salud 200; consulta pública de proyectos y foro 200; evaluación sin sesión 401; talleres 503 por migración pendiente. |

Las pruebas aíslan la base de datos y las claves de servicios externos. Pueden repetirse con `npm run test:all` desde la raíz de la aplicación. Para compilar: `npm run build:all`. Hay advertencias de lint existentes y avisos de paquetes grandes en la compilación; no se consideran resueltos por estas correcciones.

Evidencias: [páginas públicas](correcciones-2026-11-07/comprobacion-navegador.json), [interacciones con datos sintéticos](correcciones-2026-11-07/interacciones-corregidas.json), [inicio móvil](correcciones-2026-11-07/inicio-movil.png), [evaluación](correcciones-2026-11-07/evaluacion-con-fixtures.png) y [solicitud docente](correcciones-2026-11-07/solicitud-docente-con-fixtures.png).

Quedan fuera de esta validación Google OAuth, entrega de correo, videollamada entre cuentas reales, cargas remotas reales, pruebas de carga y ejecución completa con Docker. El 8 de noviembre Docker Desktop se inició correctamente y Compose intentó construir las imágenes, pero la descarga de Node falló con `tls: bad record MAC` desde Docker Hub y desde su caché alternativa. Una descarga directa desde Windows también se interrumpió. La API local fue restaurada y el script ahora diferencia el motor apagado de un fallo de construcción. Sigue pendiente optimizar los paquetes grandes del catálogo y PDF, y mejorar gradualmente la primera experiencia y los componentes extensos. Las cuotas en memoria necesitan almacenamiento compartido si se despliegan varias instancias de API.

## Próxima implementación: recomendaciones por intereses

La idea del usuario corresponde a un sistema de recomendación de contenidos y personas. La selección de intereses y la primera sección «Para ti» ya están implementadas en el código, con los detalles de activación en el documento enlazado arriba. El clustering todavía no está incorporado.

Plan inicial que orienta esta implementación y las fases siguientes:

1. **Intereses explícitos:** implementados con tablas y contratos nuevos para los temas que interesan, se quieren aprender y se pueden compartir. Los antiguos métodos de habilidades/intereses de proyectos siguen desacoplados y no son el almacenamiento del módulo nuevo.
2. **Señales de uso:** registrar de forma acotada acciones como guardar un apunte, seguir un tema o participar en un proyecto, diferenciando una visita de un interés declarado. No incorporar contacto privado, preferencias de accesibilidad ni diagnósticos al vector de intereses.
3. **Arranque sin historial:** recomendaciones por intereses seleccionados y asignaturas, más contenidos recientes. Comparar esta versión sencilla con cualquier modelo posterior.
4. **Clustering:** construir vectores normalizados y evaluar si K-Means resulta apropiado para el volumen y la distribución de los datos. Probar distintos números de grupos y medir separación con silhouette; esa métrica no demuestra por sí sola que las recomendaciones sean útiles. Un trabajo periódico recalcula grupos y guarda una versión del modelo.
5. **Orden de contenidos y personas:** combinar similitud, preferencias explícitas y actividad reciente. Para tutorías, añadir complementariedad: alguien que necesita SQL debe encontrar personas que enseñen SQL, aunque no pertenezcan al mismo grupo. Aplicar permisos, bloqueos y visibilidad antes de recomendar; el modelo no concede acceso a datos privados.
6. **Interfaz y evaluación:** sección «Para ti», explicación breve («Te interesa bases de datos»), opción de ajustar intereses o desactivar personalización, y acceso a «Explorar todo». Medir guardados útiles, solicitudes aceptadas y tutorías realizadas, además de cobertura y diversidad.

Ejemplo: quien elige Python y análisis de datos recibe apuntes de esos temas, proyectos relacionados y tutores que realmente los enseñan. Puede explorar otros temas y modificar sus intereses. No se limita toda la plataforma a un único grupo permanente.

Fuentes técnicas para la próxima fase: [clustering en scikit-learn](https://scikit-learn.org/stable/modules/clustering.html) y [análisis de silhouette con K-Means](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_silhouette_analysis.html).
