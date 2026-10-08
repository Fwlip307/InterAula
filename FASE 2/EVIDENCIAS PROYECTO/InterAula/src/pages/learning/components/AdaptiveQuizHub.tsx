import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { profileService } from '../../../services/profile.service';
import type { NeededSubject } from '../../../types/profile';
import {
  adaptiveQuizService,
  INTEREST_THEMES,
  type InterestTheme,
  type AdaptiveQuizQuestion,
} from '../../../services/adaptiveQuiz.service';
import {
  SparklesIcon,
  CheckIcon,
  XIcon,
  BookOpenIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';

const CRITICAL_SUBJECTS = [
  'Programación de Algoritmos',
  'Programación Web',
  'Modelamiento de Base de Datos',
  'Consultas de Bases de Datos',
  'Nivelación Matemática',
  'Programación Orientada a Objetos',
];

interface AdaptiveQuizHubProps {
  isCalmMode?: boolean;
}

export default function AdaptiveQuizHub({ isCalmMode = false }: AdaptiveQuizHubProps) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<string[]>(CRITICAL_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = useState<string>(CRITICAL_SUBJECTS[0]);
  const [selectedTheme, setSelectedTheme] = useState<InterestTheme>(INTEREST_THEMES[0]);
  const [neededSubjectsList, setNeededSubjectsList] = useState<NeededSubject[]>([]);

  // Estado del juego
  const [questions, setQuestions] = useState<AdaptiveQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Cargar materias que el alumno necesita reforzar desde su perfil
  useEffect(() => {
    async function loadStudentNeeds() {
      if (!user) return;
      try {
        const needed = await profileService.getNeededSubjects(user.id);
        setNeededSubjectsList(needed);
        if (needed && needed.length > 0) {
          const names = needed
            .map((n) => n.subject?.name)
            .filter((name): name is string => Boolean(name));
          if (names.length > 0) {
            setSubjects((prev) => Array.from(new Set([...names, ...prev])));
            setSelectedSubject(names[0]);
          }
        }
      } catch (err) {
        console.warn('[AdaptiveQuizHub] No fue posible cargar materias necesarias:', err);
      }
    }
    loadStudentNeeds();
  }, [user]);

  // Generar Quiz
  const handleStartQuiz = async () => {
    setLoadingQuiz(true);
    setQuizCompleted(false);
    setCurrentIdx(0);
    setSelectedOptionId(null);
    setShowHint(false);
    setIsAnswered(false);
    setScore(0);
    setCorrectCount(0);

    try {
      const generated = await adaptiveQuizService.generateQuiz(selectedSubject, selectedTheme, 3);
      setQuestions(generated);
    } catch (err) {
      console.error('[AdaptiveQuizHub] Error al generar quiz:', err);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleSelectOption = (optionId: string) => {
    if (isAnswered) return;
    setSelectedOptionId(optionId);
    setIsAnswered(true);

    const q = questions[currentIdx];
    if (q && optionId === q.correctOptionId) {
      setScore((prev) => prev + 100);
      setCorrectCount((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOptionId(null);
      setShowHint(false);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
      adaptiveQuizService.saveQuizProgress({
        subject: selectedSubject,
        theme: selectedTheme.name,
        score: score + (selectedOptionId === questions[currentIdx]?.correctOptionId ? 100 : 0),
        totalQuestions: questions.length,
        completedAt: new Date().toISOString(),
      });
    }
  };

  const currentQ = questions[currentIdx];

  // Paleta dinámica según modo calma
  const cardBg = isCalmMode ? '#f8fafc' : '#ffffff';
  const borderCol = isCalmMode ? '#cbd5e1' : '#e2e8f0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Banner de Presentación Neuroinclusiva */}
      <div
        className="ia-card"
        style={{
          background: isCalmMode
            ? '#f1f5f9'
            : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)',
          border: `1.5px solid ${isCalmMode ? '#cbd5e1' : '#c4b5fd'}`,
          borderRadius: '16px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  letterSpacing: '0.04em',
                }}
              >
                DISEÑO UNIVERSAL PARA EL APRENDIZAJE (DUA)
              </span>
              <span style={{ fontSize: '0.82rem', color: '#6d28d9', fontWeight: 700 }}>
                Aprende con lo que te apasiona
              </span>
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e1b4b', margin: '0 0 6px 0' }}>
              Micro-Quizzes IA Adaptados a tus Intereses
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#4338ca', lineHeight: 1.5, margin: 0 }}>
              Traduce conceptos abstractos y complejos en analogías claras de tus hobbies y pasiones.
              Sin cronómetros punitivos, con pistas paso a paso y ritmo libre de estrés sensorial.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#ffffff',
              padding: '8px 14px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <SparklesIcon size={18} color="#7c3aed" />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#4c1d95' }}>
              {score} pts acumulados
            </span>
          </div>
        </div>
      </div>

      {/* Pantalla Inicial de Configuración / Lanzador */}
      {questions.length === 0 || quizCompleted ? (
        <div
          className="ia-card"
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {quizCompleted && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                padding: '20px',
                borderRadius: '14px',
                textAlign: 'center',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
                ¡Excelente progreso!
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.92rem', color: '#15803d' }}>
                Completaste el micro-desafío de <strong>{selectedSubject}</strong> con analogías de{' '}
                <strong>{selectedTheme.name}</strong>. Obtuviste {score} puntos ({correctCount} de{' '}
                {questions.length} respuestas correctas).
              </p>
              <div style={{ display: 'inline-flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700 }}>
                  🌱 Cada concepto reforzado afianza tu autonomía académica.
                </span>
              </div>
            </div>
          )}

          {/* Paso 1: Selección de Materia a Reforzar */}
          <div>
            <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              1. Selecciona la Materia que deseas reforzar:
            </label>
            {neededSubjectsList.length > 0 && (
              <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#2563eb', fontWeight: 600 }}>
                💡 Sugerencia: Incluye las materias marcadas en tu perfil de estudiante como "Necesito Refuerzo".
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {subjects.map((sub) => {
                const isSelected = selectedSubject === sub;
                const isProfileNeeded = neededSubjectsList.some((n) => n.subject?.name === sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      fontSize: '0.86rem',
                      fontWeight: isSelected ? 800 : 600,
                      border: `1.5px solid ${isSelected ? '#7c3aed' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                      color: isSelected ? '#6d28d9' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <BookOpenIcon size={14} color={isSelected ? '#7c3aed' : '#64748b'} />
                    <span>{sub}</span>
                    {isProfileNeeded && (
                      <span
                        style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        Prioritaria
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paso 2: Selección de Pasión / Hiperfoco */}
          <div>
            <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              2. Elige tu Pasión o Interés para las Analogías explicativas:
            </label>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#64748b' }}>
              La IA adaptará los problemas y pistas a este tema para que los conceptos tengan sentido práctico e intuitivo para ti.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '12px',
              }}
            >
              {INTEREST_THEMES.map((theme) => {
                const isSelected = selectedTheme.id === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    style={{
                      border: `2px solid ${isSelected ? theme.color : '#e2e8f0'}`,
                      backgroundColor: isSelected ? `${theme.color}10` : '#ffffff',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                      boxShadow: isSelected ? `0 4px 12px ${theme.color}25` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.6rem' }}>{theme.emoji}</span>
                      {isSelected && (
                        <span
                          style={{
                            backgroundColor: theme.color,
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                          }}
                        >
                          Elegido
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      {theme.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                      {theme.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón de Lanzamiento */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={handleStartQuiz}
              disabled={loadingQuiz}
              className="ia-btn-primary"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                borderColor: '#7c3aed',
                padding: '12px 24px',
                fontSize: '0.96rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 6px 14px rgba(124, 58, 237, 0.3)',
                cursor: loadingQuiz ? 'wait' : 'pointer',
              }}
            >
              <SparklesIcon size={18} color="#ffffff" />
              <span>
                {loadingQuiz
                  ? 'Diseñando Micro-Desafío con IA...'
                  : quizCompleted
                  ? 'Iniciar Nuevo Desafío'
                  : 'Comenzar Micro-Quiz Adaptativo'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Reproductor del Quiz Interactivo */
        <div
          className="ia-card"
          style={{
            background: cardBg,
            border: `1.5px solid ${borderCol}`,
            borderRadius: '16px',
            padding: '26px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          {/* Barra de Progreso Superior */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  backgroundColor: '#f3e8ff',
                  color: '#7c3aed',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: '10px',
                }}
              >
                DESAFÍO {currentIdx + 1} DE {questions.length}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                {currentQ.subject}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                Temática: {currentQ.themeLabel}
              </span>
              <button
                type="button"
                onClick={() => setQuestions([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cambiar tema
              </button>
            </div>
          </div>

          {/* Tarjeta de Contexto / Analogía del Interés */}
          {currentQ.analogyContext && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderLeft: '4px solid #7c3aed',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 800, color: '#6d28d9' }}>💡 Analogía de Referencia: </span>
              {currentQ.analogyContext}
            </div>
          )}

          {/* Enunciado de la Pregunta */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', lineHeight: 1.4 }}>
              {currentQ.prompt}
            </h3>

            {currentQ.codeSnippet && (
              <pre
                style={{
                  backgroundColor: '#0f172a',
                  color: '#e2e8f0',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontFamily: 'Consolas, monospace',
                  overflowX: 'auto',
                  lineHeight: 1.5,
                  margin: '10px 0',
                }}
              >
                <code>{currentQ.codeSnippet}</code>
              </pre>
            )}
          </div>

          {/* Botón de Pista Paso a Paso (Andamiaje Cognitivo) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={() => setShowHint((prev) => !prev)}
              style={{
                background: 'none',
                border: '1px dashed #3b82f6',
                borderRadius: '8px',
                color: '#2563eb',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{showHint ? 'Ocultar Pista' : '💡 Dame una pista paso a paso (sin penalización)'}</span>
            </button>
          </div>

          {showHint && (
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '14px 16px',
                borderRadius: '10px',
                fontSize: '0.86rem',
                color: '#1e40af',
                lineHeight: 1.5,
                whiteSpace: 'pre-line',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '4px' }}>Andamiaje de Apoyo:</div>
              {currentQ.hintStepByStep}
            </div>
          )}

          {/* Opciones de Respuesta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentQ.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const isCorrect = opt.id === currentQ.correctOptionId;

              let optBg = '#ffffff';
              let optBorder = '#cbd5e1';
              let optColor = '#1e293b';

              if (isAnswered) {
                if (isCorrect) {
                  optBg = '#f0fdf4';
                  optBorder = '#22c55e';
                  optColor = '#15803d';
                } else if (isSelected) {
                  optBg = '#fef2f2';
                  optBorder = '#ef4444';
                  optColor = '#b91c1c';
                }
              } else if (isSelected) {
                optBg = '#f5f3ff';
                optBorder = '#7c3aed';
                optColor = '#6d28d9';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={isAnswered}
                  style={{
                    backgroundColor: optBg,
                    border: `2px solid ${optBorder}`,
                    color: optColor,
                    padding: '14px 18px',
                    borderRadius: '12px',
                    textAlign: 'left',
                    fontSize: '0.92rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: isAnswered ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: isSelected || (isAnswered && isCorrect) ? optBorder : '#f1f5f9',
                        color: isSelected || (isAnswered && isCorrect) ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <span>{opt.text}</span>
                  </div>

                  {isAnswered && isCorrect && <CheckIcon size={20} color="#16a34a" />}
                  {isAnswered && isSelected && !isCorrect && <XIcon size={20} color="#dc2626" />}
                </button>
              );
            })}
          </div>

          {/* Explicación Pedagógica Post-Respuesta */}
          {isAnswered && (
            <div
              style={{
                backgroundColor: selectedOptionId === currentQ.correctOptionId ? '#f0fdf4' : '#fffbeb',
                border: `1.5px solid ${selectedOptionId === currentQ.correctOptionId ? '#86efac' : '#fde68a'}`,
                padding: '16px 20px',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedOptionId === currentQ.correctOptionId ? (
                  <>
                    <CheckIcon size={18} color="#16a34a" />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#166534' }}>
                      ¡Respuesta Correcta! (+100 pts)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircleIcon size={18} color="#b45309" />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#92400e' }}>
                      ¡Buen intento! Analicemos el porqué:
                    </span>
                  </>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
                {currentQ.explanation}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="ia-btn-primary"
                  style={{
                    backgroundColor: '#7c3aed',
                    borderColor: '#6d28d9',
                    padding: '9px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                >
                  {currentIdx + 1 < questions.length ? 'Siguiente Desafío →' : 'Ver Resultados Finales 🎉'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
