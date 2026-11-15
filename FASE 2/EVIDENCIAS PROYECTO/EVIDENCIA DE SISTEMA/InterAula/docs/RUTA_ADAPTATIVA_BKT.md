# Ruta adaptativa: grafo de conocimientos y BKT

## Implementación
Piloto privado de Cálculo en **Mi espacio de aprendizaje → Ruta adaptativa**, con acceso /learning-space?tab=adaptive y búsqueda global por “ruta adaptativa”, “grafo”, “BKT” o “Cálculo”.

- Diez conceptos y cuarenta ejercicios. El contenido y los prerrequisitos son editoriales, pendientes de revisión docente externa.
- Comprobación del objetivo, refuerzo de prerrequisitos ante una dificultad y recomendación explicable.
- Estimación bayesiana por concepto, objetivo persistente y recuperación del ejercicio pendiente.
- Pistas, lectura en voz alta, texto amplio y “No lo sé todavía”. Sin cronómetro ni expulsión por errores.
- Simulación explícita que no escribe en el progreso personal.
- Acceso al catálogo de tutores con búsqueda inicial “Cálculo” y filtro de acreditación. No asigna tutores ni comparte apoyos automáticamente.

La práctica no modifica el examen de acreditación ni otorga certificados.

## Modelo inicial
Se implementa inferencia **Bayesian Knowledge Tracing** en TypeScript y su equivalente transaccional en PostgreSQL. No instala Python ni entrena un modelo con datos reales. Referencia: [pyBKT](https://github.com/CAHLR/pyBKT).

| Parámetro de bkt-calculo-v1 | Valor inicial |
|---|---:|
| Prior de dominio | 0.20 |
| Aprendizaje | 0.10 |
| Acierto por azar | 0.25 |
| Error pese a dominar | 0.10 |
| Umbral provisional | 0.85 |
| Ejercicios distintos correctos sin pista | 3 |

Para probabilidad previa p, acierto por azar g, error pese a saber s y transición de aprendizaje t:

- Predicción antes de responder: P(acierto) = p·(1−s) + (1−p)·g.
- Tras acertar sin pista: p_observado = p·(1−s) / P(acierto).
- Tras fallar sin pista: p_observado = p·s / [p·s + (1−p)·(1−g)].
- Transición: p_nuevo = p_observado + (1−p_observado)·t.

Una respuesta con pista mantiene la estimación y no agrega evidencia independiente. Se registra como práctica acompañada. Repetir un ejercicio no aumenta el número de ejercicios distintos exigidos. “No lo sé todavía” registra una dificultad y permite reforzar sin abandonar.

Los conceptos sin respuestas muestran **Sin práctica**, sin porcentajes ficticios. Consolidar requiere umbral y evidencia mínima; no demuestra aprobación académica real.

Brier y pérdida logarítmica usan predicciones almacenadas **antes** de la respuesta y excluyen ejercicios con pista. Se calculan sobre las últimas 200 oportunidades consultadas. Describen predicción, no eficacia educativa.

## Grafo y recomendación
Se valida que no haya conceptos duplicados, prerrequisitos inexistentes ni ciclos. El piloto abarca ecuaciones, potencias, factorización, funciones, límites, definición de derivada, reglas de derivación y optimización.

1. Sin evidencia del objetivo, se propone una comprobación breve.
2. Ante una dificultad, se recorren los prerrequisitos hasta un concepto que convenga reforzar.
3. Se explica la ruta y se evita repetir ejercicios recientes cuando hay alternativas disponibles.
4. Al consolidar los prerrequisitos se vuelve hacia el objetivo.
5. Al consolidar el objetivo, se permite elegir otro. No se marcan como completados conceptos no practicados.

La selección es una heurística explícita sobre el grafo y las estimaciones BKT. No utiliza clustering ni un modelo de lenguaje para decidir dominio. La simulación aplica el mismo motor con historiales sintéticos.

## Persistencia y privacidad
La migración 024 crea:

- adaptive_learning_goals: objetivo por estudiante y curso.
- adaptive_skill_mastery: evidencia y estado por concepto, con versión de modelo.
- adaptive_practice_attempts: ejercicio privado, pista, respuesta y predicción previa.
- submit_adaptive_practice: función transaccional que califica y actualiza intento y modelo con bloqueos de fila.

Solo puede haber un ejercicio pendiente por usuario y curso. Repetir el envío de la misma respuesta devuelve la confirmación guardada; cambiar una ya confirmada produce conflicto. Las pistas se registran en el servidor. El cliente no decide aciertos, probabilidades, soluciones ni identidad.

No se entregan soluciones antes de responder. Los ejercicios privados no son legibles directamente por usuarios. El estado solo permite lectura del propietario y escritura desde los flujos del servidor. No se incorporan diagnósticos ni apoyos privados al modelo.

## Cómo probar
El usuario ejecutó ACTIVAR_APRENDIZAJE_ADAPTATIVO.sql y confirmó **Aprendizaje adaptativo activado**, motor_activado=true. Las tablas se verificaron con límite cero, sin leer progreso de estudiantes.

1. Abrir http://localhost/learning-space?tab=adaptive con sesión iniciada; recargar con Ctrl+F5 tras actualizar Docker.
2. Pulsar **Ver simulación del motor** para comparar recomendaciones sin escribir datos personales.
3. Elegir un objetivo y **Practicar este concepto**.
4. Responder o usar **No lo sé todavía** y observar el refuerzo recomendado.
5. Consultar una pista para distinguir práctica acompañada e independiente.
6. Recargar con un ejercicio pendiente: debe recuperarse el mismo intento.
7. Consultar **Cómo funciona el motor** para ver parámetros y métricas propias.

Si falta la activación se conserva un mapa y simulación de lectura, y se deshabilita el inicio. No se guarda avance local como sustituto de Supabase.

## Archivos principales
- backend/src/data/adaptiveCurriculum.ts: catálogo y ejercicios.
- backend/src/services/adaptiveEngine.ts: grafo, BKT y decisiones.
- backend/src/services/adaptiveLearning.service.ts: persistencia y selección.
- backend/src/routes/adaptiveLearning.routes.ts: API privada bajo /api/learning-space/adaptive.
- frontend/src/pages/learning/components/AdaptiveLearningPanel.tsx: práctica.
- frontend/src/pages/learning/components/AdaptiveKnowledgeMap.tsx: mapa y lista móvil.
- supabase/migrations/024_adaptive_learning_graph.sql: transacciones y permisos.

## Validación y próximos pasos
Se prueban las fórmulas y extremos, DAG, banco, diferencias entre historiales, identidad, cuerpos estrictos, soluciones ocultas, recuperación, RLS, idempotencia, pistas y concordancia SQL/TypeScript. La activación se ejecuta dos veces sin perder intentos.

Las pruebas visuales usan componentes reales con respuestas sintéticas calculadas por el motor de producción, sin escribir datos reales. Cubren error y reintento, cambios de recomendación, pistas, recuperación, separación de cuentas y escritorio/móvil.

Antes de ampliar: validar contenido con docentes, hacer pruebas de accesibilidad con estudiantes y comparar contra una ruta fija. Para ajustar parámetros se necesitarán interacciones consentidas, separación cronológica y estudiantes reservados para evaluación. No se atribuyen mejoras de rendimiento o bienestar sin evidencia.

