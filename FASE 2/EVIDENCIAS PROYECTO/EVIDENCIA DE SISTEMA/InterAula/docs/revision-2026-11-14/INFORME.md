# Revisión de los cambios nuevos de InterAula

Fecha de revisión: 14 de noviembre de 2026, contexto del usuario en America/Santiago.

Comparación: `bf60ec7` → `5229816`, cuatro commits (`1f1cb5d`, `b2bfd8f`, `32a5a75`, `5229816`), 75 archivos modificados y 5.434 líneas añadidas. La revisión incluye código, compilación, pruebas existentes, reproducciones HTTP, PostgreSQL aislado y una comprobación del dictado en navegador. No se modificaron fuentes de la aplicación, cuentas de usuarios, datos remotos ni contenedores.

## Resultado

Hay una ampliación considerable de las herramientas de aprendizaje y accesibilidad. Sin embargo, varias funciones nuevas todavía no completan su flujo de extremo a extremo. Las pruebas existentes pasan, pero no detectan las incompatibilidades entre los formularios nuevos, la API y las políticas de la migración 019.

Antes de agregar más funciones conviene corregir los problemas P1, completar los flujos P2 y probarlos con dos cuentas diferentes. Esta entrega no implementa clustering: las recomendaciones conservan el motor de afinidad anterior; su cambio principal es la separación de controladores y rutas.

## Funciones añadidas

- Preferencias de filtro cálido, fuente Lexend, regla de lectura, reducción de destellos y lenguaje literal.
- Lectura en voz alta y dictado en distintos módulos; ayuda contextual y pausa de acompañamiento en el bot.
- Mi espacio: un paso a la vez, división de tareas con IA, avisos del temporizador, días activos, meta semanal, reporte PDF y ficha de apoyos.
- Bandeja de ideas rápidas y conversión de ideas en tareas.
- Preparación de tutorías y talleres: guion, cámara, participación y materiales anticipados; previsualización del aula, pausa sensorial y semáforo de comunicación.
- Solicitudes de acreditación inclusiva y filtro de tutores con esa acreditación.
- Micro-entregables con responsable, fecha, estado y comentarios en Proyectos.
- Migración 019, scripts para Windows/Linux, detección de Docker/WSL y puertos configurables.

## Hallazgos P1: corregir primero

### 1. Un validador puede aprobar su propia acreditación inclusiva

**Referencia:** `supabase/migrations/019_inclusive_learning_features.sql:160` y `backend/src/controllers/verification.controller.ts:212`.

La política de actualización comprueba que la cuenta pertenezca a `academic_validators`, pero no exige que sea distinta de `tutor_id`. El controlador tampoco impone esa separación. En PostgreSQL aislado, un docente insertó su propia solicitud y la actualizó a `approved`, con él mismo como verificador.

**Impacto:** el sello de formación inclusiva puede concederse sin una revisión independiente. Agregar la restricción en la base y el servidor, incluyendo una prueba que rechace autoaprobación.

### 2. Confirmar el dictado deja activo el reconocimiento aunque la interfaz diga que terminó

**Referencia:** `frontend/src/components/common/VoiceDictationButton.tsx:116`.

`handleConfirmInsert` inserta el texto y cambia `isListening` a falso, pero no detiene `recognitionRef.current`. El botón de confirmación está disponible durante la escucha.

**Reproducción en Chrome:** componente real, API de reconocimiento simulada. Después de iniciar, emitir texto y confirmar: `active=true`, `stopCalls=0`, `visibleListening=false`. No se usó el micrófono real.

**Impacto:** el navegador puede continuar escuchando después de que la interfaz oculta ese estado. Detener el reconocimiento antes de confirmar y comprobar la transición visual y la liberación del recurso. [Evidencia](dictado-navegador.json).

### 3. Crear talleres y guardar su preparación produce HTTP 400

