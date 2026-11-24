import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessmentCatalog } from '../data/assessmentCatalog.js';
import {
  buildAccreditationPrompt,
  buildAccreditationQuestions,
  normalizeGeneratedPayload,
  resolveGeminiModels,
  resolveSubjectContext,
} from '../services/accreditationQuestions.service.js';
import { aiBackendService } from '../services/ai.service.js';

test('Cobertura universal del catálogo: las 1.000 materias y 42 áreas resuelven contexto académico real sin dependencia única', () => {
  assert.equal(assessmentCatalog.length, 1000);
  const areas = new Set(assessmentCatalog.map((item) => item.area));
  assert.equal(areas.size, 42);

  for (const subject of assessmentCatalog) {
    const context = resolveSubjectContext(subject.name, subject.area);
    assert.equal(context.inCatalog, true);
    assert.equal(context.subjectName, subject.name);
    assert.equal(context.areaSlug, subject.area);
    assert.ok(context.areaLabel.length >= 4);
    assert.ok(context.relatedSubjects.length >= 1);
    assert.ok(context.questionMix.length > 20);
  }
});

test('Generación IA universal: una asignatura representativa de cada una de las 42 áreas genera 10 preguntas válidas y específicas', async (t) => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'mock-universal-key';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  t.after(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prevModel;
  });

  // Tomar la primera asignatura de cada una de las 42 áreas reales del catálogo
  const seenAreas = new Set<string>();
  const sampleSubjects = assessmentCatalog.filter((s) => {
    if (seenAreas.has(s.area)) return false;
    seenAreas.add(s.area);
    return true;
  });
  assert.equal(sampleSubjects.length, 42);

  const promptsSent: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any, options: any) => {
    assert.equal(String(url).includes('mock-universal-key'), false);
    assert.equal(options.headers['x-goog-api-key'], 'mock-universal-key');
    const promptText: string = JSON.parse(options.body).contents[0].parts[0].text;
    promptsSent.push(promptText);
    const subjectMatch = promptText.match(/asignatura "([^"]+)"/);
    const subjectName = subjectMatch?.[1] || 'Asignatura';
    const payload = {
      questions: Array.from({ length: 10 }, (_, idx) => ({
        prompt: `Pregunta evaluativa número ${idx + 1} sobre conceptos y aplicación en ${subjectName}`,
        options: [
          { id: 'A', text: `Respuesta técnica correcta ${idx + 1} para ${subjectName}` },
          { id: 'B', text: `Distractor conceptual ${idx + 1}A` },
          { id: 'C', text: `Distractor conceptual ${idx + 1}B` },
          { id: 'D', text: `Distractor conceptual ${idx + 1}C` },
        ],
        correctOptionId: 'A',
        explanation: `Justificación académica verificable para la pregunta ${idx + 1} de ${subjectName}.`,
        topic: `Fundamentos ${idx + 1}`,
        difficulty: 'basic',
      })),
    };
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    } as Response;
  });

  for (const subject of sampleSubjects) {
    const result = await buildAccreditationQuestions(subject.name, subject.area);
    assert.equal(result.source, 'generated');
    assert.equal(result.questions.length, 10);
    assert.equal(result.context.areaSlug, subject.area);
    assert.ok(result.questions.every((q) => q.subject === subject.name));
    assert.ok(result.questions.every((q) => q.options?.length === 4 && q.options.some((o) => o.id === q.correctOptionId)));
  }
  assert.equal(promptsSent.length, 42);
});

test('Respaldo automático de modelo Gemini cuando el modelo configurado responde 404 (ej. modelo inválido o retirado)', async (t) => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'mock-fallback-key';
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  t.after(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prevModel;
  });

  const models = resolveGeminiModels();
  assert.equal(models[0], 'gemini-3.5-flash-lite');
  assert.ok(models.includes('gemini-2.5-flash'));

  const calledUrls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    const u = String(url);
    calledUrls.push(u);
    if (u.includes('gemini-3.5-flash-lite')) {
      return { ok: false, status: 404, json: async () => ({ error: { message: 'Model not found' } }) } as Response;
    }
    const rows = Array.from({ length: 10 }, (_, idx) => ({
      prompt: `Caso práctico ${idx + 1} de Derecho Constitucional chileno sobre garantías fundamentales`,
      options: [
        { id: 'a', text: `Alternativa correcta ${idx + 1}` },
        { id: 'b', text: `Alternativa incorrecta ${idx + 1}B` },
        { id: 'c', text: `Alternativa incorrecta ${idx + 1}C` },
        { id: 'd', text: `Alternativa incorrecta ${idx + 1}D` },
      ],
      correctOptionId: 'a',
      explanation: `Explicación jurídica verificable número ${idx + 1}.`,
    }));
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(rows) }] } }] }),
    } as Response;
  });

  const result = await buildAccreditationQuestions('Derecho Constitucional', 'derecho');
  assert.equal(result.source, 'generated');
  assert.equal(result.questions.length, 10);
  assert.equal(calledUrls.length, 2);
  assert.ok(calledUrls[0].includes('gemini-3.5-flash-lite'));
  assert.ok(calledUrls[1].includes('gemini-2.5-flash'));
});

