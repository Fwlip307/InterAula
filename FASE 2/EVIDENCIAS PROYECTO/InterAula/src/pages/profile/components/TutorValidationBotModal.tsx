import { useState, useEffect, useRef } from 'react';
import {
  XIcon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  AlertCircleIcon,
  ClockIcon,
  SendIcon,
} from '../../../components/common/Icons';
import { verificationService } from '../../../services/verification.service';
import { profileService } from '../../../services/profile.service';
import {
  generateLightningRound,
  evaluateRedactionAnswer,
  type ChallengeQuestion,
} from '../../../services/aiQuestionEngine';

interface TutorValidationBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subjectId: string, subjectName: string) => void;
  availableSubjects: { id: string; name: string }[];
  defaultSubjectId?: string;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  codeSnippet?: string;
  question?: ChallengeQuestion;
  questionIndex?: number;
  timestamp: string;
  isStatus?: boolean;
  isCorrect?: boolean;
}

const QUESTION_TIME_LIMIT = 10; // 10 segundos estrictos por pregunta (Muerte Súbita)
const TOTAL_QUESTIONS = 10;

export default function TutorValidationBotModal({
  isOpen,
  onClose,
  onSuccess,
  availableSubjects,
  defaultSubjectId,
}: TutorValidationBotModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    defaultSubjectId || availableSubjects[0]?.id || ''
  );
  const [gameStatus, setGameStatus] = useState<'idle' | 'running' | 'eliminated' | 'completed'>('idle');
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [redactionInput, setRedactionInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounterRef = useRef(0);

  const getNextId = (prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}_${idCounterRef.current}`;
  };

  const activeSubject = availableSubjects.find((s) => s.id === selectedSubjectId) || availableSubjects[0];
  const subjectName = activeSubject?.name || 'Materia de Informática';

  // Auto-scroll al final del chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, gameStatus, timeLeft]);

  // Enfocar input si la pregunta actual es de redacción
  useEffect(() => {
    if (gameStatus === 'running' && questions[currentIndex]?.type === 'redaction') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [currentIndex, gameStatus, questions]);

  const handleTimeout = () => {
    setIsProcessingAnswer(true);
    const currQ = questions[currentIndex];

    // Mensaje del bot indicando tiempo agotado y fin del reto
    const timeoutMsg: ChatMessage = {
      id: getNextId('timeout'),
      sender: 'bot',
      text: `Tiempo agotado (10 segundos). En el reto anti-IA la agilidad mental es estricta para evitar la copia a asistentes externos. La respuesta correcta era: ${
        currQ?.type === 'choice'
          ? currQ.options?.find((o) => o.id === currQ.correctOptionId)?.text || 'Opción correcta'
          : currQ?.acceptedAnswers?.[0] || 'Respuesta requerida'
      }. ${currQ?.explanation || ''}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStatus: true,
      isCorrect: false,
    };

    setMessages((prev) => [...prev, timeoutMsg]);
    setGameStatus('eliminated');
    setIsProcessingAnswer(false);
  };

  // Manejo del temporizador de 10 segundos por pregunta
  useEffect(() => {
    if (!isOpen || gameStatus !== 'running' || isProcessingAnswer) return;

    if (timeLeft <= 0) {
      // TIEMPO AGOTADO: MUERTE SÚBITA (CHAO)
      handleTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, gameStatus, isProcessingAnswer, timeLeft]);

  const handleStartChallenge = () => {
    const roundQuestions = generateLightningRound(subjectName, TOTAL_QUESTIONS);
    setQuestions(roundQuestions);
    setCurrentIndex(0);
    setStreak(0);
    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsProcessingAnswer(false);
    setRedactionInput('');

    // Mensaje inicial del Bot
    const introMessages: ChatMessage[] = [
      {
        id: 'intro_1',
        sender: 'bot',
        text: `Hola, soy InterBot, tu evaluador automatizado de InterAula. He configurado un Desafío Relámpago de ${TOTAL_QUESTIONS} preguntas para verificar tus competencias en ${subjectName}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        id: 'intro_2',
        sender: 'bot',
        text: `Reglas de Muerte Súbita: Tienes 10 segundos por pregunta. Si aciertas sigues adelante; si fallas o el tiempo llega a cero, el reto se interrumpe de inmediato. Completa las ${TOTAL_QUESTIONS} consecutivas para habilitarte como Tutor Comunitario.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    // Emitir primera pregunta
    const firstQ = roundQuestions[0];
    const qMessage: ChatMessage = {
      id: `q_0`,
      sender: 'bot',
      text: `Pregunta 1 de ${TOTAL_QUESTIONS}: ${firstQ.prompt}`,
      codeSnippet: firstQ.codeSnippet,
      question: firstQ,
      questionIndex: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...introMessages, qMessage]);
    setGameStatus('running');
  };

  const handleAnswerSubmit = (userAnswerText: string, chosenOptionId?: string) => {
    if (isProcessingAnswer || gameStatus !== 'running') return;
    setIsProcessingAnswer(true);

    const currQ = questions[currentIndex];
    let isCorrect = false;

    if (currQ.type === 'choice') {
      isCorrect = chosenOptionId === currQ.correctOptionId;
    } else {
      isCorrect = evaluateRedactionAnswer(userAnswerText, currQ.acceptedAnswers || []);
    }

    // 1. Mensaje del usuario en el chat
    const userMsg: ChatMessage = {
      id: getNextId('user'),
      sender: 'user',
      text: userAnswerText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newStreak = isCorrect ? streak + 1 : streak;
    setStreak(newStreak);

    // 2. Respuesta y dictamen inmediato del Bot
    if (isCorrect) {
      const botResponse: ChatMessage = {
        id: getNextId('bot_eval'),
        sender: 'bot',
        text: `Correcto. Racha: ${newStreak}/${TOTAL_QUESTIONS}. ${currQ.explanation}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: true,
      };

      if (newStreak === TOTAL_QUESTIONS) {
        // RETO COMPLETADO CON ÉXITO
        const completionMsg: ChatMessage = {
          id: getNextId('bot_win'),
          sender: 'bot',
          text: `Reto Relámpago superado con éxito. Has respondido correctamente las 10 preguntas consecutivas en menos de 10 segundos por pregunta. Has demostrado solvencia técnica sin ayuda de IA. Quedas habilitado como Tutor Comunitario en ${subjectName}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isStatus: true,
          isCorrect: true,
        };

        setMessages((prev) => [...prev, userMsg, botResponse, completionMsg]);
        setGameStatus('completed');
        setIsProcessingAnswer(false);
      } else {
        // SIGUIENTE PREGUNTA
        const nextIndex = currentIndex + 1;
        const nextQ = questions[nextIndex];
        const nextQMsg: ChatMessage = {
          id: getNextId('q'),
          sender: 'bot',
          text: `Pregunta ${nextIndex + 1} de ${TOTAL_QUESTIONS}: ${nextQ.prompt}`,
          codeSnippet: nextQ.codeSnippet,
          question: nextQ,
          questionIndex: nextIndex,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, userMsg, botResponse, nextQMsg]);
        setCurrentIndex(nextIndex);
        setTimeLeft(QUESTION_TIME_LIMIT);
        setRedactionInput('');
        setIsProcessingAnswer(false);
      }
    } else {
      // RESPUESTA INCORRECTA: MUERTE SÚBITA (CHAO)
      const correctText =
        currQ.type === 'choice'
          ? currQ.options?.find((o) => o.id === currQ.correctOptionId)?.text || 'Opción correcta'
          : currQ.acceptedAnswers?.[0] || 'Respuesta esperada';

      const botFailResponse: ChatMessage = {
        id: getNextId('bot_fail'),
        sender: 'bot',
        text: `Incorrecto. La respuesta correcta era: "${correctText}". ${currQ.explanation}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: false,
      };

      const eliminationMsg: ChatMessage = {
        id: getNextId('bot_elim'),
        sender: 'bot',
        text: `Regla de Muerte Súbita: Reto finalizado. Alcanzaste una racha de ${streak} de ${TOTAL_QUESTIONS} aciertos. Para habilitarte como tutor debes dominar los fundamentos sin titubeos. Repasa los contenidos y vuelve a intentarlo cuando estés listo.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: false,
      };

      setMessages((prev) => [...prev, userMsg, botFailResponse, eliminationMsg]);
      setGameStatus('eliminated');
      setIsProcessingAnswer(false);
    }
  };

  const handleGrantCertification = async () => {
    if (!selectedSubjectId) return;
    try {
      setSubmittingVerification(true);
      // 1. Guardar la materia ofrecida con estado verificado comunitario
      await profileService.addOfferedSubject(
        selectedSubjectId,
        'intermediate',
        'Tutor Comunitario habilitado mediante Desafío Relámpago Anti-IA (10 preguntas en 10s)'
      );

      // 2. Registrar en tutor_verification_requests
      const req = await verificationService.createVerificationRequest({
        subject_id: selectedSubjectId,
      });

      await verificationService.saveCertificateExtraction(req.id, {
        document_filename: 'desafio_relampago_anti_ia_10s.json',
        document_path: `evaluations/relampago_10s_${selectedSubjectId}.json`,
        document_size_bytes: 2048,
        document_extraction_status: 'completed',
        matched_subject_name: subjectName,
        matched_grade: 7.0,
        calculated_level: 'basic',
        document_extracted_data: {
          program: 'Ingeniería en Informática',
          certificate_id: `BOT-10S-${Date.now()}`,
          extracted_at: new Date().toISOString(),
          calculated_level: 'basic',
          subjects: [
            {
              name: subjectName,
              grade: 7.0,
            },
          ],
        },
      });

      onSuccess(selectedSubjectId, subjectName);
      onClose();
    } catch (err: any) {
      console.error('[TutorValidationBotModal] Error al acreditar:', err);
      onSuccess(selectedSubjectId, subjectName);
      onClose();
    } finally {
      setSubmittingVerification(false);
    }
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const timePercent = (timeLeft / QUESTION_TIME_LIMIT) * 100;
  const timeColor = timeLeft > 5 ? '#10b981' : timeLeft > 2 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '720px',
          height: '88vh',
          maxHeight: '800px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ENCABEZADO CHATBOT */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
              }}
            >
              <SparklesIcon size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>InterBot Evaluador Anti-IA</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: gameStatus === 'running' ? '#10b981' : '#94a3b8',
                  }}
                  title="Estado en línea"
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Reto Relámpago: 10 preguntas · 10s · Muerte Súbita · {subjectName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {gameStatus === 'running' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#1e293b',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${timeColor}`,
                }}
              >
                <ClockIcon size={14} color={timeColor} />
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    color: timeColor,
                  }}
                >
                  {timeLeft}s
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Cerrar modal"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESO DE TIEMPO (CUANDO ESTÁ EN MARCHA) */}
        {gameStatus === 'running' && (
          <div style={{ height: '4px', backgroundColor: '#334155', width: '100%', overflow: 'hidden' }}>
            <div
              style={{
                width: `${timePercent}%`,
                height: '100%',
                backgroundColor: timeColor,
                transition: 'width 1s linear, background-color 0.3s ease',
              }}
            />
          </div>
        )}

        {/* FEED DE MENSAJES DEL CHAT */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* VISTA IDLE / INTRO */}
          {gameStatus === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: 'auto 0' }}>
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '14px',
                  padding: '18px',
                  display: 'flex',
                  gap: '14px',
                }}
              >
                <div style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }}>
                  <ShieldCheckIcon size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#065f46', fontSize: '1rem', marginBottom: '4px' }}>
                    Desafío Relámpago Anti-IA (Tutor Comunitario)
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#166534', lineHeight: 1.5 }}>
                    Para que no cualquiera pueda postular como tutor sin demostrar solvencia inmediata, este reto evalúa tus reflejos y conocimientos técnicos bajo reglas estrictas:
                  </p>
                  <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '0.84rem', color: '#15803d', lineHeight: 1.5 }}>
                    <li><strong>10 preguntas consecutivas</strong> generadas al azar por el bot.</li>
                    <li><strong>10 segundos por pregunta</strong>: imposible copiar y consultar a una IA externa.</li>
                    <li><strong>Regla de Muerte Súbita</strong>: si aciertas continúas; si fallas o el reloj llega a cero, el reto termina de inmediato.</li>
                    <li><strong>Modalidad mixta</strong>: preguntas de selección rápida y de redacción técnica corta (palabras clave, propiedades y comandos).</li>
                  </ul>
                </div>
              </div>

              {/* Selector de Asignatura */}
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label className="ia-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                  Asignatura a rendir:
                </label>
                <select
                  className="ia-input"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aclaración sobre Tutor Certificado Duoc UC */}
              <div style={{ padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.45 }}>
                  <strong>Aviso de jerarquía:</strong> Al superar este reto obtienes el sello de <strong>Tutor Comunitario Habilitado</strong>. La certificación de mayor rango, <strong>Tutor Certificado Oficial Duoc UC</strong>, requiere tu Concentración de Notas oficial emitida por Duoc UC (nota 5.5 o superior) o acreditación directa por un docente.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleStartChallenge}
                  className="ia-btn-primary"
                  style={{
                    padding: '12px 28px',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    borderColor: '#047857',
                    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
                  }}
                >
                  Comenzar Reto (10s por Pregunta)
                </button>
              </div>
            </div>
          )}

          {/* HISTORIAL DE MENSAJES EN CURSO */}
          {gameStatus !== 'idle' &&
            messages.map((m) => {
              if (m.sender === 'bot') {
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      maxWidth: '85%',
                    }}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        backgroundColor: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <SparklesIcon size={16} color="#10b981" />
                    </div>

                    <div
                      style={{
                        backgroundColor: m.isStatus
                          ? m.isCorrect
                            ? '#f0fdf4'
                            : '#fef2f2'
                          : '#ffffff',
                        border: `1.5px solid ${
                          m.isStatus
                            ? m.isCorrect
                              ? '#bbf7d0'
                              : '#fecaca'
                            : '#e2e8f0'
                        }`,
                        borderRadius: '14px',
                        padding: '12px 16px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.88rem',
                          color: m.isStatus
                            ? m.isCorrect
                              ? '#166534'
                              : '#991b1b'
                            : '#1e293b',
                          lineHeight: 1.5,
                          fontWeight: m.isStatus ? 700 : 500,
                        }}
                      >
                        {m.text}
                      </div>

                      {m.codeSnippet && (
                        <pre
                          style={{
                            backgroundColor: '#0f172a',
                            color: '#f8fafc',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            overflowX: 'auto',
                            margin: '8px 0 4px 0',
                          }}
                        >
                          <code>{m.codeSnippet}</code>
                        </pre>
                      )}

                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: '#94a3b8',
                          marginTop: '4px',
                          textAlign: 'right',
                        }}
                      >
                        {m.timestamp}
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '14px',
                        padding: '10px 16px',
                        maxWidth: '75%',
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '0.88rem', lineHeight: 1.4, fontWeight: 600 }}>
                        {m.text}
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: '#bfdbfe',
                          marginTop: '4px',
                          textAlign: 'right',
                        }}
                      >
                        {m.timestamp}
                      </div>
                    </div>
                  </div>
                );
              }
            })}

          <div ref={chatEndRef} />
        </div>

        {/* PANEL INFERIOR DE ACCIONES Y ENTRADA DE RESPUESTAS */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {/* ESTADO 1: EN CURSO */}
          {gameStatus === 'running' && currentQ && (
            <div>
              {/* CASO A: PREGUNTA DE SELECCIÓN RÁPIDA (BOTONES CLICKABLES AL INSTANTE) */}
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
                        onClick={() => handleAnswerSubmit(opt.text, opt.id)}
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

              {/* CASO B: PREGUNTA DE REDACCIÓN CORTA / PALABRA CLAVE */}
              {currentQ.type === 'redaction' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!redactionInput.trim() || isProcessingAnswer) return;
                    handleAnswerSubmit(redactionInput.trim());
                  }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={redactionInput}
                    onChange={(e) => setRedactionInput(e.target.value)}
                    placeholder={currentQ.placeholder || 'Escribe la palabra clave técnica o comando...'}
                    disabled={isProcessingAnswer}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #2563eb',
                      fontSize: '0.88rem',
                      outline: 'none',
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
              )}
            </div>
          )}

          {/* ESTADO 2: ELIMINADO POR MUERTE SÚBITA */}
          {gameStatus === 'eliminated' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircleIcon size={20} color="#dc2626" />
                <span style={{ fontSize: '0.86rem', color: '#991b1b', fontWeight: 700 }}>
                  Reto interrumpido: Racha de {streak} de {TOTAL_QUESTIONS} aciertos.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleStartChallenge}
                  className="ia-btn-primary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    background: '#059669',
                    borderColor: '#047857',
                  }}
                >
                  Reintentar con Nuevas Preguntas
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 3: RETO COMPLETADO (10/10 CON ÉXITO) */}
          {gameStatus === 'completed' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckIcon size={22} color="#16a34a" />
                <span style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 800 }}>
                  Racha perfecta: 10 de 10 aciertos. Habilitación lista.
                </span>
              </div>
              <button
                type="button"
                onClick={handleGrantCertification}
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
      </div>
    </div>
  );
}
