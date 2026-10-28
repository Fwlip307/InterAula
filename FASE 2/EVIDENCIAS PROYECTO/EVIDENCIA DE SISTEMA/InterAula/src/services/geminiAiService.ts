/**
 * geminiAiService.ts
 * Integración con Inteligencia Artificial a través del Backend REST propio de InterAula.
 * Elimina la dependencia de Edge Functions externas obsoletas y garantiza respuesta inmediata
 * tanto si el servidor cuenta con GEMINI_API_KEY como si utiliza bancos pedagógicos curados.
 */

import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { ChallengeQuestion } from './aiQuestionEngine';
import type { AcademicLevel } from '../types/profile';

export function getGeminiApiKey(): string {
  // Clave custodiada en variables de entorno del backend por seguridad
  return '';
}

export function setSessionGeminiApiKey(_key: string): void {
  console.info('[geminiAiService] La clave de IA está custodiada en el backend propio.');
}

export function hasGeminiApiConfigured(): boolean {
  // El backend propio provee el servicio de IA y bancos pedagógicos garantizados
  return true;
}

/**
 * Consulta el estado y capacidades actuales del motor de IA en el backend
 */
export async function getAiEngineStatus(): Promise<{ configured: boolean; provider: string } | null> {
  try {
    const data = await apiClient.get<{ configured: boolean; provider: string }>(API_ENDPOINTS.AI.STATUS);
    return data;
  } catch (err) {
    console.warn('[geminiAiService] No fue posible consultar estado del motor de IA:', err);
    return null;
  }
}

/**
 * Genera preguntas técnicas mediante la API de IA del backend
 */
export async function generateGeminiQuestions(
  subjectName: string,
  level: AcademicLevel,
  count: number = 10,
  context?: { institution?: string; career?: string }
): Promise<ChallengeQuestion[] | null> {
  try {
    const questions = await apiClient.post<ChallengeQuestion[]>(
      API_ENDPOINTS.AI.GENERATE_QUESTIONS,
      {
        subject_name: subjectName,
        level,
        count,
        context,
      }
    );

    if (Array.isArray(questions) && questions.length > 0) {
      return questions;
    }
    return null;
  } catch (err) {
    console.warn('[geminiAiService] Falló solicitud de generación de preguntas al backend:', err);
    return null;
  }
}

/**
 * Evaluador semántico a través del backend propio para respuestas de redacción abierta
 */
export async function evaluateAnswerWithGemini(
  questionPrompt: string,
  userAnswer: string,
  acceptedAnswers: string[]
): Promise<boolean | null> {
  try {
    const res = await apiClient.post<{ score: number; passed: boolean; feedback: string }>(
      API_ENDPOINTS.AI.EVALUATE_ANSWER,
      {
        question: questionPrompt,
        answer: userAnswer,
        rubric: `Respuestas aceptables: ${acceptedAnswers.join(', ')}`,
      }
    );

    if (res && typeof res.passed === 'boolean') {
      return res.passed;
    }
    return null;
  } catch (apiErr) {
    console.warn('[geminiAiService] Error en evaluación semántica en el backend:', apiErr);
    return null;
  }
}
