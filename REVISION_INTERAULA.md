**Revisión de InterAula — 7 de noviembre de 2026**

**Actualización posterior:** este documento conserva los hallazgos iniciales. Las correcciones y su validación están descritas en [CORRECCIONES_Y_RECOMENDACIONES.md](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/CORRECCIONES_Y_RECOMENDACIONES.md>). El usuario activó las migraciones 016–018 en Supabase el 9 de noviembre. Docker funciona y la API confirmó el catálogo de 22 temas y la consulta de talleres.

La propuesta de aprendizaje colaborativo e inclusivo está bien definida y la aplicación tiene una base funcional amplia. Antes de sumar módulos, conviene corregir autorizaciones, contratos entre frontend y backend y persistencia: hay funciones que muestran éxito sin completar la operación y permisos que no se aplican en todas las vías de acceso.

**Alcance y ejecución**

El código principal está en `FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula`. Revisé frontend, API, autenticación, servicios, esquemas, migraciones, pruebas y configuración de despliegue. Ejecuté ambos servicios y comprobé las pantallas públicas con Chrome en escritorio y móvil.

- Interfaz: http://localhost:5173
- Salud de la API: http://localhost:3001/api/health
- React, TypeScript y Vite en frontend; Express, TypeScript y Zod en backend; Supabase para autenticación, PostgreSQL y almacenamiento; Jitsi para videollamadas.
- Reutilicé la configuración pública de Supabase que ya existía en otra carpeta del repositorio. Creé `.env.local` en la aplicación y `backend/.env`, ignorados por Git. No copié claves privadas al frontend. No configuré Gemini ni la clave administrativa de Supabase.
- Las consultas al Supabase configurado fueron de lectura. Las reproducciones de fallos usaron datos sintéticos en una instancia aislada; las del bot usaron persistencia simulada, sin conceder acreditaciones reales.
- No modifiqué el código funcional ni ejecuté migraciones sobre la base de datos.

No había una sesión de usuario disponible. La revisión visual cubre inicio, acceso, registro y protección de rutas. Los flujos privados se revisaron mediante código, pruebas existentes y reproducciones locales; no se verificaron de extremo a extremo con cuentas reales. Tampoco se verificaron Google OAuth, entrega de correos, videollamadas entre participantes, cargas reales de archivos ni Docker.

**Resultados comprobados**

| Comprobación | Resultado |
| --- | --- |
| Compilación del frontend | Correcta; advertencia por paquetes grandes |
| Compilación del backend | Correcta |
| Pruebas del frontend | 39 aprobadas, 0 fallidas |
| Pruebas del backend | 23 aprobadas, 0 fallidas, con Supabase desconectado y persistencia local aislada |
| Lint del frontend | Finaliza correctamente, con advertencias de hooks, efectos y otras reglas |
| Lint del backend | Finaliza correctamente |
| Inicio a 1440 px y 390 px, acceso móvil y registro | Sin excepciones de JavaScript ni desbordes horizontales observados |
| Rutas privadas sin sesión | Redirigen a `/login` |
| Modo oscuro y Modo Calma | Cambian la apariencia; Calma activa reducción de movimiento y persiste al recargar |
| Registro con contraseña débil | La rechaza antes de enviar una solicitud de registro |
| API con Supabase configurado | Salud, proyectos, foro, catálogo, tutores y talleres responden 200; perfil privado sin token responde 401; ruta inexistente responde 404 |

Durante la comprobación, proyectos y foro devolvieron un registro cada uno; catálogo, tutores y talleres devolvieron listas vacías. Estas respuestas no prueban que el esquema remoto esté completo ni que los permisos autenticados sean correctos.

Que las 62 pruebas pasen no implica que todos los flujos sean correctos: varias comprueban utilidades, esquemas o caminos de respaldo, y no cubren los fallos siguientes.

**Hallazgos que priorizaría**

1. **Alta — El respaldo local expone proyectos privados por su identificador.**

   `backend/src/services/project.service.ts:88` devuelve el proyecto del archivo local sin comprobar visibilidad, propietario o membresía. El controlador no transmite la identidad del solicitante. Vacantes y miembros tienen caminos locales similares.

   Reproducción confirmada: una consulta sin token a `/api/projects/:id`, contra una instancia aislada con un proyecto sintético privado y en borrador, devolvió HTTP 200 y su contenido. Corregir la autorización en el servicio y aplicarla también a miembros y vacantes.

