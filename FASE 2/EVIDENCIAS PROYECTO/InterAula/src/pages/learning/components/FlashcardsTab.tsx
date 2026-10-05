import { useState } from 'react';
import { STUDY_FLASHCARDS } from '../data/studyBank';
import {
  CheckIcon,
  BookOpenIcon,
} from '../../../components/common/Icons';

export default function FlashcardsTab() {
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  const subjects = Array.from(new Set(STUDY_FLASHCARDS.map((f) => f.subject)));

  const filteredCards =
    selectedSubject === 'all'
      ? STUDY_FLASHCARDS
      : STUDY_FLASHCARDS.filter((f) => f.subject === selectedSubject);

  const currentCard = filteredCards[currentIndex % (filteredCards.length || 1)];

  if (!currentCard) {
    return (
      <div className="ia-card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        No hay tarjetas disponibles para esta materia.
      </div>
    );
  }

  const isMastered = masteredIds.has(currentCard.id);

  const handleFlip = () => setIsFlipped((prev) => !prev);

  const handleNext = () => {
    setCurrentIndex((prev) => prev + 1);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setIsFlipped(false);
  };

  const handleToggleMastered = () => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) {
        next.delete(currentCard.id);
      } else {
        next.add(currentCard.id);
      }
      return next;
    });
  };

  const subjectColors: Record<string, string> = {
    'Programacion de Algoritmos': '#2563eb',
    'Modelamiento y Bases de Datos': '#16a34a',
    'Programacion Orientada a Objetos': '#7c3aed',
    'Programacion Web': '#ea580c',
    'Nivelacion Matematica': '#0891b2',
  };
  const accentColor = subjectColors[currentCard.subject] || '#2563eb';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra superior */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
            {masteredIds.size} dominadas de {filteredCards.length}
          </span>
          <div
            style={{
              width: '120px',
              height: '6px',
              backgroundColor: '#e2e8f0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${filteredCards.length > 0 ? (masteredIds.size / filteredCards.length) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#22c55e',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <select
          className="ia-input"
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          <option value="all">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tarjeta principal (Flashcard) */}
      <div
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
        style={{
          minHeight: '280px',
          borderRadius: '16px',
          border: `2px solid ${isMastered ? '#86efac' : isFlipped ? accentColor : '#e2e8f0'}`,
          background: isFlipped
            ? `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}15 100%)`
            : '#ffffff',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          boxShadow: isFlipped
            ? `0 8px 24px ${accentColor}20`
            : '0 2px 8px rgba(0,0,0,0.06)',
          position: 'relative',
        }}
      >
        {/* Indicadores superiores */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '20px',
            right: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              background: `${accentColor}15`,
              color: accentColor,
            }}
          >
            {currentCard.category}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
            {(currentIndex % (filteredCards.length || 1)) + 1} / {filteredCards.length}
          </span>
        </div>

        {isMastered && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '60px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#15803d',
              background: '#f0fdf4',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #bbf7d0',
            }}
          >
            <CheckIcon size={10} color="#15803d" /> Dominada
          </div>
        )}

        {/* Contenido */}
        {!isFlipped ? (
          <>
            <BookOpenIcon size={28} color={accentColor} style={{ marginBottom: '16px', opacity: 0.6 }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              {currentCard.term}
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
              {currentCard.subject}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '20px' }}>
              Toca para ver la definicion
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {currentCard.definition}
            </p>
            {currentCard.example && (
              <div
                style={{
                  fontSize: '0.84rem',
                  color: '#475569',
                  background: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  width: '100%',
                  maxWidth: '500px',
                }}
              >
                <strong>Ejemplo:</strong> {currentCard.example}
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '16px' }}>
              Toca para volver al termino
            </p>
          </>
        )}
      </div>

      {/* Controles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="ia-btn-secondary"
          style={{
            padding: '8px 18px',
            fontWeight: 700,
            fontSize: '0.88rem',
            opacity: currentIndex === 0 ? 0.5 : 1,
          }}
        >
          Anterior
        </button>

        <button
          type="button"
          onClick={handleToggleMastered}
          className="ia-btn-secondary"
          style={{
            padding: '8px 18px',
            fontWeight: 700,
            fontSize: '0.88rem',
            color: isMastered ? '#b91c1c' : '#15803d',
            borderColor: isMastered ? '#fecaca' : '#bbf7d0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckIcon size={14} color={isMastered ? '#b91c1c' : '#15803d'} />
          {isMastered ? 'Quitar de Dominadas' : 'Marcar como Dominada'}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="ia-btn-primary"
          style={{
            padding: '8px 18px',
            fontWeight: 700,
            fontSize: '0.88rem',
          }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
