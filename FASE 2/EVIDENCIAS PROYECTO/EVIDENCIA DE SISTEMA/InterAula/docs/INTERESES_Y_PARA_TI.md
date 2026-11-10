# Intereses y «Para ti»

Implementado el 9 de noviembre de 2026. Primera fase de las recomendaciones por intereses; el clustering todavía no está incorporado.

## Cómo se usa

Para probar todos los temas con datos ficticios, consultar [la matriz de escenarios y la carga DEMO](PRUEBAS_RECOMENDACIONES.md). Sus pruebas adicionales llevan la suite de backend a 78 casos aprobados; no cambian el código de la aplicación ni requieren reconstruir Docker.

1. En el portal, abrir **Ajustar mis intereses**; también está disponible en **Perfil → Mis intereses**.
2. Elegir hasta 12 temas por apartado: **Me interesa**, **Quiero aprender** y **Puedo compartir**. Hay un catálogo inicial de 22 temas y un buscador.
3. Guardar. La selección se conserva por cuenta en PostgreSQL. Los cambios sin guardar y los errores se muestran explícitamente.
4. Volver a **Para ti** para ver contenidos y personas relacionados. Cada tarjeta explica el motivo y abre el recurso correspondiente.
5. **No me interesa** oculta una sugerencia para esa cuenta. Puede deshacerse o restaurarse el conjunto de sugerencias ocultas.

La personalización puede desactivarse: entonces se muestran novedades generales y se conserva la selección. **Explorar todo** mantiene acceso al catálogo completo de apuntes, foro, proyectos y tutorías.

Compartir los temas para que recomienden el perfil es opcional y viene desactivado. Solo se publican identificador del perfil, tema e intención si se habilitan tanto compartir como personalizar. Las asignaturas ofrecidas por tutores disponibles mantienen su descubrimiento público existente. Seleccionar **Puedo compartir** no concede acreditación de tutor.

## Activación de la base de datos

**Activación en un solo paso:** abrir [ACTIVAR_INTERESES.sql](../supabase/ACTIVAR_INTERESES.sql), copiar su contenido completo y ejecutarlo en **Supabase → SQL Editor → New query**, en el mismo proyecto usado por la aplicación. El archivo reúne 016–018, comprueba las tablas previas y ejecuta los cambios en una sola transacción. Al terminar muestra `Activacion completada`, 22 temas y disponibilidad de talleres. Después, recargar la aplicación y elegir intereses. No es necesario crear publicaciones ni usuarios de ejemplo.

El archivo se genera desde las migraciones originales con `node scripts/build-activation.mjs`; `node scripts/build-activation.mjs --check` comprueba que esté actualizado. La prueba de PostgreSQL ejecuta este mismo archivo y verifica que rechace una base sin el esquema previo.

La implementación requiere la nueva [migración 018](../supabase/migrations/018_interests_and_recommendations.sql), sobre el esquema compatible con las anteriores. Las migraciones 016 y 017 de la fase de correcciones también siguen siendo necesarias.

**Activación remota confirmada el 9 de noviembre:** el usuario ejecutó el archivo en SQL Editor y obtuvo `Activacion completada`, 22 temas y disponibilidad de talleres. La API de la aplicación confirmó 200 para el catálogo con 22 temas y para talleres. No se usó una conexión administrativa desde el agente. En futuros despliegues, revisar primero el historial; no repetir migraciones antiguas de limpieza o modificación de cuentas concretas.

La función de intereses utiliza la sesión del usuario y no necesita una nueva clave privada. La acreditación automática de la fase anterior sigue necesitando la clave de servicio únicamente en el servidor.

Esta versión usa los contenedores frontend y backend existentes: no agrega dependencias ni un servicio de Python. **Docker se construyó y arrancó correctamente el 9 de noviembre**: ambos servicios están `healthy`. La aplicación se publica en http://localhost y la API en http://localhost:3001/api/health. El script de inicio abre Docker Desktop en segundo plano si está cerrado y espera hasta dos minutos a que el motor responda.

La base de datos continúa en Supabase: arrancar Docker no ejecuta migraciones remotas. Si un despliegue todavía no está activado, el backend responde con `RECOMMENDATIONS_NOT_READY` y la interfaz explica que las sugerencias aún no están habilitadas. No afirma que existan intereses guardados ni confunde este estado con una selección vacía.

## Persistencia y API

| Recurso | Función |
| --- | --- |
| `recommendation_topics` | Catálogo común de temas y términos relacionados. |
| `recommendation_preferences` | Personalización, consentimiento para compartir y versión por cuenta. |
| `user_topic_interests` | Temas elegidos y propósito: interés, aprender o compartir. |
| `recommendation_dismissals` | Sugerencias ocultas por el usuario. |
| `discoverable_topic_interests` | Proyección de temas compartidos voluntariamente. |

