import React, { useState } from 'react';
import type { TutoringSession } from '../../../types/tutoring';
import { tutoringService } from '../../../services/tutoring.service';
import { getUserDisplayName } from '../../../utils/formatters';
import {
  XIcon,
  StarIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';

interface ReviewModalProps {
  session: TutoringSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({
  session,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [communicationScore, setCommunicationScore] = useState(10);
  const [knowledgeScore, setKnowledgeScore] = useState(10);
  const [punctualityScore, setPunctualityScore] = useState(10);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !session) return null;

  const tutorName = getUserDisplayName(session.tutor);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      await tutoringService.submitReview({
        session_id: session.id,
        tutor_id: session.tutor_id,
        communication_score: communicationScore,
        knowledge_score: knowledgeScore,
        punctuality_score: punctualityScore,
        comment: comment.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ReviewModal] Error al enviar evaluación:', err);
      setErrorMessage(err.message || 'No fue posible registrar la evaluación.');
    } finally {
      setSubmitting(false);
    }
  };

  const scoreOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        overflowY: 'auto',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Evaluar Desempeño del Tutor
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Tutor: <strong>{tutorName}</strong> | Materia: <strong>{session.subject?.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar modal"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
          {errorMessage && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircleIcon size={18} color="#b91c1c" />
              <span>{errorMessage}</span>
            </div>
          )}

          <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: 0, marginBottom: '20px', lineHeight: 1.5 }}>
            Califica las competencias del tutor de <strong>1</strong> (muy deficiente) a <strong>10</strong> (excelente). El promedio general se calculará de forma automática y transparente en el sistema.
          </p>

          {/* Criterio 1: Comunicación */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                1. Comunicación Pedagógica
              </label>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                {communicationScore} / 10
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {scoreOptions.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCommunicationScore(num)}
                  style={{
                    flex: 1,
                    minWidth: '32px',
                    padding: '8px 0',
                    borderRadius: '8px',
                    border: `1.5px solid ${communicationScore === num ? '#2563eb' : '#e2e8f0'}`,
                    background: communicationScore === num ? '#2563eb' : '#ffffff',
                    color: communicationScore === num ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Criterio 2: Dominio */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                2. Dominio del Tema y Claridad Técnica
              </label>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                {knowledgeScore} / 10
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {scoreOptions.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setKnowledgeScore(num)}
                  style={{
                    flex: 1,
                    minWidth: '32px',
                    padding: '8px 0',
                    borderRadius: '8px',
                    border: `1.5px solid ${knowledgeScore === num ? '#2563eb' : '#e2e8f0'}`,
                    background: knowledgeScore === num ? '#2563eb' : '#ffffff',
                    color: knowledgeScore === num ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Criterio 3: Puntualidad */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                3. Puntualidad y Compromiso
              </label>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                {punctualityScore} / 10
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {scoreOptions.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPunctualityScore(num)}
                  style={{
                    flex: 1,
                    minWidth: '32px',
                    padding: '8px 0',
                    borderRadius: '8px',
                    border: `1.5px solid ${punctualityScore === num ? '#2563eb' : '#e2e8f0'}`,
                    background: punctualityScore === num ? '#2563eb' : '#ffffff',
                    color: punctualityScore === num ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Comentario */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Comentario u observaciones (opcional)
            </label>
            <textarea
              className="ia-input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Qué tal fue la explicación? ¿Fue útil para tu preparación?"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ia-btn-primary"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <StarIcon size={16} color="#ffffff" />
              {submitting ? 'Guardando evaluación...' : 'Registrar Evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
