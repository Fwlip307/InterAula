# Alertas de clases y correos opcionales

Implementado el 16 de noviembre de 2026. InterAula genera avisos de tutorías y talleres dentro de la aplicación y prepara correos transaccionales mediante Resend. El correo está desactivado por defecto: no se enviaron mensajes reales durante el desarrollo y todavía falta configurar el proveedor y un remitente verificado.

## Qué recibe cada persona

| Evento | Destinatarios |
| --- | --- |
| Solicitud de tutoría | Tutor: nueva solicitud; estudiante: solicitud enviada |
| Tutoría aceptada | Estudiante y tutor: confirmación |
| Rechazo o cancelación | Ambos participantes: cambio de estado |
| Tutoría en curso | Ambos: acceso desde la agenda |
| Sesión terminada o confirmación pendiente | Participante que debe actuar; tutor recibe validación |
| Taller programado | Tutor |
| Inscripción o retiro de un taller | Estudiante y tutor |
| Cambio de horario, inicio, cancelación o final de taller | Tutor y estudiantes inscritos |
| Clase próxima | Tutor y estudiante(s), según su participación |

Los recordatorios se generan durante las 24 horas previas y de nuevo durante la última hora. Si una clase se programa con menos de una hora de anticipación, recibe solo el recordatorio cercano; no se envían dos juntos para compensar el anterior. Cada horario tiene claves de evento únicas. El contenido indica la hora de Chile mediante America/Santiago, resuelta por Intl, y ofrece un enlace a la agenda.

Los avisos internos son silenciosos. El contador de la bandeja se actualiza cada minuto mientras la página está visible y al volver a ella. No hay sonidos, destellos, notificaciones push ni permisos de navegador obligatorios.

## Preferencias

En **Configuración → Avisos y notificaciones**:

- **Correos de tutorías y talleres**: confirma solicitudes, inscripciones y cambios.
- **Recordatorios de clases por correo**: permite los recordatorios de 24 horas y una hora; necesita que el correo de clases esté activado.
- El usuario debe **guardar sus preferencias** para sincronizarlas con su cuenta. Desactivar correo no elimina los avisos internos.
- Los correos del Hub de Proyectos siguen pendientes; esa opción conserva su estado previo y no se presenta como un canal activo.

La pantalla y la bandeja muestran si el correo está configurado o pendiente, sin presentar correos simulados como enviados. La confirmación de la API del proveedor significa **aceptado para envío**, no entrega garantizada a la bandeja del destinatario. No se implementaron seguimiento de aperturas, webhooks de entrega/rebote ni una lista pública de direcciones.

## Activar los avisos automáticos

Ejecutar completo **supabase/ACTIVAR_ALERTAS_DE_CLASES.sql** en SQL Editor del proyecto InterAula. Debe mostrar **Alertas de clases y correo preparadas**, `cola_activada=true` y `recordatorios_activados=true`.

Contiene únicamente la migración 029 en una transacción. Requiere incidencias y bandeja (027), se puede repetir y no borra registros, asigna roles ni reenvía el historial antiguo. No ejecuta llamadas de correo desde SQL. Docker no aplica la migración remota.

El backend ejecuta el trabajo de recordatorios cada minuto incluso con el correo desactivado, y también los comprueba para la persona que abre su bandeja. Necesita la clave privada de servidor de Supabase ya utilizada por la aplicación. En esta instalación se ejecuta dentro de Docker: si el equipo o los contenedores están apagados, el trabajo no corre. Para operación permanente hay que desplegar el backend en un servidor que permanezca activo. No se envían recordatorios atrasados después del inicio de una clase.

## Configurar Resend, paso a paso

1. Crear o utilizar una cuenta de Resend y abrir **Domains**. Añadir un dominio propio o un subdominio del proyecto y completar su verificación con los registros DNS indicados por Resend. No se compró ni se configuró un dominio durante esta implementación.
2. En **API Keys**, crear una clave con permiso de envío para ese dominio. Guardarla únicamente en el archivo privado **backend/.env**. No pegarla en chats ni ponerla en variables VITE_.
3. Elegir una dirección del dominio verificado, por ejemplo `InterAula <clases@TU_DOMINIO>`, y definir la URL pública HTTPS de la aplicación. Los enlaces localhost solo funcionan en el equipo local y no sirven como acceso para otros estudiantes; la integración mantiene el envío bloqueado mientras no exista una URL HTTPS válida.
4. Completar en **backend/.env**:

   ```dotenv
   EMAIL_ENABLED=true
   RESEND_API_KEY=TU_CLAVE_PRIVADA
   EMAIL_FROM=InterAula <clases@TU_DOMINIO>
   APP_PUBLIC_URL=https://TU_DOMINIO_DE_LA_APP
   ```

