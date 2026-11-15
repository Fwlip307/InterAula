# Acreditación inclusiva con respaldo verificable

La sección **Materias habilitadas para impartir** es ahora un listado de solo lectura. Incluye únicamente registros con `is_verified=true`, aprobados por evaluación o revisión académica. Se retiraron el alta manual, la eliminación desde esa sección y el sello genérico que aparecía incluso sin acreditación. El catálogo público de tutores también exige materias verificadas. Los registros pendientes se conservan para los flujos de acreditación, pero no se presentan como habilitaciones.

## Solicitud de formación inclusiva

El solicitante aporta curso, entidad emisora, fecha de finalización, folio, enlace HTTPS de verificación, un certificado PDF privado de hasta 5 MB y la resolución de un caso práctico sobre apoyo académico universitario. El servidor comprueba que el archivo exista bajo su cuenta, que el tamaño coincida y que empiece por la cabecera PDF. Esto valida el formato; la autenticidad se verifica humanamente con el emisor.

El estado inicial siempre es **pendiente**. El usuario indicó que aún no dispone de revisor: no se crearon cuentas, no se asignaron permisos ni se aprobaron solicitudes reales. Se puede recibir evidencia y mantenerla pendiente hasta designar un responsable.

La revisión requiere un usuario presente en `academic_validators`, distinto del solicitante. No depende de una casilla editable del perfil. Antes de aprobar debe confirmar titularidad del certificado, autenticidad con el emisor, pertinencia de la formación y suficiencia del caso práctico, además de escribir una justificación de al menos 30 caracteres. Puede solicitar correcciones o revocar una aprobación justificadamente.

Este sello reconoce formación para acompañamiento académico dentro de InterAula. No es una certificación profesional oficial ni habilita atención clínica. La plataforma registra la revisión; no acredita por sí misma que un curso sea oficial ni sustituye el trabajo del revisor.

## Privacidad y trazabilidad

- Bucket privado `inclusive-evidence`, solo PDF y máximo 5 MB. No se permiten sustituciones de archivos mediante el flujo de subida.
- Lectura del documento solo por su propietario o revisores autorizados; enlaces temporales de 120 segundos. La interfaz renueva los enlaces y no publica el PDF en el perfil.
- Los documentos adjuntos y los referidos en el historial no se pueden borrar con los permisos del solicitante mientras estén referenciados.
- La tabla de solicitudes completa solo es legible por el titular y validadores. El catálogo público consulta una vista mínima que excluye documento, folio, caso práctico, enlace de verificación e historial.
- La base impide autoaprobaciones, modificaciones de evidencia por el revisor y aprobaciones sin la rúbrica. El historial de decisiones se agrega desde un trigger y no se puede vaciar desde el cliente.
- La revisión envía la fecha de actualización que vio el revisor. Si cambió la solicitud mientras la revisaba, el servidor exige cargar y revisar nuevamente la evidencia.
- No se leen ni se consultan automáticamente enlaces externos del emisor desde el servidor. El revisor debe comprobarlos. No se enviaron correos ni mensajes a entidades.

Las acreditaciones anteriores se conservan. Las que no tienen el respaldo documental nuevo deben actualizarlo y someterse a revisión antes de aparecer con el nuevo sello público.

## Activación y revisión operativa

La migración `023_verified_inclusive_evidence.sql` está disponible como `supabase/ACTIVAR_ACREDITACION_INCLUSIVA.sql`. El usuario la ejecutó y confirmó **Acreditacion inclusiva verificable activada**, `evidencia_activada=true`. La comprobación real verificó las columnas, la vista pública y la configuración privada del bucket sin leer documentos ni filas de solicitudes.

El paquete `ACTIVAR_COMUNIDAD.sql` también incorpora la migración 023 al final para que repetir esa activación no restaure las reglas antiguas. No es necesario volver a ejecutarlo si la activación inclusiva ya terminó correctamente.

Cuando exista una persona responsable, su cuenta deberá designarse como validador mediante administración de base de datos, tras verificar su identidad y competencia. No debe autoasignarse ese rol ni concederse acceso a cuentas de demostración. El panel de revisión aparecerá al iniciar sesión con una cuenta autorizada; se actualizará usando **Actualizar estado**.

## Verificación

- Backend: 103 pruebas, incluida validación HTTP de PDF y titularidad, prohibición de autoaprobación y control de revisión desactualizada.
- PostgreSQL aislado: evidencia obligatoria, privacidad, no autoaprobación, rúbrica, historial no borrable, revocación y repetición de la activación sin borrar solicitudes.
- Frontend: 50 pruebas existentes y siete comprobaciones de navegador sobre componentes reales con servicios sintéticos: listado acreditado, ausencia de controles manuales, envío pendiente, reintento sin duplicar subida, revisión justificada, separación de cuentas y adaptación a 1440/390/320 px.
- Las pruebas no subieron documentos reales ni aprobaron acreditaciones de usuarios. Evidencia en `docs/inclusive-2026-11-14/`.
