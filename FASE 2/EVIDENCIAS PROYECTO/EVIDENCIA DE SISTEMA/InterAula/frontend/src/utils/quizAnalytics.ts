import type { AdaptiveQuizQuestion, QuizAttemptProgress } from '../services/adaptiveQuiz.service';

export interface QuizAnswerRecord {
  questionId: string;
  prompt: string;
  subject: string;
  selectedOptionId: string;
  selectedOptionText: string;
  correctOptionId: string;
  correctOptionText: string;
  isCorrect: boolean;
  usedHint: boolean;
  explanation: string;
}

export interface QuizSessionSummary {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number;
  practicePoints: number;
  bestStreak: number;
  levelBadge: string;
  motivationalTitle: string;
  motivationalCopy: string;
  strengths: QuizAnswerRecord[];
  toReinforce: QuizAnswerRecord[];
}

export interface CumulativeQuizStats {
  completedSessions: number;
  totalPracticePoints: number;
  averageAccuracyPercent: number | null;
}

export function buildQuizAnswerRecord(
  question: AdaptiveQuizQuestion,
  selectedOptionId: string,
  usedHint: boolean
): QuizAnswerRecord {
  const selectedOpt = question.options.find((o) => o.id === selectedOptionId);
  const correctOpt = question.options.find((o) => o.id === question.correctOptionId);
  const isCorrect = selectedOptionId === question.correctOptionId;

  return {
    questionId: question.id,
    prompt: question.prompt,
    subject: question.subject,
    selectedOptionId,
    selectedOptionText: selectedOpt?.text || selectedOptionId,
    correctOptionId: question.correctOptionId,
    correctOptionText: correctOpt?.text || question.correctOptionId,
    isCorrect,
    usedHint,
    explanation: question.explanation,
  };
}

export function summarizeQuizSession(
  records: QuizAnswerRecord[],
  totalQuestions: number,
  practicePoints: number,
  subject: string
): QuizSessionSummary {
  const safeTotal = Math.max(totalQuestions, records.length, 1);
  const answeredCount = records.length;
  const correctCount = records.filter((r) => r.isCorrect).length;
  const accuracyPercent = Math.round((correctCount / safeTotal) * 100);

  let runningStreak = 0;
  let bestStreak = 0;
  for (const rec of records) {
    if (rec.isCorrect) {
      runningStreak += 1;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  const strengths = records.filter((r) => r.isCorrect);
  const toReinforce = records.filter((r) => !r.isCorrect);

  let levelBadge = 'En exploración';
  let motivationalTitle = `Buen inicio en ${subject}`;
  let motivationalCopy =
    'Cada intento te muestra con claridad qué ideas ya manejas y cuáles conviene repasar con calma.';

  if (accuracyPercent === 100) {
    levelBadge = 'Desafío impecable';
    motivationalTitle = `¡Excelente precisión en ${subject}!`;
    motivationalCopy =
      'Respondiste correctamente todas las preguntas de esta partida. Puedes subir la dificultad probando otro tema específico.';
  } else if (accuracyPercent >= 66) {
    levelBadge = 'Avance sólido';
    motivationalTitle = `¡Muy buen avance en ${subject}!`;
    motivationalCopy =
      'Comprendiste la mayoría de los conceptos evaluados. Revisa el detalle abajo para afinar lo pendiente.';
  }

  return {
    totalQuestions: safeTotal,
    answeredCount,
    correctCount,
    accuracyPercent,
    practicePoints,
    bestStreak,
    levelBadge,
    motivationalTitle,
    motivationalCopy,
    strengths,
    toReinforce,
  };
}

export function computeCumulativeQuizStats(
  history: QuizAttemptProgress[]
): CumulativeQuizStats {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      completedSessions: 0,
      totalPracticePoints: 0,
      averageAccuracyPercent: null,
    };
  }

  const completedSessions = history.length;
  const totalPracticePoints = history.reduce((acc, item) => acc + Math.max(0, item.score || 0), 0);

  // Cada respuesta correcta en Micro-Quiz suma 100 pts base; acotamos a 100% por si incluye bono de secuencia.
  const percentages = history
    .filter((item) => item.totalQuestions > 0)
    .map((item) => {
      const approxCorrect = Math.min(item.totalQuestions, Math.floor((item.score || 0) / 100));
      return Math.round((approxCorrect / item.totalQuestions) * 100);
    });

  const averageAccuracyPercent =
    percentages.length > 0
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : null;

  return {
    completedSessions,
    totalPracticePoints,
    averageAccuracyPercent,
  };
}
