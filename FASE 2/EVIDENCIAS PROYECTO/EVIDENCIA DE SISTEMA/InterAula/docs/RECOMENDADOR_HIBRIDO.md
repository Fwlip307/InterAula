# Recomendador híbrido de InterAula

Implementación y verificación del 16 de noviembre de 2026.

## Cómo probarlo

1. Abre http://localhost, inicia sesión y entra en **Inicio → Para ti**.
2. Elige tus temas en **Ajustar mis intereses**. Se conservan «Me interesa», «Quiero aprender», «Puedo compartir» y el control para desactivar la personalización.
3. En **Cambiar comunidad o modalidad**, elige institución, sede y alcance: toda la comunidad, institución, sede o sedes de la misma comuna.
4. Cada tarjeta explica su coincidencia por tema y, cuando corresponde, su afinidad con un grupo y su relación con la comunidad.
5. **Probar ejemplo de intereses y cercanía** permite alternar Python/datos, web/diseño y marketing/administración, además de toda la comunidad, sede o comuna. No cambia preferencias, no inserta registros y no permite contactar los perfiles ficticios.

El ejemplo es opcional y separado del feed. Cambiar su selección no guarda nada en Supabase. Si hay pocos perfiles reales con temas públicos, las sugerencias reales siguen usando afinidad y comunidad, con un aviso claro.

## Qué combina

| Componente | Función |
| --- | --- |
| Afinidad explícita | Mantiene la selección de intereses, intenciones de aprender/compartir y materias a reforzar. Es el requisito de entrada: un grupo no hace elegible un tema ajeno. |
| K-Means de intereses | Agrupa vectores binarios de temas de personas públicas disponibles para tutorías o proyectos. Usa solo intereses publicados voluntariamente y materias acreditadas ofrecidas públicamente. |
| Contenidos | Apuntes, foro, proyectos y talleres se representan con temas detectados en sus metadatos autorizados y se comparan localmente con los centroides. No se envían títulos, archivos ni cuerpos al servicio ML. |
| Comunidad | Respeta primero alcance y modalidad. Después prioriza misma sede, misma comuna/región o misma institución entre coincidencias pertinentes. La referencia es la sede elegida, no una dirección residencial. |
| Acreditación | Continúa siendo una regla independiente. Agrupar intereses no acredita materias ni formación inclusiva. Una materia ofrecida sin verificar no sirve como prueba de conocimientos para esta recomendación. |
| Valoraciones | El buscador de tutores conserva su modelo anterior de comunicación, dominio y puntualidad. Es otro pipeline; esta ampliación está integrada en «Para ti». |

La cercanía se resuelve por reglas explícitas y catálogo académico, no por K-Means sobre coordenadas. No mide kilómetros ni usa GPS. «Toda la comunidad» conserva las coincidencias de otras instituciones; en modalidad online y alcance global no se aplica el bono geográfico.

## Modelo y ordenación

- Catálogo de temas ordenado por ID; una dimensión por tema, máximo 128.
- Hasta 150 perfiles públicos, procedentes de la consulta existente de personas disponibles. Se excluyen el propio perfil, duplicados, personas ocultas y vectores sin temas públicos.
- Mínimo 6 vectores y al menos dos patrones distintos. Los límites son decisiones iniciales del prototipo, pendientes de evaluación.
- Normalización L2 → KMeans de scikit-learn 1.7.1, semilla 42, n_init=20, max_iter=200.
- Se comparan 2–4 grupos por silhouette; se descartan grupos de un solo integrante y separación menor a 0,15.
- El número de grupos se calcula; los tres conjuntos temáticos del DEMO no fuerzan tres clusters. Esta ejecución seleccionó cuatro al distinguir combinaciones de temas dentro de una familia.
- La consulta del usuario se forma **solo en Express**: aprender/reforzar pesa 1,5, interés 1 y compartir 0,75. No sale hacia Python.
- Se asigna cada oportunidad al centro temático más similar por coseno. Si consulta-centro ≥ 0,35 y oportunidad-centro ≥ 0,45, se suma hasta 2 puntos al score de afinidad.
- La prioridad de comunidad suma hasta 1,5 puntos (0,5 × prioridad 0–3), después del filtro estricto de alcance. Se conserva variedad entre tipos de resultados.
- Sin personalización no hay consulta al modelo ni bonos de grupos: se muestran novedades y se mantienen los filtros de comunidad que el usuario eligió.
- Datos escasos, homogéneos, sin grupos claros, respuesta inválida o timeout de 5 segundos → afinidad directa y comunidad. No se simulan clusters.

