import { useEffect, useRef, useState } from 'react';
import { MicIcon, XIcon, CheckIcon } from './Icons';

interface VoiceDictationButtonProps {
  onInsertText: (text: string) => void;
  buttonLabel?: string;
  compact?: boolean;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export default function VoiceDictationButton({
  onInsertText,
  buttonLabel = 'Dictar por voz',
  compact = false,
}: VoiceDictationButtonProps) {
  const RecognitionCtor = getSpeechRecognitionCtor();
  const [isListening, setIsListening] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  if (!RecognitionCtor) {
    return (
      <span
        style={{ fontSize: '0.76rem', color: 'var(--ia-text-muted)' }}
        title="Tu navegador actual no soporta reconocimiento de voz Web Speech API"
      >
        Dictado por voz no disponible en este navegador
      </span>
    );
  }

  const startDictation = () => {
    setErrorMsg('');
    try {
      const recognition = new RecognitionCtor();
      recognition.lang = 'es-CL';
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalTranscript = draftTranscript ? `${draftTranscript.trim()} ` : '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalTranscript += piece + ' ';
          } else {
            interim += piece;
          }
        }
        setDraftTranscript((finalTranscript + interim).trim());
        setShowPreview(true);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMsg('Permiso de micrófono denegado. Puedes escribir manualmente o habilitar el micrófono en tu navegador.');
        } else if (event.error !== 'aborted') {
          setErrorMsg('No se pudo capturar audio en este momento. Intenta nuevamente.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setShowPreview(true);
    } catch {
      setErrorMsg('No fue posible iniciar el micrófono.');
      setIsListening(false);
    }
  };

  const stopDictation = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore
    }
    setIsListening(false);
  };

  const handleConfirmInsert = () => {
    const clean = draftTranscript.trim();
    if (clean) {
      onInsertText(clean);
    }
    setDraftTranscript('');
    setShowPreview(false);
    setIsListening(false);
  };

  const handleDiscard = () => {
    stopDictation();
    setDraftTranscript('');
    setShowPreview(false);
    setErrorMsg('');
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {!isListening ? (
          <button
            type="button"
            className="ia-btn ia-btn-secondary"
            onClick={startDictation}
            style={{
              padding: compact ? '5px 10px' : '7px 12px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Activa el micrófono del navegador para dictar texto (opcional, sin guardar grabaciones)"
          >
            <MicIcon size={15} />
            <span>{buttonLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            className="ia-btn"
            onClick={stopDictation}
            style={{
              padding: compact ? '5px 10px' : '7px 12px',
              fontSize: '0.8rem',
              backgroundColor: 'var(--ia-danger-bg, #fee2e2)',
              color: 'var(--ia-danger, #b91c1c)',
              border: '1px solid var(--ia-danger-border, #fecaca)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            <MicIcon size={15} />
            <span>Escuchando... (Detener)</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--ia-danger, #b91c1c)' }}>
          {errorMsg}
        </span>
      )}

      {showPreview && (
        <div
          className="ia-card"
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--ia-border, #cbd5e1)',
            backgroundColor: 'var(--ia-surface, #ffffff)',
            minWidth: '280px',
            maxWidth: '540px',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ia-text-secondary)' }}>
            Vista previa del dictado (puedes editar antes de insertar):
          </div>
          <textarea
            className="ia-input"
            rows={3}
            value={draftTranscript}
            onChange={(e) => setDraftTranscript(e.target.value)}
            placeholder="Tu dictado aparecerá aquí..."
            aria-label="Texto reconocido por dictado de voz"
            style={{ width: '100%', fontSize: '0.86rem', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="ia-btn ia-btn-secondary"
              onClick={handleDiscard}
              style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <XIcon size={14} />
              <span>Cancelar</span>
            </button>
            <button
              type="button"
              className="ia-btn ia-btn-primary"
              onClick={handleConfirmInsert}
              disabled={!draftTranscript.trim()}
              style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <CheckIcon size={14} />
              <span>Insertar texto</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

