# Centro de incidencias y bandeja interna

Implementado el 16 de noviembre de 2026. Esta etapa añade reportes y seguimiento privado, revisión autorizada, una apelación independiente y avisos internos. No envía correo ni notificaciones push.

## Abrir y usar

- Acceso visible **Bandeja** en el encabezado; en pantallas estrechas se muestra un icono con etiqueta accesible «Avisos y ayuda». También se encuentra con Ctrl + K.
- **Informar un problema** está disponible en sesiones, perfiles ajenos, apuntes leídos, publicaciones de foro, proyectos públicos ajenos y talleres ajenos.
- En /support se separan **Avisos**, **Mis incidencias** y, para personas autorizadas por base de datos, **Revisión autorizada**.
- El formulario recoge motivo y descripción; mantiene el texto si falla el envío. No solicita diagnósticos ni contacto privado.
- Los antecedentes adicionales se envían al equipo, no directamente a la otra persona. El seguimiento muestra estados, mensajes autorizados y decisiones.
- Los reportes sin responsable asignado quedan pendientes. Recibir un reporte no suspende cuentas, elimina contenido, revoca acreditaciones ni modifica notas.

## Activación remota

Ejecutar el contenido completo de **supabase/ACTIVAR_INCIDENCIAS_Y_AVISOS.sql** en SQL Editor del proyecto InterAula. Resultado esperado: «Incidencias y avisos activados», incidencias_activadas=true y avisos_activados=true.

El activador es transaccional, repetible, no borra registros y no asigna revisores. Docker no lo ejecuta automáticamente. El usuario confirmó ambas columnas true. La comprobación posterior SELECT limit(0) verificó disponibles las cuatro tablas, sin leer expedientes, avisos ni filas de roles. Los tres contenedores están saludables. La designación de responsables reales continúa pendiente.

Sin activación, el centro muestra que aún no está habilitado. No guarda reportes en un almacén local alternativo ni simula envíos.

## Quién puede revisar

El permiso proviene exclusivamente de **community_reviewers**, no de ser tutor, validador académico ni de user_metadata del navegador. Esta migración no concede el permiso a ninguna persona.

Cuando el equipo designe responsables reales, un operador autorizado del proyecto puede registrar sus UUID de perfil mediante SQL administrativo:

    INSERT INTO public.community_reviewers(profile_id,active)
    VALUES ('REEMPLAZAR_POR_UUID_DEL_PERFIL',true)
    ON CONFLICT(profile_id) DO UPDATE SET active=true;

Es un ejemplo que requiere sustituir el marcador; no forma parte del activador ni fue ejecutado. Una persona no puede revisar un caso en el que sea quien reporta o la persona involucrada. Una apelación requiere un revisor distinto del que comunicó la resolución anterior.

Todavía no existe pantalla para administrar el equipo o reasignación automática por ausencia. Al retirar permisos se deben revisar los expedientes asignados. Esta etapa no establece plazos garantizados de atención.

## Flujo y privacidad

Estados: recibida → en revisión → esperando antecedentes → resuelta/cerrada. Una de las partes puede solicitar una única apelación, que vuelve a estar pendiente hasta que otro revisor la asume.

- El creador ve su reporte original. El equipo autorizado no involucrado puede revisarlo.
- La otra persona no puede abrir el expediente hasta que haya un resumen revisado o una resolución compartida.
- El texto original, las respuestas de cada parte y las notas internas no se muestran a la otra persona.
- El revisor decide qué resumen o explicación compartir. La interfaz advierte que debe evitar divulgar identidades innecesariamente: el texto libre no se anonimiza automáticamente.
- Las respuestas de las partes son privadas con el equipo. Las notas internas solo aparecen para el equipo; quien reporta tampoco las ve.
- Los DTO muestran roles como «Quien reporta», «Persona involucrada» o «Equipo de revisión», sin identidades o IDs de autores de mensajes.
- Las acciones conservan actor real, fecha y texto en la base privada. Cada cambio aumenta revision; una decisión desde una versión antigua se rechaza para que el revisor actualice.
- No se abre automáticamente al revisor el contenido privado del aula, las preferencias de aprendizaje o los datos de contacto.

La sesión reportada exige participación; apuntes requieren estar publicados como public/shared; proyectos requieren visibilidad pública. No se admite reportar el propio perfil/contenido. Los recursos privados ajenos no pueden usarse para crear un expediente.

