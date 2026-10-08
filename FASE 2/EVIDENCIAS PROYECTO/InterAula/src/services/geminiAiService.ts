/**
 * geminiAiService.ts
 * Integración con Google Gemini API para generación dinámica y evaluación semántica
 * de pruebas técnicas para tutores en InterAula.
 */

import type { ChallengeQuestion } from './aiQuestionEngine';
import type { AcademicLevel } from '../types/profile';

// Clave API provista para el motor de evaluación (se obtiene de .env.local de forma segura)
const DEFAULT_GEMINI_API_KEY = '';

// Modelos Gemini optimizados por velocidad y disponibilidad
const CANDIDATE_GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

export function getGeminiApiKey(): string {
  try {
    const envKey =
      typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env as any).VITE_GEMINI_API_KEY
        : typeof globalThis !== 'undefined' && (globalThis as any).process?.env
        ? (globalThis as any).process.env.VITE_GEMINI_API_KEY
        : undefined;

    if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
      return envKey.trim();
    }

    if (typeof localStorage !== 'undefined') {
      const localKey = localStorage.getItem('ia_gemini_api_key');
      if (localKey && localKey.trim().length > 10) {
        return localKey.trim();
      }
    }
  } catch (err) {
    console.warn('[geminiAiService] Error al obtener API key:', err);
  }

  return DEFAULT_GEMINI_API_KEY;
}

export function setSessionGeminiApiKey(key: string): void {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    if (key && key.trim()) {
      localStorage.setItem('ia_gemini_api_key', key.trim());
      sessionStorage.setItem('ia_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('ia_gemini_api_key');
      sessionStorage.removeItem('ia_gemini_api_key');
    }
  } catch (err) {
    console.warn('[geminiAiService] Error al guardar clave en storage:', err);
  }
}

export function hasGeminiApiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.trim().length > 10);
}

/**
 * Realiza llamadas a Gemini con tolerancia a fallos mediante cascada de modelos.
 * Si un modelo tiene alta demanda (código 503) o no responde en 10 segundos, salta al siguiente.
 */
export async function callGeminiApiWithFallback(body: any, timeoutMs: number = 10000): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  for (const model of CANDIDATE_GEMINI_MODELS) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (response.ok) {
        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim().length > 0) {
          return candidateText;
        }
      } else {
        console.warn(`[geminiAiService] Modelo ${model} respondió status ${response.status}. Probando alternativo...`);
      }
    } catch (err: any) {
      clearTimeout(timerId);
      console.warn(`[geminiAiService] Modelo ${model} no respondió a tiempo (${err.message || 'timeout'}). Intentando siguiente...`);
    }
  }

  return null;
}

/**
 * Genera 10 preguntas técnicas mediante la API de Gemini
 * con estricta adherencia al temario de la materia y al nivel seleccionado.
 */