**Referencias:** `frontend/src/pages/tutoring/components/CreateWorkshopModal.tsx:42`, `frontend/src/pages/tutoring/VirtualClassroom.tsx:287`, `frontend/src/types/tutoring.ts:13`, `backend/src/schemas/tutoring.schema.ts:73`.

El frontend utiliza `mixed`, `chat_first` y `voice_or_chat`; el backend acepta `chat_only`, `chat_or_voice` y `voice_preferred`. Ninguna opción del selector coincide. También difieren `camera_policy` (`off` frente a `required`), las reglas vacías (`null` frente a texto) y los materiales (arreglo de enlaces frente a objetos estructurados).

**Reproducción:** la creación de taller con los valores inclusivos predeterminados devuelve 400; guardar la preparación también devuelve 400. Estas incompatibilidades se comprobaron separadamente de otros campos del formulario.

**Impacto:** el flujo se bloquea antes de guardar. Definir un contrato compartido, normalizar los datos y probar lo que envía el formulario completo. [API local](api-local.json), [contratos](contratos-y-sql.json).

### 4. Los micro-entregables no se pueden crear desde su formulario

**Referencias:** `frontend/src/pages/projects/ProjectsHub.tsx:1950`, `backend/src/schemas/project.schema.ts:133`, `frontend/src/services/project.service.ts:222`.

El formulario siempre envía `assignee_name`, incluso cuando está vacío. El esquema estricto del backend no acepta esa propiedad y espera `assignee_id`. La fecha del input es `YYYY-MM-DD`, mientras la API exige fecha y hora. Los estados también divergen: la interfaz utiliza `submitted`/`reviewed`; servidor y base utilizan `review`/`completed`.

**Reproducción:** crear un entregable sin responsable ni fecha devuelve 400. Validar una fecha de calendario o el estado `submitted` también falla.

**Impacto:** creación y cierre del flujo bloqueados. Elegir responsables reales del equipo, acordar el formato de fecha y unificar estados. [Evidencia](api-local.json).

### 5. El semáforo no reconoce las salas reales de las sesiones individuales

**Referencias:** `supabase/migrations/019_inclusive_learning_features.sql:76`, `frontend/src/pages/tutoring/VirtualClassroom.tsx:208`, `supabase/migrations/007_virtual_classroom_and_attendance.sql:29`.

El aula solicita las señales con `session.room_id`, generado como `ia-aula-...`. La función de pertenencia compara el identificador recibido solamente con el UUID de sesión o con `session-UUID`; no lo compara con `ts.room_id`.

**Reproducción:** para el estudiante de una sesión real creada en la base aislada, `can_access_classroom_room(session.id)=true`, pero `can_access_classroom_room(session.room_id)=false`.

**Impacto:** RLS rechaza el guardado del semáforo de participantes legítimos. Además, el frontend silencia el error. Corregir el identificador canónico y mostrar el fallo cuando no pueda guardarse. [Evidencia](contratos-y-sql.json).

### 6. La división de tareas con IA apunta a un modelo retirado

**Referencia:** `backend/src/services/ai.service.ts:1076`.

