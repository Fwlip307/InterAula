# Medidas de convivencia y revisión independiente

Implementación del 16 de noviembre de 2026. La reputación describe experiencias; una sanción requiere hechos revisados por una persona autorizada. Esta actualización no asigna revisores ni sanciona cuentas al activarse.

## Política inicial

| Situación | Resultado |
| --- | --- |
| Reporte recibido o nota baja | Seguimiento; no suma strikes ni aplica restricciones |
| Primer hecho leve confirmado en 90 días | Advertencia privada por 90 días |
| Segundo hecho leve distinto confirmado en 90 días | 7 días sin ofrecer tutorías ni talleres |
| Tercero o siguientes en 90 días | 30 días sin ofrecer tutorías ni talleres |
| Hecho grave confirmado | Revisor elige materia, tutorías, comunidad o cuenta; 1, 7, 30 días o sin vencimiento |
| Riesgo que requiere protección preventiva | Alcance explícito por 1 o 7 días; sin incumplimiento confirmado ni strike |
| Hecho ya revisado | Vincular al antecedente: no duplicar strike ni medida |

Las decisiones tienen motivos privados, explicación compartida, responsable, fecha, alcance y vencimiento. El revisor confirma expresamente las consecuencias antes de enviar. La política de 90 días cuenta hechos leves confirmados no revocados; no cuenta denuncias. La escala para hechos leves afecta la oferta docente; el acoso, fraude u otras conductas graves requieren decidir un alcance proporcionado.

Una medida de tutorías no elimina materias acreditadas ni impide estudiar. Una medida por materia bloquea solo esa asignatura. La restricción de comunidad impide publicaciones e interacciones nuevas; permite leer y conservar apuntes privados y retirar contenido propio. Una restricción de cuenta bloquea las API autenticadas y las escrituras directas de miembros; mantiene inicio de sesión, avisos, ayuda y apelación. Los recursos públicos siguen siendo públicos. No se usa el ban de Supabase Auth, que también impediría presentar la apelación.

## Dónde se gestiona

**Bandeja → Avisos y ayuda → Mis medidas** muestra el historial privado, las fechas y el enlace al expediente. En **Revisión autorizada**, quien asume un expediente ve el formulario para decidir medidas si tiene permiso específico. Puede usar la resolución habitual sin sanción cuando no se acredita una falta.

El equipo debe designar al menos dos responsables independientes antes de operar con sanciones. No existe todavía una pantalla para administrar esos permisos. Un operador autorizado puede provisionar un perfil real, una vez acordado por el equipo, con este ejemplo que requiere sustituir el marcador:

    INSERT INTO public.community_reviewers(profile_id,active,can_sanction,can_suspend_accounts)
    VALUES ('REEMPLAZAR_POR_UUID_DE_PERFIL',true,true,false)
    ON CONFLICT(profile_id) DO UPDATE SET active=true,can_sanction=true;

`can_suspend_accounts` requiere una autorización adicional del operador para restringir o revisar una cuenta completa. No se obtiene por ser tutor, validador académico ni mediante user_metadata. Nadie puede resolver un expediente propio. Un revisor ordinario puede atender reportes y comunicar acuerdos, pero no aplicar medidas.

El retiro de un permiso no reasigna expedientes; un operador debe revisar los que queden asignados. No se garantiza un plazo de atención mientras el equipo no designe responsables y una cobertura de revisión.

## Apelación y correcciones

En expedientes con medidas, la apelación se reserva a la persona afectada: quien reporta no puede consumirla. Las demás incidencias conservan el flujo previo. Hay una revisión independiente por expediente, con antecedentes privados y una explicación final.

Un revisor distinto del primer responsable, con permiso para decidir medidas, debe mantener o revocar explícitamente la decisión. No puede cerrar esa apelación con el botón de resolución habitual. Para restricciones de cuenta necesita también el permiso adicional. Si se revoca, se retiran el incumplimiento y la medida de ese expediente; las medidas leves posteriores se recalculan para evitar una escala apoyada en un strike revocado. Otras medidas independientes siguen vigentes.

