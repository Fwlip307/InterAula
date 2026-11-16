# Experiencia guiada de InterAula

El inicio propone un siguiente paso y tres intenciones: estudiar, pedir apoyo y participar. Los accesos importantes permanecen visibles. La jerarquía se obtiene con títulos, tarjetas y espaciado, sin agrupar la navegación dentro de desplegables.

## Recorridos

- **Inicio:** retoma una tarea en curso, después una ruta activa pendiente o una tarea pendiente. Si no hay actividad, invita a elegir materia. Las recomendaciones aparecen directamente, con tres tarjetas iniciales y un botón para ver todas las sugerencias recibidas. Cuenta, apoyos y lectura tienen enlaces visibles.
- **Estudiar:** las siete secciones están visibles y se distinguen por importancia visual. El resumen muestra el siguiente paso, rutas y tareas, progreso semanal, reporte PDF y material relacionado. Las listas de rutas y tareas presentan hasta tres elementos y un acceso al módulo completo.
- **Pedir apoyo:** tutores, talleres, agenda, quizzes y materiales se seleccionan directamente. Acreditación y gestión de tutorías tienen enlaces visibles.
- **Comunidad:** apuntes, foro y proyectos, junto con institución e intereses.
- **Cuenta:** se conserva el menú habitual de usuario, sin un segundo desplegable dentro.
- **Práctica adaptativa:** objetivo, progreso y mapa de conceptos visibles. Al iniciar una pregunta se conserva el enfoque automático en el ejercicio; al responder se vuelve a habilitar la selección del objetivo. Solo la simulación y la explicación técnica del motor se despliegan a petición.

El menú móvil sigue disponible en pantallas pequeñas; los cuatro destinos principales se muestran en la barra a partir de 1181 px.

## Continuidad y accesibilidad

Los enlaces directos a pestañas y el historial del navegador siguen funcionando. La ruta pendiente utiliza `tab=paths&path=<id>`. El enlace `/dashboard#para-ti` lleva a las recomendaciones visibles. Se conserva el salto al contenido, ubicación, foco del teclado, Modo Calma, lectura en voz alta y apoyos privados.

Un fallo parcial del inicio permite reintentar y seguir navegando. No hay cambios en acreditaciones, permisos ni reglas del motor adaptativo. No se requieren migraciones nuevas.

## Verificación de la revisión de accesos visibles

- Compilación del frontend e imagen final de Docker.
- 53 pruebas de frontend aprobadas; lint sin errores, con advertencias del proyecto.
- 8 recorridos en Chrome sobre páginas y AppRouter reales, con cuenta y servicios ficticios; sin escrituras en producción.
- Tamaños 320, 390, 768, 1181, 1280 y 1440 px; se revisó también la navegación de estudio a 320 px.
- Evidencia: `docs/visible-navigation-2026-11-15/`.
- La primera simplificación y sus pruebas anteriores se conservan en `docs/guided-2026-11-15/`.

Estas comprobaciones técnicas deben complementarse con pruebas de usabilidad con el público objetivo.

Referencia de diseño: [W3C, Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/).
