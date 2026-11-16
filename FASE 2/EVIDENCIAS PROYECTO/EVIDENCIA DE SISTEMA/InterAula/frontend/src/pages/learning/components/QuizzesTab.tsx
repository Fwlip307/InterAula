import { useState } from 'react';
import { LEARNING_QUIZ_BANK } from '../data/studyBank';
import type { QuizQuestion } from '../data/studyBank';
import {
  CheckIcon,
  XIcon,
  SparklesIcon,
} from '../../../components/common/Icons';

export default function QuizzesTab() {
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  const subjects = Array.from(new Set(LEARNING_QUIZ_BANK.map((q) => q.subject)));

  const filteredQuestions =
    selectedSubject === 'all'
      ? LEARNING_QUIZ_BANK
      : LEARNING_QUIZ_BANK.filter((q) => q.subject === selectedSubject);

  const currentQuestion: QuizQuestion | undefined =
    filteredQuestions[currentIndex % (filteredQuestions.length || 1)];

  if (!currentQuestion) {
    return (
      <div className="ia-card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        No hay preguntas disponibles para esta materia.
      </div>
    );
  }

  const isCorrect = selectedOption === currentQuestion.correctIndex;

  const handleSelectOption = (idx: number) => {
    if (submitted) return;
    setSelectedOption(idx);
    setSubmitted(true);
    setTotalAnswered((prev) => prev + 1);
    if (idx === currentQuestion.correctIndex) {
      setScore((prev) => prev + 100);
      setCorrectCount((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setSubmitted(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setSubmitted(false);
    setScore(0);
    setCorrectCount(0);
    setTotalAnswered(0);
  };

  const difficultyColors: Record<string, { bg: string; color: string }> = {
    Basico: { bg: '#f0fdf4', color: '#15803d' },
    Intermedio: { bg: '#fffbeb', color: '#b45309' },
    Avanzado: { bg: '#fef2f2', color: '#b91c1c' },
  };
  const diff = difficultyColors[currentQuestion.difficulty] || difficultyColors.Basico;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Panel de puntaje y filtros */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
            }}
          >
            <SparklesIcon size={16} color="#fbbf24" />
            <span>{score} pts</span>
          </div>
          <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 600 }}>
            {correctCount} / {totalAnswered} correctas
          </span>
          {totalAnswered > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="ia-btn-secondary"
              style={{ padding: '4px 12px', fontSize: '0.78rem' }}
            >
              Reiniciar
            </button>
          )}
        </div>

        <select
          className="ia-input"
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setCurrentIndex(0);
            setSelectedOption(null);
            setSubmitted(false);
          }}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          <option value="all">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tarjeta de la pregunta */}
      <div
        className="ia-card"
        style={{
          padding: '24px',
          borderLeft: `4px solid ${diff.color}`,
        }}
      >
        {/* Cabecera de pregunta */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                background: diff.bg,
                color: diff.color,
              }}
            >
              {currentQuestion.difficulty}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {currentQuestion.subject}
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
            Pregunta {(currentIndex % (filteredQuestions.length || 1)) + 1} de {filteredQuestions.length}
          </span>
        </div>

        {/* Enunciado */}
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0', lineHeight: 1.4 }}>
          {currentQuestion.question}
        </h3>

        {/* Snippet de codigo */}
        {currentQuestion.codeSnippet && (
          <pre
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              padding: '14px 18px',
              borderRadius: '10px',
              fontSize: '0.84rem',
              fontFamily: "'Fira Code', 'Consolas', monospace",
              overflowX: 'auto',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            {currentQuestion.codeSnippet}
          </pre>
        )}

        {/* Opciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {currentQuestion.options.map((option, idx) => {
            const isThisCorrect = idx === currentQuestion.correctIndex;
            const isSelected = selectedOption === idx;

            let bgColor = '#ffffff';
            let borderColor = '#e2e8f0';
            let textColor = '#334155';

            if (submitted) {
              if (isThisCorrect) {
                bgColor = '#f0fdf4';
                borderColor = '#86efac';
                textColor = '#166534';
              } else if (isSelected && !isThisCorrect) {
                bgColor = '#fef2f2';
                borderColor = '#fca5a5';
                textColor = '#991b1b';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={submitted}
                onClick={() => handleSelectOption(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `2px solid ${borderColor}`,
                  background: bgColor,
                  color: textColor,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: submitted ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: submitted && isThisCorrect ? '#22c55e' : submitted && isSelected ? '#ef4444' : '#f1f5f9',
                    color: submitted && (isThisCorrect || isSelected) ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {submitted && isThisCorrect ? <CheckIcon size={14} color="#ffffff" /> : submitted && isSelected && !isThisCorrect ? <XIcon size={14} color="#ffffff" /> : String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {/* Retroalimentacion */}
        {submitted && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              background: isCorrect ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`,
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: isCorrect ? '#166534' : '#991b1b',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isCorrect ? <CheckIcon size={16} color="#166534" /> : <XIcon size={16} color="#991b1b" />}
              {isCorrect ? 'Respuesta Correcta (+100 pts)' : 'Respuesta Incorrecta'}
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Boton siguiente */}
        {submitted && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleNext}
              className="ia-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              Siguiente Pregunta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