export async function generateGeminiQuestions(
  subjectName: string,
  level: AcademicLevel,
  count: number = 10,
  context?: { institution?: string; career?: string }
): Promise<ChallengeQuestion[] | null> {
  const levelLabels: Record<AcademicLevel, string> = {
    basic: 'Básico (Fundamentos, sintaxis, conceptos nucleares de inicio)',
    intermediate: 'Intermedio (Lógica aplicada, APIs, asincronía, manipulación y debugging estándar)',
    advanced: 'Avanzado (Arquitectura, seguridad, rendimiento, optimización y casos de borde complejos)',
  };

  const contextInstruction = context?.institution || context?.career
    ? `\nCONTEXTO ACADÉMICO DEL ESTUDIANTE:
- Institución de procedencia: ${context.institution || 'Educación Superior en Chile'}
- Carrera del estudiante: ${context.career || 'Disciplina afín'}
Ajusta la terminología y los casos prácticos a los estándares formativos de dicha institución y disciplina en Chile.`
    : '';

  const systemPrompt = `Eres el Evaluador Técnico Oficial de InterAula, una plataforma de tutorías académicas universitarias.
Tu tarea es generar un examen técnico riguroso de ${count} preguntas para acreditar a un estudiante como Tutor en la materia "${subjectName}", en el nivel "${levelLabels[level]}".${contextInstruction}

REGLAS OBLIGATORIAS:
1. Las preguntas DEBEN ser 100% pertinentes a "${subjectName}". NO mezcles conceptos de otras materias no relacionadas.
2. Cada pregunta debe tener:
   - "type": "choice" (alternativas) o "redaction" (desarrollo técnico corto).
   - "timeLimit": 15 para "choice", 45 para "redaction".
   - "prompt": Enunciado claro, profesional y directo en español.
   - "codeSnippet": (Opcional) Código relevante si la pregunta es de debugging o análisis.
   - Si es "choice": exactamente 3 opciones ("id": "a", "b", "c", con su "text"), y "correctOptionId".
   - Si es "redaction": lista de "acceptedAnswers" (palabras clave, nombres de métodos o valores exactos) y un "placeholder".
   - "explanation": Breve justificación pedagógica de por qué es la respuesta correcta (máx 2 líneas).
3. Asegura un balance: aproximadamente 5 de alternativas ("choice") y 5 de desarrollo técnico ("redaction").
4. Genera preguntas variadas y originales, adecuadas al nivel "${level}".`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\nDevuelve ÚNICAMENTE un arreglo JSON con las ${count} preguntas conforme al siguiente formato:\n[
  {
    "id": "q1",
    "subject": "${subjectName}",
    "type": "choice",
    "category": "conceptual",
    "timeLimit": 15,
    "prompt": "...",
    "options": [
      {"id": "a", "text": "..."},
      {"id": "b", "text": "..."},
      {"id": "c", "text": "..."}
    ],
    "correctOptionId": "a",
    "explanation": "..."
  },
  {
    "id": "q2",
    "subject": "${subjectName}",
    "type": "redaction",
    "category": "debugging",
    "timeLimit": 45,
    "prompt": "...",
    "acceptedAnswers": ["palabra_clave"],
    "placeholder": "...",
    "explanation": "..."
  }
]`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
    },
  };

  try {
    const candidateText = await callGeminiApiWithFallback(requestBody, 22000);
    if (!candidateText) return null;

    const cleanedText = candidateText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed: ChallengeQuestion[] = JSON.parse(cleanedText);
    if (Array.isArray(parsed) && parsed.length >= 5) {
      let fullList = [...parsed];
      while (fullList.length < count) {
        fullList.push({ ...parsed[fullList.length % parsed.length] });
      }
      return fullList.slice(0, count).map((q, idx) => ({
        ...q,
        id: `gemini_${Date.now()}_${idx + 1}`,
        subject: subjectName,
        level: level,
      }));
    }
    return null;
  } catch (err) {
    console.error('[geminiAiService] Error al procesar respuesta de Gemini:', err);
    return null;
  }
}

/**
 * Evaluador semántico opcional con Gemini para respuestas de redacción abierta
 * que puedan tener sinónimos o explicaciones redactadas de forma distinta.
 */
export async function evaluateAnswerWithGemini(
  questionPrompt: string,
  userAnswer: string,
  acceptedAnswers: string[]
): Promise<boolean | null> {
  try {
    const prompt = `Pregunta técnica: "${questionPrompt}"
Respuestas de referencia: ${JSON.stringify(acceptedAnswers)}
Respuesta escrita por el estudiante: "${userAnswer}"

¿La respuesta del estudiante demuestra que conoce el concepto o término técnico correcto, considerando posibles variaciones de redacción o sinónimos técnicos válidos?
Responde estrictamente un JSON: {"isCorrect": true} o {"isCorrect": false}.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const candidateText = await callGeminiApiWithFallback(requestBody);
    if (!candidateText) return null;

    const cleanedRaw = candidateText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const result = JSON.parse(cleanedRaw);
    return Boolean(result.isCorrect);
  } catch (err) {
    console.warn('[geminiAiService] Falló evaluación semántica con Gemini:', err);
    return null;
  }
}
