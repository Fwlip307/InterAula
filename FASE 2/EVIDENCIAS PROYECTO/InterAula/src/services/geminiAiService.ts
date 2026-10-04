/**
 * geminiAiService.ts
 * Integración con Google Gemini API para generación dinámica y evaluación semántica
 * de pruebas técnicas para tutores en InterAula.
 */

import type { ChallengeQuestion } from './aiQuestionEngine';
import type { AcademicLevel } from '../types/profile';

// Clave de API de Gemini desde variables de entorno de Vite o almacenamiento local/sesión
export function getGeminiApiKey(): string | null {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
    return envKey.trim();
  }
  const localKey = localStorage.getItem('ia_gemini_api_key');
  if (localKey && localKey.trim().length > 10) {
    return localKey.trim();
  }
  const sessionKey = sessionStorage.getItem('ia_gemini_api_key');
  if (sessionKey && sessionKey.trim().length > 10) {
    return sessionKey.trim();
  }
  return null;
}

export function setSessionGeminiApiKey(key: string): void {
  if (key && key.trim()) {
    localStorage.setItem('ia_gemini_api_key', key.trim());
    sessionStorage.setItem('ia_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('ia_gemini_api_key');
    sessionStorage.removeItem('ia_gemini_api_key');
  }
}

export function hasGeminiApiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * Genera 10 preguntas técnicas mediante la API de Gemini (gemini-2.5-flash o gemini-1.5-flash)
 * con estricta adherencia al temario de la materia y al nivel seleccionado.
 */
export async function generateGeminiQuestions(
  subjectName: string,
  level: AcademicLevel,
  count: number = 10
): Promise<ChallengeQuestion[] | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const levelLabels: Record<AcademicLevel, string> = {
    basic: 'Básico (Fundamentos, sintaxis, conceptos nucleares de inicio)',
    intermediate: 'Intermedio (Lógica aplicada, APIs, asincronía, manipulación y debugging estándar)',
    advanced: 'Avanzado (Arquitectura, seguridad, rendimiento, optimización y casos de borde complejos)',
  };

  const systemPrompt = `Eres el Evaluador Técnico Oficial de InterAula, una plataforma de tutorías académicas universitarias.
Tu tarea es generar un examen técnico riguroso de ${count} preguntas para acreditar a un estudiante como Tutor en la materia "${subjectName}", en el nivel "${levelLabels[level]}".

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
    },
  };

  try {
    // Intentar primero con gemini-2.5-flash y fallback a gemini-1.5-flash
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn('[geminiAiService] Falló gemini-2.5-flash, status:', response.status);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const cleanedText = candidateText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed: ChallengeQuestion[] = JSON.parse(cleanedText);
    if (Array.isArray(parsed) && parsed.length >= count) {
      return parsed.slice(0, count).map((q, idx) => ({
        ...q,
        id: `gemini_${Date.now()}_${idx + 1}`,
        subject: subjectName,
      }));
    }
    return null;
  } catch (err) {
    console.error('[geminiAiService] Error al llamar Gemini API:', err);
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const prompt = `Pregunta técnica: "${questionPrompt}"
Respuestas de referencia: ${JSON.stringify(acceptedAnswers)}
Respuesta escrita por el estudiante: "${userAnswer}"

¿La respuesta del estudiante demuestra que conoce el concepto o término técnico correcto, considerando posibles variaciones de redacción o sinónimos técnicos válidos?
Responde estrictamente un JSON: {"isCorrect": true} o {"isCorrect": false}.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const cleanedRaw = raw
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
