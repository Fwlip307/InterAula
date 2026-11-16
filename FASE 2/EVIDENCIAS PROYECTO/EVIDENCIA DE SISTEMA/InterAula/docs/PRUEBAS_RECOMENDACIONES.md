# Pruebas con todos los intereses

Conjunto `interaula-demo-interests-v1`, preparado el 9 de noviembre de 2026. Datos ficticios claramente identificados con **[DEMO]**. **El usuario ya ejecutó la carga en Supabase** y obtuvo las cantidades esperadas. Los endpoints públicos de apuntes, foro, proyectos y talleres confirmaron que los ejemplos están disponibles en la aplicación. El agente verificó la carga por lectura; no accedió administrativamente al proyecto remoto.

## Cargar una vez

1. Abrir [DATOS_PRUEBA_INTERESES.sql](../supabase/DATOS_PRUEBA_INTERESES.sql).
2. Copiar el archivo completo en **Supabase → SQL Editor → New query**, en el proyecto de InterAula, y pulsar **Run**.
3. El resultado debe indicar **Datos DEMO listos** con estos valores:

| Resultado | Cantidad |
| --- | ---: |
| Intereses cubiertos | 22 |
| Perfiles DEMO | 68 |
| Apuntes DEMO, incluidos controles privados y borradores | 89 |
| Publicaciones del foro | 22 |
| Proyectos, incluidos controles privados y borradores | 66 |
| Talleres, incluidos controles vencidos, llenos o cancelados | 110 |

4. Abrir http://localhost, entrar en **Perfil → Mis intereses**, guardar la selección y volver a **Para ti**.

No necesitas reconstruir Docker ni ejecutar de nuevo la activación del esquema. La API consulta los datos nuevos al recargar. Repetir la carga no duplica registros; actualiza las fechas de talleres ficticios a siete días desde la ejecución. Los intereses y las sugerencias ocultas de las cuentas reales se conservan.