2. **Alta — El bot confía en una nota y un nivel declarados por el navegador.**

   `backend/src/services/verification.service.ts:84` solo comprueba que `body.score` alcance 70. No verifica un intento de evaluación guardado en el servidor ni recalcula la nota a partir de respuestas.

   Reproducción con persistencia simulada: `score: 100`, `correct_answers: 0`, `total_questions: 10` y `level: advanced` obtiene éxito e intenta escribir `is_verified: true`. La acreditación efectiva depende de permisos y triggers de la base real, que no se alteraron durante esta revisión.

   El servidor debe crear el intento, conservar las respuestas correctas, evaluar la entrega y derivar nota y nivel. Las respuestas correctas de un examen de acreditación tampoco deberían entregarse al navegador antes de finalizarlo.

3. **Alta — La acreditación puede informar éxito aunque fallen todas las escrituras.**

   El mismo servicio ignora errores en varias consultas y mutaciones. Con todas las operaciones de base de datos simuladas como fallidas devuelve `success: true`, “Acreditación concedida exitosamente” y `request: null`.

   Validar cada resultado y ejecutar las operaciones relacionadas dentro de una transacción o función de base de datos. Si falta la configuración administrativa, comunicar que la acreditación no se completó.

4. **Alta — Los apuntes renderizan HTML aportado por usuarios sin sanitización visible.**

   `backend/src/schemas/notes.schema.ts` admite `content_html` como texto; `backend/src/services/notes.service.ts:260` lo conserva y `frontend/src/pages/resources/Resources.tsx:716` lo inserta con `dangerouslySetInnerHTML`. El editor también utiliza `innerHTML` y renderizado de HTML.

   Hay una vía de riesgo de XSS persistente. El fallback de Markdown también interpola texto en HTML sin escape. Este hallazgo es de revisión del código; no se publicaron contenidos maliciosos. Sanitizar con una lista explícita de etiquetas, atributos y protocolos permitidos, y escapar el texto plano.

5. **Alta — La vista de perfiles públicos no protege la lectura directa de la tabla privada.**

   `supabase/migrations/001_profiles_and_projects.sql:626` permite a cualquier usuario autenticado seleccionar filas de `profiles` con `USING (true)`. No encontré una migración posterior que sustituya esa política por una restricción de lectura privada. El frontend de tutorías consulta `profiles` con `*`.

   Si se mantienen los permisos de lectura de tabla previstos, esto permite obtener campos que la vista `public_profiles` oculta, como contacto y preferencias. Restringir la tabla privada al titular y usar una proyección pública para descubrir personas. Es una conclusión sobre las migraciones del repositorio; falta contrastarla con las políticas y concesiones instaladas en la base remota.

6. **Alta — Registrar y eliminar materias a reforzar tiene contratos incompatibles.**

   `frontend/src/services/profile.service.ts:268` envía `current_level`; `backend/src/schemas/profile.schema.ts:76` exige `level` y rechaza campos desconocidos. Confirmé que el esquema rechaza exactamente el formato del frontend.

   Además, el backend intenta insertar `level`, mientras la tabla definida en la migración 001 tiene `current_level`. Para eliminar, el frontend transmite `subject_id`, pero el servicio filtra por `id`; la definición de esa tabla utiliza la clave compuesta `profile_id, subject_id` y no define `id`.

   Alinear formulario, API y tabla alrededor del mismo contrato y comprobar el ciclo completo de agregar, listar y eliminar.

7. **Alta — La evaluación de respaldo aprueba texto sin relación con la pregunta.**

   `backend/src/services/ai.service.ts:829` asigna nota según cantidad de palabras y longitud. La variable `hasTechnicalKeywords` no busca términos técnicos: comprueba si hay más de 20 caracteres.

   Reproducción confirmada: a una pregunta sobre claves primarias, “Las nubes verdes bailan lentamente mientras ocho elefantes cantan canciones azules” obtuvo 8/10, aprobación y feedback de consistencia conceptual.

   El respaldo debe comprobar contenido con criterios específicos o indicar que no pudo evaluar. No debería producir una aprobación académica por longitud.

8. **Alta — La API de IA permite operaciones sin autenticación ni límites de consumo visibles.**

   `backend/src/routes/ai.routes.ts` publica generación de preguntas, quizzes y evaluación sin `requireAuth`. Confirmé HTTP 200 al evaluar sin token. No encontré middleware de cuotas o limitación de solicitudes.

   Si se habilita un proveedor externo, estas rutas pueden generar consumo ajeno a usuarios autorizados. Definir cuáles deben ser públicas y aplicar autenticación, cuotas y límites de longitud apropiados al resto. El README actualmente describe la evaluación como autenticada.

