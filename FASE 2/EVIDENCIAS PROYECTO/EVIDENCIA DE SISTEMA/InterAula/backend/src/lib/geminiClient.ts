export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

export function sanitizeGeminiApiKey(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isVertexExpressModeEnabled(): boolean {
  return process.env.GEMINI_USE_VERTEX_EXPRESS === 'true';
}

export function buildAiStudioUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

export function buildVertexExpressUrl(model: string): string {
  return `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Tanto las claves clásicas (AIza...) como las nuevas claves de Google AI Studio (AQ....)
 * utilizan generativelanguage.googleapis.com por defecto.
 * Solo se enruta a Vertex AI Express (aiplatform.googleapis.com) cuando GEMINI_USE_VERTEX_EXPRESS=true.
 */
export function buildGeminiGenerateContentUrl(model: string, _apiKey?: string): string {
  if (isVertexExpressModeEnabled()) {
    return buildVertexExpressUrl(model);
  }
  return buildAiStudioUrl(model);
}

export function resolveGeminiModels(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = configured ? [configured, ...FALLBACK_GEMINI_MODELS] : [...FALLBACK_GEMINI_MODELS];
  return [...new Set(candidates.filter(Boolean))];
}

export function extractGeminiResponseText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part: any) => !part?.thought && typeof part?.text === 'string')
    .map((part: any) => part.text)
    .join('');
}

export async function readSafeProviderError(response: Response, apiKey: string): Promise<string> {
  try {
    const raw = (await response.json()) as any;
    const status = typeof raw?.error?.status === 'string' ? raw.error.status : '';
    const message = typeof raw?.error?.message === 'string' ? raw.error.message : '';
    const combined = [status, message].filter(Boolean).join(' - ').slice(0, 220);
    if (!combined) return '';
    return apiKey ? combined.split(apiKey).join('[REDACTED]') : combined;
  } catch {
    return '';
  }
}
