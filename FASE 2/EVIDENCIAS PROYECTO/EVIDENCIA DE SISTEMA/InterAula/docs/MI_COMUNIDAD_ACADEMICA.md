# Mi comunidad académica

InterAula mantiene su enfoque en universitarios y colaboración entre instituciones, con apoyos inclusivos opcionales. La comunidad académica agrega una referencia privada para encontrar coincidencias por institución, sede y comuna, conservando la afinidad por materias como criterio principal.

## Activación

La base existente debe tener las migraciones hasta 018. Ejecutar **una vez** el contenido completo de [ACTIVAR_COMUNIDAD.sql](../supabase/ACTIVAR_COMUNIDAD.sql) en el SQL Editor del mismo proyecto Supabase. Incluye 019, las correcciones 020 y la preferencia privada 021 en una sola transacción. Se puede repetir; no elimina perfiles, intereses, publicaciones ni datos de demostración. No volver a ejecutar las migraciones históricas 001–018.

El resultado final debe mostrar `Comunidad y apoyos activados`, `ideas_activadas=true` y `apoyos_activados=true`. Este archivo se genera con `node scripts/build-community-activation.mjs`. Docker no ejecuta SQL contra Supabase automáticamente.

## Uso

1. Abre **Mi comunidad académica** desde el buscador global, el menú de tu cuenta o los enlaces de **Para ti**.
2. Elige institución y sede. La selección inicial se toma de tu perfil cuando puede identificarse en el catálogo.
3. Elige el alcance: **Toda la comunidad**, **Mi institución**, **Mi sede** o **Cerca de mi sede**.
4. Elige modalidad y pulsa **Guardar mi comunidad**.
5. Abre **Ver mis recomendaciones**. Los motivos académicos y de comunidad aparecen por separado.

La referencia no cambia la institución pública del perfil. Elegir otra sede sirve para explorar esa comunidad; no equivale a acreditar pertenencia.

## Qué significa cercanía

El catálogo existente contiene 130 instituciones y 484 sedes con nombres, comunas y regiones. No contiene coordenadas verificadas. **Cerca** significa que la sede de la persona o autor está en la misma comuna y región que la sede de referencia. No usa GPS, domicilio, kilómetros ni una ubicación en tiempo real.

Las sedes se comparan dentro de su institución. Dos instituciones pueden compartir comuna sin ser la misma sede. Si un perfil no permite reconocer su institución y sede, no se incluye en un alcance estricto; sigue disponible al explorar toda la comunidad. No se amplía el alcance en silencio: la pantalla vacía ofrece cambiar la comunidad.

Para un alcance abierto, las coincidencias de comunidad desempatan resultados de la misma afinidad académica. Un tema ajeno nunca se vuelve pertinente por estar cerca. En modalidad online y alcance abierto se conserva la afinidad y recencia, sin favorecer la sede. La modalidad filtra actividades que la indican; no supone la disponibilidad presencial de una persona por su domicilio o sede. Los talleres anteriores sin modalidad se consideran online, conforme a su flujo de aula virtual existente.

Las publicaciones y perfiles se buscan dentro de los límites recientes del feed existente. La ubicación de apuntes corresponde a la institución de su autor, no a una certificación de equivalencia de programas. Para un futuro ranking por kilómetros harán falta coordenadas públicas verificadas de cada sede y nuevas pruebas; no se generan distancias aproximadas como si fueran reales.

## Correcciones incluidas

- Confirmar el dictado detiene el reconocimiento antes de insertar texto y descarta resultados tardíos.
- Talleres y preparación aceptan el contrato de los formularios. Las lecturas normalizan formatos anteriores sin reescribir sesiones terminadas.
- La vista de talleres devuelve guion, reglas, materiales y modalidad.
- Un estudiante no puede alterar la preparación del tutor directamente por REST; el semáforo reconoce la sala real de la sesión.
- Un validador no puede autoaprobarse. El solicitante puede reenviar una solicitud pendiente o revocada; una aprobación existente no se degrada por un reenvío.
- Los entregables usan responsables reales del equipo, fechas ISO y estados coherentes. Los comentarios se agregan con bloqueo transaccional, conservan los anteriores y no permiten suplantar al autor.
- Las ideas respetan contexto y asignatura; la conversión remota es atómica e idempotente.
- Los apoyos compartidos se leen mediante una función que devuelve únicamente los puntos seleccionados para compartir. No devuelve notas privadas, diagnósticos ni el perfil completo. El acceso se revoca con las preferencias actuales; proyectos exige pertenencia de ambas personas al equipo. La pantalla receptora incluye **Actualizar apoyos**.
- Los tutores se eligen por nombre, sin pedir UUID a la persona usuaria.
- El modelo de IA se configura con `GEMINI_MODEL` en el servidor. La clave sigue en el backend; la revisión usa respuestas simuladas, sin consumo de API.
- Se corrige la expresión de arranque de Docker Desktop y los imports duplicados de los tests.

## Comprobaciones y pruebas manuales

Validación del 14 de noviembre de 2026: **89 pruebas backend y 49 frontend correctas**, compilación de ambos proyectos correcta y revisión estática sin errores (persisten advertencias previas). Docker reconstruido y ambos servicios saludables. La persona usuaria confirmó la activación en Supabase; una consulta pública con límite cero verificó las columnas nuevas sin leer datos de usuarios. Evidencias de Docker y Supabase en `docs/community-2026-11-14/`.

Las pruebas nuevas cubren afinidad antes que localidad, sedes homónimas en instituciones diferentes, comuna, filtros de modalidad, rechazo de campos ajenos al contrato, formularios HTTP autenticados, conversión repetida, permisos de revisión, apoyos privados, revocación y comentarios. Se aplican y repiten las migraciones con PostgreSQL aislado.

En navegador se usan componentes reales con cuentas y servicios simulados; se comprueba guardado, error sin pérdida de selección, recarga, cambio de cuenta, activación pendiente, buscador, dictado y anchos de 1440, 960, 390 y 320 px. Evidencias en [community-2026-11-14](community-2026-11-14/browser-verification.json).

Después de activar Supabase, probar con dos cuentas reales: mismas materias y sedes diferentes; misma comuna en instituciones distintas; proyecto privado y externo; compartir y revocar un apoyo; reenviar y revisar acreditación con otro docente. Micrófono real, Jitsi y disponibilidad efectiva de tutores requieren esa validación en el entorno final.
