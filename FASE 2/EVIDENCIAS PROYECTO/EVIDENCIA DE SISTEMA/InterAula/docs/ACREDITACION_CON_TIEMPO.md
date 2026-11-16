# Acreditación con tiempo y pantalla completa

La migración anterior trasladó la calificación al servidor, pero simplificó el modal y dejó fuera los cronómetros, la pantalla completa y la selección completa de materias. Esta corrección recupera esas funciones manteniendo las soluciones y la acreditación en el servidor.

## Configuración local y Docker

1. La clave de Google se guarda exclusivamente en el archivo privado e ignorado `backend/.env`, en `GEMINI_API_KEY`. El modelo se configura mediante `GEMINI_MODEL`. No usar variables `VITE_` para claves privadas.
2. En el proyecto Supabase correspondiente, abrir **Project Settings → API Keys → Secret keys**. Copiar o crear una clave de servidor y guardarla en `backend/.env` como `SUPABASE_SECRET_KEY=valor_privado`. No pegarla en chats ni subirla al repositorio. También se admite la variable anterior `SUPABASE_SERVICE_ROLE_KEY`.
3. Ejecutar completo `supabase/ACTIVAR_ACREDITACION.sql` en **SQL Editor → New query → Run**. El resultado esperado es **Acreditacion con tiempo activada**, `tiempo_por_pregunta=true`. El script requiere la base de acreditación de la migración 017 y se puede repetir. No borra materias ni acreditaciones.
4. Desde `C:\Proyectos\InterAula`, ejecutar `.\docker-start.bat`. El script reconstruye y recrea los contenedores cargando `backend/.env`.
5. Entrar en **http://localhost → Mi perfil → Tutorías → Rendir Evaluación con el Asistente**. El perfil debe tener institución y carrera. Buscar la materia, elegir tiempo y comenzar.

El SQL fue confirmado por el usuario con captura el 14 de noviembre de 2026. La configuración privada se comprueba por separado: una clave de Google no sustituye la clave de servidor de Supabase. El botón de inicio permanece deshabilitado si el servidor no tiene acceso a las columnas de acreditación. La comprobación utiliza una consulta con límite cero y no devuelve soluciones ni claves.

