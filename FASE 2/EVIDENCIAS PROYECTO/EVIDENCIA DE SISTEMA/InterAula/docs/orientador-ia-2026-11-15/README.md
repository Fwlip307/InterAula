# Orientador conversacional con Gemini — 15/11/2026

El orientador llama a Google Gemini a través del backend autenticado. Los recorridos manuales se inician por elección del estudiante. La guía de acreditación va al perfil y no a la búsqueda de tutores. El chat permite conversación académica breve y preguntas de seguimiento; no consulta registros de la cuenta ni ejecuta acciones.

## Verificación realizada

- Backend: 116/116 pruebas. Frontend: 61/61.
- Compilaciones de frontend/backend correctas; análisis estático sin errores, con avisos del repositorio.
- Navegador: 10 comprobaciones con UI real, servicios de prueba y respuestas de IA simuladas. Incluye el recorrido de perfil, historial, errores/reintentos, cancelación, evaluaciones, cambio de cuenta y pantallas 320/390/768/1440 px en claro/oscuro/Calma.
- Gemini real: conversación ficticia de cuatro mensajes con la configuración existente. Evidencia: gemini-smoke.json.
- Gemini real dentro del contenedor: ofrecer tutorías → become-tutor. Evidencia: docker-gemini-smoke.json.
- Docker reconstruido: frontend/backend running/healthy; GET http://localhost/api/health respondió 200. Sin escrituras en Supabase ni nuevas migraciones.

## Reproducir

Desde la raíz de la app:

```powershell
npm --prefix backend test
npm --prefix frontend test
npm run build:all
node docs/orientador-ia-2026-11-15/live-probe.mjs
```

La última orden requiere compilar el backend y tener la configuración privada en backend/.env. Hace cuatro solicitudes reales; solo imprime mensajes ficticios y respuestas, nunca claves.

browser-fixture.mjs requiere Vite en 127.0.0.1:5175 y Chrome aislado con depuración en 9235; usa el runner tsx del backend para importar el currículo TypeScript. No usa una cuenta real ni permite escrituras. La voz está simulada: no prueba pronunciación.

Contrato y limitaciones: ../ORIENTADOR_PASO_A_PASO.md. Las instrucciones reducen respuestas ajenas al ámbito, pero el modelo puede equivocarse. No se garantiza el mismo texto o las mismas sugerencias en cada ejecución.