El nuevo método `breakdownTask` llama directamente a `gemini-1.5-flash`. Google documenta que esa familia ya fue apagada en las [notas oficiales del 29 de septiembre de 2025](https://ai.google.dev/gemini-api/docs/changelog). La función transforma las respuestas fallidas en un 503; agregar una clave válida no corrige el modelo inexistente.

**Impacto:** no funciona la división automática con ese endpoint. Usar un modelo vigente configurable y un adaptador central para evitar endpoints obsoletos repartidos entre funciones. No se invocó la API de pago ni se enviaron claves durante esta revisión.

### 7. El arranque automático de Docker Desktop falla si el motor está apagado

**Referencia:** `docker-start.bat:66`.

La expresión que construye `$paths` usa dos llamadas a `Join-Path` separadas por una coma sin agrupar cada llamada. PowerShell interpreta los argumentos de forma incorrecta.

**Reproducción:** al ejecutar únicamente esa expresión, sin lanzar servicios, se obtiene `System.Object[]` no convertible a `System.String` para `ChildPath`.

**Impacto:** el script sale antes de iniciar Docker cuando el motor no responde. Agrupar cada llamada a `Join-Path` y probar arranque con Docker apagado y encendido.

## Hallazgos P2: completar la integración

### 8. Los datos anticipados del taller no regresan por la API

**Referencias:** `supabase/migrations/019_inclusive_learning_features.sql:43`, `backend/src/services/workshop.service.ts:20`.

La migración agrega columnas a `tutoring_workshops`, pero no recrea `workshop_summary`. La vista anterior fue definida con `w.*`; PostgreSQL fija su lista de columnas al crearla. El servicio usa esa vista tanto para detalle como para listados y devuelve el detalle después de guardar.

**Reproducción:** con las migraciones 001–019, la tabla guarda el guion, pero el resultado de `workshop_summary` no contiene `agenda_preview`, `participation_mode` ni `anticipated_materials`.

**Corrección:** recrear la vista en una nueva migración y verificar la respuesta de detalle y listas. Es un problema independiente del HTTP 400 del formulario.

### 9. Reenviar una solicitud de acreditación existente está bloqueado

**Referencia:** `backend/src/controllers/verification.controller.ts:172`.

El endpoint utiliza `upsert` con conflicto en `tutor_id`; la base permite insertar solicitudes propias pendientes, pero solamente los validadores pueden actualizar. Al reenviar una solicitud existente como tutor, la rama de actualización falla con `42501`.

**Corrección:** definir cuándo se permite reenviar y qué campos puede editar el solicitante. Mantener la aprobación y los datos del verificador fuera de ese permiso.

### 10. La ficha de apoyos permite seleccionar destinatarios, pero no está implementada su lectura compartida

**Referencia:** `frontend/src/pages/learning/LearningSpace.tsx:3554`.

Los IDs autorizados y los apoyos se guardan en `learning_space_config`. No se agregó un endpoint, vista o política para recuperar exclusivamente los apoyos compartidos por otra cuenta, ni una interfaz receptora en tutorías/proyectos. En la reproducción, el tutor autorizado no puede leer la ficha del estudiante: la consulta devuelve cero filas, de acuerdo con las políticas privadas existentes.

La privacidad se conserva; lo incompleto es la promesa de compartir. También se pide introducir manualmente un UUID del tutor, algo poco adecuado para un flujo de usuarios finales.

**Corrección:** implementar lectura limitada a campos autorizados, revocación y presentación para destinatarios; seleccionar tutores de una lista comprensible. No ampliar el acceso a todo `profiles`.

### 11. La bandeja mezcla contextos y la conversión puede duplicar tareas

**Referencias:** `backend/src/controllers/learningSpace.controller.ts:282`, `backend/src/services/remote/learningSpace.service.ts:85`, `backend/src/services/remote/learningSpace.service.ts:97`.

El frontend envía filtros `context_type`, `context_id` y `resolved`, pero el controlador y servicio no los utilizan. Una solicitud de la sala B devuelve las ideas de B y A de la misma persona. La separación entre cuentas se conserva.

La conversión ignora la asignatura enviada por la interfaz y utiliza `General`. No comprueba `converted_task_id` antes de crear; repetir la solicitud crea otra tarea. En Supabase se trata además de dos escrituras independientes, sin transacción que vincule creación y actualización.

**Reproducción HTTP:** filtrar por B devuelve ambas salas; convertir la misma idea dos veces devuelve 201 dos veces y dos tareas diferentes, con asignatura `General`.

**Corrección:** filtrar y validar en servidor, respetar el contexto y hacer la conversión atómica e idempotente. [Evidencia](api-local.json).

### 12. La revisión estática del frontend falla por imports duplicados en los tests

**Referencia:** `frontend/tests/security_and_services.test.ts:502` y `frontend/tests/security_and_services.test.ts:603`.

`DEFAULT_ACCESSIBILITY_PREFERENCES` y `LEARNING_PREFERENCES` se importan dos veces con los mismos identificadores. `npm test` transpila y pasa; `npm run lint` devuelve 1 con dos errores. La compilación productiva no incluye ese archivo de tests, por lo que también pasa.

**Corrección:** unificar los imports y exigir los tres controles: test, compilación y revisión estática.

## Verificación realizada y límites

| Comprobación | Resultado |
| --- | --- |
| Pruebas backend | 82 pasan, 0 fallan |
| Pruebas frontend | 49 pasan, 0 fallan |
| Compilación backend | Correcta |
| Compilación frontend | Correcta; advertencia de bundles grandes |
| Lint backend | Correcto, con advertencias |
| Lint frontend | Falla: dos identificadores duplicados; otras advertencias |
| Migraciones 001–019 | Se aplican en PostgreSQL aislado |
| Formularios/API | Tres reproducciones HTTP 400 con sesión simulada |
| Semáforo, vista de talleres y acreditación | Reproducidos con RLS y cuentas sintéticas |
| Dictado | Componente real en Chrome, reconocimiento simulado |
| Compose | Configuración válida |
| Docker en ejecución | Motor no disponible en este equipo durante la revisión |

Las pruebas existentes de base de datos llegan hasta la migración 018. Las pruebas inclusivas añadidas comprueban principalmente esquemas y rechazo sin token; no verifican los flujos autenticados descritos aquí. Por eso, 131 pruebas correctas no demuestran que funcionen las nuevas pantallas completas.

No se comprobó si la migración 019 está instalada en tu Supabase. `ACTIVAR_INTERESES.sql` sigue cubriendo 016–018. No ejecutar nuevamente migraciones antiguas destructivas: preparar una activación separada y revisada de las funciones nuevas.

No se validaron micrófono real, voces del sistema, Jitsi con dos participantes ni un despliegue Docker de esta versión. Se detuvieron el Chrome y el Vite temporales utilizados para la revisión. No se publicaron cambios.

## Orden sugerido para continuar

1. Corregir confirmación del dictado y autoaprobación de acreditaciones.
2. Unificar los contratos de talleres, preparación y entregables, con pruebas que envíen los payloads reales de los formularios.
3. Corregir sala canónica y actualizar `workshop_summary`; comprobar una sesión individual y un taller con tutor y estudiante.
4. Actualizar la integración de IA y reparar el arranque de Docker Desktop.
5. Completar reenvío de acreditación, ficha compartida y conversión de ideas; resolver lint.
6. Agregar al buscador global las funciones nuevas por sus nombres: ficha de apoyos, ideas rápidas, semáforo y un paso a la vez. El catálogo de navegación aún no se actualizó para esas opciones.
7. Retomar el clustering cuando estos flujos estén verificados. Mantener las recomendaciones actuales como respaldo y validar el futuro modelo con datos de interacción y consentimiento apropiados.

## Archivos de evidencia

- [Resumen de comprobaciones](resumen.json).
- [Contratos y resultados de PostgreSQL](contratos-y-sql.json).
- [Resultados HTTP locales](api-local.json).
- [Resultado del dictado en Chrome](dictado-navegador.json).
- [Reproducción de contratos y SQL](reproducir-contratos-sql.mjs).
- [Reproducción HTTP aislada](reproducir-api-local.mjs).

Para repetir las reproducciones desde la carpeta de la aplicación, con dependencias instaladas, ejecutar `npm run build` en backend y después `node docs/revision-2026-11-14/reproducir-contratos-sql.mjs .` o `node docs/revision-2026-11-14/reproducir-api-local.mjs .`. La primera usa PostgreSQL en memoria; la segunda simula la identidad y bloquea el acceso externo. Sus resultados describen el comportamiento observado, no una suite de regresión corregida.
