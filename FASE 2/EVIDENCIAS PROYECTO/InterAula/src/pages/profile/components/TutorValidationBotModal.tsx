import { useState, useEffect, useRef } from 'react';
import {
  XIcon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  AlertCircleIcon,
  ClockIcon,
  SendIcon,
  LockIcon,
} from '../../../components/common/Icons';
import { verificationService } from '../../../services/verification.service';
import { profileService } from '../../../services/profile.service';
import type { AcademicLevel } from '../../../types/profile';
import {
  generateLightningRound,
  evaluateRedactionAnswer,
  getQuestionTimeLimit,
  TIME_LIMIT_CHOICE,
  TIME_LIMIT_REDACTION,
  type ChallengeQuestion,
  isSubjectSupportedForAiEvaluation,
} from '../../../services/aiQuestionEngine';
import {
  hasGeminiApiConfigured,
  setSessionGeminiApiKey,
  getGeminiApiKey,
  evaluateAnswerWithGemini,
} from '../../../services/geminiAiService';

interface TutorValidationBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subjectId: string, subjectName: string, level?: AcademicLevel) => void;
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

type StepType = 'idle' | 'ready_check' | 'answering' | 'question_feedback' | 'eliminated' | 'completed';

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
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey() || '');
  const [aiEnabled, setAiEnabled] = useState(hasGeminiApiConfigured());

  useEffect(() => {
    if (isOpen) {
      if (defaultSubjectId && availableSubjects.some((s) => s.id === defaultSubjectId)) {
        setSelectedSubjectId(defaultSubjectId);
      } else if (availableSubjects.length > 0 && (!selectedSubjectId || !availableSubjects.some((s) => s.id === selectedSubjectId))) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    }
  }, [isOpen, defaultSubjectId, availableSubjects]);
  const [step, setStep] = useState<StepType>('idle');
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(TIME_LIMIT_CHOICE);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [redactionInput, setRedactionInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounterRef = useRef(0);

  const getNextId = (prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}_${idCounterRef.current}`;
  };

  const activeSubject = availableSubjects.find((s) => s.id === selectedSubjectId) || availableSubjects[0];
  const subjectName = activeSubject?.name || 'Materia de Informática';

  // Control de pantalla completa (Modo Enfoque F11)
  const enterFullscreen = async () => {
    try {
      const el = modalOverlayRef.current || document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('[TutorValidationBotModal] Pantalla completa rechazada o no soportada:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('[TutorValidationBotModal] Error al salir de pantalla completa:', err);
    }
  };

  // Monitorear cambios de pantalla completa para sincronizar estado
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Bloqueo de atajos de teclado para copia e inspección durante la evaluación
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'C', 'u', 'U', 's', 'S', 'p', 'P'].includes(e.key)
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Detección de pérdida de foco o cambio de pestaña durante la pregunta activa
  useEffect(() => {
    if (!isOpen || step !== 'answering') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setShowTabWarning(true);
      }
    };

    const handleWindowBlur = () => {
      setTabSwitchCount((prev) => prev + 1);
      setShowTabWarning(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isOpen, step]);

  // Manejo de salida segura y confirmación de abandono
  const handleRequestClose = () => {
    if (step === 'ready_check' || step === 'answering' || step === 'question_feedback') {
      setShowAbandonConfirm(true);
    } else {
      handleFinalClose();
    }
  };

  const handleFinalClose = () => {
    exitFullscreen();
    setShowAbandonConfirm(false);
    setShowTabWarning(false);
    setPasteWarning(false);
    setStep('idle');
    setQuestions([]);
    setCurrentIndex(0);
    setStreak(0);
    setMessages([]);
    onClose();
  };

  // Auto-scroll al final del chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, step, timeLeft]);

  // Enfocar input si la pregunta actual es de redacción
  useEffect(() => {
    if (step === 'answering' && questions[currentIndex]?.type === 'redaction') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    }
  }, [currentIndex, step, questions]);

  const handleTimeout = () => {
    setIsProcessingAnswer(true);
    const currQ = questions[currentIndex];
    const qTime = currQ ? getQuestionTimeLimit(currQ) : TIME_LIMIT_CHOICE;

    const correctText =
      currQ?.type === 'choice'
        ? currQ.options?.find((o) => o.id === currQ.correctOptionId)?.text || 'Opción correcta'
        : currQ?.acceptedAnswers?.[0] || 'Respuesta requerida';

    const timeoutMsg: ChatMessage = {
      id: getNextId('timeout'),
      sender: 'bot',
      text: `Tiempo agotado (${qTime} segundos). La respuesta esperada era: "${correctText}". ${currQ?.explanation || ''}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStatus: true,
      isCorrect: false,
    };

    const finalNoticeMsg: ChatMessage = {
      id: getNextId('notice_timeout'),
      sender: 'bot',
      text: `Para ser tutor necesitas completar la evaluación demostrando agilidad y dominio técnico. Alcanzaste ${streak} de ${TOTAL_QUESTIONS} aciertos. ¡Tómate un momento para repasar y vuelve a intentarlo cuando estés listo!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStatus: true,
      isCorrect: false,
    };

    setMessages((prev) => [...prev, timeoutMsg, finalNoticeMsg]);
    setStep('eliminated');
    setIsProcessingAnswer(false);
  };

  // Manejo del temporizador: SOLO corre durante 'answering' (mientras responde la pregunta)
  useEffect(() => {
    if (!isOpen || step !== 'answering' || isProcessingAnswer) return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step, isProcessingAnswer, timeLeft]);

  // Paso 1: Inicializar la prueba y preguntar interactivamente si está listo (tiempo pausado)
  const handleStartChallenge = async () => {
    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const roundQuestions = await generateLightningRound(subjectName, selectedLevel, TOTAL_QUESTIONS);
      if (!roundQuestions || roundQuestions.length === 0) {
        setErrorMessage(
          `La materia "${subjectName}" aún no cuenta con banco de preguntas activado en el piloto. Por favor selecciona Programación Web o solicita acreditación mediante Respaldo de Profesor.`
        );
        setIsGenerating(false);
        return;
      }

      enterFullscreen();
      setQuestions(roundQuestions);
      setCurrentIndex(0);
      setStreak(0);
      setIsProcessingAnswer(false);
      setRedactionInput('');

      const levelNames: Record<AcademicLevel, string> = {
        basic: 'Básico (Tutor Inicial)',
        intermediate: 'Intermedio (Tutor Comunitario)',
        advanced: 'Avanzado (Tutor Senior)',
      };

      const introMessages: ChatMessage[] = [
        {
          id: getNextId('intro'),
          sender: 'bot',
          text: `Hola, soy tu Asistente Evaluador de InterAula. Para habilitarte como tutor en ${subjectName} [Nivel ${levelNames[selectedLevel]}], necesitas rendir esta evaluación práctica de ${roundQuestions.length} preguntas basada exclusivamente en el temario de la materia.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: getNextId('intro_rules'),
          sender: 'bot',
          text: `Para que leas y respondas con calma, el tiempo solo correrá cuando tengas la pregunta en pantalla (${TIME_LIMIT_CHOICE} segundos en preguntas de alternativas y ${TIME_LIMIT_REDACTION} segundos en desarrollo técnico). Entre cada pregunta podrás tomarte una pausa para revisar la explicación.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: getNextId('ready_question'),
          sender: 'bot',
          text: `¿Estás listo para comenzar con la primera pregunta?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];

      setMessages(introMessages);
      setStep('ready_check');
    } catch (err: any) {
      console.error('[TutorValidationBotModal] Error al generar preguntas:', err);
      setErrorMessage('Ocurrió un error al preparar la evaluación. Intenta nuevamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Paso 2: El usuario confirma que está listo -> Se activa pantalla completa, se muestra la Pregunta 1 y arranca el tiempo
  const handleConfirmReady = () => {
    enterFullscreen();
    const userConfirmMsg: ChatMessage = {
      id: getNextId('user_ready'),
      sender: 'user',
      text: '¡Estoy listo, comenzar!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const firstQ = questions[0];
    const initialTime = firstQ ? getQuestionTimeLimit(firstQ) : TIME_LIMIT_CHOICE;

    const qMessage: ChatMessage = {
      id: getNextId('q'),
      sender: 'bot',
      text: `Pregunta 1 de ${TOTAL_QUESTIONS} [${firstQ.type === 'choice' ? `Alternativa · ${TIME_LIMIT_CHOICE}s` : `Desarrollo Técnico · ${TIME_LIMIT_REDACTION}s`}]: ${firstQ.prompt}`,
      codeSnippet: firstQ.codeSnippet,
      question: firstQ,
      questionIndex: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userConfirmMsg, qMessage]);
    setTimeLeft(initialTime);
    setStep('answering');
  };

  // Paso 3: El usuario envía su respuesta a la pregunta activa
  const handleAnswerSubmit = async (userAnswerText: string, chosenOptionId?: string) => {
    if (isProcessingAnswer || step !== 'answering') return;
    setIsProcessingAnswer(true);

    const currQ = questions[currentIndex];
    let isCorrect = false;

    if (currQ.type === 'choice') {
      isCorrect = chosenOptionId === currQ.correctOptionId;
    } else {
      isCorrect = evaluateRedactionAnswer(userAnswerText, currQ.acceptedAnswers || []);
      // Si falló en la comprobación local pero Gemini está activo, intentar evaluación semántica inteligente
      if (!isCorrect && hasGeminiApiConfigured()) {
        try {
          const aiEval = await evaluateAnswerWithGemini(currQ.prompt, userAnswerText, currQ.acceptedAnswers || []);
          if (aiEval === true) {
            isCorrect = true;
          }
        } catch (e) {
          console.warn('[TutorValidationBotModal] Error en evaluación semántica Gemini:', e);
        }
      }
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

    // 2. Respuesta y retroalimentación inmediata del Bot
    if (isCorrect) {
      const botResponse: ChatMessage = {
        id: getNextId('bot_eval'),
        sender: 'bot',
        text: `¡Correcto! Aciertos: ${newStreak} de ${TOTAL_QUESTIONS}. ${currQ.explanation}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: true,
      };

      if (newStreak === TOTAL_QUESTIONS) {
        // RETO COMPLETADO CON ÉXITO
        const completionMsg: ChatMessage = {
          id: getNextId('bot_win'),
          sender: 'bot',
          text: `¡Felicitaciones! Has completado exitosamente las ${TOTAL_QUESTIONS} preguntas de ${subjectName}. Has demostrado solvencia conceptual y pedagógica para ser tutor. Ya puedes activar tu habilitación en tu perfil.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isStatus: true,
          isCorrect: true,
        };

        setMessages((prev) => [...prev, userMsg, botResponse, completionMsg]);
        setStep('completed');
        setIsProcessingAnswer(false);
      } else {
        // PAUSA INTERACTIVA: El bot pregunta si desea pasar a la siguiente (el tiempo se detiene)
        const promptNextMsg: ChatMessage = {
          id: getNextId('bot_prompt_next'),
          sender: 'bot',
          text: `¿Pasamos a la siguiente pregunta?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, userMsg, botResponse, promptNextMsg]);
        setStep('question_feedback');
        setIsProcessingAnswer(false);
      }
    } else {
      // RESPUESTA INCORRECTA: Se detiene y explica
      const correctText =
        currQ.type === 'choice'
          ? currQ.options?.find((o) => o.id === currQ.correctOptionId)?.text || 'Opción correcta'
          : currQ.acceptedAnswers?.[0] || 'Respuesta esperada';

      const botFailResponse: ChatMessage = {
        id: getNextId('bot_fail'),
        sender: 'bot',
        text: `Respuesta incorrecta. La respuesta correcta era: "${correctText}". ${currQ.explanation}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: false,
      };

      const finalFailMsg: ChatMessage = {
        id: getNextId('bot_final_fail'),
        sender: 'bot',
        text: `Para habilitarte como tutor necesitas responder con precisión cada reto (aciertos logrados: ${streak} de ${TOTAL_QUESTIONS}). Te sugerimos repasar estos conceptos troncales y volver a rendir la evaluación cuando gustes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStatus: true,
        isCorrect: false,
      };

      setMessages((prev) => [...prev, userMsg, botFailResponse, finalFailMsg]);
      setStep('eliminated');
      setIsProcessingAnswer(false);
    }
  };

  // Paso 4: El usuario hace clic en "Pasar a la siguiente pregunta"
  const handleProceedToNextQuestion = () => {
    const nextIndex = currentIndex + 1;
    const nextQ = questions[nextIndex];
    const nextQTime = nextQ ? getQuestionTimeLimit(nextQ) : TIME_LIMIT_CHOICE;

    const userProceedMsg: ChatMessage = {
      id: getNextId('user_next'),
      sender: 'user',
      text: 'Pasemos a la siguiente pregunta',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextQMsg: ChatMessage = {
      id: getNextId('q'),
      sender: 'bot',
      text: `Pregunta ${nextIndex + 1} de ${TOTAL_QUESTIONS} [${nextQ.type === 'choice' ? `Alternativa · ${TIME_LIMIT_CHOICE}s` : `Desarrollo Técnico · ${TIME_LIMIT_REDACTION}s`}]: ${nextQ.prompt}`,
      codeSnippet: nextQ.codeSnippet,
      question: nextQ,
      questionIndex: nextIndex,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userProceedMsg, nextQMsg]);
    setCurrentIndex(nextIndex);
    setTimeLeft(nextQTime);
    setRedactionInput('');
    setStep('answering');
  };

  const handleGrantCertification = async () => {
    if (!selectedSubjectId) return;
    try {
      setSubmittingVerification(true);
      await profileService.addOfferedSubject(
        selectedSubjectId,
        selectedLevel,
        `Tutor Habilitado (${selectedLevel === 'basic' ? 'Nivel Básico' : selectedLevel === 'advanced' ? 'Nivel Avanzado' : 'Nivel Intermedio'}) mediante Evaluación Técnica de Contenidos`
      );

      const req = await verificationService.createVerificationRequest({
        subject_id: selectedSubjectId,
      });

      await verificationService.saveCertificateExtraction(req.id, {
        document_filename: 'evaluacion_tecnica_tutor.json',
        document_path: `evaluations/evaluacion_${selectedSubjectId}.json`,
        document_size_bytes: 2048,
        document_extraction_status: 'completed',
        matched_subject_name: subjectName,
        matched_grade: 7.0,
        calculated_level: selectedLevel,
        document_extracted_data: {
          program: 'Ingeniería en Informática',
          certificate_id: `EVAL-TUTOR-${Date.now()}`,
          extracted_at: new Date().toISOString(),
          calculated_level: selectedLevel,
          subjects: [
            {
              name: subjectName,
              grade: 7.0,
            },
          ],
        },
      });

      exitFullscreen();
      onSuccess(selectedSubjectId, subjectName, selectedLevel);
      onClose();
    } catch (err: any) {
      console.error('[TutorValidationBotModal] Error al acreditar:', err);
      exitFullscreen();
      onSuccess(selectedSubjectId, subjectName, selectedLevel);
      onClose();
    } finally {
      setSubmittingVerification(false);
    }
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const currentMaxTime = currentQ ? getQuestionTimeLimit(currentQ) : TIME_LIMIT_CHOICE;
  const timePercent = (timeLeft / currentMaxTime) * 100;
  const timeColor =
    timeLeft > currentMaxTime * 0.4
      ? '#10b981'
      : timeLeft > currentMaxTime * 0.2
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div
      ref={modalOverlayRef}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isFullscreen ? '#090d16' : 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: isFullscreen ? '0' : '16px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isFullscreen ? '0' : '18px',
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : '740px',
          height: isFullscreen ? '100vh' : '88vh',
          maxHeight: isFullscreen ? '100vh' : '820px',
          boxShadow: isFullscreen ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: isFullscreen ? 'none' : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        {/* MODAL DE CONFIGURACIÓN DE GEMINI API */}
        {showApiKeyModal && (
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
              zIndex: 110,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '520px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                    }}
                  >
                    <SparklesIcon size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                      Configurar Google Gemini IA
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                      Generador de preguntas dinámicas y evaluador semántico
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                Conectar la API gratuita de Google Gemini (2.5 Flash) dota a InterAula de:
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Preguntas 100% dinámicas e inéditas en cada intento.</li>
                  <li>Evaluaciones para cualquier materia universitaria del catálogo.</li>
                  <li>Calificación semántica inteligente para redacción abierta.</li>
                </ul>
              </div>

              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                  Google Gemini API Key:
                </label>
                <input
                  type="password"
                  className="ia-input"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.88rem' }}
                />
                <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#64748b' }}>
                  Obtén tu clave gratuita en{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Google AI Studio
                  </a>. La clave se guarda de manera segura solo en tu navegador.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                {aiEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSessionGeminiApiKey('');
                      setApiKeyInput('');
                      setAiEnabled(false);
                      setShowApiKeyModal(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Desconectar API Key
                  </button>
                ) : (
                  <span />
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="ia-btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionGeminiApiKey(apiKeyInput);
                      setAiEnabled(hasGeminiApiConfigured());
                      setShowApiKeyModal(false);
                    }}
                    className="ia-btn-primary"
                    style={{
                      padding: '8px 18px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      backgroundColor: '#2563eb',
                      borderColor: '#1d4ed8',
                    }}
                  >
                    Guardar y Activar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN DE ABANDONO */}
        {showAbandonConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              zIndex: 100,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
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
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                    ¿Deseas salir de la evaluación?
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Puedes retomar la prueba en otro momento
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                Si abandonas ahora, el progreso de la sesión actual no se guardará. No tendrás penalizaciones ni registro negativo en tu cuenta, y podrás volver a realizar la evaluación cuando lo desees.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowAbandonConfirm(false)}
                  className="ia-btn-secondary"
                  style={{ padding: '9px 16px', fontSize: '0.84rem' }}
                >
                  Continuar Evaluación
                </button>
                <button
                  type="button"
                  onClick={handleFinalClose}
                  style={{
                    padding: '9px 18px',
                    fontSize: '0.84rem',
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
        {!isFullscreen && (step === 'ready_check' || step === 'answering' || step === 'question_feedback') && !showAbandonConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              zIndex: 90,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                textAlign: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                }}
              >
                <LockIcon size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                  Pantalla Completa Requerida
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Modo de Enfoque sin Pestañas Externas
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                Para garantizar la transparencia y evitar consultas en otras pestañas, la evaluación debe rendirse en pantalla completa.
              </p>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleFinalClose}
                  className="ia-btn-secondary"
                  style={{ padding: '9px 16px', fontSize: '0.84rem' }}
                >
                  Abandonar Evaluación
                </button>
                <button
                  type="button"
                  onClick={enterFullscreen}
                  className="ia-btn-primary"
                  style={{
                    padding: '9px 20px',
                    fontSize: '0.84rem',
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
                <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>Asistente Evaluador de Tutores</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: step === 'answering' ? '#10b981' : '#94a3b8',
                  }}
                  title="Estado activo"
                />
                {isFullscreen && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#064e3b',
                      color: '#a7f3d0',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: '1px solid #059669',
                    }}
                  >
                    <LockIcon size={10} color="#a7f3d0" />
                    Enfoque F11
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Habilitación de Tutor Comunitario · {subjectName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step === 'idle' && (
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput(getGeminiApiKey() || '');
                  setShowApiKeyModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: aiEnabled ? '#1e3a8a' : '#1e293b',
                  border: `1px solid ${aiEnabled ? '#3b82f6' : '#334155'}`,
                  color: aiEnabled ? '#93c5fd' : '#cbd5e1',
                  borderRadius: '16px',
                  padding: '5px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Configurar conexión con Google Gemini API"
              >
                <SparklesIcon size={13} color={aiEnabled ? '#60a5fa' : '#94a3b8'} />
                <span>{aiEnabled ? 'Gemini IA Activo' : 'Conectar Gemini IA'}</span>
              </button>
            )}

            {step === 'answering' && (
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
                    fontSize: '0.92rem',
                    color: timeColor,
                  }}
                >
                  {timeLeft}s
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  ({currentQ?.type === 'choice' ? 'Alternativa' : 'Desarrollo'})
                </span>
              </div>
            )}

            {/* BOTÓN ÚNICO DE SALIDA / ABANDONO EN CABECERA */}
            {step === 'ready_check' || step === 'answering' || step === 'question_feedback' ? (
              <button
                type="button"
                onClick={handleRequestClose}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = '#fca5a5';
                }}
              >
                Abandonar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestClose}
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
                title="Cerrar ventana"
              >
                <XIcon size={20} />
              </button>
            )}
          </div>
        </div>

        {/* ALERTA DE PÉRDIDA DE FOCO / CAMBIO DE VENTANA */}
        {showTabWarning && step === 'answering' && (
          <div
            style={{
              backgroundColor: '#fef3c7',
              borderBottom: '1px solid #fde68a',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '0.82rem',
              color: '#92400e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircleIcon size={16} color="#d97706" />
              <span>
                <strong>Aviso de Enfoque:</strong> Se detectó cambio de pestaña o ventana ({tabSwitchCount}). Mantén la evaluación en pantalla completa para asegurar la validez de tus respuestas.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTabWarning(false)}
              style={{
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
        )}

        {/* BARRA DE TIEMPO (SOLO CORRE MIENTRAS RESPONDE) */}
        {step === 'answering' && (
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
          {step === 'idle' && (
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
                    Evaluación Práctica para Acreditación de Tutores
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#166534', lineHeight: 1.5 }}>
                    Para habilitarte como tutor y apoyar a tus compañeros en InterAula, necesitas rendir esta evaluación práctica con nuestro Asistente Evaluador:
                  </p>
                  <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '0.84rem', color: '#15803d', lineHeight: 1.5 }}>
                    <li><strong>10 preguntas prácticas</strong> calibradas estrictamente con el temario oficial de la materia.</li>
                    <li><strong>3 niveles formativos</strong>: elige entre Básico, Intermedio o Avanzado según tu dominio.</li>
                    <li><strong>Tiempos específicos por pregunta</strong>: 15 segundos en alternativas y 45 segundos en desarrollo técnico para agilidad.</li>
                    <li><strong>Modo de enfoque en pantalla completa</strong>: evaluación inmersiva con detección de cambio de pestañas.</li>
                    <li><strong>Redacción manual</strong>: respuestas auténticas por teclado (copiado y pegado bloqueado).</li>
                  </ul>
                </div>
              </div>

              {/* Selector de Asignatura */}
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label className="ia-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                  Asignatura a evaluar:
                </label>
                <select
                  className="ia-input"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setErrorMessage(null);
                  }}
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  {availableSubjects.map((s) => {
                    const isSubPilot = isSubjectSupportedForAiEvaluation(s.name);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {isSubPilot ? ' · [Piloto IA Activo]' : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Feedback según disponibilidad del banco o Gemini */}
                <div style={{ marginTop: '10px' }}>
                  {isSubjectSupportedForAiEvaluation(subjectName) ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        fontSize: '0.82rem',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckIcon size={16} color="#16a34a" />
                      <span>
                        <strong>Piloto Activo:</strong> "{subjectName}" cuenta con temario oficial calibrado en 3 niveles de dificultad.
                      </span>
                    </div>
                  ) : aiEnabled ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        fontSize: '0.82rem',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <SparklesIcon size={16} color="#2563eb" />
                      <span>
                        <strong>Google Gemini Activo:</strong> Las 10 preguntas para "{subjectName}" serán generadas dinámicamente en tiempo real mediante IA.
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#fffbeb',
                        borderRadius: '8px',
                        border: '1px solid #fde68a',
                        fontSize: '0.82rem',
                        color: '#92400e',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <AlertCircleIcon size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ lineHeight: 1.45 }}>
                        <strong>Materia en fase de incorporación:</strong> "{subjectName}" no tiene banco curado offline aún. Para evaluarla dinámicamente con IA,{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setApiKeyInput(getGeminiApiKey() || '');
                            setShowApiKeyModal(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#b45309',
                            fontWeight: 700,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          conecta tu API Key de Google Gemini
                        </button>
                        , o selecciona una materia del piloto como <strong>Programación Web</strong> o <strong>Programación de Algoritmos</strong>.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selector de Nivel de Dificultad Académica */}
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label className="ia-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
                  Nivel de Tutoría a Acreditar:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {[
                    {
                      id: 'basic' as AcademicLevel,
                      badge: 'Nivel Básico',
                      title: 'Tutor Inicial',
                      desc: 'Fundamentos nucleares, etiquetas, selectores y conceptos base.',
                    },
                    {
                      id: 'intermediate' as AcademicLevel,
                      badge: 'Nivel Intermedio',
                      title: 'Tutor Comunitario',
                      desc: 'Lógica aplicada, llamadas a APIs, eventos y debugging práctico.',
                    },
                    {
                      id: 'advanced' as AcademicLevel,
                      badge: 'Nivel Avanzado',
                      title: 'Tutor Senior',
                      desc: 'Arquitectura, seguridad web, rendimiento y optimización crítica.',
                    },
                  ].map((lvl) => {
                    const isSelected = selectedLevel === lvl.id;
                    return (
                      <div
                        key={lvl.id}
                        onClick={() => setSelectedLevel(lvl.id)}
                        style={{
                          border: `2px solid ${isSelected ? '#059669' : '#e2e8f0'}`,
                          backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: isSelected ? '#047857' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {lvl.badge}
                          </span>
                          {isSelected && <CheckIcon size={14} color="#059669" />}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                          {lvl.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                          {lvl.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tarjeta del Motor de Evaluación y Estado de IA */}
              <div
                style={{
                  backgroundColor: aiEnabled ? '#f8faff' : '#f8fafc',
                  border: `1.5px solid ${aiEnabled ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: aiEnabled ? '#dbeafe' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: aiEnabled ? '#2563eb' : '#64748b',
                      flexShrink: 0,
                    }}
                  >
                    <SparklesIcon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                      {aiEnabled ? 'Motor IA Activo: Google Gemini 2.5 Flash' : 'Motor Activo: Banco Curado InterAula (Offline)'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {aiEnabled
                        ? 'Generación dinámica de retos inéditos y corrección semántica inteligente.'
                        : 'Preguntas calibradas por docentes. Conecta tu API Key gratuita de Gemini para retos dinámicos.'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput(getGeminiApiKey() || '');
                    setShowApiKeyModal(true);
                  }}
                  className="ia-btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {aiEnabled ? 'Ajustar API' : 'Conectar API'}
                </button>
              </div>

              {/* Mensaje de error si la materia no tiene preguntas */}
              {errorMessage && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.84rem',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircleIcon size={16} color="#dc2626" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Aclaración sobre Tutor Certificado Institucional */}
              <div style={{ padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.45 }}>
                  <strong>Aviso Institucional:</strong> Esta prueba te acredita como <strong>Tutor Comunitario Habilitado</strong> en el nivel elegido. Para obtener el sello de <strong>Tutor Certificado Institucional</strong>, puedes solicitar respaldo formal a tu profesor titular o adjuntar tu Concentración de Notas oficial (nota 5.5 o superior).
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleStartChallenge}
                  disabled={isGenerating || (!isSubjectSupportedForAiEvaluation(subjectName) && !aiEnabled)}
                  className="ia-btn-primary"
                  style={{
                    padding: '12px 30px',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    background:
                      !isSubjectSupportedForAiEvaluation(subjectName) && !aiEnabled
                        ? '#94a3b8'
                        : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    borderColor:
                      !isSubjectSupportedForAiEvaluation(subjectName) && !aiEnabled ? '#94a3b8' : '#047857',
                    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
                    cursor:
                      !isSubjectSupportedForAiEvaluation(subjectName) && !aiEnabled
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {isGenerating
                    ? 'Preparando Evaluación con IA...'
                    : `Iniciar Evaluación [Nivel ${
                        selectedLevel === 'basic'
                          ? 'Básico'
                          : selectedLevel === 'advanced'
                          ? 'Avanzado'
                          : 'Intermedio'
                      }]`}
                </button>
              </div>
            </div>
          )}

          {/* HISTORIAL DE MENSAJES CONVERSACIONALES */}
          {step !== 'idle' &&
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

        {/* PANEL INFERIOR INTERACTIVO SEGÚN EL ESTADO */}
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
                  onClick={handleRequestClose}
                  className="ia-btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  Salir
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReady}
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
                      handleAnswerSubmit(redactionInput.trim());
                    }}
                    style={{ display: 'flex', gap: '8px' }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={redactionInput}
                      onChange={(e) => setRedactionInput(e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        setPasteWarning(true);
                        setTimeout(() => setPasteWarning(false), 3500);
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
                  onClick={handleRequestClose}
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
                  Acierto registrado ({streak}/{TOTAL_QUESTIONS}). El tiempo está en pausa.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="ia-btn-secondary"
                  style={{ padding: '10px 14px', fontSize: '0.82rem' }}
                >
                  Abandonar
                </button>
                <button
                  type="button"
                  onClick={handleProceedToNextQuestion}
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
                  Evaluación finalizada: {streak} de {TOTAL_QUESTIONS} aciertos.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleFinalClose}
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
                  10 de 10 aciertos. Habilitación docente lista.
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
