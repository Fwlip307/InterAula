# Guía de uso de InterAula

El inicio privado y la presentación pública incluyen el componente AppOverview: tres áreas principales con acciones concretas y accesos visibles a apoyos, recomendaciones y acreditación. La presentación propone tres pasos opcionales para empezar.

La guía completa está en /guide, es pública y se puede abrir desde el inicio, la presentación, el menú de cuenta y el buscador global. Contiene siete áreas, veinte enlaces directos, ejemplos cotidianos y un índice por temas. Las secciones se muestran directamente y la introducción dispone de lectura en voz alta.

Contenido completo: frontend/src/content/productGuide.ts.
Vista de la guía: frontend/src/pages/ProductGuide.tsx.
Resumen de inicio: frontend/src/components/common/AppOverview.tsx.

El inicio incluye una bienvenida con fotografía en StudyWelcome. Las tres áreas tienen fotografías locales, iconos y ejemplos breves; el bloque de práctica adaptativa explica el recorrido en tres pasos. Los apoyos, intereses y acreditación permanecen visibles. Modo Calma utiliza superficies sobrias y fotografías menos saturadas; el modo oscuro mantiene acentos adaptados al fondo.

La revisión visual se verificó con 53 pruebas de frontend y 11 recorridos de navegador, incluyendo imágenes cargadas, pantallas de celular y los modos claro, oscuro y Calma. Evidencia: docs/visual-overview-2026-11-15/.

Al actualizar funciones, mantener las explicaciones acordes con el comportamiento real: el motor adaptativo es un piloto de Cálculo; practicar o declarar intereses no acredita como tutor; cada materia requiere acreditación; la formación inclusiva necesita evidencia y revisión autorizada. Personalizar los apoyos es opcional y no exige declarar diagnósticos.

Verificación: compilación del frontend, 53 pruebas aprobadas, lint sin errores y 10 recorridos de navegador con servicios ficticios. Se comprobaron enlaces, navegación por sección, guía sin sesión y vista de celular. No se realizaron escrituras en producción. Docker y las rutas /guide, /dashboard, / y /api/health responden correctamente.

Evidencia: docs/product-guide-2026-11-15/.
No requiere migraciones de Supabase.