Solo puede existir un reporte activo por persona y recurso. Un reintento devuelve el existente. SQL limita a 10 reportes por persona en 24 horas y a 20 eventos de mensajes/notas por caso y actor en una hora. La API añade límites de tasa y valida IDs, acciones y campos permitidos. No se pueden asignar rol, resolución o identidad desde el formulario.

## Avisos internos

Se generan dentro de las mismas transacciones de la base:

- Nueva solicitud de tutoría.
- Aceptación, rechazo o cancelación.
- Confirmación de realización pendiente del otro participante.
- Sesión validada y valoración pendiente.
- Valoración recibida.
- Recepción del reporte y actualizaciones del caso según su audiencia.
- Avisos a revisores activos no involucrados cuando hay un caso o nuevos antecedentes.

Al abrir la bandeja se generan recordatorios de tutorías aceptadas/en curso previstas en las próximas 24 horas. No hay cron o entrega con la aplicación cerrada. Cada evento tiene clave única por destinatario para impedir duplicados. Marcar leído es idempotente y solo afecta al destinatario autenticado.

La bandeja y el contador del encabezado son silenciosos, estáticos y sin destellos. Los avisos contienen textos generales y enlaces internos, sin la descripción de una denuncia, sus respuestas, notas privadas o datos de aprendizaje. La actualización del contador descarta respuestas antiguas.

Los avisos de eventos empiezan con la activación; no se reconstruye todo el historial anterior. Los recordatorios se comprueban al consultar. Se muestran las 100 notificaciones más recientes y el total sin leer; «Marcar todos» incluye también las anteriores. Las listas de expedientes tienen límite de 100, sin paginación todavía.

Los correos de tutorías/proyectos siguen pendientes de habilitar: Ajustes lo indica y conserva las preferencias. Tampoco se implementaron aún avisos de postulaciones del Hub ni de cambios de talleres. No se contactó a personas ni se envió correo durante esta implementación.

## Implementación

- Migración 027 y activador único.
- Tablas privadas con RLS y sin privilegios de lectura/escritura directa para usuarios; acceso mediante RPC que verifica identidad, relación con el expediente y rol.
- Rutas autenticadas /api/support/inbox, /inbox/read, /cases y /cases/:id/actions.
- Operaciones normales usan JWT del usuario, no clave administrativa.
- Las funciones que crean avisos no son ejecutables directamente por usuarios.
- La ampliación [Medidas de convivencia](MEDIDAS_DE_CONVIVENCIA.md) añade advertencias, restricciones y revisión independiente de medidas. Requiere activar por separado la migración 028.

## Validación

**216 pruebas automáticas:** 62 frontend, 139 backend y 15 Python aprobadas. Compilación y lint completados; permanecen advertencias del repositorio.

PostgreSQL temporal comprobó privacidad entre roles, denegación a terceros/anónimos, rechazo de autoasignación de revisor, reporte idempotente, control de versión, notas privadas, resolución, apelación con otro revisor y límite de una apelación, bandeja por destinatario y recordatorios sin duplicados. La migración y el activador se reaplicaron conservando datos.

La integración real Express → PostgreSQL/RLS en memoria repitió el recorrido con identidades sintéticas. La prueba del navegador ejecutó AppRouter, AuthContext, componentes y cliente HTTP reales, incluyendo siete comprobaciones de reporte, separación de datos, revisión, apelación, lectura de avisos, error/reintento y conservación de borradores.

Se revisaron 320, 390, 768 y 1440 px, incluido que los controles del encabezado queden dentro del área visible, además de claro, oscuro y Calma. Se compactaron accesos del encabezado y se corrigió el ancho mínimo de la página para no ocultar controles detrás de la barra de desplazamiento.

Evidencia en docs/support-2026-11-16/: integration-verification.json, browser-verification.json, schema-verification.json y capturas support-*.png. Los nombramientos de revisores de esas pruebas existen solo en PostgreSQL en memoria; no en Supabase real. Ninguna prueba funcional escribió en la base real ni llamó a Gemini o a un proveedor de correo.

## Próximo ensayo

Una vez activado el SQL y designados responsables, recorrer con cuentas de prueba: solicitar tutoría → aceptar → confirmar realización → valorar → revisar reputación; después reportar un desacuerdo → revisar → responder → resolver → apelar con otro revisor → comprobar avisos y lectura. La prueba con usuarios/dispositivos reales sigue pendiente.

Adjuntos privados, entrega de correo/push, plazos y prioridades de atención, reasignación del equipo, paginación e implementación de medidas tras una resolución quedan para futuras iteraciones.