Referencia de claves: [documentación de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## Reglas de la evaluación

- Un solo campo permite buscar y seleccionar entre las 1.000 entradas del catálogo académico existente, además de materias registradas que no figuren en él. Admite búsqueda sin tildes, selección por teclado y estado sin coincidencias; las materias acreditadas no se pueden elegir de nuevo. Los nombres homónimos muestran el área; el catálogo no equivale a la validación oficial de cada programa universitario.
- Con Google configurado, cada intento nuevo genera diez preguntas específicas de la materia, incluso si existe un banco revisado. Se solicita otro caso práctico y se compara contra las preguntas completas de los diez últimos intentos del mismo usuario y materia. Se rechazan repeticiones normalizadas (sin tildes/puntuación) y textos casi idénticos; se cambia también el orden de las alternativas y sus identificadores. Esta comprobación textual no garantiza detectar toda paráfrasis o concepto similar.
- Si la propuesta repite preguntas o no cumple el formato, se permite una segunda generación dentro del límite total de 45 segundos. Si ambas fallan se informa el error y no se recicla el examen anterior. Sin Google solo se permite un banco revisado con al menos cinco preguntas no usadas recientemente; si se agota, se detiene la generación y se ofrece revisión docente.
- El servidor valida estructura, opciones y duplicados, pero esa validación no garantiza la exactitud académica de todas las preguntas generadas. La revisión docente sigue disponible. Las generaciones nuevas consumen la cuota del proveedor y se mantiene el límite de tres inicios por hora y usuario.
- No se acredita con ejercicios genéricos ni con preguntas de otra materia cuando falla la generación. El error permite reintentar o recurrir a revisión docente.
- Tiempo estándar: 20 segundos por alternativa y 40 segundos por desarrollo breve. Tiempo extendido: 40 y 80 segundos, disponible sin pedir diagnósticos. Desarrollo breve significa escribir un concepto o resultado corto; no un ensayo o ejercicio largo. La pantalla muestra ambos tiempos por separado y el tipo de cada pregunta. Los formatos disponibles dependen del banco de cada materia; la generación con Google produce alternativas breves.
- Los nuevos intentos utilizan la política 5: al primer error, respuesta omitida o tiempo agotado finaliza la prueba, sale de pantalla completa y no permite acceder a otra pregunta ni acreditar. Es necesario acertar todas para aprobar. Se conserva la pausa mínima de 5 segundos (10 con tiempo extendido) tras cada respuesta correcta. Los intentos anteriores conservan su política: la 4 permite 70% con pausas, la 3 usa 20/40 sin pausa obligatoria y la 2 conserva 45/90. Este ajuste no requiere otro SQL.
- El servidor fija cada vencimiento. El navegador muestra el contador con un reloj monotónico; recargar, cambiar la hora del equipo o volver a pantalla completa no reinicia el plazo.
- Al expirar una pregunta, el navegador envía una respuesta por tiempo agotado. El servidor rechaza como correcta una respuesta tardía aunque se manipule el navegador.
- Después de responder hay una pantalla de pausa sin la pregunta siguiente, con un consejo breve que cambia entre pausas. La explicación queda en un desplegable opcional. Pasada la pausa mínima se habilita **Siguiente pregunta**; no avanza automáticamente y entonces comienza el plazo nuevo. Recargar no reinicia la pausa. El intento mantiene un límite total que incluye hasta un minuto de lectura y pausa por pregunta.

## Concentración y apoyos de lectura

La preparación, recuperación, guardado y acreditación tienen pantallas de carga que sustituyen el contenido de la pregunta. No se muestran porcentajes de avance inventados ni se mantiene visible una pregunta mientras se guarda.

Durante la respuesta se presenta una sola pregunta, sus alternativas o respuesta breve, progreso y lectura en voz alta. Las reglas, fuente, incidencias y tiempo total se consultan en desplegables. La explicación y los consejos aparecen entre preguntas para evitar cambios de texto mientras se responde.

La vista tranquila está activada inicialmente: colores suaves, sin animaciones ni transiciones. Se puede agrandar la letra u ocultar la cuenta regresiva sin detener el plazo real. Se respetan el modo calma global, el modo oscuro y la preferencia de movimiento reducido. La navegación por teclado y el foco en cada pregunta siguen disponibles. Son apoyos opcionales para cualquier estudiante; no requieren declarar TEA, TDAH, dislexia ni otro diagnóstico.
- Se exige completar **todas las preguntas correctamente (100%)** para acreditar los intentos nuevos. No se revela la solución del error al cerrar la prueba. Los niveles superiores requieren el flujo docente correspondiente. Se permiten hasta tres inicios por hora y usuario.
- La acreditación final exige un intento completo aprobado del mismo usuario. No se aceptan notas, soluciones ni estados de aprobación enviados por el cliente.

## Pantalla completa e integridad

La prueba requiere pantalla completa nativa. Copiar y pegar dentro de la evaluación están bloqueados. Cambiar de pestaña, perder el foco o salir de pantalla completa registra incidencias. El servidor agrupa eventos ocurridos en un mismo episodio y termina el intento al alcanzar tres. La salida voluntaria requiere confirmar el abandono.

Fuera de pantalla completa las respuestas quedan deshabilitadas y el tiempo continúa. El intento se puede recuperar tras una recarga usando su identificador guardado por cuenta; las preguntas y respuestas completas permanecen en el servidor. Los eventos pendientes se reintentan antes de responder o confirmar la acreditación.

Estos controles del navegador son disuasorios: no impiden capturas del sistema operativo, consultas desde otro dispositivo ni un cliente manipulado que omita eventos. No se recopila el contenido del portapapeles, el escritorio ni URLs de otras pestañas. Para evaluaciones que requieran supervisión formal se necesita un procedimiento adicional.

La pregunta y sus opciones se ocultan al perder foco, cambiar de pestaña o salir de pantalla completa; también se detiene la lectura en voz alta. Volver no reinicia el tiempo. La impresión excluye el modal. Cuando el navegador entrega un atajo detectable de captura, se activa una cubierta temporal; Windows, macOS u otras herramientas pueden capturar antes o sin entregar ese evento, por lo que esta cubierta no garantiza impedir capturas. No se borra ni se lee el portapapeles del sistema.

## Validación

- Backend: 100 pruebas aprobadas, incluidas propiedad del intento, fechas del servidor, recuperación sin ampliar el tiempo, respuestas tardías, incidencia repetida, abandono, materias, generación específica, tiempos 20/40 y 40/80, conservación de tiempos anteriores, pausas obligatorias, cierre al primer error, bloqueo de continuación/acreditación, generación nueva incluso con banco revisado y rechazo de exámenes repetidos.
- Frontend: 50 pruebas aprobadas; compilaciones de frontend y backend correctas.
- SQL: migraciones y activación ejecutadas de forma aislada con PGlite, repetición idempotente y ausencia de permisos de lectura directa de intentos para usuarios públicos/autenticados.
- Navegador: componente real en React StrictMode, con respuestas sintéticas de servicios; pantalla completa nativa, avance, tiempo extendido, vencimiento automático, copiar/pegar, tres incidencias, recuperación, abandono, acreditación y configuración ausente. Sin desbordamiento horizontal a 1440, 390 y 320 píxeles. Evidencia en `docs/accreditation-2026-11-14/`.
- Google: consulta real de disponibilidad del modelo y una generación real de Marketing Digital válidas, sin registrar claves ni soluciones.

Las pruebas del navegador no acreditan usuarios reales ni sustituyen una prueba completa con una cuenta de la instalación una vez configurada la clave privada.