Los vencimientos se comprueban al operar; no dependen de un cron. Los historiales se conservan aunque la restricción termine. Una medida sin vencimiento continúa hasta una revisión que la revoque; no hay un botón público de reactivación.

## Reservas y protección técnica

- Se cancelan las tutorías individuales futuras pendientes o aceptadas que afecta una medida docente, por materia o de cuenta. Se avisa a ambos participantes sin divulgar el motivo privado.
- Se cancelan talleres futuros del tutor afectado y se avisa a sus inscritos. Si se restringe la cuenta de un estudiante, se liberan sus inscripciones futuras y se informa al tutor y al estudiante.
- Las sesiones pasadas y los historiales no se borran. Las reservas canceladas no se reactivan automáticamente después de una apelación o del vencimiento.
- El catálogo de tutores y las sugerencias de personas excluyen ofertas restringidas. Una vista pública expone solo disponibilidad y materias no disponibles, sin motivos ni strikes.
- Las escrituras de miembros en tablas públicas y almacenamiento tienen guardas SQL; también se comprueban reservas nuevas, aceptación, ofertas y talleres. Las operaciones normales mantienen JWT y RLS. Las operaciones administrativas privilegiadas quedan bajo control del operador.
- La API comprueba restricciones de cuenta después de validar el token. Si no puede comprobarlas, devuelve error; antes de instalar la migración permite el funcionamiento anterior porque aún no existen medidas. Las acciones admiten campos estrictos y límites de tasa.
- Las decisiones toman bloqueo del expediente, revisión esperada y bloqueo por persona para evitar carreras. Los casos no relacionados con perfiles deduplican por recurso; los reportes de perfil exigen vincular un hecho anterior o confirmar que se trata de otro. La equivalencia semántica de dos denuncias requiere revisión humana.

No se infieren diagnósticos ni se sancionan preferencias de aprendizaje. Los respaldos privados de formación inclusiva y las acreditaciones académicas siguen sus flujos separados. La reputación reciente y los hitos históricos no se borran por una sanción.

## Activación

1. En el mismo proyecto Supabase, ejecutar completo **supabase/ACTIVAR_MEDIDAS_CONVIVENCIA.sql** en SQL Editor → New query → Run.
2. Debe mostrar **Medidas de convivencia activadas**, `medidas_activadas=true` y `apelaciones_activadas=true`.
3. Abrir InterAula y recargar. Docker no ejecuta el SQL remoto.
4. Designar responsables reales antes de atender casos con medidas; no se asignan automáticamente.

El activador contiene la migración 028, exige el centro de incidencias previo y aplica todos los cambios en una transacción. No vuelve a ejecutar migraciones antiguas. Se puede repetir. Activación remota confirmada por el usuario. La comprobación posterior verificó las seis tablas/vistas y columnas esperadas mediante SELECT limit(0), sin leer registros ni asignar revisores.

## Validación y límites

**219 pruebas aprobadas:** 142 backend, 62 frontend y 15 ML. Compilaciones completadas y lint sin errores, con advertencias pendientes del repositorio. Docker frontend/backend/ml saludable, frontend HTTP 200, API saludable y acceso sin sesión a medidas rechazado con 401.

Pruebas de PostgreSQL temporal cubren advertencias, escala 7/30 días, privacidad, permisos, duplicados, cancelación de reservas, guardas directas, alcance por materia/comunidad/cuenta, prevención, vencimiento, apelación y repetición del activador. Las pruebas HTTP comprueban autenticación, identidad y bloqueo de cuenta manteniendo ayuda. La verificación de navegador usa React y API reales con PostgreSQL en memoria y cuentas ficticias; los catálogos ajenos al flujo se sustituyen por listas vacías. Evidencias: **docs/moderation-2026-11-16**.

Quedan pendientes: responsables reales, plazos de atención, panel de administración/reasignación, paginación después de 100 registros y una política institucional de convivencia acordada con el cliente. No se envían correos ni push. No se sancionó a usuarios reales durante el desarrollo.
