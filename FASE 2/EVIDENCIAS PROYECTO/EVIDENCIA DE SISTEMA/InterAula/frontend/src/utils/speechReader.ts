/**
 * speechReader.ts
 * Utilidad centralizada de síntesis de voz (Text-to-Speech) basada en Web Speech API.
 * Soporta reproducir, pausar, continuar, detener y ajustar velocidad (0.8x, 1.0x, 1.2x).
 */

export type SpeechSpeed = 0.8 | 1.0 | 1.2;
export type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'unsupported' | 'error';

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function stopSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore cancellation errors in restricted browsers
  }
}

export function pauseSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  } catch {
    // Ignore
  }
}

export function resumeSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    // Ignore
  }
}

export function speakText(
  text: string,
  options: {
    rate?: SpeechSpeed;
    lang?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  } = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.('Tu navegador no admite lectura en voz alta.');
    return false;
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    options.onError?.('No hay contenido textual para leer.');
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = options.lang || 'es-CL';
    utterance.rate = options.rate ?? 1.0;

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
        options.onEnd?.();
        return;
      }
      options.onError?.('No se pudo reproducir el audio en este navegador.');
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onError?.('Ocurrió un problema al iniciar la lectura en voz alta.');
    return false;
  }
}