9. **Alta — El respaldo del espacio de aprendizaje no está separado por cuenta.**

   `frontend/src/services/learningSpace.service.ts:14` usa siempre `interaula_learning_space_v1`. Ante cualquier error de la API devuelve ese contenido, sin comprobar su titular. El cierre de sesión no elimina ese respaldo.

   En un navegador compartido, una segunda cuenta podría recibir el resumen de la primera si falla la API. Usar claves por usuario, limpiar el estado al cambiar de sesión y distinguir un fallo de autorización de un fallo de conectividad.

10. **Alta — La privacidad del registro de un apunte no se refleja en su archivo subido.**

    La migración 013 crea `academic-notes` como bucket público y permite lectura general. `frontend/src/services/notes.service.ts:242` obtiene una URL pública aunque el apunte pueda marcarse privado.

    La privacidad de la ficha no revoca el acceso al archivo de quien conserve su URL. Este hallazgo corresponde a la configuración del repositorio, sin descargar archivos privados reales. Vincular el acceso al archivo con los permisos del apunte y usar URLs temporales cuando corresponda.

**Funciones incompletas y consistencia de datos**

- **Respaldo docente simulado:** `TeacherEndorsementModal.tsx:98` usa `setTimeout` para mostrar éxito. No registra una solicitud ni envía un correo; `ProfileView` anuncia “Solicitud enviada”. Implementar un estado persistido y un enlace de aprobación con expiración antes de presentar el envío como completado.
- **Archivos que pueden perderse:** si falla Storage, `notes.service.ts:260` usa una URL `blob:` para archivos mayores de 3 MB. Esa dirección pertenece a la sesión del navegador y no constituye almacenamiento persistente para recargas u otros usuarios. Si la carga falla, conservar explícitamente un borrador local o pedir reintento.
- **Persistencia dividida:** foro, apuntes, proyectos y aprendizaje mezclan PostgreSQL con `runtime_store.json`. Algunos datos locales tienen prioridad sobre los remotos; algunos errores de autenticación o red se clasifican como esquema faltante. No hay una reconciliación general visible. Esto complica despliegues con varias instancias y puede ocultar fallos de guardado.
- **Escritura del archivo:** `persistentStore.ts:315` reescribe el JSON completo de forma síncrona y mantiene datos en memoria cuando falla el disco. Conviene definir una única fuente de verdad para producción y presentar por separado los estados guardado, local y pendiente de sincronizar.
- **Tutorías:** el servicio permite cambios de estado sin una matriz completa de transiciones; no encontré una protección de solapamientos en el servicio ni en las migraciones revisadas. La asistencia acepta `elapsed_minutes` del cliente para completar una sesión. El cupo de talleres se comprueba contando y luego insertando, sin una operación atómica visible que reserve el último lugar.
- **Catálogo:** la API consulta asignaturas con el cliente anónimo aunque la política del repositorio permite lectura a autenticados. Ante un fallo de red, devuelve cuatro materias con identificadores `subj-1` a `subj-4`, que no son los UUID de la base. Evitar presentar esos registros como catálogo operativo.
- **Habilidades e intereses:** varios métodos de `profile.service.ts:287` devuelven listas vacías u objetos vacíos; las tablas correspondientes se eliminaron en la migración 009. Aclarar el alcance actual antes de reintroducir estas opciones en proyectos y perfiles.
- **Migraciones:** la 009 elimina tablas de proyectos y datos asociados, y la 010 modifica una cuenta concreta y concede rol validador a otro perfil. Separar migraciones de esquema de datos de demostración y revisar el historial antes de aplicarlo a información existente.
- **Errores HTTP:** el manejador devuelve `err.message` también en producción. Los servicios incluyen mensajes de base de datos en esas excepciones; podrían revelar detalles internos. Distinguir mensajes públicos de diagnóstico y asignar estados HTTP de dominio, en vez de convertirlos todos en 500.

**Feedback de producto y experiencia**

Lo más valioso es reunir organización del estudio, explicaciones adaptables y apoyo entre pares. Modo Calma tiene un cambio visible y conserva la preferencia. La portada comunica bien el propósito, y acceso y registro son legibles en móvil. La separación básica de controladores, servicios y esquemas facilita corregir las reglas del servidor.

