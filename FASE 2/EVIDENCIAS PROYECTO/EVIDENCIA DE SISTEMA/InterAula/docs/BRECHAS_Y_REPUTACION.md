# Brechas y propuesta de reputación — 16 de noviembre de 2026

**Nueva iteración:** implementados el centro privado de incidencias, revisión/apelación y bandeja interna. Activación remota confirmada por el usuario y estructura verificada sin leer registros. La designación de responsables sigue pendiente. El correo continúa pendiente. La ampliación de [medidas de convivencia](MEDIDAS_DE_CONVIVENCIA.md) ya está implementada y activada: sanciones revisadas por personas autorizadas, vencimientos y apelación independiente. [Estado y pruebas](INCIDENCIAS_Y_AVISOS.md).

**Iteración posterior completada:** implementados cierre verificable, conservación de trayectoria y calidad dinámica con política publicada. [Estado actual y validación](REPUTACION_Y_SESIONES_VALIDAS.md). Los hallazgos que siguen documentan la revisión anterior; gestión de reportes y avisos continúan pendientes.

Revisión de código y del documento APT compartido por el usuario. No se reprodujeron datos personales. Esta revisión no cambia reglas, insignias o registros de Supabase.

## Conclusión

La base funcional del MVP está implementada. No corresponde afirmar que todo el alcance está validado para operación real: faltan gestión de calidad, atención de incidencias, notificaciones efectivas y ensayos completos con cuentas/dispositivos reales. Las 210 pruebas aprobadas corresponden a la iteración anterior; no se volvieron a ejecutar en esta revisión de lectura.

## Documento y estado

| Compromiso del documento | Estado observado |
| --- | --- |
| Acceso, perfiles de habilidades y autenticación externa | Implementados; falta cerrar confirmación/recuperación y ciclo de uso con cuentas reales. |
| Tutorías y materiales sin monedas | Implementados; los acuerdos del Hub no son una pasarela de pagos. |
| Insignias por 10, 25 y 50 sesiones | Implementadas; existe también una por la primera sesión. El trigger cuenta estados completed y no consulta notas. |
| Valoración 1–10 de comunicación, dominio y puntualidad | Implementada, con promedio SQL; estudiante participante, sesión completada y unicidad de reseña. |
| Perfil automático de fortalezas | Existen promedios por criterio y general; falta un resumen comprensible de trayectoria reciente, cantidad de evaluadores y confianza de la estimación. |
| K-Means sobre valoraciones para tutores y cursos | Implementado para ordenar tutores. Los talleres de Para ti usan temas/comunidad; no hay evidencia de que el clustering de valoraciones evalúe o recomiende cursos como unidad propia. Ajustar la afirmación del informe o completar esa relación. |
| Hub de Proyectos y materiales | Implementados; falta probar colaboración y entregables con dos cuentas reales. |
| Inclusión y aprendizaje adaptativo | Hay apoyos opcionales y piloto adaptativo de Cálculo; no es cobertura de todas las materias ni eficacia educativa demostrada. |
| Uso operativo en nube | Supabase remoto y ejecución Docker local; la operación pública requiere validar dominio/HTTPS, recuperación de datos, supervisión y responsables. |

## Hallazgos concretos

1. **Cantidad no equivale a calidad.** handle_award_tutoring_badges en 002_tutoring_and_badges.sql otorga los hitos por número de sesiones completadas. Una nota mala no revoca el hito. La insignia de 50 sesiones se llama «Mentor de Excelencia» sin exigir una valoración mínima: conviene renombrarla como trayectoria.
2. **No hay circuito completo de gestión de mala experiencia.** Hay reseñas y cancelaciones; no se encontró una integración de reporte de sesión/contenido, expediente, responsable, resolución, medidas graduadas y apelación.
3. **Cerrar una sesión no prueba por sí solo que ocurrió.** La política activa reserva el cierre al tutor y prohíbe hacerlo antes del inicio programado. Existe registro de asistencia con cálculo del servidor, pero el otorgamiento de insignias no exige asistencia verificada, confirmación de ambas partes o resolución de una incidencia. Debe admitir evidencia alternativa para tutorías presenciales o fuera del aula virtual.
4. **Avisos declarados sin entrega observada.** Settings ofrece emailTutoring y emailProjects; el contrato los guarda, pero no se encontró un flujo de entrega de esos avisos asociado a solicitudes/aceptaciones/proyectos. Preferencia guardada no demuestra envío.
5. **Excepción histórica a la reputación automática.** La migración 010 contiene acreditación y concesión manual de insignias a una cuenta concreta. Debe revisarse para separar datos de demostración/provisión histórica de reglas productivas. No se consultó si fue ejecutada ni se retiró ningún reconocimiento.
6. **El sistema conserva textos técnicos o históricos demasiado fuertes.** Por ejemplo, expresiones de auditoría «criptográfica» del aula no sustituyen evidencia de asistencia ni certificación educativa. Revisar la redacción frente a la implementación activa.

