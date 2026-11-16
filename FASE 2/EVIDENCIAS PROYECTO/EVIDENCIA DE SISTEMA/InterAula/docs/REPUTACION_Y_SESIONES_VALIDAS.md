# Trayectoria, calidad reciente y sesiones verificables

Implementado el 16 de noviembre de 2026. Completa la primera prioridad de BRECHAS_Y_REPUTACION.md. Reportes, mediación, sanciones, apelaciones y entrega de notificaciones quedan para otra iteración.

## Uso y activación

- Perfil → Tutorías: panel «Trayectoria y calidad reciente», separado de valoraciones históricas, acreditaciones e hitos.
- Perfil público: el mismo resumen muestra sesiones validadas/históricas, cantidad de reseñas y estudiantes y los tres criterios.
- Gestionar mis tutorías o Pedir apoyo → Mi agenda: «Confirmar realización». Las vistas sin acción integrada enlazan a la gestión de confirmaciones.

Requiere supabase/ACTIVAR_REPUTACION.sql. El usuario confirmó ambas columnas true y compartió la captura. Una consulta remota posterior SELECT limit(0) comprobó vista y columnas sin leer registros ni escribir datos. Docker no aplica migraciones.

## Sesiones válidas

El servidor acepta confirmaciones de participantes de sesiones accepted/in_progress a partir de 15 minutos desde el horario programado. Ese plazo no mide la duración real: es una condición mínima distinta del registro de asistencia.

Hay dos vías:

1. Asistencia registrada por el aula y confirmación del tutor. La asistencia existente exige al menos 900 segundos por participante mediante reloj y heartbeats del servidor.
2. Confirmación del tutor y del estudiante, útil también en tutorías presenciales o fuera del aula. Es una declaración conjunta, no una prueba independiente ni una garantía contra acuerdos fraudulentos.

Una sola confirmación de la segunda vía deja la sesión abierta. Cuando hay evidencia suficiente se guardan completed, método y fecha de validación atómicamente. La última confirmación puede ser del estudiante. Repetirla no duplica hitos ni cambia su fecha inicial.

La función bloquea la sesión durante la operación. Los participantes no pueden completar mediante UPDATE directo, falsificar confirmaciones ni asignar evidencia. La API anterior que solicitaba completed como tutor también utiliza la función segura.

El estudiante participante sigue siendo el único que puede valorar y existe una reseña por sesión. Las reseñas históricas conservan su flujo y promedio; los reconocimientos nuevos solo usan sesiones con evidencia.

## Tres dimensiones

| Dimensión | Comportamiento |
| --- | --- |
| Acreditación | Materias y evidencia inclusiva conservan su proceso. Una nota baja no elimina acreditaciones. |
| Trayectoria | Hitos por 1/10/25/50 sesiones validadas. Se conservaron códigos y reconocimientos existentes; los nombres describen cantidad, sin llamar excelencia a 50 sesiones. |
| Calidad reciente | Reconocimientos de comunicación, dominio y puntualidad, calculados al consultar y sin otorgar insignias permanentes en user_badges. |

No se borran sesiones, reseñas o insignias anteriores ni se asigna asistencia retrospectiva. Los completed sin completion_verified_at se muestran como históricos y no alimentan la nueva calidad. Los hitos históricos permanecen aunque el nuevo conteo validado sea menor.

## Política inicial de calidad

Para cada criterio: últimos **90 días**, al menos **10 reseñas**, al menos **5 estudiantes distintos** y puntuación ajustada **≥ 8,5/10**.

Puntuación ajustada = (suma de notas + 35) / (reseñas + 5). La base fija 7/10 con peso 5 suaviza muestras pequeñas: no añade reseñas o personas a los contadores. Se muestran el promedio real y el ajustado por separado. Es una política inicial de producto pendiente de validación con estudiantes.

La vista recalcula la calidad al consultarse, incluida la salida de reseñas de la ventana de 90 días; no necesita cron. La pantalla se actualiza al recargar o navegar.

Una reseña baja puede desactivar un reconocimiento si deja de cumplirse su regla. No suspende la cuenta ni borra hitos. El panel distingue muestra insuficiente de ausencia de reconocimiento, sin etiquetar al tutor como malo. K-Means mantiene sus reglas de afinidad; no es un mecanismo de sanción.

## Seguridad y compatibilidad

- POST /api/tutoring/sessions/:id/confirm-completion: autenticación, UUID validado, cuerpo vacío, autorización SQL y límite de tasa.
- GET /api/tutoring/reputation/:id: autenticación y agregados públicos. No devuelve identidades de evaluadores ni comentarios.
- Confirmaciones y fechas individuales permanecen en sesiones, limitadas a participantes por RLS.
- No se utiliza una clave administrativa para confirmar ni escribir reseñas.
- Sin migración, el cierre devuelve un error de activación y no recurre al cierre anterior. El panel diferencia activación pendiente y error de carga.
- La migración es repetible, conserva filas y solo actualiza nombres/descripciones de los cuatro hitos; no modifica estados o notas retrospectivamente.

## Validación

**213 pruebas automáticas aprobadas:** 62 frontend, 136 backend y 15 Python. Compilación correcta; lint sin errores, con advertencias existentes del repositorio.

PostgreSQL temporal comprobó repetición de migración/activador sin perder históricos; rechazo de cierre directo, evidencia falsa, terceros, anónimos y confirmación anticipada; cierre por ambas vías; idempotencia; hitos 1/10/25/50; calidad con muestra suficiente, cambio tras una mala reseña y caducidad a 90 días; conservación de disponibilidad e hitos y privacidad de sesiones ajenas.

La integración HTTP Express → PostgreSQL temporal ejecutó confirmaciones y reseña con cuentas sintéticas. El navegador usó componentes y cliente HTTP reales: seis comprobaciones de panel, ambos participantes, reseña, cambio de calidad, error/reintento y dimensiones 320/390/768/1440 en claro, oscuro y Calma.

Evidencia: docs/reputation-2026-11-16/, con integration-verification.json, browser-verification.json, schema-verification.json y capturas reputation-*.png. Los ensayos funcionales no escriben en Supabase ni utilizan cuentas reales; la consulta remota solo verifica estructura.

## Pendiente

Definir responsables y flujo de reporte/revisión/apelación; contemplar rectificación de una confirmación equivocada, sesiones disputadas, fraude coordinado y reseñas fraudulentas. Validar la política y lenguaje con estudiantes y probar asistencia entre dos dispositivos reales. Dos confirmaciones no demuestran por sí solas calidad ni realización efectiva.