Todos los endpoints están bajo `/api/recommendations`. Solo el catálogo de temas es público.

| Método y ruta | Operación |
| --- | --- |
| `GET /topics` | Obtener catálogo. |
| `GET /preferences` | Leer la selección propia. |
| `PUT /preferences` | Guardar atómicamente la selección completa y sus opciones. |
| `GET /feed?limit=9` | Obtener sugerencias; límite permitido de 1 a 30. |
| `POST /dismissals` | Ocultar `{kind, id}` de un recurso accesible. |
| `DELETE /dismissals/:kind/:id` | Deshacer una ocultación. |
| `DELETE /dismissals` | Restaurar las sugerencias ocultas de la cuenta. |

El guardado recibe `revision`, `personalization_enabled`, `discoverable` y los arreglos `interest`, `learn`, `teach`. El servidor obtiene la identidad del token. La transacción comprueba catálogo, duplicados, límites y versión; si otra ventana guardó antes, devuelve 409 y conserva la selección local para su revisión. No hay respaldo compartido en localStorage ni éxito simulado si falla la base.

## Cómo se eligen las sugerencias

El motor `interests-v1` compara los temas elegidos y las materias a reforzar con títulos, resúmenes, etiquetas, tecnologías y asignaturas de los contenidos. Usa términos completos normalizados: por ejemplo, Java no coincide con JavaScript. No utiliza el HTML completo, archivos, teléfono, correo, preferencias de accesibilidad ni diagnósticos.

Para personas, combina temas compartidos voluntariamente y asignaturas ofrecidas públicamente. Prioriza la complementariedad entre aprender y enseñar; solo presenta a alguien como tutor acreditado si la asignatura está realmente verificada y su perfil está disponible para tutorías.

Las consultas usan el JWT y las políticas RLS. No se incluyen apuntes privados o en borrador, proyectos privados, talleres cancelados/finalizados, talleres programados en el pasado ni talleres sin cupo. Se omiten el perfil propio, los contenidos propios y las sugerencias ocultas. Los enlaces vuelven a comprobar disponibilidad y permisos al abrirse.

Sin intereses ni materias a reforzar, se muestran novedades. Con personalización activa y sin coincidencias, se muestra un estado vacío con acceso a ajustar intereses y explorar; no se inventan usuarios ni publicaciones. Los errores de consulta se muestran como errores.

La primera versión compara hasta 150 candidatos por tipo, antes del orden personalizado. Incluye variedad de tipos y desempata por fecha. Este límite favorece un alcance acotado; con más datos convendrá seleccionar candidatos por tema en la base y agregar paginación. Los temas de contenido se infieren de sus metadatos existentes, sin reescribir sus publicaciones.

## Verificación

- 48 pruebas de backend y 39 de frontend aprobadas: **87 en total**.
- Migraciones completas y reaplicación de 016–018 comprobadas en PostgreSQL embebido con datos sintéticos.
- Pruebas de aislamiento por cuenta, consentimiento para compartir, desactivación, versión obsoleta, rollback y feedback privado.
- Pruebas del motor, límites de API, identidad tomada del token y propagación de errores de persistencia.
- Chrome: ocho comprobaciones de interacción de los componentes y siete de integración con el router y las páginas reales. Incluyen errores y reintentos, recuperación de selección, cambio de cuenta, ocultar/deshacer, desactivar y enlaces al lector, hilo, proyecto y taller.
- Escritorio y móvil de 390 px: sin excepciones ni desbordes horizontales observados en estas comprobaciones.

Las verificaciones privadas del navegador usan identidad y servicios simulados; no constituyen una validación con cuentas reales en Supabase. El esquema remoto ya está activado y sus endpoints públicos están comprobados. Falta verificar con cuentas reales el guardado de intereses y el feed personalizado de cada persona.

Evidencias: [interacciones](intereses-2026-11-09/comprobacion-intereses.json), [rutas integradas](intereses-2026-11-09/integracion-rutas.json), [perfil integrado](intereses-2026-11-09/perfil-integrado.png), [portal integrado](intereses-2026-11-09/portal-integrado.png), [intereses en móvil](intereses-2026-11-09/intereses-movil.png) y [sugerencias en móvil](intereses-2026-11-09/para-ti-movil.png).

## Próxima fase

Añadir señales voluntarias de uso, construir vectores por perfil y comparar un modelo de clustering con esta versión de referencia. Medir utilidad mediante contenidos guardados, participación y tutorías realizadas. La agrupación no debe sustituir los permisos de acceso ni la complementariedad para recomendar tutores.
