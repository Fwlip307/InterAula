# K-Means para encontrar tutores

Implementado y comprobado el 15 de noviembre de 2026. Es un piloto de recomendación de tutores por valoraciones. «Para ti» conserva su motor de afinidad por intereses; el aprendizaje adaptativo de Cálculo y Gemini siguen siendo componentes distintos.

## Probarlo en la aplicación

1. Abre http://localhost e inicia sesión.
2. Entra en **Pedir apoyo → Encontrar un tutor**.
3. En **¿Qué valoras más en una tutoría?**, elige perfil equilibrado, explicaciones claras, dominio del tema o puntualidad. «Orden habitual» desactiva la priorización.
4. Usa la búsqueda y el filtro de materia. La recomendación no habilita materias sin acreditar.
5. Para ver resultados aunque todavía no haya valoraciones reales, pulsa **Probar con datos DEMO** y cambia la prioridad. El ejemplo utiliza Python/scikit-learn real, con 18 vectores ficticios. No crea usuarios, tutorías ni reseñas en Supabase y no permite reservar esos perfiles.

La comprobación remota de esta iteración encontró **0 tutores disponibles con materias acreditadas** en el catálogo público. Por eso la comunidad devuelve catálogo sin clustering; el ejemplo DEMO sí está operativo. Esto no afirma que no existan cuentas o acreditaciones en el proyecto: solo describe los resultados de esa consulta.

## Funcionamiento y decisiones

| Paso | Implementación |
| --- | --- |
| Elegibilidad | Tutor disponible y al menos una materia acreditada. Se excluye al usuario que busca y se respetan los filtros de materia, texto y formación inclusiva. |
| Datos | Promedios 1–10 de comunicación, dominio y puntualidad de las valoraciones existentes. Mínimo 3 reseñas por tutor y 6 tutores elegibles con promedios válidos. Son límites iniciales del prototipo, no umbrales validados con estudiantes. |
| Población | Se ajusta con el catálogo disponible, antes de los filtros de búsqueda. Máximo 500 vectores, seleccionados por cantidad de reseñas e ID para estabilizar la muestra. Este límite puede favorecer perfiles con más reseñas y debe revisarse al crecer. |
| Modelo | StandardScaler y KMeans de scikit-learn 1.7.1. Semilla 42, n_init=20, max_iter=200; se comparan 2–4 grupos y se elige el mayor silhouette. Se rechazan grupos de un solo integrante y estructura menor a 0,15. |
| Orden | La preferencia explícita ordena los centroides por el criterio elegido y después los perfiles de cada grupo por su promedio individual. «Equilibrado» usa la media de los tres criterios. K-Means agrupa; la regla de ordenación es una decisión separada de producto. |
| Nuevos tutores | Se reserva una posición de cada cinco, cuando existen, a perfiles sin suficientes reseñas. No se les asigna una nota inventada. Todos los perfiles filtrados permanecen en el catálogo. |
| Respaldo | Si faltan datos, son homogéneos, no forman grupos claros o Python falla/no responde en 5 segundos, se devuelve el catálogo sin agrupación con una explicación. |
| Caché | Estadísticas 30 segundos, invalidadas al guardar una reseña en esta instancia. Modelo numérico en memoria hasta 5 minutos, máximo 8 matrices. No se persiste un archivo de modelo. |

Los grupos no son niveles de acreditación ni categorías de personas. El modelo no determina que un tutor sea adecuado para TEA/TDAH/dislexia: las necesidades de apoyo y la formación inclusiva se gestionan explícitamente por separado. Las valoraciones pueden ser escasas o sesgadas; no sustituyen una revisión de conocimientos o de evidencia.

El valor silhouette del DEMO (0,944431 en esta ejecución) describe separación entre vectores sintéticos construidos para mostrar tres patrones. No es una tasa de acierto ni demuestra mejora educativa, calidad de recomendaciones reales o eficacia clínica. Los empates numéricos pueden cambiar el orden entre perfiles prácticamente idénticos según plataforma; el patrón prioritario y los grupos se comprobaron tanto en Windows como en Linux.

## Arquitectura y privacidad

React → API Express autenticada → estadísticas agregadas existentes → servicio Python interno → explicación y catálogo.

