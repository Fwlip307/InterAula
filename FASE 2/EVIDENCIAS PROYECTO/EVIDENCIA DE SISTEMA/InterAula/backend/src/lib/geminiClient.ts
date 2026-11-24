export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
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

/**
 * Las claves de Google Cloud Vertex AI Express Mode comienzan con "AQ."
 * y requieren el endpoint global aiplatform.googleapis.com/v1/publishers/google/models/...
 * mientras que las claves de Google AI Studio (AIza...) usan generativelanguage.googleapis.com.
 */
export function isVertexExpressKey(apiKey: string): boolean {
  return apiKey.startsWith('AQ.');
}

export function buildGeminiGenerateContentUrl(model: string, apiKey: string): string {
  const encodedModel = encodeURIComponent(model);
  if (isVertexExpressKey(apiKey)) {
    return `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodedModel}:generateContent`;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent`;
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
    const raw = await response.json() as any;
    const status = typeof raw?.error?.status === 'string' ? raw.error.status : '';
    const message = typeof raw?.error?.message === 'string' ? raw.error.message : '';
    const combined = [status, message].filter(Boolean).join(' - ').slice(0, 200);
    if (!combined) return '';
    return apiKey ? combined.split(apiKey).join('[REDACTED]') : combined;
  } catch {
    return '';
  }
}
