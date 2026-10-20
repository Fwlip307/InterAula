import React from 'react';
import {
  CheckIcon,
  AlertCircleIcon,
  SendIcon,
} from '../../../components/common/Icons';
import type { ChallengeQuestion } from '../../../services/aiQuestionEngine';

interface TutorValidationBottomBarProps {
  step: 'idle' | 'ready_check' | 'answering' | 'question_feedback' | 'eliminated' | 'completed';
  currentQ?: ChallengeQuestion;
  timeLeft: number;
  isProcessingAnswer: boolean;
  redactionInput: string;
  onRedactionInputChange: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  pasteWarning: boolean;
  onPasteAttempt: () => void;
  streak: number;
  totalQuestions: number;
  eliminationReason: 'timeout' | 'wrong_answer' | null;
  submittingVerification: boolean;
  onAnswerSubmit: (answerText: string, optionId?: string) => void;
  onRequestClose: () => void;
  onConfirmReady: () => void;
  onProceedNext: () => void;
  onFinalClose: () => void;
  onRetry: () => void;
  onGrantCertification: () => void;
}

export default function TutorValidationBottomBar({
  step,
  currentQ,
  timeLeft,
  isProcessingAnswer,
  redactionInput,
  onRedactionInputChange,
  inputRef,
  pasteWarning,
  onPasteAttempt,
  streak,
  totalQuestions,
  eliminationReason,
  submittingVerification,
  onAnswerSubmit,
  onRequestClose,
  onConfirmReady,
  onProceedNext,
  onFinalClose,
  onRetry,
  onGrantCertification,
}: TutorValidationBottomBarProps) {
  if (step === 'idle') return null;

  return (
    <div
      style={{
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
      }}
    >
      {/* ESTADO 1: READY CHECK (El bot preguntó si está listo -> El tiempo NO corre) */}
      {step === 'ready_check' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
            El tiempo comenzará a correr solo cuando confirmes que estás listo para la pregunta.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onRequestClose}
              className="ia-btn-secondary"
              style={{ padding: '10px 16px', fontSize: '0.85rem' }}
            >
              Salir
            </button>
            <button
              type="button"
              onClick={onConfirmReady}
              className="ia-btn-primary"
              style={{
                padding: '10px 22px',
                fontSize: '0.9rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderColor: '#047857',
                boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
              }}
            >
              ¡Estoy listo, comenzar!
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 2: RESPONDIENDO PREGUNTA (El tiempo corre aquí) */}
      {step === 'answering' && currentQ && (
        <div>
          {/* OPCIÓN A: PREGUNTA DE SELECCIÓN RÁPIDA */}
          {currentQ.type === 'choice' && currentQ.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>
                Selecciona tu respuesta ({timeLeft}s restantes):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {currentQ.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onAnswerSubmit(opt.text, opt.id)}
                    disabled={isProcessingAnswer}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* OPCIÓN B: PREGUNTA DE DESARROLLO TÉCNICO / REDACCIÓN */}
          {currentQ.type === 'redaction' && (
            <div>
              {pasteWarning && (
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: '#b91c1c',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    marginBottom: '6px',
                    fontWeight: 600,
                  }}
                >
                  Acción no permitida: Debes redactar tu respuesta directamente usando el teclado para validar la autoría.
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!redactionInput.trim() || isProcessingAnswer) return;
                  onAnswerSubmit(redactionInput.trim());
                }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={redactionInput}
                  onChange={(e) => onRedactionInputChange(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    onPasteAttempt();
                  }}
                  placeholder={currentQ.placeholder || 'Escribe tu respuesta técnica aquí (redacción directa)...'}
                  disabled={isProcessingAnswer}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #2563eb',
                    fontSize: '0.88rem',
                    outline: 'none',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                  }}
                />
                <button
                  type="submit"
                  disabled={!redactionInput.trim() || isProcessingAnswer}
                  className="ia-btn-primary"
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Enviar</span>
                  <SendIcon size={16} color="#ffffff" />
                </button>
              </form>
            </div>
          )}

          {/* BARRA INFERIOR DE SOPORTE Y ABANDONO */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              paddingTop: '6px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Modo de Enfoque Activo · Redacción directa por teclado
            </span>
            <button
              type="button"
              onClick={onRequestClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              Abandonar evaluación
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 3: PAUSA ENTRE PREGUNTAS (El tiempo está detenido para leer la retroalimentación) */}
      {step === 'question_feedback' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckIcon size={20} color="#16a34a" />
            <span style={{ fontSize: '0.86rem', color: '#166534', fontWeight: 700 }}>
              Acierto registrado ({streak}/{totalQuestions}). El tiempo está en pausa.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onRequestClose}
              className="ia-btn-secondary"
              style={{ padding: '10px 14px', fontSize: '0.82rem' }}
            >
              Abandonar
            </button>
            <button
              type="button"
              onClick={onProceedNext}
              className="ia-btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '0.88rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderColor: '#047857',
              }}
            >
              Pasar a la siguiente pregunta
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 4: FALLÓ O SE AGOTÓ EL TIEMPO */}
      {step === 'eliminated' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircleIcon size={20} color="#dc2626" />
            <span style={{ fontSize: '0.86rem', color: '#991b1b', fontWeight: 700 }}>
              Evaluación finalizada ({eliminationReason === 'timeout' ? 'Tiempo agotado' : 'Respuesta incorrecta'}): {streak} de {totalQuestions} aciertos.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onFinalClose}
              className="ia-btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="ia-btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: '0.82rem',
                fontWeight: 800,
                background: '#059669',
                borderColor: '#047857',
              }}
            >
              Reintentar Evaluación
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 5: EVALUACIÓN COMPLETADA (10/10) */}
      {step === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckIcon size={22} color="#16a34a" />
            <span style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 800 }}>
              {totalQuestions} de {totalQuestions} aciertos. Habilitación docente lista.
            </span>
          </div>
          <button
            type="button"
            onClick={onGrantCertification}
            disabled={submittingVerification}
            className="ia-btn-primary"
            style={{
              padding: '10px 22px',
              fontSize: '0.9rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderColor: '#047857',
              boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
            }}
          >
            {submittingVerification ? 'Guardando...' : 'Activar Habilitación en Mi Perfil'}
          </button>
        </div>
      )}
    </div>
  );
}
