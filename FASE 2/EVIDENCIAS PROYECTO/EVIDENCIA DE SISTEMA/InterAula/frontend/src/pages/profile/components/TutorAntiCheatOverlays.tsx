import { AlertCircleIcon, LockIcon } from '../../../components/common/Icons';

interface TutorAntiCheatOverlaysProps {
  showAbandonConfirm: boolean;
  onCancelAbandon: () => void;
  onConfirmAbandon: () => void;
  isFullscreen: boolean;
  step: 'idle' | 'ready_check' | 'answering' | 'question_feedback' | 'eliminated' | 'completed';
  isGenerating: boolean;
  onEnterFullscreen: () => void;
}

export default function TutorAntiCheatOverlays({
  showAbandonConfirm,
  onCancelAbandon,
  onConfirmAbandon,
  isFullscreen,
  step,
  isGenerating,
  onEnterFullscreen,
}: TutorAntiCheatOverlaysProps) {
  return (
    <>
      {/* MODAL DE CONFIRMACIÓN DE SALIDA AMIGABLE */}
      {showAbandonConfirm && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 120,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '26px 24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                  ¿Deseas salir de la evaluación?
                </div>
                <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
                  Puedes retomar la prueba en otro momento
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.55 }}>
              Si abandonas ahora, el progreso de la sesión actual no se guardará. No tendrás penalizaciones ni registro negativo en tu cuenta, y podrás volver a realizar la evaluación cuando lo desees.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onCancelAbandon}
                className="ia-btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.92rem' }}
              >
                Continuar Evaluación
              </button>
              <button
                type="button"
                onClick={onConfirmAbandon}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Salir y Abandonar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEANTE SI EL ESTUDIANTE SALE DEL MODO PANTALLA COMPLETA */}
      {!isFullscreen && (step === 'answering' || step === 'question_feedback') && !showAbandonConfirm && !isGenerating && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 110,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px 24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                border: '1px solid #fecaca',
              }}
            >
              <LockIcon size={26} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                Modo Pantalla Completa Obligatorio
              </div>
              <div style={{ fontSize: '0.9rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                No está permitido minimizar ni alternar aplicaciones
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.55 }}>
              Esta evaluación no admite segundo plano ni minimizado: <strong>es entrar o salir</strong>. El tiempo continúa corriendo en tiempo real. Para continuar, reanuda la pantalla completa de inmediato.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', width: '100%', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onConfirmAbandon}
                className="ia-btn-secondary"
                style={{ padding: '11px 20px', fontSize: '0.92rem', fontWeight: 600 }}
              >
                Salir y Abandonar
              </button>
              <button
                type="button"
                onClick={onEnterFullscreen}
                className="ia-btn-primary"
                style={{
                  padding: '10px 22px',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#047857',
                }}
              >
                Reanudar Pantalla Completa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
