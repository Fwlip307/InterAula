import { useEffect, useState } from 'react';
import { Volume2Icon, PlayIcon, PauseIcon, XIcon } from './Icons';
import {
  isSpeechSynthesisSupported,
  pauseSpeech,
  resumeSpeech,
  speakText,
  stopSpeech,
  type SpeechSpeed,
  type SpeechStatus,
} from '../../utils/speechReader';

interface ReadAloudControlsProps {
  text: string;
  label?: string;
  compact?: boolean;
}

const SPEEDS: SpeechSpeed[] = [0.8, 1.0, 1.2];

export function ReadAloudControls({
  text,
  label = 'Escuchar en voz alta',
  compact = false,
}: ReadAloudControlsProps) {
  const [status, setStatus] = useState<SpeechStatus>(() =>
    isSpeechSynthesisSupported() ? 'idle' : 'unsupported'
  );
  const [speed, setSpeed] = useState<SpeechSpeed>(1.0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  if (status === 'unsupported') {
    return (
      <span style={{ fontSize: '0.76rem', color: 'var(--ia-text-muted)' }}>
        Lectura en voz alta no disponible en este navegador.
      </span>
    );
  }

  const handlePlay = (nextRate: SpeechSpeed = speed) => {
    setErrorMsg('');
    speakText(text, {
      rate: nextRate,
      onStart: () => setStatus('speaking'),
      onEnd: () => setStatus('idle'),
      onError: (msg) => {
        setStatus('error');
        setErrorMsg(msg);
      },
    });
  };

  const handlePauseOrResume = () => {
    if (status === 'speaking') {
      pauseSpeech();
      setStatus('paused');
    } else if (status === 'paused') {
      resumeSpeech();
      setStatus('speaking');
    } else {
      handlePlay();
    }
  };

  const handleStop = () => {
    stopSpeech();
    setStatus('idle');
  };

  const handleSpeedChange = (nextRate: SpeechSpeed) => {
    setSpeed(nextRate);
    if (status === 'speaking' || status === 'paused') {
      handlePlay(nextRate);
    }
  };

  return (
    <div
      className="ia-read-aloud-controls"
      role="group"
      aria-label="Controles de lectura en voz alta"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
      }}
    >
      {status === 'idle' || status === 'error' ? (
        <button
          type="button"
          className="ia-btn ia-btn-secondary"
          onClick={() => handlePlay()}
          style={{
            padding: compact ? '5px 10px' : '7px 12px',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Volume2Icon size={15} />
          <span>{label}</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            className="ia-btn ia-btn-primary"
            onClick={handlePauseOrResume}
            style={{
              padding: compact ? '5px 10px' : '7px 12px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {status === 'speaking' ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            <span>{status === 'speaking' ? 'Pausar' : 'Continuar'}</span>
          </button>
          <button
            type="button"
            className="ia-btn ia-btn-secondary"
            onClick={handleStop}
            aria-label="Detener lectura en voz alta"
            style={{
              padding: compact ? '5px 8px' : '7px 10px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <XIcon size={14} />
            <span>Detener</span>
          </button>
        </>
      )}

      <div
        role="group"
        aria-label="Velocidad de lectura"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSpeedChange(s)}
            aria-pressed={speed === s}
            style={{
              padding: '4px 7px',
              fontSize: '0.73rem',
              fontWeight: speed === s ? 700 : 500,
              borderRadius: '6px',
              border: '1px solid var(--ia-border, #cbd5e1)',
              backgroundColor: speed === s ? 'var(--ia-primary, #2563eb)' : 'var(--ia-surface, #fff)',
              color: speed === s ? '#ffffff' : 'var(--ia-text-secondary, #475569)',
              cursor: 'pointer',
            }}
          >
            {s.toFixed(1)}x
          </button>
        ))}
      </div>

      {errorMsg && (
        <span role="status" style={{ fontSize: '0.75rem', color: 'var(--ia-danger, #b91c1c)' }}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}

export default ReadAloudControls;