- GET /api/tutoring/recommendations y /api/tutoring/recommendations/demo requieren sesión; admiten parámetros validados y un límite compartido de 60 solicitudes/minuto por usuario.
- La API usa su clave administrativa existente solo para leer una proyección de tutor_statistics_view de tutores públicos disponibles. No consulta comentarios ni identidades de estudiantes para entrenar.
- Python recibe únicamente una matriz de tres números por fila: sin IDs, nombres, correos, diagnósticos, claves o preferencias individuales.
- El contenedor ML no publica puerto al equipo anfitrión, no recibe claves Supabase/Gemini y corre con usuario sin privilegios.
- No consume cuota de Google ni necesita migración SQL nueva. La clave administrativa del backend debe estar configurada para leer estadísticas cuando haya tutores.

## Ejecución y reproducción

Desde la raíz de la aplicación, el docker-start.bat existente incorpora automáticamente el tercer servicio. Comando equivalente si la configuración privada está en backend/.env:

    docker compose --env-file backend/.env up -d --build
    docker compose ps

Frontend en http://localhost; backend en el puerto configurado; ML solo en la red interna de Compose. Los tres contenedores quedaron saludables en esta verificación.

Para desarrollo sin Docker, instala ml/requirements.txt en un entorno Python 3.13 y ejecuta python ml/server.py. Configura ML_SERVICE_URL=http://127.0.0.1:8000 en el backend. La aplicación mantiene el catálogo si ese servicio no se inicia.

    npm run test:all
    npm run build:all
    npm run lint
    python -m unittest discover -s ml -p test_engine.py

Si Docker interrumpe descargas TLS, el helper opcional ml/download-wheels.ps1 descarga los cinco wheels Linux x86_64 fijados y verifica SHA256 contra PyPI, manteniendo la validación HTTPS. Ejecutarlo con PowerShell desde la raíz y volver a construir ML. La caché local ml/wheels está ignorada por Git; no se necesita en instalaciones normales con acceso a PyPI. Para ARM, usar la instalación normal del Dockerfile.

## Verificación realizada

- 62 pruebas frontend y 125 backend aprobadas; 9 Python aprobadas: **196 pruebas automáticas**.
- Compilación frontend/backend correcta. Lint termina sin errores; conserva advertencias del repositorio. La compilación conserva la advertencia de paquetes JavaScript grandes.
- Express → Python real: tres prioridades, filtro de materia, inclusión de tutor nuevo, autenticación, validación de parámetros y respaldo sin ML.
- React → HTTP → Express → Python: 8 comprobaciones de navegador, cambio de orden y DEMO, error/reintento, respuesta tardía al cerrar y dimensiones 320/390/768/1440; capturas en claro, oscuro y Calma.
- Docker → Python: tres patrones sintéticos correctos. Catálogo/estadísticas remotas consultados sin escrituras. Ningún dato DEMO se insertó en Supabase.

Evidencias en **docs/kmeans-2026-11-15/**: integration-verification.json, browser-verification.json, docker-runtime-verification.json y capturas kmeans-*.png. Los scripts de navegador/integración usan identidad y catálogo sintéticos aislados; no prueban una sesión real de estudiante. docker-probe.mjs es la comprobación interna de Docker; ejecutar su contenido por stdin a node --input-type=module dentro del backend. Los logs de compilación/pruebas son locales y están ignorados por Git.

## Pendientes del piloto

Recoger reseñas auténticas de tutorías finalizadas, comprobar utilidad con estudiantes y comparar esta priorización con un orden directo por promedio y con el catálogo habitual. Medir cobertura, exposición de tutores nuevos, aceptación de sugerencias y satisfacción voluntaria; revisar si el agrupamiento aporta valor frente a esas bases simples. Falta completar el ciclo de tutoría entre dos cuentas reales. No se ha ampliado K-Means a apuntes, proyectos ni intereses.

## Referencias técnicas

El pipeline se apoya en la documentación oficial de [KMeans 1.7](https://scikit-learn.org/1.7/modules/generated/sklearn.cluster.KMeans.html), [StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html) y [silhouette_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html). Los parámetros, umbrales, respaldo y reglas de orden descritos arriba corresponden a esta implementación.