5. Reiniciar los servicios con **docker-start.bat**, que carga backend/.env. La configuración de Docker pasa estas variables exclusivamente al backend.
6. Recargar Configuración y comprobar que aparezca «El servicio de correo está configurado». Esto confirma la configuración local; la validez del dominio y de la clave se comprueba cuando el proveedor acepta un envío.
7. Probar con una reserva real entre cuentas de prueba del equipo, con direcciones confirmadas y correo activado. Revisar el mensaje recibido y la sección Emails de Resend. No se incluyó un endpoint público para enviar mensajes a direcciones arbitrarias.

Si todavía no tienen dominio o una URL pública, dejar `EMAIL_ENABLED=false`: los avisos de la aplicación y los recordatorios siguen siendo utilizables. El código del proveedor está separado del resto del flujo para poder adaptarlo después a otro servicio si el equipo ya dispone de uno.

Referencias oficiales verificadas: [envío de correos](https://resend.com/docs/api-reference/emails/send-email), [verificación de dominios](https://resend.com/docs/dashboard/domains/introduction), [claves de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Privacidad y fiabilidad

- Los eventos y los trabajos de correo se registran en la misma transacción que la reserva o cambio: si se revierte la operación, no queda un correo fantasma.
- La cola usa RLS y no permite acceso directo a usuarios. Solo las funciones de trabajo autorizadas para service_role pueden reclamar o confirmar envíos. Ningún cliente puede indicar destinatario o texto libre de correo.
- Las direcciones provienen de Supabase Auth y requieren email confirmado. No se usan correos editables del perfil. La elegibilidad, preferencias, dirección confirmada y estado de la clase se verifican antes de preparar el envío; un cambio de dirección invalida el trabajo antiguo.
- La cola solo acepta tipos explícitos de clase. No envía denuncias, respuestas privadas, notas internas, diagnósticos, contacto de otros participantes ni preferencias de aprendizaje.
- Un registro tiene una única notificación de origen; los reintentos conservan cuerpo, destino y clave de idempotencia. Las concesiones de trabajo evitan que dos procesos reclamen el mismo envío al mismo tiempo.
- El trabajador procesa hasta diez correos por ciclo de un minuto en esta versión. Hay hasta cinco intentos, espera creciente y una ventana de reintento inferior a 20 horas. El proveedor conserva claves de idempotencia durante 24 horas; los trabajos que agotan la ventana quedan fallidos para revisión, sin reenvío automático posterior.
- Se descartan recordatorios expirados, cancelados, con horario anterior o para estudiantes que ya no estén inscritos. Un cambio de horario del taller produce avisos y recordatorios para el horario nuevo.
- Un fallo de correo no revierte una reserva válida. Se conserva el aviso en la bandeja y el código técnico del fallo en la cola privada. No se imprimen direcciones, contenido o claves en los logs del trabajador.

## Validación y pendientes

**209 pruebas aprobadas:** 147 backend y 62 frontend. Compilación y lint completados, con advertencias existentes. Docker frontend/backend/ml saludable, HTTP 200 y acceso sin sesión al estado de los canales rechazado con 401. Navegador comprobado en 320/390/768/1440 px y modos claro, oscuro y Calma. Activación remota confirmada por el usuario y comprobada mediante SELECT limit(0): cola disponible y recordatorios automáticos activos. El correo permanece desactivado; no se leyeron registros ni se enviaron correos durante la comprobación.

Pruebas aisladas de SQL y transporte simulado verifican destinatarios, solicitudes y talleres, recordatorios, preferencias, direcciones no confirmadas, revocación de preferencias tras reclamar un trabajo, cancelaciones, rollback, repetición del activador, permisos, plantillas HTML/texto, claves de idempotencia y recuperación después de un fallo de confirmación en base de datos. No se contactó a usuarios reales ni al proveedor durante las pruebas.

Faltan la configuración privada de Resend, el dominio/remitente verificado, la URL pública y una prueba real de entrega entre cuentas del equipo. La activación remota del nuevo script fue confirmada por el usuario y verificada sin leer registros. No se promete entrega ni precisión de un minuto si el servidor está apagado, hay retrasos del proveedor o errores de red.
