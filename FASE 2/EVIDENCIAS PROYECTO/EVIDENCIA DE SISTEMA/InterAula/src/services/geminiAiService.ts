/**
 * geminiAiService.ts
 * Integración con Google Gemini API para generación dinámica y evaluación semántica
 * de pruebas técnicas para tutores en InterAula.
 */

import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { ChallengeQuestion } from './aiQuestionEngine';
import type { AcademicLevel } from '../types/profile';

/**
 * Las llamadas a Gemini se delegan a la Supabase Edge Function 'gemini-proxy',
 * que custodia la clave GEMINI_API_KEY en variables de entorno del servidor
 * y verifica la autenticación del usuario mediante JWT.
 */

export function getGeminiApiKey(): string {
  // Clave deshabilitada en el cliente por seguridad. Se gestiona en el servidor.
  return '';
}

export function setSessionGeminiApiKey(_key: string): void {
  // No-op por seguridad: los secretos se gestionan en Supabase Edge Functions.
  console.info('[geminiAiService] La clave de IA está protegida en el backend (Edge Function).');
}

export function hasGeminiApiConfigured(): boolean {
  // El backend cuenta con la Edge Function configurada para usuarios autenticados
  return true;
}

/**
 * Realiza llamadas a Gemini a través de la función protegida en el servidor.
 * Cuenta con timeout y fallback a generadores locales en caso de desconexión.
 */
export async function callGeminiApiWithFallback(body: any, timeoutMs: number = 20000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'generateContent',
        payload: body,
      },
    });

    clearTimeout(timerId);

    if (error) {
      console.warn('[geminiAiService] La Edge Function de Gemini retornó un error:', error.message || error);
      return null;
    }

    if (data && typeof data.resultText === 'string' && data.resultText.trim().length > 0) {
      return data.resultText;
    }

    return null;
  } catch (err: any) {
    console.warn('[geminiAiService] Error al invocar gemini-proxy:', err?.message || err);
    return null;
  }
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
 * Evaluador semántico con backend propio o Gemini para respuestas de redacción abierta
 * que puedan tener sinónimos o explicaciones redactadas de forma distinta.
 */
export async function evaluateAnswerWithGemini(
  questionPrompt: string,
  userAnswer: string,
  acceptedAnswers: string[]
): Promise<boolean | null> {
  // 1. Intentar evaluación semántica a través del backend propio
  try {
    const res = await apiClient.post<{ score: number; passed: boolean; feedback: string }>(API_ENDPOINTS.AI.EVALUATE_ANSWER, {
      question: questionPrompt,
      answer: userAnswer,
      rubric: `Respuestas aceptables: ${acceptedAnswers.join(', ')}`,
    });
    if (res && typeof res.passed === 'boolean') {
      return res.passed;
    }
  } catch (apiErr) {
    console.warn('[geminiAiService] Backend API fallback para evaluateAnswer:', apiErr);
  }

  // 2. Fallback a Supabase Edge Function
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