El agrupamiento ayuda a ordenar coincidencias existentes. No incorpora por sí solo temas que el usuario no eligió. La complementariedad entre quien aprende y quien comparte se conserva en el motor de reglas, no se confunde con pertenencia al mismo grupo.

## Privacidad y operación

La API del feed usa el JWT del usuario y las políticas RLS existentes. Los intereses privados de otras personas no se consultan; la vista discoverable_topic_interests exige que cada persona active compartir temas y personalización.

Python recibe únicamente una matriz de ceros y unos. No recibe IDs, nombres, correos, consultas privadas, ubicación, intenciones individuales, diagnósticos ni claves. Las materias verificadas son datos publicados como oferta de tutoría. Los centroides y la comparación personal quedan en el backend; el cliente recibe una explicación y estado del modelo, sin etiquetas de grupo por persona.

El servicio ML corre sin privilegios, no publica puerto fuera de la red Docker y no tiene credenciales de Supabase ni Google. Los resultados numéricos se conservan en memoria hasta cinco minutos, con un máximo de ocho matrices. No hay archivos de modelos ni un nuevo historial de comportamiento.

No consume cuota de Gemini ni necesita un script SQL nuevo. Se utilizan las migraciones de intereses y comunidad que ya estaban activadas. Docker sigue iniciándose con el docker-start.bat de la raíz del repositorio.

## Restauración realizada

El commit 14227a4 eliminó accidentalmente 482 archivos de la aplicación. Con autorización del usuario se recuperaron únicamente los destinos ausentes desde 88edc44, sin sobrescribir archivos existentes, cambiar ramas ni reescribir el historial.

El usuario autorizó por separado recuperar backend/.env desde el contenedor local existente. Se guardó solo en el archivo privado ignorado por Git y no se imprimieron sus valores. Se reconstruyó también la configuración pública de desarrollo del frontend; ambos archivos siguen excluidos de Git.

Los archivos recuperados aparecen como nuevos en el árbol de trabajo porque el último commit los había eliminado. No se hizo commit ni push de la restauración o de esta ampliación. Las dependencias y artefactos se regeneraron. Una descarga PDF falló por TLS; se completó mediante rangos HTTPS, con SHA512 verificado contra package-lock, sin desactivar validación de certificados.

## Validación y evidencia

- **210 pruebas automáticas aprobadas:** 62 frontend, 133 backend y 15 Python.
- Compilación frontend/backend correcta. Lint sin errores; conserva advertencias del repositorio y las habituales del tamaño de los bundles.
- Express → Python real: nueve escenarios (tres familias de intereses × tres alcances), feed híbrido y respaldo al desconectar ML.
- React y cliente HTTP reales: seis comprobaciones de navegador, incluyendo cambio de temas/alcance, ausencia de enlaces de contacto en el DEMO, error/reintento y cierre con respuesta pendiente.
- Diseño comprobado en 320, 390, 768 y 1440 px, en claro, oscuro y Calma.
- Backend Docker → Python Docker: nueve escenarios sintéticos correctos. Los tres contenedores quedaron saludables.
- Verificación de los endpoints a través de Nginx: el DEMO requiere autenticación. No se insertaron registros ni se hicieron llamadas a Gemini.

Evidencias en docs/hybrid-2026-11-16/: integration-verification.json, browser-verification.json, docker-verification.json y capturas hybrid-*.png. Los scripts de navegador/integración simulan identidad y respuestas de Supabase; ejecutan el componente, cliente HTTP, Express y Python reales. Su alcance no equivale a una prueba con estudiantes reales.

Reproducción automática desde la raíz de la aplicación:

    npm run test:all
    python -m unittest discover -s ml -p 'test_*.py'
    npm run build:all
    npm run lint

La prueba aislada integration-probe.mjs requiere backend compilado y Python en 127.0.0.1:8001; --serve deja la API sintética en 127.0.0.1:3002 para browser-fixture.mjs. El navegador usa Chrome aislado en 9235 y Vite en 5175. docker-probe.mjs se ejecuta por stdin dentro del backend Docker y no accede a Supabase.

## Límites del piloto

La agrupación usa una muestra limitada de personas que comparten temas o acreditaciones públicas; no representa a toda la comunidad y puede favorecer perfiles disponibles o recientemente actualizados. Los temas se detectan por catálogo y aliases, no por comprensión semántica de documentos. Los centroides no prueban capacidad docente ni que dos personas vayan a colaborar bien.

Los datos DEMO solo verifican funcionamiento. Falta comparar utilidad con afinidad directa y medir satisfacción/cobertura con participación voluntaria de estudiantes. No se ha demostrado mejora educativa ni eficacia clínica y no se infieren TEA, TDAH o dislexia. Sigue pendiente un ciclo completo de tutoría entre dos cuentas reales.