## Propuesta de reputación: tres dimensiones separadas

- **Acreditación:** qué asignaturas puede impartir, mediante evaluación o evidencia revisada. Una nota baja no borra automáticamente una acreditación.
- **Trayectoria:** hitos 1/10/25/50 de sesiones válidas. Se conservan como hechos históricos; un expediente de fraude confirmado puede requerir invalidar la evidencia y recalcularlos.
- **Calidad reciente:** reconocimiento dinámico y explicable. Puede quedar inactivo cuando deja de cumplirse la regla, sin borrar reseñas legítimas ni etiquetar públicamente al tutor.

Ejemplo para discutir y validar, todavía sin implementar: «Comunicación destacada» requiere promedio ajustado de comunicación ≥ 8,5/10, al menos 10 reseñas válidas de 5 estudiantes distintos en los últimos 90 días. Los números son una propuesta inicial, no una política vigente ni una regla educativa validada. Debe contemplar caducidad natural, baja actividad y revisiones de fraude.

Para valorar y ordenar: mostrar media y tamaño de muestra; usar un promedio regularizado para evitar que una sola nota 10 supere automáticamente una trayectoria consistente; ofrecer también detalle por criterio. K-Means agrupa patrones y no sustituye una política de calidad o de moderación.

## Manejo propuesto de notas bajas y reportes

| Situación | Respuesta propuesta |
| --- | --- |
| Una reseña baja aislada | Registrar, actualizar promedios y explicar el criterio. Ofrecer una respuesta del tutor y un plan de mejora; no suspender automáticamente. |
| Patrón reciente de notas bajas con muestra suficiente | Aviso privado, recomendaciones de mejora y revisión del reconocimiento de calidad según la regla publicada. No borrar reseñas por ser negativas. |
| Inasistencia o incumplimiento de acuerdos | Incidencia vinculada a una sesión y evidencia; seguimiento y medidas graduadas tras revisión. |
| Acoso, fraude o riesgo grave reportado | Canal privado prioritario, evaluación humana y medidas preventivas justificadas cuando correspondan. No depender del promedio ni dar por probado el hecho solo por un reporte. |
| Reseñas coordinadas, duplicadas o fraudulentas | Registro de revisión; excluir del cálculo solo con motivo trazable y posibilidad de impugnación. |
| Desacuerdo con una medida | Expediente con estado, explicación, responsable y apelación. |

Los umbrales y medidas requieren responsables reales de moderación. La decisión anterior de mantener solicitudes de formación inclusiva pendientes sigue vigente hasta designar revisores autorizados.

## Orden de implementación recomendado

1. **Reputación y validez de sesiones:** distinguir trayectoria/calidad/acreditación, mejorar el cierre y publicar criterios. Criterio de aceptación: una mala reseña conserva el hito histórico pero modifica la calidad de forma explicable; una sesión no acreditable no infla logros.
2. **Centro de gestión:** panel privado con permisos para solicitudes, evidencia, reportes y apelaciones, estados, plazos y auditoría. Criterio: ninguna medida depende de un cambio manual sin registro o de un rol enviado por el navegador.
3. **Avisos reales:** bandeja de acciones pendientes, confirmaciones, cancelaciones y recordatorios, con preferencias, modo silencioso y sin duplicados; correo opcional con entrega/reintentos observables.
4. **Cerrar flujos con dos cuentas:** reserva → aceptación → sesión/presencial → cierre → reseña → promedio → insignia → recomendación. Después aula en dos dispositivos, proyecto compartido y revisión de evidencias.
5. **Orden interno y operación:** extraer pantallas grandes por funciones, centralizar permisos/estados/políticas en servidor, conservar cuatro destinos principales y un solo lugar para gestionar tutorías; registrar errores/latencia/disponibilidad de ML/IA y ensayar respaldo/restauración. Guardar la restauración actual en control de versiones antes de otra ronda grande de cambios.

## Organización visible sugerida

Conservar Inicio, Estudiar, Pedir apoyo y Comunidad. Perfil/Ajustes mantienen preferencias y acreditaciones. Un bloque «Tu siguiente acción» puede reunir solicitudes por responder, próximas sesiones, tareas y valoraciones pendientes, enlazando al módulo correspondiente. No duplicar formularios ni esconder funciones importantes en acordeones.

La reputación del tutor debería mostrar, juntas, materias acreditadas, sesiones válidas, puntuación por criterio y número de estudiantes que evaluaron. «Ver trayectoria» y «Cómo se calcula» pueden ampliar la explicación; la información esencial permanece visible.