test('Normalización controlada de JSON de IA y estrategia segura para asignaturas fuera de catálogo', () => {
  const ctx = resolveSubjectContext('Bioinformática Aplicada Avanzada');
  assert.equal(ctx.inCatalog, false);
  const prompt = buildAccreditationPrompt(ctx, [], 0);
  assert.ok(prompt.includes('No inventes un programa oficial'));

  const normalized = normalizeGeneratedPayload(
    '```json\n{"questions":[{"prompt":"Pregunta de prueba de longitud válida sobre el tema","options":[{"id":"A","text":"Uno"},{"id":"B","text":"Dos"},{"id":"C","text":"Tres"},{"id":"D","text":"Cuatro"}],"correctOptionId":"B","explanation":"Justificación válida de prueba."}]}\n```'
  ) as any[];
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].correctOptionId, 'b');
  assert.equal(normalized[0].options[0].id, 'a');

  // Bancos revisados locales para materias troncales sin clave IA
  for (const subject of [
    'Programación de Algoritmos',
    'Modelamiento de Base de Datos',
    'Consultas de Bases de Datos',
    'Nivelación Matemática',
  ]) {
    assert.ok(aiBackendService.getAccreditationQuestions(subject).length >= 5, `Banco revisado insuficiente para ${subject}`);
  }
});

test('Vertex AI Express (clave AQ.), limpieza de prefijo [DEMO], partes thought y respaldo ante HTTP 503', async (t) => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = '"AQ.Ab8RN6MockVertexExpressKey12345678901234567890123"';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  t.after(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prevModel;
  });

  // [DEMO] Álgebra hace match exacto y [DEMO] Inglés infiere su área y materias relacionadas del catálogo
  const exactDemoCtx = resolveSubjectContext('[DEMO] Álgebra');
  assert.equal(exactDemoCtx.inCatalog, true);
  assert.equal(exactDemoCtx.subjectName, 'Álgebra');
  assert.equal(exactDemoCtx.areaSlug, 'matematicas_estadistica');

  const demoCtx = resolveSubjectContext('[DEMO] Inglés');
  assert.equal(demoCtx.subjectName, 'Inglés');
  assert.notEqual(demoCtx.areaSlug, 'general');
  assert.ok(demoCtx.relatedSubjects.length >= 1);

  const calls: Array<{ url: string; body: any; keyHeader: string }> = [];
  t.mock.method(globalThis, 'fetch', async (url: any, options: any) => {
    const u = String(url);
    const parsedBody = JSON.parse(options.body);
    calls.push({ url: u, body: parsedBody, keyHeader: options.headers['x-goog-api-key'] });
    assert.ok(u.startsWith('https://aiplatform.googleapis.com/v1/publishers/google/models/'));
    assert.equal(u.includes('AQ.'), false);
    assert.equal(options.headers['x-goog-api-key'], 'AQ.Ab8RN6MockVertexExpressKey12345678901234567890123');
    assert.equal(parsedBody.contents[0].role, 'user');

    // Simular 503 en gemini-2.5-flash y éxito en gemini-2.5-flash-lite con parte thought
    if (u.includes('gemini-2.5-flash:')) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: { status: 'UNAVAILABLE', message: 'Temporarily overloaded' } }),
      } as Response;
    }

    const rows = Array.from({ length: 10 }, (_, idx) => ({
      prompt: `Pregunta de gramática y comprensión lectora en Inglés número ${idx + 1} para nivel universitario`,
      options: [
        { id: 'a', text: `Opción correcta en inglés ${idx + 1}` },
        { id: 'b', text: `Distractor inglés ${idx + 1}B` },
        { id: 'c', text: `Distractor inglés ${idx + 1}C` },
        { id: 'd', text: `Distractor inglés ${idx + 1}D` },
      ],
      correctOptionId: 'a',
      explanation: `Explicación lingüística verificable número ${idx + 1}.`,
      topic: `Grammar ${idx + 1}`,
      difficulty: 'basic',
    }));

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'Internal reasoning that must be ignored' },
                { text: JSON.stringify(rows) },
              ],
            },
          },
        ],
      }),
    } as Response;
  });

  const result = await buildAccreditationQuestions('[DEMO] Inglés');
  assert.equal(result.source, 'generated');
  assert.equal(result.questions.length, 10);
  assert.equal(result.context.subjectName, 'Inglés');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('gemini-2.5-flash:generateContent'));
  assert.ok(calls[1].url.includes('gemini-2.5-flash-lite:generateContent'));
});
