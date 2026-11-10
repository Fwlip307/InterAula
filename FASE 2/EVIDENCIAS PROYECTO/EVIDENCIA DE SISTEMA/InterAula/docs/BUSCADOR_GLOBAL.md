# Buscador de navegación

En la barra superior, pulsa **Buscar en InterAula** o usa **Ctrl + K** (en Mac, **⌘ + K**). En pantallas pequeñas aparece una lupa. Escribe el nombre de una opción y selecciónala con el ratón, o con las flechas y **Enter**. **Esc** cierra el buscador.

Para encontrar la opción de intereses:

1. Busca **Quiero aprender**.
2. Abre el resultado: lleva a **Perfil → Mis intereses → Quiero aprender**, desplaza la vista hasta sus controles y coloca allí el foco.
3. Selecciona los temas y pulsa **Guardar mis intereses**.

También puedes buscar «Puedo compartir», «Para ti», «Borradores», «Mis postulaciones», «Talleres», «Tareas» o «Accesibilidad». La búsqueda reconoce mayúsculas, palabras sin tildes y sinónimos incluidos en el catálogo.

## Alcance

El catálogo contiene 41 destinos de navegación: Inicio, Mi espacio, Tutorías, gestión de tutorías, Apuntes, Proyectos, Foro, Perfil y Configuración, con sus pestañas principales. Busca módulos y opciones; no indexa el contenido de publicaciones, documentos ni perfiles de personas. Funciona localmente en el navegador y no requiere SQL, nuevos datos ni servicios externos.

Las pestañas se reflejan en `?tab=...`. Los intereses admiten `intent=interest`, `intent=learn` e `intent=teach`; las secciones de configuración usan un fragmento `#...`. Estos enlaces funcionan al navegar desde otro módulo o desde otra pestaña del mismo módulo. Abrir una lista desde el buscador cierra el detalle que se estuviera leyendo.

El catálogo se mantiene en `frontend/src/navigation/navigationSearch.ts`. Al agregar una pestaña, registra allí su título, ruta, descripción y palabras de búsqueda, y permite que el módulo lea la pestaña desde la URL.

## Comprobación

Las pruebas del frontend cubren las rutas de intereses, tildes, mayúsculas, sinónimos, consultas de varias palabras, cobertura de módulos y consultas sin resultados. La compilación TypeScript y la revisión estática comprueban la integración.

La comprobación de navegador utiliza los componentes y el enrutador reales con identidad y respuestas de servicios simuladas; no modifica cuentas ni datos remotos. Revisa navegación por teclado, foco, selección de intereses sin guardar, salida de detalles hacia listas y anchos de 320, 390, 960, 1280 y 1440 píxeles. Las capturas y el resultado se guardan en `docs/buscador-2026-11-09/`.

## Docker

El buscador forma parte del frontend. Después de cambiar el código, `docker-start.bat` reconstruye y levanta la aplicación. Abre **http://localhost** y recarga con **Ctrl + F5** si el navegador conserva la versión anterior. No es necesario repetir la activación de intereses ni cargar otra vez los datos DEMO.