En móvil, la cabecera del inicio ocupa aproximadamente 165 px y reparte sus acciones en varias filas; además desaparecen los enlaces de secciones sin un menú alternativo. Compactaría la cabecera y acortaría el texto introductorio para acercar la acción principal al inicio de la pantalla.

La propuesta inclusiva ganaría con una primera experiencia más breve: elegir una materia, definir una meta pequeña y completar una primera actividad. La portada expone siete pasos y muchas capacidades antes de que la persona haya obtenido un primer resultado. En el portal, daría prioridad a “continuar donde quedé”, próxima tutoría y una siguiente acción concreta.

Los errores de conexión deberían mostrarse como tales. Una lista vacía o un mensaje de éxito no permite distinguir entre ausencia de datos, falta de permisos y una operación que no llegó a guardarse.

La acreditación utiliza cronómetros, bloqueo de atajos y pérdida de foco, mientras la propuesta general enfatiza avanzar sin presión. Definiría con claridad la diferencia entre práctica y acreditación, con ajustes de tiempo y alternativas accesibles. Estos controles del navegador tampoco sustituyen la verificación del resultado en el servidor.

**Mantenibilidad y rendimiento**

La carga diferida de rutas ya ayuda. Los principales puntos de crecimiento son componentes de miles de líneas, CSS compartido extenso, estilos incrustados y acceso mixto desde el frontend a REST y directamente a Supabase.

La compilación produjo aproximadamente 1,97 MB sin comprimir para el catálogo educativo, 637 kB para la vista de perfil, 404 kB para el logo y 1,26 MB para el worker de PDF. Separaría catálogo y PDF por necesidad, optimizaría el logo y cargaría los modales de acreditación cuando se abran. Son tamaños de artefactos de compilación; no una medición de todo lo transferido al entrar en cada pantalla.

Extraería gradualmente los formularios y secciones grandes de aprendizaje, proyectos y editor. Incorporaría contratos compartidos o comprobaciones entre cliente y API: el fallo de `current_level` muestra que la compilación independiente no detecta ese desacuerdo.

Los scripts `docker-start.bat` contienen una ruta absoluta del equipo de otro desarrollador. No son portables a esta ubicación. El README también sobrestima varias garantías actuales y debería ajustarse al comportamiento comprobado.

**Orden de implementación propuesto**

| Orden | Trabajo | Resultado esperado |
| --- | --- | --- |
| 1 | Corregir acceso a proyectos privados, privacidad de perfiles y archivos, sanitización de HTML y acreditación | Permisos y resultados académicos verificables |
| 2 | Reparar materias a reforzar, errores de guardado y aislamiento de la caché | Flujos básicos que guardan y recuperan los datos correctos |
| 3 | Unificar persistencia y completar transiciones, agenda y cupos | Comportamiento consistente ante concurrencia y fallos |
| 4 | Completar respaldo docente y estados de solicitud | Un flujo real de acreditación con trazabilidad |
| 5 | Simplificar móvil y primera experiencia; reducir paquetes grandes | Menos pasos para llegar al primer resultado útil |

Después de esa base, las ampliaciones con mejor encaje son notificaciones de solicitudes y respuestas, disponibilidad semanal de tutores con calendario, mensajería ligada a cada tutoría, panel de validación y moderación, y recomendaciones de próximos pasos basadas en necesidades reales del estudiante.

Para la siguiente validación de extremo a extremo harían falta cuentas de prueba separadas de estudiante, tutor y validador, y un entorno con migraciones conocidas. Eso permitiría comprobar solicitud, aceptación, aula, asistencia, evaluación y acreditación sin depender de respaldos locales.

**Evidencias guardadas**

- [Inicio en escritorio](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/inicio-escritorio.png>) y [móvil](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/inicio-movil.png>).
- [Acceso móvil](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/login-movil.png>) y [registro](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/registro-escritorio.png>).
- [Modo oscuro](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/inicio-dark.png>) y [Modo Calma](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/inicio-calm.png>).
- [Comprobación del navegador](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/comprobacion-navegador.json>), [interacciones](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/comprobacion-interacciones.json>), [API](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/comprobacion-api.json>) y [reproducciones locales](<FASE 2/EVIDENCIAS PROYECTO/EVIDENCIA DE SISTEMA/InterAula/docs/revision-2026-11-07/reproducciones-locales.json>).
