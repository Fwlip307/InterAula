import { useState, useEffect, useRef } from 'react';
import {
  XIcon,
  ShieldCheckIcon,
  SparklesIcon,
  AlertCircleIcon,
  ClockIcon,
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
} from '../../../services/aiQuestionEngine';
import {
  hasGeminiApiConfigured,
  evaluateAnswerWithGemini,
} from '../../../services/geminiAiService';
import { useAntiCheat } from '../hooks/useAntiCheat';
import TutorAntiCheatOverlays from './TutorAntiCheatOverlays';
import TutorValidationIntro from './TutorValidationIntro';
import TutorValidationBottomBar from './TutorValidationBottomBar';

interface TutorValidationBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subjectId: string, subjectName: string, level?: AcademicLevel) => void;
  availableSubjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  userInstitution?: string;
  userCareer?: string;
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
  userInstitution,
  userCareer,
}: TutorValidationBotModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    defaultSubjectId || availableSubjects[0]?.id || ''
  );
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const aiEnabled = true;

  // Temporizador para la fase de generación de preguntas
  useEffect(() => {
    let interval: any = null;
    if (isGenerating) {
      setGenerationSeconds(0);
      interval = setInterval(() => {
        setGenerationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setGenerationSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

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
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [eliminationReason, setEliminationReason] = useState<'timeout' | 'wrong_answer' | null>(null);

  const {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    tabSwitchCount,
    showTabWarning,
    setShowTabWarning,
    isWindowBlurred,
    setIsWindowBlurred,
    screenshotBlockedToast,
    pasteWarning,
    setPasteWarning,
    resetAntiCheat,
  } = useAntiCheat({
    isOpen,
    isActiveExam: step === 'answering' || step === 'ready_check' || step === 'question_feedback',
  });

  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounterRef = useRef(0);
  const questionEndTimeRef = useRef<number>(0);

  const getNextId = (prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}_${idCounterRef.current}`;
  };

  const activeSubject = availableSubjects.find((s) => s.id === selectedSubjectId) || availableSubjects[0];
  const subjectName = isCustomSubject && customSubjectInput.trim()
    ? customSubjectInput.trim()
    : activeSubject?.name || 'Materia Universitaria';

  // Manejo de salida segura y confirmación de abandono
  const handleRequestClose = () => {
    if (step === 'ready_check' || step === 'answering' || step === 'question_feedback') {
      setShowAbandonConfirm(true);
    } else {
      handleFinalClose();
    }
  };

  const handleFinalClose = () => {
    resetAntiCheat();
    setShowAbandonConfirm(false);
    setEliminationReason(null);
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
    setEliminationReason('timeout');
    setStep('eliminated');
    setIsProcessingAnswer(false);
  };

  // Manejo del temporizador: reloj real absoluto con Date.now() (no se congela al minimizar)
  useEffect(() => {
    if (!isOpen || step !== 'answering' || isProcessingAnswer) return;

    const checkTime = () => {
      if (isProcessingAnswer) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((questionEndTimeRef.current - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleTimeout();
      }
    };

    checkTime();
    const timer = setInterval(checkTime, 250);

    const handleSync = () => {
      checkTime();
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [isOpen, step, isProcessingAnswer]);

  const getGenerationStatus = (sec: number) => {
    if (sec < 2) {
      return 'Conectando con el motor de Inteligencia Artificial...';
    } else if (sec < 5) {
      return `Analizando temario oficial de "${subjectName}"...`;
    } else if (sec < 8) {
      return 'Formulando 10 reactivos técnicos y alternativas de respuesta...';
    } else {
      return 'Calibrando criterios de evaluación y preparando entorno seguro...';
    }
  };

  // Paso 1: Inicializar la prueba y comenzar inmediatamente en pantalla completa
  const handleStartChallenge = async () => {
    setErrorMessage(null);

    if (isCustomSubject && !customSubjectInput.trim()) {
      setErrorMessage('Por favor escribe el nombre de la asignatura que deseas evaluar.');
      return;
    }

    setIsGenerating(true);
    setGenerationSeconds(0);

    // 1. Invocar pantalla completa en el evento de clic directo del usuario (garantiza aceptación del navegador)
    enterFullscreen();

    try {
      const roundQuestions = await generateLightningRound(
        subjectName,
        selectedLevel,
        TOTAL_QUESTIONS,
        { institution: userInstitution, career: userCareer }
      );
      if (!roundQuestions || roundQuestions.length === 0) {
        setErrorMessage(
          `No fue posible generar las preguntas para "${subjectName}" en este momento. Por favor reintenta en unos instantes.`
        );
        setIsGenerating(false);
        return;
      }

      // Reasegurar pantalla completa
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
          text: `Para que leas y respondas con calma, el tiempo solo correrá cuando tengas la pregunta en pantalla (${TIME_LIMIT_CHOICE} segundos en preguntas de alternativas y ${TIME_LIMIT_REDACTION} segundos en desarrollo técnico). Entre cada pregunta podrás tomarte una pausa para revisar la retroalimentación.`,
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
    questionEndTimeRef.current = Date.now() + initialTime * 1000;

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
      setEliminationReason('wrong_answer');
      setStep('eliminated');
      setIsProcessingAnswer(false);
    }
  };

  // Paso 4: El usuario hace clic en "Pasar a la siguiente pregunta"
  const handleProceedToNextQuestion = () => {
    const nextIndex = currentIndex + 1;
    const nextQ = questions[nextIndex];
    const nextQTime = nextQ ? getQuestionTimeLimit(nextQ) : TIME_LIMIT_CHOICE;
    questionEndTimeRef.current = Date.now() + nextQTime * 1000;

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
    const effectiveSubjectId = isCustomSubject ? `custom_${Date.now()}` : selectedSubjectId;
    if (!effectiveSubjectId) return;
    try {
      setSubmittingVerification(true);
      await profileService.addOfferedSubject(
        effectiveSubjectId,
        selectedLevel,
        `Tutor Habilitado (${selectedLevel === 'basic' ? 'Nivel Básico' : selectedLevel === 'advanced' ? 'Nivel Avanzado' : 'Nivel Intermedio'}) mediante Evaluación Técnica de Contenidos`
      );

      const req = await verificationService.createVerificationRequest({
        subject_id: effectiveSubjectId,
      });

      await verificationService.saveCertificateExtraction(req.id, {
        document_filename: 'evaluacion_tecnica_tutor.json',
        document_path: `evaluations/evaluacion_${effectiveSubjectId}.json`,
        document_size_bytes: 2048,
        document_extraction_status: 'completed',
        matched_subject_name: subjectName,
        matched_grade: 7.0,
        calculated_level: selectedLevel,
        document_extracted_data: {
          program: userCareer || 'Educación Superior',
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
      onSuccess(effectiveSubjectId, subjectName, selectedLevel);
      onClose();
    } catch (err: any) {
      console.error('[TutorValidationBotModal] Error al acreditar:', err);
      exitFullscreen();
      onSuccess(effectiveSubjectId, subjectName, selectedLevel);
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
      <style>{`
        @keyframes ia-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ia-pulse-scale {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.88; }
        }
        @keyframes ia-indeterminate {
          0% { left: -40%; width: 40%; }
          50% { left: 25%; width: 50%; }
          100% { left: 100%; width: 40%; }
        }
      `}</style>
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isFullscreen ? '0' : '18px',
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : '860px',
          height: isFullscreen ? '100vh' : '92vh',
          maxHeight: isFullscreen ? '100vh' : '920px',
          boxShadow: isFullscreen ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: isFullscreen ? 'none' : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        {/* ESCUDO DE PRIVACIDAD ANTICAPTURA AL PERDER EL FOCO O MINIMIZAR */}
        {isWindowBlurred && (step === 'answering' || step === 'question_feedback') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#020617',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 120,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                marginBottom: '16px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <ShieldCheckIcon size={32} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.35rem', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              Contenido Oculto por Seguridad
            </div>
            <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8', maxWidth: '480px', lineHeight: 1.6 }}>
              La ventana perdió el foco o se detectó una herramienta de captura de pantalla. Para asegurar la integridad técnica, el contenido se oculta de inmediato.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsWindowBlurred(false);
                enterFullscreen();
              }}
              className="ia-btn-primary"
              style={{
                marginTop: '20px',
                padding: '10px 24px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              }}
            >
              Volver a la Evaluación
            </button>
          </div>
        )}

        {/* NOTIFICACIÓN TOAST DE CAPTURA BLOQUEADA */}
        {screenshotBlockedToast && (
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#7f1d1d',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '0.92rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
              zIndex: 130,
              border: '1px solid #ef4444',
            }}
          >
            <AlertCircleIcon size={16} color="#fca5a5" />
            <span>Captura de pantalla no permitida durante la evaluación</span>
          </div>
        )}

        {/* MODALES DE CONTROL ANTI-CHEAT Y SALIDA */}
        <TutorAntiCheatOverlays
          showAbandonConfirm={showAbandonConfirm}
          onCancelAbandon={() => setShowAbandonConfirm(false)}
          onConfirmAbandon={handleFinalClose}
          isFullscreen={isFullscreen}
          step={step}
          isGenerating={isGenerating}
          onEnterFullscreen={enterFullscreen}
        />

        {/* ENCABEZADO CHATBOT */}
        <div
          style={{
            padding: '18px 24px',
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
                <span style={{ fontWeight: 800, fontSize: '1.12rem', letterSpacing: '-0.01em' }}>Asistente Evaluador de Tutores</span>
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
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1px solid #059669',
                    }}
                  >
                    <LockIcon size={10} color="#a7f3d0" />
                    Enfoque F11
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                {userInstitution
                  ? `${userInstitution}${userCareer ? ` · ${userCareer}` : ''}`
                  : `Habilitación de Tutor Comunitario · ${subjectName}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isGenerating && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#064e3b',
                  border: '1px solid #059669',
                  color: '#a7f3d0',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                <ClockIcon size={12} color="#34d399" />
                <span>Generando... {generationSeconds}s</span>
              </div>
            )}

            {step === 'idle' && !isGenerating && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#064e3b',
                  border: '1px solid #059669',
                  color: '#a7f3d0',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                <SparklesIcon size={12} color="#34d399" />
                <span>Evaluador IA Activo</span>
              </div>
            )}

            {step === 'ready_check' && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#064e3b',
                  border: '1px solid #059669',
                  color: '#a7f3d0',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                <SparklesIcon size={12} color="#34d399" />
                <span>Tiempo en Pausa · Lee con calma</span>
              </div>
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
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
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
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '6px 14px',
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
              fontSize: '0.92rem',
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
                fontSize: '0.82rem',
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
          <div style={{ height: '5px', backgroundColor: '#334155', width: '100%', overflow: 'hidden' }}>
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
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* ESTADO INICIAL: CARGA DINÁMICA O SELECCIÓN DE MATERIA Y NIVEL */}
          {step === 'idle' && (
            <TutorValidationIntro
              isGenerating={isGenerating}
              generationSeconds={generationSeconds}
              getGenerationStatus={getGenerationStatus}
              subjectName={subjectName}
              selectedSubjectId={selectedSubjectId}
              onSelectSubjectId={(id) => {
                setSelectedSubjectId(id);
                setErrorMessage(null);
              }}
              selectedLevel={selectedLevel}
              onSelectLevel={setSelectedLevel}
              availableSubjects={availableSubjects}
              isCustomSubject={isCustomSubject}
              onToggleCustomSubject={() => {
                setIsCustomSubject(!isCustomSubject);
                setErrorMessage(null);
              }}
              customSubjectInput={customSubjectInput}
              onCustomSubjectInputChange={(val) => {
                setCustomSubjectInput(val);
                setErrorMessage(null);
              }}
              userInstitution={userInstitution}
              userCareer={userCareer}
              aiEnabled={aiEnabled}
              errorMessage={errorMessage}
              onStartChallenge={handleStartChallenge}
            />
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
        <TutorValidationBottomBar
          step={step}
          currentQ={currentQ}
          timeLeft={timeLeft}
          isProcessingAnswer={isProcessingAnswer}
          redactionInput={redactionInput}
          onRedactionInputChange={setRedactionInput}
          inputRef={inputRef}
          pasteWarning={pasteWarning}
          onPasteAttempt={() => {
            setPasteWarning(true);
            setTimeout(() => setPasteWarning(false), 3500);
          }}
          streak={streak}
          totalQuestions={TOTAL_QUESTIONS}
          eliminationReason={eliminationReason}
          submittingVerification={submittingVerification}
          onAnswerSubmit={handleAnswerSubmit}
          onRequestClose={handleRequestClose}
          onConfirmReady={handleConfirmReady}
          onProceedNext={handleProceedToNextQuestion}
          onFinalClose={handleFinalClose}
          onRetry={handleStartChallenge}
          onGrantCertification={handleGrantCertification}
        />
      </div>
    </div>
  );
}