Los perfiles son autores ficticios sin contraseña ni identidad de inicio de sesión. Se crean como referencias para el contenido y para probar el descubrimiento de personas, siguiendo el patrón de [placeholder de Supabase](https://supabase.com/docs/guides/local-development/cli-workflows#step-4-add-seed-data). No se envían invitaciones ni correos, ni se conceden roles administrativos o acreditaciones. Puedes seguir usando tu cuenta actual; estos perfiles no son cuentas para iniciar sesión. Las clases y los materiales DEMO no representan docencia real.

## Probar cada tema

Para empezar, activar la personalización, quitar los temas anteriores de los tres apartados y elegir **solo un tema en «Me interesa»**. Si tienes materias a reforzar, esas también pueden añadir coincidencias; para un caso estrictamente aislado utiliza una cuenta sin materias registradas. No hace falta cambiar tu consentimiento para compartir intereses.

Cada tema tiene estos ejemplos positivos:

- `[DEMO] Guia de [tema]` y `[DEMO] Apunte compartido - [tema]`.
- `[DEMO] Practiquemos [tema]`, en el foro.
- `[DEMO] Proyecto de [tema]`, con una vacante de prueba.
- `[DEMO] Taller de [tema]`, futuro y con cupos.
- `[DEMO] Comparte [tema]` y `[DEMO] Aprende [tema]`, como personas relacionadas.

Normalmente son **siete coincidencias por tema**. Python y Análisis de datos comparten un ejemplo adicional. Si ya existe contenido real compatible, también podrá aparecer. El portal muestra hasta nueve sugerencias por carga; la categoría «Mostrar» filtra dentro de esas sugerencias.

| Seleccionar un tema | Ejemplo que debe aparecer |
| --- | --- |
| Python | `[DEMO] Guia de Python` |
| JavaScript y TypeScript | `[DEMO] Guia de JavaScript y TypeScript` |
| Java | `[DEMO] Guia de Java` |
| Desarrollo web | `[DEMO] Guia de Desarrollo web` |
| Bases de datos y SQL | `[DEMO] Guia de Bases de datos y SQL` |
| Algoritmos y programación | `[DEMO] Guia de Algoritmos y programación` |
| Análisis de datos | `[DEMO] Guia de Análisis de datos` |
| Inteligencia artificial | `[DEMO] Guia de Inteligencia artificial` |
| Ciberseguridad y redes | `[DEMO] Guia de Ciberseguridad y redes` |
| Arquitectura y calidad de software | `[DEMO] Guia de Arquitectura y calidad de software` |
| Matemáticas | `[DEMO] Guia de Matemáticas` |
| Estadística | `[DEMO] Guia de Estadística` |
| Física | `[DEMO] Guia de Física` |
| Biología y salud | `[DEMO] Guia de Biología y salud` |
| Diseño y experiencia de usuario | `[DEMO] Guia de Diseño y experiencia de usuario` |
| Administración y emprendimiento | `[DEMO] Guia de Administración y emprendimiento` |
| Economía y finanzas | `[DEMO] Guia de Economía y finanzas` |
| Marketing y comunicación | `[DEMO] Guia de Marketing y comunicación` |
| Inglés | `[DEMO] Guia de Inglés` |
| Escritura e investigación | `[DEMO] Guia de Escritura e investigación` |
| Educación | `[DEMO] Guia de Educación` |
| Sustentabilidad | `[DEMO] Guia de Sustentabilidad` |

## Escenarios para recorrer juntos

| Caso | Qué hacer | Resultado esperado |
| --- | --- | --- |
| Tu selección actual | Elegir Estadística, Física, Análisis de datos e Inteligencia artificial | Nueve sugerencias visibles relacionadas con esos temas. El conjunto contiene 29 candidatos compatibles antes del límite. |
| Dos temas en un apunte | Elegir Python y Análisis de datos | Aparece `[DEMO] Analisis de datos con Python`, relacionado con ambos y con mayor prioridad entre apuntes. |
| Palabras parecidas | Elegir solo Java | Los registros de JavaScript y TypeScript no aparecen por contener la palabra Java. |
| Quiero aprender | Elegir Python en «Quiero aprender», sin otras selecciones | Se prioriza `[DEMO] Comparte Python`, con una explicación de conocimientos que puede compartir. |
| Puedo compartir | Elegir Python en «Puedo compartir», sin otras selecciones | Se prioriza `[DEMO] Aprende Python`, porque quiere aprender ese tema. |
| Sin historial | Usar una cuenta sin intereses ni materias a reforzar | Se muestran novedades generales, sin inventar afinidad ni recomendar personas. |
| Desactivar | Desmarcar personalización y guardar | Novedades de cualquier tema, sin razones personalizadas; se conserva la selección. |
| Ocultar | Pulsar «No me interesa» en un apunte y recargar | El apunte sigue oculto para esa cuenta. |
| Deshacer | Pulsar «Deshacer» después de ocultar | El apunte vuelve a estar disponible. |
| Restaurar | Pulsar «Restaurar sugerencias ocultas» | Se eliminan las ocultaciones de la cuenta. |
| Cambiar de cuenta | Ocultar un apunte en A y abrir otra cuenta B | B tiene sus propios intereses y no hereda lo que ocultó A. |
| Contenido propio | Crear desde tu cuenta un apunte público del mismo tema | Tu apunte no se te recomienda; sí puede ser candidato para otra persona. |
| Privados y borradores | Consultar los controles en Table Editor y luego «Para ti» | Ningún contenido titulado `NO RECOMENDAR` debe aparecer en las sugerencias. |
| Talleres sin disponibilidad | Comparar el taller abierto con sus controles | Solo se recomienda el futuro con cupos; se excluyen pasado, cancelado, finalizado y lleno. |
| Intereses sin compartir | Buscar `[DEMO] Temas ocultos: [tema]` entre sugerencias | No se recomienda por sus intereses privados. Su perfil no se trata como si hubiera dado consentimiento para compartirlos. |
| Acreditación | Revisar los perfiles y la explicación de las tarjetas | Los perfiles DEMO no aparecen como tutores acreditados. |

Antes de repetir la matriz, usa **Restaurar sugerencias ocultas** si ya escondiste ejemplos. La carga SQL no borra ese feedback para simular una recarga real de datos.

## Retirar las pruebas

Ejecutar completo [RETIRAR_DATOS_PRUEBA_INTERESES.sql](../supabase/RETIRAR_DATOS_PRUEBA_INTERESES.sql) en SQL Editor. Se retiran los autores ficticios, su contenido y las interacciones asociadas a ese contenido DEMO. Se conservan tu cuenta, intereses elegidos y contenido ajeno al conjunto.

Las asignaturas DEMO se conservan si alguna cuenta real las está usando en sus materias o contenido. Si alguien convirtió un perfil DEMO en una cuenta con identidad de acceso, el retiro se detiene para que se revise. Repetir el retiro es seguro y no elimina cuentas por coincidencias de nombre: se comprueban marca, dominio ficticio e identificadores del conjunto.

## Pruebas automatizadas

La matriz ejecuta el **servicio real de recomendaciones** sobre PostgreSQL embebido con las políticas RLS. Solo sustituye el transporte de Supabase por un adaptador de consultas hacia esa base aislada.

Comprueba los 22 temas individualmente, tu combinación de cuatro temas, complementariedad, palabras completas, permisos, feedback por cuenta, ausencia de acreditaciones ficticias, ejecución repetida, retiro repetido y protección frente a colisiones con cuentas ajenas.

Última ejecución: **78 pruebas de backend aprobadas**, incluida esta matriz. La compilación y el lint del backend también finalizaron correctamente; el lint conserva advertencias anteriores en los dobles de prueba. [Resultado guardado](pruebas-demo-2026-11-09/resultado.json).

Desde `backend`:

```powershell
node --import tsx --import ./src/tests/setup.ts --test src/tests/demoRecommendations.test.ts
```

Las pruebas automatizadas siguen usando una base aislada. La carga remota de este proyecto ya fue confirmada por separado; en otro entorno hay que ejecutar el SQL del primer paso antes de probar la interfaz.
