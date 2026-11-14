import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { learningSpaceService } from '../../services/learningSpace.service';
import { profileService } from '../../services/profile.service';
import { notesService, type AcademicNote } from '../../services/notes.service';
import { forumService, type ForumQuestion as ForumPost } from '../../services/forum.service';
import { projectService } from '../../services/project.service';
import AdaptiveQuizHub from './components/AdaptiveQuizHub';
import { InteractiveVisualExplainLab } from '../../components/learning/InteractiveVisualExplainLab';
import {
  EXPLANATION_MODES,
  LEARNING_PROFILE_CATEGORIES,
  MASTERY_LABELS,
  SUPPORT_PASSPORT_OPTIONS,
  type LearningSpaceConfig,
  type LearningPath,
  type StudyTask,
  type TopicAssessment,
  type AdaptiveExplanation,
  type ExplanationMode,
  type LearningPace,
} from '../../types/learningSpace';
import { breakdownTaskWithAi, type AiTaskBreakdownStep } from '../../services/geminiAiService';
import { ReadAloudControls } from '../../components/common/ReadAloudControls';
import { QuickIdeasDrawer } from '../../components/common/QuickIdeasDrawer';
import { generatePersonalProgressPdf } from '../../utils/noteExporter';
import type { Subject } from '../../types/profile';
import type { Project } from '../../types/project';
import {
  CompassIcon,
  LayersIcon,
  LightbulbIcon,
  ListChecksIcon,
  TargetIcon,
  SlidersIcon,
  BookOpenIcon,
  UsersIcon,
  MessageSquareIcon,
  PlusIcon,
  CheckIcon,
  CheckCircleIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  EditIcon,
} from '../../components/common/Icons';
import '../../styles/dashboard.css';

import { useModuleTab } from '../../hooks/useModuleTab';

type SpaceTab = 'overview' | 'paths' | 'explain' | 'tasks' | 'reinforce' | 'profile';

export const LearningSpace = () => {
  const { user } = useAuth();
  const { isCalmMode, themeMode, setThemeMode, preferences, updatePreferences } = useCalmMode();
  const navigate = useNavigate();
  const [activeTab,setActiveTab]=useModuleTab<SpaceTab>(['overview','paths','explain','tasks','reinforce','profile'],'overview');

  // Estado principal cargado desde el backend
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  const [config, setConfig] = useState<LearningSpaceConfig>({
    onboardingCompleted: false,
    shareWithTutors: false,
    explanationStyle: ['step_by_step', 'practical_examples'],
    organizationStyle: ['short_tasks', 'frequent_breaks'],
    communicationStyle: ['message_first', 'individual_tutoring'],
    environmentStyle: ['calm_interface', 'untimed_practice'],
    defaultStudyIntervalMinutes: 20,
    defaultBreakMinutes: 5,
    subjectsToReinforce: [],
    learningGoalSummary: '',
  });
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [assessments, setAssessments] = useState<TopicAssessment[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<Subject[]>([]);

  // Ecosistema conectado de InterAula
  const [relatedNotes, setRelatedNotes] = useState<AcademicNote[]>([]);
  const [relatedForumPosts, setRelatedForumPosts] = useState<ForumPost[]>([]);
  const [relatedProjects, setRelatedProjects] = useState<Project[]>([]);

  // Estado para crear nueva ruta de aprendizaje
  const [newPathSubject, setNewPathSubject] = useState('');
  const [newPathTitle, setNewPathTitle] = useState('');
  const [newPathGoal, setNewPathGoal] = useState('');
  const [newPathPace, setNewPathPace] = useState<LearningPace>('paso_a_paso');
  const [newPathMode, setNewPathMode] = useState<ExplanationMode>('paso_a_paso');
  const [creatingPath, setCreatingPath] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // Estado para editar ruta existente y agregar etapa personalizada
  const [editingPath, setEditingPath] = useState(false);
  const [editPathTitle, setEditPathTitle] = useState('');
  const [editPathGoal, setEditPathGoal] = useState('');
  const [editPathPace, setEditPathPace] = useState<LearningPace>('paso_a_paso');
  const [editPathMode, setEditPathMode] = useState<ExplanationMode>('paso_a_paso');
  const [showAddStageForm, setShowAddStageForm] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [newStagePrompt, setNewStagePrompt] = useState('');
  const [pathsViewMode, setPathsViewMode] = useState<'board' | 'list'>('board');
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  // Estado para "Aprende a tu manera" (Explicaciones adaptables)
  const [explainSubject, setExplainSubject] = useState('Programación de Algoritmos');
  const [explainTopic, setExplainTopic] = useState('Estructuras de control y descomposición de problemas');
  const [explainGoal, setExplainGoal] = useState('');
  const [explainMode, setExplainMode] = useState<ExplanationMode>('sencilla');
  const [explanationData, setExplanationData] = useState<AdaptiveExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [selectedCheckOption, setSelectedCheckOption] = useState<string | null>(null);
  const [checkSubmitted, setCheckSubmitted] = useState(false);

  // Estado para Tareas y Organización + Temporizador de Acompañamiento
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'baja' | 'media' | 'alta'>('media');
  const [newTaskInterval, setNewTaskInterval] = useState(20);
  const [newTaskBreak, setNewTaskBreak] = useState(5);
  const [newTaskSubtasksRaw, setNewTaskSubtasksRaw] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [inlineSubtaskInputs, setInlineSubtaskInputs] = useState<Record<string, string>>({});
  const [tasksViewMode, setTasksViewMode] = useState<'board' | 'list'>('board');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Temporizador flexible y no punitivo
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerPhase, setTimerPhase] = useState<'study' | 'break'>('study');
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(20 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDiscreteAlerts, setTimerDiscreteAlerts] = useState(true);
  const [timerSoundAlerts, setTimerSoundAlerts] = useState(false);
  const [timerAlertNotice, setTimerAlertNotice] = useState<string | null>(null);

  // Modo "Un paso a la vez" + División IA de tareas + Lenguaje literal + PDF personal
  const [oneStepMode, setOneStepMode] = useState(false);
  const [oneStepTaskId, setOneStepTaskId] = useState<string | null>(null);
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);
  const [aiBreakdownSteps, setAiBreakdownSteps] = useState<AiTaskBreakdownStep[] | null>(null);
  const [aiBreakdownError, setAiBreakdownError] = useState<string | null>(null);
  const [literalMode, setLiteralMode] = useState<boolean>(Boolean(preferences.literalLanguage));
  const [includePassportInPdf, setIncludePassportInPdf] = useState(false);
  const [passportTutorIdInput, setPassportTutorIdInput] = useState('');

  // Estado para Evaluación de Conocimientos manual/rápida
  const [evalSubject, setEvalSubject] = useState('');
  const [evalTopic, setEvalTopic] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [newReinforceSubjectInput, setNewReinforceSubjectInput] = useState('');

  const handleTabChange = (tab: SpaceTab) => {
    setActiveTab(tab);
  };

  const loadSpaceData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [overview, allSubjects, notesRes, forumRes, projectsRes] = await Promise.all([
        learningSpaceService.getOverview(),
        profileService.getSubjects().catch(() => [] as Subject[]),
        notesService.getNotes().catch(() => [] as AcademicNote[]),
        forumService.getPosts().catch(() => [] as ForumPost[]),
        projectService.getProjects().catch(() => [] as Project[]),
      ]);

      setConfig(overview.config);
      setPaths(overview.paths);
      setTasks(overview.tasks);
      setAssessments(overview.assessments);
      setCatalogSubjects(allSubjects);
      setNewTaskInterval(overview.config.defaultStudyIntervalMinutes || 20);
      setNewTaskBreak(overview.config.defaultBreakMinutes || 5);
      setTimerSecondsLeft((overview.config.defaultStudyIntervalMinutes || 20) * 60);

      // Aplicar preferencias del perfil a la experiencia activa (modo de explicación inicial)
      if (overview.config.explanationStyle?.length > 0) {
        const preferredStyle = overview.config.explanationStyle[0];
        const mappedMode: ExplanationMode =
          preferredStyle === 'step_by_step'
            ? 'paso_a_paso'
            : preferredStyle === 'practical_examples'
            ? 'ejemplos'
            : preferredStyle === 'visual_support'
            ? 'visual'
            : 'sencilla';
        setNewPathMode(mappedMode);
        setExplainMode(mappedMode);
      }

      if (overview.paths.length > 0 && !selectedPathId) {
        setSelectedPathId(overview.paths[0].id);
      }

      if (allSubjects.length > 0) {
        setNewPathSubject((prev) => prev || allSubjects[0].name);
        setNewTaskSubject((prev) => prev || allSubjects[0].name);
        setEvalSubject((prev) => prev || allSubjects[0].name);
      }

      setRelatedNotes(notesRes.slice(0, 4));
      setRelatedForumPosts(forumRes.slice(0, 4));
      setRelatedProjects(projectsRes.filter((p) => p.status === 'open' || p.status === 'recruiting').slice(0, 3));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cargar tu espacio de aprendizaje.');
    } finally {
      setLoading(false);
    }
  }, [selectedPathId]);

  useEffect(() => {
    loadSpaceData();
  }, [loadSpaceData]);

  // Temporizador de acompañamiento de estudio con alertas discretas opcionales (50% y 2 min)
  const timerTotalSeconds =
    (timerPhase === 'study'
      ? config.defaultStudyIntervalMinutes || 20
      : config.defaultBreakMinutes || 5) * 60;

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        const next = prev - 1;
        if (timerDiscreteAlerts && timerTotalSeconds >= 240) {
          const halfPoint = Math.floor(timerTotalSeconds / 2);
          if (next === halfPoint) {
            setTimerAlertNotice('Mitad del bloque alcanzada. Vas a buen ritmo.');
          } else if (next === 120) {
            setTimerAlertNotice('Quedan 2 minutos para cerrar este bloque.');
          }
        }
        if (prev <= 1) {
          setTimerRunning(false);
          setTimerAlertNotice('Bloque completado. Puedes descansar o continuar cuando quieras.');
          if (timerSoundAlerts && typeof window !== 'undefined' && 'AudioContext' in window) {
            try {
              const ctx = new window.AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.value = 528;
              gain.gain.value = 0.04;
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.25);
            } catch {
              // Ignorar si el navegador bloquea AudioContext
            }
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerDiscreteAlerts, timerSoundAlerts, timerTotalSeconds]);

  // Cargar explicación adaptable cuando se entra a la pestaña 'explain' o se cambia el modo
  const fetchExplanation = useCallback(
    async (modeToUse: ExplanationMode, subj?: string, top?: string, gl?: string) => {
      const targetSubject = (subj ?? explainSubject).trim();
      const targetTopic = (top ?? explainTopic).trim();
      if (!targetSubject || !targetTopic) return;

      setLoadingExplanation(true);
      setSelectedCheckOption(null);
      setCheckSubmitted(false);
      try {
        const res = await learningSpaceService.getAdaptiveExplanation({
          subject_name: targetSubject,
          topic: targetTopic,
          mode: modeToUse,
          goal: gl ?? explainGoal,
          literal_mode: literalMode,
        });
        setExplanationData(res);
      } catch (err: any) {
        setErrorMsg(err?.message || 'No se pudo generar la explicación adaptada.');
      } finally {
        setLoadingExplanation(false);
      }
    },
    [explainSubject, explainTopic, explainGoal, literalMode]
  );

  useEffect(() => {
    if (activeTab === 'explain' && !explanationData && !loadingExplanation) {
      fetchExplanation(explainMode);
    }
  }, [activeTab, explanationData, loadingExplanation, explainMode, fetchExplanation]);

  const handleModeSwitch = (newMode: ExplanationMode) => {
    setExplainMode(newMode);
    fetchExplanation(newMode);
  };

  // Crear ruta de aprendizaje
  const handleCreatePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathSubject.trim() || !newPathTitle.trim() || !newPathGoal.trim()) return;
    setCreatingPath(true);
    setErrorMsg('');
    try {
      const matchedSub = catalogSubjects.find(
        (s) => s.name.toLowerCase() === newPathSubject.trim().toLowerCase()
      );
      const created = await learningSpaceService.createLearningPath({
        subject_id: matchedSub?.id || null,
        subject_name: newPathSubject.trim(),
        title: newPathTitle.trim(),
        goal: newPathGoal.trim(),
        pace: newPathPace,
        preferred_mode: newPathMode,
      });
      setPaths((prev) => [created, ...prev]);
      setSelectedPathId(created.id);
      setNewPathTitle('');
      setNewPathGoal('');
      setStatusBanner('Ruta de aprendizaje creada y dividida en etapas paso a paso.');
      setTimeout(() => setStatusBanner(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo crear la ruta de aprendizaje.');
    } finally {
      setCreatingPath(false);
    }
  };

  // Completar o desmarcar etapa de una ruta
  const handleToggleStage = async (pathId: string, stageId: string, currentCompleted: boolean) => {
    try {
      const updated = await learningSpaceService.toggleStage(pathId, stageId, !currentCompleted);
      setPaths((prev) => prev.map((p) => (p.id === pathId ? updated : p)));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la etapa.');
    }
  };

  // Editar ruta de aprendizaje existente
  const handleStartEditPath = (path: LearningPath) => {
    setEditingPath(true);
    setEditPathTitle(path.title);
    setEditPathGoal(path.goal);
    setEditPathPace(path.pace);
    setEditPathMode(path.preferred_mode);
  };

  const handleSaveEditPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPathId || !editPathTitle.trim() || !editPathGoal.trim()) return;
    setErrorMsg('');
    try {
      const updated = await learningSpaceService.updateLearningPath(selectedPathId, {
        title: editPathTitle.trim(),
        goal: editPathGoal.trim(),
        pace: editPathPace,
        preferred_mode: editPathMode,
      });
      setPaths((prev) => prev.map((p) => (p.id === selectedPathId ? updated : p)));
      setEditingPath(false);
      setStatusBanner('Ruta de aprendizaje actualizada.');
      setTimeout(() => setStatusBanner(''), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la ruta.');
    }
  };

  // Agregar etapa personalizada a la ruta seleccionada
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPathId || !newStageTitle.trim()) return;
    setErrorMsg('');
    try {
      const updated = await learningSpaceService.addStageToPath(selectedPathId, {
        title: newStageTitle.trim(),
        description:
          newStageDesc.trim() ||
          `Estudiar y practicar ${newStageTitle.trim()} paso a paso.`,
        practice_prompt: newStagePrompt.trim() || undefined,
      });
      setPaths((prev) => prev.map((p) => (p.id === selectedPathId ? updated : p)));
      setNewStageTitle('');
      setNewStageDesc('');
      setNewStagePrompt('');
      setShowAddStageForm(false);
      setStatusBanner('Nueva etapa añadida a tu ruta.');
      setTimeout(() => setStatusBanner(''), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo agregar la etapa.');
    }
  };

  const handleDeletePath = async (pathId: string) => {
    try {
      await learningSpaceService.deleteLearningPath(pathId);
      const remaining = paths.filter((p) => p.id !== pathId);
      setPaths(remaining);
      if (selectedPathId === pathId) {
        setSelectedPathId(remaining[0]?.id || null);
      }
      setEditingPath(false);
      setShowAddStageForm(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo eliminar la ruta.');
    }
  };

  // Abrir una etapa directamente en "Aprende a tu manera"
  const handleOpenStageInExplain = (subjectName: string, topic: string, goal: string, mode: ExplanationMode) => {
    setExplainSubject(subjectName);
    setExplainTopic(topic);
    setExplainGoal(goal);
    setExplainMode(mode);
    handleTabChange('explain');
    fetchExplanation(mode, subjectName, topic, goal);
  };

  // Dividir tarea con IA (o mostrar respaldo manual claro si la IA no está disponible)
  const handleBreakdownWithAi = async () => {
    if (newTaskTitle.trim().length < 3) {
      setAiBreakdownError('Escribe primero un título de al menos 3 caracteres.');
      return;
    }
    setAiBreakdownLoading(true);
    setAiBreakdownError(null);
    try {
      const steps = await breakdownTaskWithAi({
        title: newTaskTitle.trim(),
        subject_name: newTaskSubject.trim() || undefined,
      });
      setAiBreakdownSteps(steps);
    } catch (err: any) {
      setAiBreakdownSteps(null);
      setAiBreakdownError(
        err?.message ||
          'El asistente IA no está disponible en este momento. Puedes escribir tus subtareas manualmente abajo.'
      );
    } finally {
      setAiBreakdownLoading(false);
    }
  };

  const handleApplyAiBreakdownToForm = () => {
    if (!aiBreakdownSteps || aiBreakdownSteps.length === 0) return;
    const lines = aiBreakdownSteps.map(
      (s) => `${s.title} (${s.estimated_minutes} min)`
    );
    setNewTaskSubtasksRaw(lines.join('\n'));
    setAiBreakdownSteps(null);
    setStatusBanner('Pasos sugeridos cargados. Puedes editarlos antes de guardar.');
    setTimeout(() => setStatusBanner(''), 3500);
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWeekDays = (() => {
    const now = new Date();
    const day = now.getDay(); // 0=Dom
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const activeSet = new Set(config.activeStudyDates || []);
    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (activeSet.has(d.toISOString().slice(0, 10))) count += 1;
    }
    return count;
  })();

  const handleRecordTodayStudy = async () => {
    const existing = config.activeStudyDates || [];
    if (existing.includes(todayIso)) return;
    const updatedDates = [...existing, todayIso].slice(-90);
    try {
      const saved = await learningSpaceService.updateConfig({ activeStudyDates: updatedDates });
      setConfig(saved);
      setStatusBanner('Día de estudio registrado en tu avance semanal.');
      setTimeout(() => setStatusBanner(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo registrar tu día de estudio.');
    }
  };

  const handleDownloadPersonalPdf = () => {
    const passport = config.supportPassport;
    const supportLabels = (passport?.selectedSupports || []).map(
      (key) => SUPPORT_PASSPORT_OPTIONS.find((opt) => opt.key === key)?.label || key
    );
    generatePersonalProgressPdf({
      studentName: user?.user_metadata?.full_name || user?.email || 'Estudiante',
      weeklyActiveDays: currentWeekDays,
      weeklyGoalDays: config.weeklyGoalDays || 3,
      learningGoalSummary: config.learningGoalSummary,
      paths: paths.map((p) => ({
        title: p.title,
        subject_name: p.subject_name,
        progress_percent: p.progress_percent,
        status: p.status,
      })),
      tasks: tasks.map((t) => ({
        title: t.title,
        subject_name: t.subject_name,
        status: t.status,
        completedSubtasks: t.subtasks.filter((s) => s.completed).length,
        totalSubtasks: t.subtasks.length,
      })),
      assessments: assessments.map((a) => ({
        subject_name: a.subject_name,
        topic_name: a.topic_name,
        mastery_level: a.mastery_level,
        score: a.score,
      })),
      includeSupportPassport: includePassportInPdf,
      supportLabels,
      supportNotes: passport?.customNotes,
    });
  };

  // Crear tarea de estudio con subtareas y prioridad
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    setErrorMsg('');
    try {
      const customSubtasks = newTaskSubtasksRaw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((title) => ({ title, completed: false }));

      const created = await learningSpaceService.createStudyTask({
        subject_name: newTaskSubject.trim() || 'General',
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        study_interval_minutes: newTaskInterval,
        break_minutes: newTaskBreak,
        subtasks: customSubtasks.length > 0 ? customSubtasks : undefined,
      });

      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskSubtasksRaw('');
      setNewTaskPriority('media');
      setStatusBanner('Tarea organizada en subtareas manejables.');
      setTimeout(() => setStatusBanner(''), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo crear la tarea.');
    } finally {
      setCreatingTask(false);
    }
  };

  // Cambiar prioridad de una tarea existente
  const handleChangeTaskPriority = async (
    task: StudyTask,
    priority: 'baja' | 'media' | 'alta'
  ) => {
    try {
      const updated = await learningSpaceService.updateStudyTask(task.id, { priority });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la prioridad de la tarea.');
    }
  };

  // Agregar subtarea rápida a una tarea existente
  const handleAddInlineSubtask = async (task: StudyTask) => {
    const title = (inlineSubtaskInputs[task.id] || '').trim();
    if (!title) return;
    const nextSubtasks = [
      ...task.subtasks,
      { id: `${task.id}-sub-${Date.now()}`, title, completed: false },
    ];
    try {
      const updated = await learningSpaceService.updateStudyTask(task.id, {
        subtasks: nextSubtasks,
        status: task.status === 'completed' ? 'in_progress' : task.status,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setInlineSubtaskInputs((prev) => ({ ...prev, [task.id]: '' }));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo agregar la subtarea.');
    }
  };

  // Alternar subtarea
  const handleToggleSubtask = async (task: StudyTask, subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const allCompleted =
      updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.completed);
    const nextStatus = allCompleted
      ? 'completed'
      : updatedSubtasks.some((st) => st.completed)
      ? 'in_progress'
      : task.status;

    try {
      const updated = await learningSpaceService.updateStudyTask(task.id, {
        subtasks: updatedSubtasks,
        status: nextStatus,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la subtarea.');
    }
  };

  // Iniciar o pausar sesión de estudio acompañada para una tarea
  const handleStartTaskCompanion = (task: StudyTask) => {
    setActiveTimerTaskId(task.id);
    setTimerPhase('study');
    setTimerSecondsLeft((task.study_interval_minutes || 20) * 60);
    setTimerRunning(true);
    if (task.status === 'pending' || task.status === 'paused') {
      learningSpaceService
        .updateStudyTask(task.id, { status: 'in_progress' })
        .then((updated) => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        })
        .catch(() => {});
    }
  };

  const handlePauseTaskStatus = async (task: StudyTask) => {
    if (activeTimerTaskId === task.id) {
      setTimerRunning(false);
    }
    const nextStatus = task.status === 'paused' ? 'in_progress' : 'paused';
    try {
      const updated = await learningSpaceService.updateStudyTask(task.id, {
        status: nextStatus,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      // Ignorar fallo menor
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await learningSpaceService.deleteStudyTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (activeTimerTaskId === taskId) {
        setActiveTimerTaskId(null);
        setTimerRunning(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo eliminar la tarea.');
    }
  };

  // Mover tarea entre columnas del Tablero Kanban Arrastrable
  const handleDropTaskToStatus = async (
    taskId: string,
    newStatus: 'pending' | 'in_progress' | 'completed'
  ) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target || target.status === newStatus) return;

    const updatedSubtasks =
      newStatus === 'completed'
        ? target.subtasks.map((st) => ({ ...st, completed: true }))
        : target.subtasks;

    try {
      const updated = await learningSpaceService.updateStudyTask(taskId, {
        status: newStatus,
        subtasks: updatedSubtasks,
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (newStatus === 'in_progress') {
        setStatusBanner(`«${target.title}» movida a Enfoque Activo.`);
        setTimeout(() => setStatusBanner(''), 3000);
      } else if (newStatus === 'completed') {
        setStatusBanner(`¡Tarea «${target.title}» completada!`);
        setTimeout(() => setStatusBanner(''), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo mover la tarea.');
    }
  };

  // Registrar dominio cuando el estudiante completa el esquema de bloques arrastrables
  const handleVisualLabMastery = async () => {
    if (!explanationData) return;
    try {
      const saved = await learningSpaceService.recordTopicAssessment({
        subject_name: explanationData.subject_name,
        topic_name: explanationData.topic,
        score: 95,
        total_questions: 100,
        recurring_errors: [],
      });
      setAssessments((prev) => [
        saved,
        ...prev.filter(
          (a) =>
            !(
              a.subject_name.toLowerCase() === saved.subject_name.toLowerCase() &&
              a.topic_name.toLowerCase() === saved.topic_name.toLowerCase()
            )
        ),
      ]);
    } catch {
      // Ignorar fallo silencioso
    }
  };

  // Registrar comprobación desde "Aprende a tu manera"
  const handleCheckComprehensionSubmit = async () => {
    if (!explanationData || !selectedCheckOption) return;
    setCheckSubmitted(true);
    const isCorrect =
      selectedCheckOption === explanationData.comprehension_check.correctOptionId;

    try {
      const saved = await learningSpaceService.recordTopicAssessment({
        subject_name: explanationData.subject_name,
        topic_name: explanationData.topic,
        score: isCorrect ? 1 : 0,
        total_questions: 1,
        recurring_errors: isCorrect
          ? []
          : [`Reforzar concepto principal en: ${explanationData.topic}`],
      });
      setAssessments((prev) => [
        saved,
        ...prev.filter(
          (a) =>
            !(
              a.subject_name.toLowerCase() === saved.subject_name.toLowerCase() &&
              a.topic_name.toLowerCase() === saved.topic_name.toLowerCase()
            )
        ),
      ]);
    } catch {
      // Continúa mostrando feedback inmediato en pantalla
    }
  };

  // Guardar preferencias del Perfil de aprendizaje
  const toggleCategoryPreference = (
    categoryKey: 'explanationStyle' | 'organizationStyle' | 'communicationStyle' | 'environmentStyle',
    optionId: string
  ) => {
    setConfig((prev) => {
      const currentList = prev[categoryKey] || [];
      const exists = currentList.includes(optionId);
      const nextList = exists
        ? currentList.filter((item) => item !== optionId)
        : [...currentList, optionId];
      return {
        ...prev,
        [categoryKey]: nextList,
      };
    });
  };

  const handleAddSubjectToReinforce = () => {
    const clean = newReinforceSubjectInput.trim();
    if (!clean) return;
    if (!config.subjectsToReinforce.includes(clean)) {
      setConfig((prev) => ({
        ...prev,
        subjectsToReinforce: [...prev.subjectsToReinforce, clean],
      }));
    }
    setNewReinforceSubjectInput('');
  };

  const handleRemoveSubjectToReinforce = (subj: string) => {
    setConfig((prev) => ({
      ...prev,
      subjectsToReinforce: prev.subjectsToReinforce.filter((s) => s !== subj),
    }));
  };

  const handleSaveLearningConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg('');
    try {
      const updated = await learningSpaceService.updateConfig({
        ...config,
        onboardingCompleted: true,
      });
      setConfig(updated);

      // Sincronizar con el contexto global de accesibilidad si el usuario marcó entorno tranquilo
      await updatePreferences({
        calmMode: updated.environmentStyle.includes('calm_interface')
          ? true
          : preferences.calmMode,
        untimedQuizzes: updated.environmentStyle.includes('untimed_practice'),
        spacing: updated.environmentStyle.includes('spacious_reading')
          ? 'spacious'
          : preferences.spacing,
      });

      setStatusBanner('Tu perfil de aprendizaje se ha guardado de forma privada.');
      setTimeout(() => setStatusBanner(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo guardar la configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const selectedPath = paths.find((p) => p.id === selectedPathId) || paths[0] || null;
  const activePathsCount = paths.filter((p) => p.status === 'active').length;
  const completedPathsCount = paths.filter((p) => p.status === 'completed').length;
  const pendingTasksCount = tasks.filter((t) => t.status !== 'completed').length;
  const consolidatedTopicsCount = assessments.filter(
    (a) => a.mastery_level === 'consolidado'
  ).length;

  // Calcular recomendación real del siguiente paso
  const nextRecommendedStage = (() => {
    for (const path of paths) {
      if (path.status === 'active') {
        const nextStage = path.stages.find((st) => !st.completed);
        if (nextStage) {
          return { path, stage: nextStage };
        }
      }
    }
    return null;
  })();

  return (
    <div className="learning-space-page">
        {/* Encabezado de Mi espacio de aprendizaje */}
        <section className="learning-space-hero">
          <div className="learning-space-hero__content">
            <span className="learning-space-hero__eyebrow">
              <CompassIcon size={15} /> Mi espacio de aprendizaje
            </span>
            <h1 className="learning-space-hero__title">
              Aprender juntos, a nuestra manera
            </h1>
            <p className="learning-space-hero__subtitle">
              Organiza tus asignaturas en etapas manejables, cambia el modo en que recibes cada
              explicación sin perder tu avance y conecta con tutores, apuntes y proyectos a tu
              propio ritmo.
            </p>
          </div>

          <div className="learning-space-hero__stats">
            <div className="learning-space-stat">
              <span className="learning-space-stat__value">{activePathsCount}</span>
              <span className="learning-space-stat__label">Rutas activas</span>
            </div>
            <div className="learning-space-stat">
              <span className="learning-space-stat__value">{completedPathsCount}</span>
              <span className="learning-space-stat__label">Rutas completadas</span>
            </div>
            <div className="learning-space-stat">
              <span className="learning-space-stat__value">{pendingTasksCount}</span>
              <span className="learning-space-stat__label">Tareas en curso</span>
            </div>
            <div className="learning-space-stat">
              <span className="learning-space-stat__value">{consolidatedTopicsCount}</span>
              <span className="learning-space-stat__label">Temas consolidados</span>
            </div>
          </div>
        </section>

        {/* Mensajes de estado */}
        {statusBanner && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircleIcon size={16} /> {statusBanner}
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Navegación interna de Mi espacio de aprendizaje */}
        <nav className="learning-space-tabs" aria-label="Secciones de Mi espacio de aprendizaje">
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleTabChange('overview')}
          >
            <CompassIcon size={16} />
            <span>Resumen y siguiente paso</span>
          </button>
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'paths' ? 'active' : ''}`}
            onClick={() => handleTabChange('paths')}
          >
            <LayersIcon size={16} />
            <span>Rutas de aprendizaje ({paths.length})</span>
          </button>
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'explain' ? 'active' : ''}`}
            onClick={() => handleTabChange('explain')}
          >
            <LightbulbIcon size={16} />
            <span>Aprende a tu manera</span>
          </button>
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => handleTabChange('tasks')}
          >
            <ListChecksIcon size={16} />
            <span>Tareas y acompañamiento ({tasks.length})</span>
          </button>
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'reinforce' ? 'active' : ''}`}
            onClick={() => handleTabChange('reinforce')}
          >
            <TargetIcon size={16} />
            <span>Evaluación y refuerzo</span>
          </button>
          <button
            type="button"
            className={`learning-space-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => handleTabChange('profile')}
          >
            <SlidersIcon size={16} />
            <span>Mi perfil de aprendizaje</span>
          </button>
        </nav>

        {loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <p className="text-muted">Cargando tu espacio de aprendizaje personalizado...</p>
          </div>
        ) : (
          <>
            {/* =================================================================
                1. PANEL PRINCIPAL DE APRENDIZAJE (OVERVIEW)
               ================================================================= */}
            {activeTab === 'overview' && (
              <div className="learning-space-grid">
                <div className="learning-space-main-col">
                  {/* Asistente inicial si aún no ha personalizado su perfil */}
                  {!config.onboardingCompleted && (
                    <div className="panel learning-onboarding-banner">
                      <div>
                        <span className="badge badge--primary" style={{ marginBottom: '0.5rem' }}>
                          Configuración inicial voluntaria
                        </span>
                        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>
                          Adapta InterAula a tu forma de estudiar
                        </h2>
                        <p className="text-muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                          Elige cómo prefieres recibir explicaciones, organizar tus tareas y
                          configurar tu entorno de estudio. Esta información es privada y puedes
                          cambiarla cuando quieras.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleTabChange('profile')}
                      >
                        Configurar mi perfil
                      </button>
                    </div>
                  )}

                  {/* Progreso flexible y descarga de reporte personal */}
                  <div className="panel" style={{ marginBottom: '1rem' }}>
                    <div className="panel__header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h2 className="panel__title">Progreso flexible esta semana</h2>
                        <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.86rem' }}>
                          Meta semanal configurable, sin rachas punitivas si necesitas pausar un día.
                        </p>
                      </div>
                      <span className="badge badge--primary">
                        {currentWeekDays} / {config.weeklyGoalDays || 3} días activos
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleRecordTodayStudy}
                          disabled={(config.activeStudyDates || []).includes(todayIso)}
                        >
                          {(config.activeStudyDates || []).includes(todayIso)
                            ? 'Hoy ya está registrado'
                            : 'Registrar día activo hoy'}
                        </button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}>
                          Meta semanal:
                          <select
                            value={config.weeklyGoalDays || 3}
                            onChange={async (e) => {
                              const nextGoal = Number(e.target.value);
                              try {
                                const saved = await learningSpaceService.updateConfig({ weeklyGoalDays: nextGoal });
                                setConfig(saved);
                              } catch {
                                // ignore
                              }
                            }}
                            style={{ padding: '0.25rem 0.5rem', borderRadius: '6px' }}
                          >
                            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                              <option key={d} value={d}>{d} días</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={includePassportInPdf}
                            onChange={(e) => setIncludePassportInPdf(e.target.checked)}
                          />
                          Incluir mis apoyos en el PDF
                        </label>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleDownloadPersonalPdf}
                        >
                          Descargar reporte PDF personal
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recomendación del siguiente paso */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <CompassIcon size={18} /> Tu siguiente paso recomendado
                      </h2>
                      <button
                        type="button"
                        className="panel__link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleTabChange('paths')}
                      >
                        Ver todas mis rutas
                      </button>
                    </div>

                    {nextRecommendedStage ? (
                      <div className="next-step-card">
                        <div className="next-step-card__meta">
                          <span className="subject-chip">{nextRecommendedStage.path.subject_name}</span>
                          <span className="text-muted" style={{ fontSize: '0.84rem' }}>
                            Ruta: {nextRecommendedStage.path.title} ({nextRecommendedStage.path.progress_percent}% completado)
                          </span>
                        </div>
                        <h3 className="next-step-card__title">
                          {nextRecommendedStage.stage.title}
                        </h3>
                        <p className="next-step-card__desc">
                          {nextRecommendedStage.stage.description}
                        </p>
                        <div className="next-step-card__actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              handleOpenStageInExplain(
                                nextRecommendedStage.path.subject_name,
                                nextRecommendedStage.stage.content_topic ||
                                  nextRecommendedStage.stage.title,
                                nextRecommendedStage.path.goal,
                                nextRecommendedStage.path.preferred_mode
                              )
                            }
                          >
                            <LightbulbIcon size={15} /> Estudiar a mi manera
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              handleToggleStage(
                                nextRecommendedStage.path.id,
                                nextRecommendedStage.stage.id,
                                false
                              )
                            }
                          >
                            <CheckIcon size={15} /> Marcar etapa como completada
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              navigate(
                                `/tutoring?subject=${encodeURIComponent(
                                  nextRecommendedStage.path.subject_name
                                )}`
                              )
                            }
                          >
                            <UsersIcon size={15} /> Solicitar tutoría de este tema
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '1.75rem 1rem' }}>
                        <h3 className="empty-state__title">Aún no tienes una ruta activa</h3>
                        <p className="empty-state__desc">
                          Crea tu primera ruta de aprendizaje eligiendo una asignatura y un
                          objetivo concreto. El sistema la dividirá en etapas claras para avanzar
                          sin sobrecarga.
                        </p>
                        <div className="empty-state__actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleTabChange('paths')}
                          >
                            <PlusIcon size={15} /> Crear ruta de aprendizaje
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleTabChange('explain')}
                          >
                            Explorar explicaciones adaptables
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progreso por asignatura y rutas activas */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <LayersIcon size={18} /> Progreso de mis rutas de aprendizaje
                      </h2>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleTabChange('paths')}
                      >
                        <PlusIcon size={14} /> Nueva ruta
                      </button>
                    </div>

                    {paths.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0 }}>
                        Todavía no has registrado rutas de aprendizaje. Cuando crees una, verás aquí
                        el avance porcentual real calculado según tus etapas completadas.
                      </p>
                    ) : (
                      <div className="learning-paths-summary-list">
                        {paths.map((path) => {
                          const completedStages = path.stages.filter((s) => s.completed).length;
                          return (
                            <div key={path.id} className="learning-path-summary-item">
                              <div className="learning-path-summary-item__top">
                                <div>
                                  <span className="subject-chip" style={{ marginRight: '0.5rem' }}>
                                    {path.subject_name}
                                  </span>
                                  <strong>{path.title}</strong>
                                </div>
                                <span className="learning-path-summary-item__pct">
                                  {path.progress_percent}% ({completedStages}/{path.stages.length} etapas)
                                </span>
                              </div>
                              <div className="learning-progress-bar">
                                <div
                                  className="learning-progress-bar__fill"
                                  style={{ width: `${path.progress_percent}%` }}
                                />
                              </div>
                              <div className="learning-path-summary-item__footer">
                                <span className="text-muted" style={{ fontSize: '0.84rem' }}>
                                  Objetivo: {path.goal}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => {
                                    setSelectedPathId(path.id);
                                    handleTabChange('paths');
                                  }}
                                >
                                  Continuar ruta
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Estado de dominio por temas */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <TargetIcon size={18} /> Estado de mis temas estudiados
                      </h2>
                      <button
                        type="button"
                        className="panel__link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleTabChange('reinforce')}
                      >
                        Ir a evaluación y refuerzo
                      </button>
                    </div>

                    {assessments.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0 }}>
                        Aún no has realizado comprobaciones de comprensión. Al practicar en
                        &ldquo;Aprende a tu manera&rdquo; o en &ldquo;Evaluación y refuerzo&rdquo;,
                        verás aquí qué temas están consolidados y cuáles conviene repasar.
                      </p>
                    ) : (
                      <div className="topic-mastery-grid">
                        {assessments.slice(0, 6).map((item) => {
                          const meta = MASTERY_LABELS[item.mastery_level];
                          return (
                            <div key={item.id} className="topic-mastery-card">
                              <div className="topic-mastery-card__header">
                                <span className="subject-chip">{item.subject_name}</span>
                                <span className={`status-badge ${meta.badgeClass}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <h4 className="topic-mastery-card__title">{item.topic_name}</h4>
                              <p className="text-muted" style={{ fontSize: '0.83rem', margin: 0 }}>
                                {meta.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna lateral: Conexión con Tutorías, Apuntes, Foro y Proyectos */}
                <aside className="learning-space-side-col">
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <SlidersIcon size={18} /> Mi configuración activa
                      </h2>
                      <button
                        type="button"
                        className="panel__link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleTabChange('profile')}
                      >
                        Editar
                      </button>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                      {config.learningGoalSummary ||
                        'Estudiando paso a paso con apoyo adaptable y bloques de estudio configurables.'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      <span className="subject-chip">
                        Bloques de {config.defaultStudyIntervalMinutes} min
                      </span>
                      <span className="subject-chip">
                        Pausas de {config.defaultBreakMinutes} min
                      </span>
                      {preferences.untimedQuizzes && (
                        <span className="subject-chip">Práctica sin límite de tiempo</span>
                      )}
                      <span className="badge badge--verified">
                        <ShieldCheckIcon size={12} />{' '}
                        {config.shareWithTutors
                          ? 'Compartido con tutores autorizados'
                          : 'Privado: solo visible para ti'}
                      </span>
                    </div>
                    {config.subjectsToReinforce.length > 0 && (
                      <div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.35rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          Materias que quiero reforzar
                        </span>
                        <div className="subject-chips">
                          {config.subjectsToReinforce.map((subj) => (
                            <span key={subj} className="subject-chip">
                              {subj}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conexión directa con Tutorías */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <UsersIcon size={18} /> Apoyo con tutores pares
                      </h2>
                    </div>
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '0.75rem',
                        border: '1px solid var(--color-border)',
                        maxHeight: '132px',
                      }}
                    >
                      <img
                        src="/images/academic/mentoria-paso-a-paso.jpg"
                        alt="Mentoría académica paso a paso entre compañeros universitarios"
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '132px',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                      Si un tema sigue resultando complejo, puedes solicitar una sesión individual o
                      grupal compartiendo voluntariamente tu forma preferida de aprender.
                    </p>
                    <Link to="/tutoring" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                      Buscar tutores en mis asignaturas
                    </Link>
                  </div>

                  {/* Apuntes recomendados */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <BookOpenIcon size={18} /> Apuntes de la comunidad
                      </h2>
                      <Link to="/resources" className="panel__link">
                        Ver biblioteca
                      </Link>
                    </div>
                    {relatedNotes.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.86rem', margin: 0 }}>
                        No hay apuntes publicados aún. Puedes crear o subir tus propios resúmenes en
                        la Biblioteca de Apuntes.
                      </p>
                    ) : (
                      <div className="connected-resource-list">
                        {relatedNotes.map((note) => (
                          <Link
                            key={note.id}
                            to="/resources"
                            className="connected-resource-item"
                          >
                            <strong>{note.title}</strong>
                            <span>{note.subjectName}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Foro y Proyectos relacionados */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <MessageSquareIcon size={18} /> Comunidad y Proyectos
                      </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <Link to="/forum" className="connected-resource-item">
                        <strong>Foro Académico ({relatedForumPosts.length} temas recientes)</strong>
                        <span>Pregunta dudas puntuales o revisa soluciones validadas</span>
                      </Link>
                      <Link to="/projects" className="connected-resource-item">
                        <strong>Hub de Proyectos ({relatedProjects.length} abiertos)</strong>
                        <span>Aplica lo aprendido en equipos interdisciplinarios</span>
                      </Link>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {/* =================================================================
                2. RUTAS DE APRENDIZAJE PERSONALIZADAS (PATHS)
               ================================================================= */}
            {activeTab === 'paths' && (
              <div className="learning-space-grid">
                <div className="learning-space-main-col">
                  {/* Detalle de la ruta seleccionada */}
                  {selectedPath ? (
                    <div className="panel">
                      <div className="panel__header" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span className="subject-chip">{selectedPath.subject_name}</span>
                            <span className="status-badge status-badge--accepted">
                              Avance: {selectedPath.progress_percent}%
                            </span>
                          </div>
                          <h2 className="panel__title" style={{ fontSize: '1.25rem' }}>
                            {selectedPath.title}
                          </h2>
                          <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.92rem' }}>
                            Objetivo: {selectedPath.goal}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleStartEditPath(selectedPath)}
                          >
                            <EditIcon size={14} /> Editar ruta
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setShowAddStageForm((prev) => !prev)}
                          >
                            <PlusIcon size={14} /> Agregar etapa
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDeletePath(selectedPath.id)}
                            title="Eliminar ruta de aprendizaje"
                          >
                            <TrashIcon size={15} /> Eliminar ruta
                          </button>
                        </div>
                      </div>

                      {editingPath && (
                        <form
                          onSubmit={handleSaveEditPath}
                          className="auth-form"
                          style={{
                            marginBottom: '1.25rem',
                            padding: '1rem',
                            background: 'var(--color-bg-subtle, #f8fafc)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)',
                            gap: '0.75rem',
                          }}
                        >
                          <div className="form-group">
                            <label htmlFor="edit-path-title">Título de la ruta</label>
                            <input
                              id="edit-path-title"
                              type="text"
                              value={editPathTitle}
                              onChange={(e) => setEditPathTitle(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="edit-path-goal">Objetivo de aprendizaje</label>
                            <textarea
                              id="edit-path-goal"
                              rows={2}
                              value={editPathGoal}
                              onChange={(e) => setEditPathGoal(e.target.value)}
                              required
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                              <label htmlFor="edit-path-pace">Ritmo</label>
                              <select
                                id="edit-path-pace"
                                value={editPathPace}
                                onChange={(e) => setEditPathPace(e.target.value as LearningPace)}
                              >
                                <option value="paso_a_paso">Paso a paso y sin prisa</option>
                                <option value="constante">Constante</option>
                                <option value="intensivo">Focalizado para evaluación</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label htmlFor="edit-path-mode">Modo de explicación</label>
                              <select
                                id="edit-path-mode"
                                value={editPathMode}
                                onChange={(e) => setEditPathMode(e.target.value as ExplanationMode)}
                              >
                                {EXPLANATION_MODES.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setEditingPath(false)}
                            >
                              Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary btn-sm">
                              Guardar cambios
                            </button>
                          </div>
                        </form>
                      )}

                      {showAddStageForm && (
                        <form
                          onSubmit={handleAddStage}
                          className="auth-form"
                          style={{
                            marginBottom: '1.25rem',
                            padding: '1rem',
                            background: 'var(--color-bg-subtle, #f8fafc)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)',
                            gap: '0.75rem',
                          }}
                        >
                          <div className="form-group">
                            <label htmlFor="new-stage-title">Título de la nueva etapa</label>
                            <input
                              id="new-stage-title"
                              type="text"
                              value={newStageTitle}
                              onChange={(e) => setNewStageTitle(e.target.value)}
                              placeholder="Ej: Etapa adicional: Resolver ejercicios de certamen"
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="new-stage-desc">Descripción breve (opcional)</label>
                            <input
                              id="new-stage-desc"
                              type="text"
                              value={newStageDesc}
                              onChange={(e) => setNewStageDesc(e.target.value)}
                              placeholder="Ej: Practicar problemas reales sin presión de tiempo"
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="new-stage-prompt">Actividad sugerida (opcional)</label>
                            <input
                              id="new-stage-prompt"
                              type="text"
                              value={newStagePrompt}
                              onChange={(e) => setNewStagePrompt(e.target.value)}
                              placeholder="Ej: Completar 2 ejercicios guiados y anotar dudas"
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setShowAddStageForm(false)}
                            >
                              Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary btn-sm">
                              Añadir etapa a la ruta
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="learning-progress-bar" style={{ marginBottom: '1rem' }}>
                        <div
                          className="learning-progress-bar__fill"
                          style={{ width: `${selectedPath.progress_percent}%` }}
                        />
                      </div>

                      {/* Selector de vista: Tablero de Bloques Arrastrables vs Lista Paso a Paso */}
                      <div className="interactive-view-toolbar">
                        <span className="interactive-view-toolbar__hint">
                          Puedes arrastrar las etapas entre columnas para actualizar tu progreso o estudiar cada bloque:
                        </span>
                        <div className="interactive-view-switcher" role="group" aria-label="Modo de visualización de ruta">
                          <button
                            type="button"
                            className={`btn btn-sm ${pathsViewMode === 'board' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setPathsViewMode('board')}
                          >
                            <LayersIcon size={14} /> Tablero de bloques (Arrastrar)
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${pathsViewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setPathsViewMode('list')}
                          >
                            <ListChecksIcon size={14} /> Lista paso a paso
                          </button>
                        </div>
                      </div>

                      {pathsViewMode === 'board' ? (
                        <div className="kanban-stages-board">
                          {/* Columna 1: Etapas pendientes / en curso */}
                          <div
                            className="kanban-stage-column"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const stId = e.dataTransfer.getData('text/plain') || draggedStageId;
                              const stObj = selectedPath.stages.find((s) => s.id === stId);
                              if (stObj && stObj.completed) {
                                handleToggleStage(selectedPath.id, stObj.id, true);
                              }
                              setDraggedStageId(null);
                            }}
                          >
                            <div className="kanban-stage-column__header kanban-stage-column__header--pending">
                              <strong>Etapas en práctica</strong>
                              <span className="badge badge--primary">
                                {selectedPath.stages.filter((s) => !s.completed).length}
                              </span>
                            </div>
                            <div className="kanban-stage-column__body">
                              {selectedPath.stages.filter((s) => !s.completed).length === 0 ? (
                                <div className="kanban-empty-drop">
                                  ¡Todas las etapas completadas! Arrastra una etapa aquí si quieres volver a practicarla.
                                </div>
                              ) : (
                                selectedPath.stages
                                  .filter((s) => !s.completed)
                                  .map((stage) => (
                                    <div
                                      key={stage.id}
                                      draggable
                                      onDragStart={(e) => {
                                        setDraggedStageId(stage.id);
                                        e.dataTransfer.setData('text/plain', stage.id);
                                      }}
                                      onDragEnd={() => setDraggedStageId(null)}
                                      className="kanban-draggable-card"
                                    >
                                      <div className="kanban-draggable-card__top">
                                        <span className="kanban-grip" title="Arrastra este bloque">⋮⋮ Bloque {stage.order_index}</span>
                                        <span className="status-badge status-badge--pending">Por consolidar</span>
                                      </div>
                                      <strong className="kanban-draggable-card__title">{stage.title}</strong>
                                      <p className="kanban-draggable-card__desc">{stage.description}</p>
                                      {stage.practice_prompt && (
                                        <div className="learning-stage-card__prompt" style={{ marginBottom: '0.6rem' }}>
                                          <strong>Reto:</strong> {stage.practice_prompt}
                                        </div>
                                      )}
                                      <div className="kanban-draggable-card__actions">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() =>
                                            handleOpenStageInExplain(
                                              selectedPath.subject_name,
                                              stage.content_topic || stage.title,
                                              selectedPath.goal,
                                              selectedPath.preferred_mode
                                            )
                                          }
                                        >
                                          <LightbulbIcon size={13} /> Explicación visual
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          onClick={() =>
                                            handleToggleStage(selectedPath.id, stage.id, false)
                                          }
                                        >
                                          <CheckIcon size={13} /> Completar →
                                        </button>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>

                          {/* Columna 2: Etapas consolidadas / completadas */}
                          <div
                            className="kanban-stage-column kanban-stage-column--done"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const stId = e.dataTransfer.getData('text/plain') || draggedStageId;
                              const stObj = selectedPath.stages.find((s) => s.id === stId);
                              if (stObj && !stObj.completed) {
                                handleToggleStage(selectedPath.id, stObj.id, false);
                              }
                              setDraggedStageId(null);
                            }}
                          >
                            <div className="kanban-stage-column__header kanban-stage-column__header--done">
                              <strong>Etapas consolidadas</strong>
                              <span className="badge badge--verified">
                                {selectedPath.stages.filter((s) => s.completed).length}
                              </span>
                            </div>
                            <div className="kanban-stage-column__body">
                              {selectedPath.stages.filter((s) => s.completed).length === 0 ? (
                                <div className="kanban-empty-drop">
                                  Arrastra una etapa desde la columna izquierda hasta aquí cuando la hayas comprendido.
                                </div>
                              ) : (
                                selectedPath.stages
                                  .filter((s) => s.completed)
                                  .map((stage) => (
                                    <div
                                      key={stage.id}
                                      draggable
                                      onDragStart={(e) => {
                                        setDraggedStageId(stage.id);
                                        e.dataTransfer.setData('text/plain', stage.id);
                                      }}
                                      onDragEnd={() => setDraggedStageId(null)}
                                      className="kanban-draggable-card kanban-draggable-card--done"
                                    >
                                      <div className="kanban-draggable-card__top">
                                        <span className="kanban-grip">⋮⋮ Bloque {stage.order_index}</span>
                                        <span className="status-badge status-badge--completed">Consolidada</span>
                                      </div>
                                      <strong className="kanban-draggable-card__title">{stage.title}</strong>
                                      <p className="kanban-draggable-card__desc">{stage.description}</p>
                                      <div className="kanban-draggable-card__actions">
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          onClick={() =>
                                            handleOpenStageInExplain(
                                              selectedPath.subject_name,
                                              stage.content_topic || stage.title,
                                              selectedPath.goal,
                                              selectedPath.preferred_mode
                                            )
                                          }
                                        >
                                          <LightbulbIcon size={13} /> Repasar
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-outline btn-sm"
                                          onClick={() =>
                                            handleToggleStage(selectedPath.id, stage.id, true)
                                          }
                                        >
                                          ← Volver a práctica
                                        </button>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="learning-stages-list">
                          {selectedPath.stages.map((stage) => (
                            <div
                              key={stage.id}
                              className={`learning-stage-card ${
                                stage.completed ? 'learning-stage-card--completed' : ''
                              }`}
                            >
                              <div className="learning-stage-card__header">
                                <label className="learning-stage-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={stage.completed}
                                    onChange={() =>
                                      handleToggleStage(
                                        selectedPath.id,
                                        stage.id,
                                        stage.completed
                                      )
                                    }
                                  />
                                  <span className="learning-stage-card__title">
                                    {stage.title}
                                  </span>
                                </label>
                                <span
                                  className={`status-badge ${
                                    stage.completed
                                      ? 'status-badge--completed'
                                      : 'status-badge--pending'
                                  }`}
                                >
                                  {stage.completed ? 'Completada' : 'En curso'}
                                </span>
                              </div>

                              <p className="learning-stage-card__desc">{stage.description}</p>

                              {stage.practice_prompt && (
                                <div className="learning-stage-card__prompt">
                                  <strong>Actividad sugerida:</strong> {stage.practice_prompt}
                                </div>
                              )}

                              <div className="learning-stage-card__actions">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    handleOpenStageInExplain(
                                      selectedPath.subject_name,
                                      stage.content_topic || stage.title,
                                      selectedPath.goal,
                                      selectedPath.preferred_mode
                                    )
                                  }
                                >
                                  <LightbulbIcon size={14} /> Abrir explicación adaptable
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    navigate(
                                      `/tutoring?subject=${encodeURIComponent(
                                        selectedPath.subject_name
                                      )}`
                                    )
                                  }
                                >
                                  <UsersIcon size={14} /> Pedir apoyo de tutoría
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="panel empty-state">
                      <h3 className="empty-state__title">
                        Crea tu primera ruta de aprendizaje personalizada
                      </h3>
                      <p className="empty-state__desc">
                        Usa el formulario lateral para elegir una asignatura y describir qué
                        necesitas preparar o reforzar. InterAula generará una ruta paso a paso con
                        actividades y explicaciones adaptables.
                      </p>
                    </div>
                  )}
                </div>

                {/* Columna lateral: Selector de rutas y Formulario para crear nueva ruta */}
                <aside className="learning-space-side-col">
                  {paths.length > 0 && (
                    <div className="panel">
                      <div className="panel__header">
                        <h2 className="panel__title">Mis rutas creadas ({paths.length})</h2>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {paths.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPathId(p.id)}
                            className={`learning-path-selector-btn ${
                              selectedPath?.id === p.id ? 'active' : ''
                            }`}
                          >
                            <div>
                              <strong>{p.title}</strong>
                              <span>{p.subject_name}</span>
                            </div>
                            <span className="badge badge--primary">{p.progress_percent}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <PlusIcon size={18} /> Nueva ruta paso a paso
                      </h2>
                    </div>
                    <form onSubmit={handleCreatePath} className="auth-form" style={{ gap: '0.85rem' }}>
                      <div className="form-group">
                        <label htmlFor="path-subject">Asignatura</label>
                        <input
                          id="path-subject"
                          type="text"
                          list="catalog-subjects-list"
                          value={newPathSubject}
                          onChange={(e) => setNewPathSubject(e.target.value)}
                          placeholder="Ej: Programación de Algoritmos"
                          required
                        />
                        <datalist id="catalog-subjects-list">
                          {catalogSubjects.map((s) => (
                            <option key={s.id} value={s.name} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-group">
                        <label htmlFor="path-title">Tema o unidad que deseas dominar</label>
                        <input
                          id="path-title"
                          type="text"
                          value={newPathTitle}
                          onChange={(e) => setNewPathTitle(e.target.value)}
                          placeholder="Ej: Ciclos iterativos y arreglos"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="path-goal">¿Qué objetivo concreto quieres lograr?</label>
                        <textarea
                          id="path-goal"
                          rows={3}
                          value={newPathGoal}
                          onChange={(e) => setNewPathGoal(e.target.value)}
                          placeholder="Ej: Comprender cómo recorrer arreglos sin confundir los índices para mi próxima evaluación."
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="path-pace">Ritmo preferido</label>
                        <select
                          id="path-pace"
                          value={newPathPace}
                          onChange={(e) => setNewPathPace(e.target.value as LearningPace)}
                        >
                          <option value="paso_a_paso">Paso a paso y sin prisa</option>
                          <option value="constante">Constante (avance semanal equilibrado)</option>
                          <option value="intensivo">Focalizado para próxima evaluación</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="path-mode">Modo de explicación inicial</label>
                        <select
                          id="path-mode"
                          value={newPathMode}
                          onChange={(e) => setNewPathMode(e.target.value as ExplanationMode)}
                        >
                          {EXPLANATION_MODES.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingPath}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {creatingPath ? 'Generando etapas...' : 'Crear ruta personalizada'}
                      </button>
                    </form>
                  </div>
                </aside>
              </div>
            )}

            {/* =================================================================
                3. EXPLICACIONES ADAPTABLES: "APRENDE A TU MANERA" (EXPLAIN)
               ================================================================= */}
            {activeTab === 'explain' && (
              <div className="panel">
                <div className="panel__header">
                  <div>
                    <h2 className="panel__title" style={{ fontSize: '1.25rem' }}>
                      <LightbulbIcon size={20} /> Aprende a tu manera: Explicaciones adaptables
                    </h2>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.92rem' }}>
                      Explora cualquier tema académico y cambia libremente el modo de explicación
                      según lo que te resulte más claro hoy, sin perder tu avance.
                    </p>
                  </div>
                </div>

                {/* Buscador de tema a explicar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchExplanation(explainMode);
                  }}
                  className="adaptive-explain-controls"
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="explain-subject">Asignatura</label>
                    <input
                      id="explain-subject"
                      type="text"
                      list="catalog-subjects-list"
                      value={explainSubject}
                      onChange={(e) => setExplainSubject(e.target.value)}
                      placeholder="Ej: Consultas de Bases de Datos"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="explain-topic">Tema o concepto que quieres comprender</label>
                    <input
                      id="explain-topic"
                      type="text"
                      value={explainTopic}
                      onChange={(e) => setExplainTopic(e.target.value)}
                      placeholder="Ej: Diferencia entre WHERE y HAVING en SQL"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loadingExplanation}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {loadingExplanation ? 'Adaptando...' : 'Generar explicación'}
                  </button>
                </form>

                {/* Controles rápidos de lectura y lenguaje literal */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    alignItems: 'center',
                    marginBottom: '0.85rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    background: 'var(--color-bg-subtle, #f8fafc)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={literalMode}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLiteralMode(checked);
                        updatePreferences({ literalLanguage: checked });
                      }}
                    />
                    Modo lenguaje literal y directo (sin metáforas ni frases ambiguas)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences.readingRuler)}
                      onChange={(e) => updatePreferences({ readingRuler: e.target.checked })}
                    />
                    Regla de lectura guiada
                  </label>
                </div>

                {/* Selector de los 6 modos de explicación */}
                <div className="explanation-mode-switcher" role="tablist" aria-label="Modos de explicación">
                  {EXPLANATION_MODES.map((modeItem) => {
                    const isActive = explainMode === modeItem.id;
                    return (
                      <button
                        key={modeItem.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`explanation-mode-btn ${isActive ? 'active' : ''}`}
                        onClick={() => handleModeSwitch(modeItem.id)}
                      >
                        <strong>{modeItem.label}</strong>
                        <span>{modeItem.description}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Contenido adaptado */}
                {loadingExplanation ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                    <p className="text-muted">
                      Estructurando explicación en modo{' '}
                      <strong>
                        {EXPLANATION_MODES.find((m) => m.id === explainMode)?.label}
                      </strong>
                      ...
                    </p>
                  </div>
                ) : explanationData ? (
                  <div className="adaptive-explanation-card">
                    <div className="adaptive-explanation-card__header">
                      <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                          <span className="subject-chip">
                            {explanationData.subject_name}
                          </span>
                          <span className="badge badge--primary">{explanationData.mode_label}</span>
                          <span className="badge badge--verified">
                            {explanationData.source === 'ai_gemini'
                              ? 'IA Generativa Gemini'
                              : 'Motor Pedagógico Adaptativo DUA'}
                          </span>
                        </div>
                        <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem' }}>
                          {explanationData.topic}
                        </h3>
                      </div>
                      <ReadAloudControls
                        text={`${explanationData.topic}. ${explanationData.summary}. ${explanationData.key_points.join('. ')}`}
                        label="Escuchar explicación"
                      />
                    </div>

                    <p className="adaptive-explanation-card__summary">
                      {explanationData.summary}
                    </p>

                    {/* Laboratorio Visual Interactivo con Nodos y Bloques Arrastrables (Drag & Drop) */}
                    <InteractiveVisualExplainLab
                      explanationData={explanationData}
                      activeMode={explainMode}
                      onModeSwitch={handleModeSwitch}
                      onMasteryVerified={handleVisualLabMastery}
                    />

                    <div className="adaptive-explanation-example">
                      <h4>Ejemplo práctico aplicado</h4>
                      <p>
                        {explanationData.practical_example
                          .replace(/---+\(([^)]+)\)--->\s*/g, ' → ($1) → ')
                          .replace(/---+>\s*/g, ' → ')
                          .replace(/\[([^\]]+)\]/g, '«$1»')}
                      </p>
                    </div>

                    {/* Comprobación breve integrada */}
                    <div className="adaptive-comprehension-box">
                      <h4>Comprobar comprensión (sin límite de tiempo)</h4>
                      <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                        {explanationData.comprehension_check.question}
                      </p>
                      <div className="adaptive-comprehension-options">
                        {explanationData.comprehension_check.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={`adaptive-comprehension-option ${
                              selectedCheckOption === opt.id ? 'selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="comprehension-check"
                              value={opt.id}
                              checked={selectedCheckOption === opt.id}
                              onChange={() => {
                                setSelectedCheckOption(opt.id);
                                setCheckSubmitted(false);
                              }}
                            />
                            <span>{opt.text}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!selectedCheckOption}
                          onClick={handleCheckComprehensionSubmit}
                        >
                          <CheckCircleIcon size={15} /> Verificar mi respuesta
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            navigate(
                              `/tutoring?subject=${encodeURIComponent(
                                explanationData.subject_name
                              )}`
                            )
                          }
                        >
                          <UsersIcon size={15} /> Aún tengo dudas: buscar tutor
                        </button>
                      </div>

                      {checkSubmitted && selectedCheckOption && (
                        <div
                          className={`alert ${
                            selectedCheckOption ===
                            explanationData.comprehension_check.correctOptionId
                              ? 'alert-success'
                              : 'alert-error'
                          }`}
                          style={{ marginTop: '0.85rem' }}
                        >
                          {selectedCheckOption ===
                          explanationData.comprehension_check.correctOptionId
                            ? `Respuesta correcta. ${explanationData.comprehension_check.feedback} (Tema registrado en tu seguimiento).`
                            : `Todavía puedes reforzar esta idea. Sugerencia: cambia al modo "Paso a paso" o "Con ejemplos prácticos" arriba y vuelve a intentarlo sin prisa.`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* =================================================================
                4. ACOMPAÑAMIENTO DE TAREAS Y ORGANIZACIÓN (TASKS)
               ================================================================= */}
            {activeTab === 'tasks' && (
              <div className="learning-space-grid">
                <div className="learning-space-main-col">
                  {/* Modo "Un paso a la vez" para reducir carga visual y bloqueo */}
                  <div className="panel" style={{ borderLeft: '4px solid var(--ia-primary)' }}>
                    <div className="panel__header" style={{ flexWrap: 'wrap', gap: '0.65rem' }}>
                      <div>
                        <h2 className="panel__title">Modo "Un paso a la vez"</h2>
                        <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.86rem' }}>
                          Muestra solo el paso actual para evitar saturación. Puedes salir cuando quieras.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${oneStepMode ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => {
                          if (!oneStepMode) {
                            const firstOpen = tasks.find((t) => t.status !== 'completed') || tasks[0] || null;
                            setOneStepTaskId(firstOpen ? firstOpen.id : null);
                          }
                          setOneStepMode((prev) => !prev);
                        }}
                      >
                        {oneStepMode ? 'Salir de modo un paso' : 'Activar un paso a la vez'}
                      </button>
                    </div>

                    {oneStepMode && (() => {
                      const focusTask =
                        tasks.find((t) => t.id === oneStepTaskId) ||
                        tasks.find((t) => t.status !== 'completed') ||
                        null;
                      if (!focusTask) {
                        return (
                          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                            No tienes tareas pendientes en este momento. Crea una a la derecha para enfocarte paso a paso.
                          </p>
                        );
                      }
                      const nextSubtask = focusTask.subtasks.find((s) => !s.completed) || null;
                      const doneCount = focusTask.subtasks.filter((s) => s.completed).length;
                      return (
                        <div
                          style={{
                            padding: '1.15rem',
                            borderRadius: '12px',
                            background: 'var(--color-bg-subtle, #f8fafc)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                            <span className="subject-chip">{focusTask.subject_name}</span>
                            <span className="badge badge--primary">
                              {focusTask.subtasks.length > 0
                                ? `Paso ${Math.min(doneCount + 1, focusTask.subtasks.length)} de ${focusTask.subtasks.length}`
                                : 'Tarea única'}
                            </span>
                          </div>
                          <h3 style={{ margin: '0 0 0.45rem 0', fontSize: '1.08rem' }}>
                            {nextSubtask ? nextSubtask.title : focusTask.title}
                          </h3>
                          {nextSubtask && (
                            <p className="text-muted" style={{ margin: '0 0 0.85rem 0', fontSize: '0.86rem' }}>
                              Parte de: {focusTask.title}
                              {nextSubtask.estimated_minutes ? ` · Tiempo sugerido: ${nextSubtask.estimated_minutes} min` : ''}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                            {nextSubtask ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleToggleSubtask(focusTask, nextSubtask.id)}
                              >
                                Listo, pasar al siguiente paso
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={async () => {
                                  const updated = await learningSpaceService.updateStudyTask(focusTask.id, {
                                    status: 'completed',
                                  });
                                  setTasks((prev) => prev.map((t) => (t.id === focusTask.id ? updated : t)));
                                  const another = tasks.find((t) => t.id !== focusTask.id && t.status !== 'completed');
                                  setOneStepTaskId(another ? another.id : null);
                                }}
                              >
                                Completar tarea
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setOneStepMode(false)}
                            >
                              Ver todas las tareas
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Temporizador de acompañamiento tranquilo y flexible */}
                  <div className="panel study-companion-panel">
                    <div className="panel__header">
                      <div>
                        <h2 className="panel__title">
                          Acompañamiento de sesión de estudio
                        </h2>
                        <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem' }}>
                          Intervalos configurables a tu medida. Puedes pausar, ajustar o cambiar a
                          descanso en cualquier momento, sin alarmas invasivas.
                        </p>
                      </div>
                      <span className="badge badge--primary">
                        {timerPhase === 'study' ? 'Bloque de enfoque' : 'Pausa de descanso'}
                      </span>
                    </div>

                    {/* Barra visual de avance */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div
                        style={{
                          height: '10px',
                          width: '100%',
                          borderRadius: '999px',
                          background: 'var(--color-border)',
                          overflow: 'hidden',
                        }}
                        aria-label="Progreso visual del bloque"
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                timerTotalSeconds > 0
                                  ? Math.round(((timerTotalSeconds - timerSecondsLeft) / timerTotalSeconds) * 100)
                                  : 0
                              )
                            )}%`,
                            background: 'var(--ia-primary, #2563eb)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem', fontSize: '0.82rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={timerDiscreteAlerts}
                            onChange={(e) => setTimerDiscreteAlerts(e.target.checked)}
                          />
                          Avisos discretos al 50% y a 2 min del cierre
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={timerSoundAlerts}
                            onChange={(e) => setTimerSoundAlerts(e.target.checked)}
                          />
                          Tono suave opcional al finalizar
                        </label>
                      </div>
                    </div>

                    {timerAlertNotice && (
                      <div
                        className="study-companion-message"
                        style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>{timerAlertNotice}</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setTimerAlertNotice(null)}
                        >
                          Cerrar
                        </button>
                      </div>
                    )}

                    <div className="study-companion-timer">
                      <div className="study-companion-timer__clock">
                        {formatTimer(timerSecondsLeft)}
                      </div>
                      <div className="study-companion-timer__controls">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setTimerRunning((prev) => !prev)}
                        >
                          {timerRunning ? (
                            <>
                              <PauseIcon size={15} /> Pausar
                            </>
                          ) : (
                            <>
                              <PlayIcon size={15} /> {timerSecondsLeft === 0 ? 'Reiniciar' : 'Iniciar / Retomar'}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setTimerRunning(false);
                            const nextPhase = timerPhase === 'study' ? 'break' : 'study';
                            setTimerPhase(nextPhase);
                            setTimerSecondsLeft(
                              (nextPhase === 'study'
                                ? config.defaultStudyIntervalMinutes || 20
                                : config.defaultBreakMinutes || 5) * 60
                            );
                          }}
                        >
                          Cambiar a {timerPhase === 'study' ? 'pausa breve' : 'bloque de estudio'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSecondsLeft(
                              (timerPhase === 'study'
                                ? config.defaultStudyIntervalMinutes || 20
                                : config.defaultBreakMinutes || 5) * 60
                            );
                          }}
                        >
                          <RotateCcwIcon size={15} /> Restablecer tiempo
                        </button>
                      </div>
                    </div>

                    {timerSecondsLeft === 0 && (
                      <p className="study-companion-message">
                        Has completado este bloque. Si lo necesitas, toma una pausa breve antes de
                        continuar con la siguiente subtarea.
                      </p>
                    )}
                  </div>

                  {/* Lista de tareas y subtareas */}
                  <div className="panel">
                    <div className="panel__header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                      <h2 className="panel__title">
                        <ListChecksIcon size={18} /> Mis tareas desglosadas ({tasks.length})
                      </h2>
                      {tasks.length > 0 && (
                        <div className="interactive-view-switcher" role="group" aria-label="Vista de tareas">
                          <button
                            type="button"
                            className={`btn btn-sm ${tasksViewMode === 'board' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setTasksViewMode('board')}
                          >
                            <LayersIcon size={14} /> Tablero Kanban (Arrastrar)
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${tasksViewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setTasksViewMode('list')}
                          >
                            <ListChecksIcon size={14} /> Vista detallada
                          </button>
                        </div>
                      )}
                    </div>

                    {tasks.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                        <h3 className="empty-state__title">No tienes tareas registradas</h3>
                        <p className="empty-state__desc">
                          Agrega una tarea de estudio en el panel lateral. Si no indicas subtareas,
                          InterAula la dividirá automáticamente en 3 pasos breves para empezar sin
                          bloqueos.
                        </p>
                      </div>
                    ) : (
                      <>
                        {tasksViewMode === 'board' && (
                          <div className="kanban-tasks-board" style={{ marginBottom: '1.5rem' }}>
                            {(
                              [
                                {
                                  key: 'pending',
                                  title: 'Por iniciar',
                                  badgeClass: 'badge--primary',
                                  filterFn: (t: StudyTask) =>
                                    t.status === 'pending' || t.status === 'paused',
                                },
                                {
                                  key: 'in_progress',
                                  title: 'En enfoque activo',
                                  badgeClass: 'badge--warning',
                                  filterFn: (t: StudyTask) => t.status === 'in_progress',
                                },
                                {
                                  key: 'completed',
                                  title: 'Completadas',
                                  badgeClass: 'badge--verified',
                                  filterFn: (t: StudyTask) => t.status === 'completed',
                                },
                              ] as const
                            ).map((col) => {
                              const colTasks = tasks.filter(col.filterFn);
                              return (
                                <div
                                  key={col.key}
                                  className={`kanban-stage-column ${
                                    col.key === 'completed' ? 'kanban-stage-column--done' : ''
                                  }`}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const tId =
                                      e.dataTransfer.getData('text/plain') || draggedTaskId;
                                    if (tId) {
                                      handleDropTaskToStatus(tId, col.key);
                                    }
                                    setDraggedTaskId(null);
                                  }}
                                >
                                  <div className="kanban-stage-column__header">
                                    <strong>{col.title}</strong>
                                    <span className={`badge ${col.badgeClass}`}>
                                      {colTasks.length}
                                    </span>
                                  </div>
                                  <div className="kanban-stage-column__body">
                                    {colTasks.length === 0 ? (
                                      <div className="kanban-empty-drop">
                                        Arrastra un bloque de tarea aquí para pasarla a «{col.title}».
                                      </div>
                                    ) : (
                                      colTasks.map((t) => {
                                        const doneSub = t.subtasks.filter((s) => s.completed).length;
                                        return (
                                          <div
                                            key={t.id}
                                            draggable
                                            onDragStart={(e) => {
                                              setDraggedTaskId(t.id);
                                              e.dataTransfer.setData('text/plain', t.id);
                                            }}
                                            onDragEnd={() => setDraggedTaskId(null)}
                                            className={`kanban-draggable-card ${
                                              col.key === 'completed'
                                                ? 'kanban-draggable-card--done'
                                                : ''
                                            }`}
                                          >
                                            <div className="kanban-draggable-card__top">
                                              <span className="kanban-grip">
                                                ⋮⋮ {t.subject_name}
                                              </span>
                                              <span className="badge badge--primary">
                                                {doneSub}/{t.subtasks.length} pasos
                                              </span>
                                            </div>
                                            <strong className="kanban-draggable-card__title">
                                              {t.title}
                                            </strong>
                                            <div className="kanban-draggable-card__actions">
                                              {col.key !== 'in_progress' && (
                                                <button
                                                  type="button"
                                                  className="btn btn-outline btn-sm"
                                                  onClick={() =>
                                                    handleDropTaskToStatus(t.id, 'in_progress')
                                                  }
                                                >
                                                  <PlayIcon size={12} /> Enfoque
                                                </button>
                                              )}
                                              {col.key !== 'completed' && (
                                                <button
                                                  type="button"
                                                  className="btn btn-primary btn-sm"
                                                  onClick={() =>
                                                    handleDropTaskToStatus(t.id, 'completed')
                                                  }
                                                >
                                                  <CheckIcon size={12} /> Completar
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="study-tasks-list">
                        {tasks.map((task) => {
                          const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
                          const pct =
                            task.subtasks.length > 0
                              ? Math.round((completedSubtasks / task.subtasks.length) * 100)
                              : 0;

                          const currentPriority = task.priority || 'media';
                          const priorityBadgeClass =
                            currentPriority === 'alta'
                              ? 'badge--warning'
                              : currentPriority === 'baja'
                              ? 'badge--verified'
                              : 'badge--primary';

                          return (
                            <div key={task.id} className="study-task-card">
                              <div className="study-task-card__header">
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                                  <span className="subject-chip">
                                    {task.subject_name}
                                  </span>
                                  <span className={`badge ${priorityBadgeClass}`}>
                                    Prioridad {currentPriority}
                                  </span>
                                  <strong>{task.title}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <select
                                    aria-label={`Cambiar prioridad de ${task.title}`}
                                    value={currentPriority}
                                    onChange={(e) =>
                                      handleChangeTaskPriority(
                                        task,
                                        e.target.value as 'baja' | 'media' | 'alta'
                                      )
                                    }
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '0.28rem 0.5rem',
                                      borderRadius: '8px',
                                      border: '1px solid var(--color-border)',
                                      background: 'var(--color-surface, #ffffff)',
                                      color: 'var(--color-text)',
                                    }}
                                  >
                                    <option value="baja">Prioridad baja</option>
                                    <option value="media">Prioridad media</option>
                                    <option value="alta">Prioridad alta</option>
                                  </select>
                                  <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                                    {completedSubtasks}/{task.subtasks.length} subtareas ({pct}%)
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleStartTaskCompanion(task)}
                                  >
                                    <PlayIcon size={13} /> Acompañar ({task.study_interval_minutes}m)
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handlePauseTaskStatus(task)}
                                  >
                                    {task.status === 'paused' ? 'Retomar' : 'Pausar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleDeleteTask(task.id)}
                                    title="Eliminar tarea"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                </div>
                              </div>

                              <div className="learning-progress-bar" style={{ margin: '0.6rem 0' }}>
                                <div
                                  className="learning-progress-bar__fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              <div className="study-subtasks-list">
                                {task.subtasks.map((sub) => (
                                  <label key={sub.id} className="study-subtask-item">
                                    <input
                                      type="checkbox"
                                      checked={sub.completed}
                                      onChange={() => handleToggleSubtask(task, sub.id)}
                                    />
                                    <span
                                      style={{
                                        textDecoration: sub.completed ? 'line-through' : 'none',
                                        color: sub.completed
                                          ? 'var(--color-text-muted)'
                                          : 'var(--color-text)',
                                      }}
                                    >
                                      {sub.title}
                                    </span>
                                  </label>
                                ))}
                              </div>

                              {/* Agregar subtarea rápida */}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  marginTop: '0.65rem',
                                  alignItems: 'center',
                                }}
                              >
                                <input
                                  type="text"
                                  value={inlineSubtaskInputs[task.id] || ''}
                                  onChange={(e) =>
                                    setInlineSubtaskInputs((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddInlineSubtask(task);
                                    }
                                  }}
                                  placeholder="Añadir otra subtarea breve..."
                                  style={{
                                    flex: 1,
                                    fontSize: '0.84rem',
                                    padding: '0.4rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleAddInlineSubtask(task)}
                                >
                                  <PlusIcon size={13} /> Subtarea
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Formulario para crear tarea */}
                <aside className="learning-space-side-col">
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">
                        <PlusIcon size={18} /> Crear tarea paso a paso
                      </h2>
                    </div>
                    <form onSubmit={handleCreateTask} className="auth-form" style={{ gap: '0.85rem' }}>
                      <div className="form-group">
                        <label htmlFor="task-title">¿Qué necesitas estudiar o entregar?</label>
                        <input
                          id="task-title"
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Ej: Preparar guía de consultas JOIN en SQL"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="task-subject">Asignatura relacionada</label>
                        <input
                          id="task-subject"
                          type="text"
                          list="catalog-subjects-list"
                          value={newTaskSubject}
                          onChange={(e) => setNewTaskSubject(e.target.value)}
                          placeholder="Ej: Consultas de Bases de Datos"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="task-priority">Prioridad de la tarea</label>
                        <select
                          id="task-priority"
                          value={newTaskPriority}
                          onChange={(e) =>
                            setNewTaskPriority(e.target.value as 'baja' | 'media' | 'alta')
                          }
                        >
                          <option value="baja">Baja (avance complementario)</option>
                          <option value="media">Media (avance semanal sugerido)</option>
                          <option value="alta">Alta (próxima entrega o certamen)</option>
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                        <div className="form-group">
                          <label htmlFor="task-interval">Estudio (min)</label>
                          <input
                            id="task-interval"
                            type="number"
                            min={5}
                            max={120}
                            value={newTaskInterval}
                            onChange={(e) => setNewTaskInterval(Number(e.target.value) || 20)}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="task-break">Pausa (min)</label>
                          <input
                            id="task-break"
                            type="number"
                            min={1}
                            max={60}
                            value={newTaskBreak}
                            onChange={(e) => setNewTaskBreak(Number(e.target.value) || 5)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <label htmlFor="task-subtasks" style={{ margin: 0 }}>
                            Subtareas pequeñas (una por línea, opcional)
                          </label>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={handleBreakdownWithAi}
                            disabled={aiBreakdownLoading}
                          >
                            {aiBreakdownLoading ? 'Dividiendo...' : 'Dividir tarea con IA'}
                          </button>
                        </div>

                        {aiBreakdownError && (
                          <p
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.5rem 0.65rem',
                              borderRadius: '8px',
                              background: 'var(--color-bg-subtle, #f8fafc)',
                              border: '1px solid var(--color-border)',
                              marginBottom: '0.5rem',
                            }}
                          >
                            {aiBreakdownError}
                          </p>
                        )}

                        {aiBreakdownSteps && aiBreakdownSteps.length > 0 && (
                          <div
                            style={{
                              padding: '0.75rem',
                              borderRadius: '10px',
                              background: 'var(--color-bg-subtle, #f8fafc)',
                              border: '1px solid var(--color-border)',
                              marginBottom: '0.6rem',
                            }}
                          >
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                              Pasos sugeridos (puedes editarlos antes de aplicar):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {aiBreakdownSteps.map((step, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    value={step.title}
                                    onChange={(e) =>
                                      setAiBreakdownSteps((prev) =>
                                        prev
                                          ? prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s))
                                          : null
                                      )
                                    }
                                    style={{ flex: 1, fontSize: '0.84rem' }}
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={180}
                                    value={step.estimated_minutes}
                                    onChange={(e) =>
                                      setAiBreakdownSteps((prev) =>
                                        prev
                                          ? prev.map((s, i) =>
                                              i === idx
                                                ? { ...s, estimated_minutes: Number(e.target.value) || 5 }
                                                : s
                                            )
                                          : null
                                      )
                                    }
                                    style={{ width: '64px', fontSize: '0.84rem' }}
                                    title="Minutos estimados"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() =>
                                      setAiBreakdownSteps((prev) =>
                                        prev ? prev.filter((_, i) => i !== idx) : null
                                      )
                                    }
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handleApplyAiBreakdownToForm}
                              >
                                Usar estos pasos
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setAiBreakdownSteps(null)}
                              >
                                Descartar
                              </button>
                            </div>
                          </div>
                        )}

                        <textarea
                          id="task-subtasks"
                          rows={4}
                          value={newTaskSubtasksRaw}
                          onChange={(e) => setNewTaskSubtasksRaw(e.target.value)}
                          placeholder={
                            '1. Leer apuntes del tema (10 min)\n2. Resolver ejercicio 1 y 2\n3. Anotar dudas para el foro o tutor'
                          }
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingTask}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {creatingTask ? 'Guardando...' : 'Organizar tarea'}
                      </button>
                    </form>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <QuickIdeasDrawer
                      contextType="learning_space"
                      defaultSubjectName={newTaskSubject || 'General'}
                      onIdeaConverted={loadSpaceData}
                    />
                  </div>
                </aside>
              </div>
            )}

            {/* =================================================================
                5. EVALUACIÓN DE CONOCIMIENTOS Y REFUERZO INTELIGENTE (REINFORCE)
               ================================================================= */}
            {activeTab === 'reinforce' && (
              <div className="learning-space-grid">
                <div className="learning-space-main-col">
                  <div className="panel">
                    <div className="panel__header">
                      <div>
                        <h2 className="panel__title">
                          <TargetIcon size={18} /> Práctica adaptativa y recuperación activa
                        </h2>
                        <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>
                          Realiza evaluaciones cortas con pistas paso a paso y analogías cercanas a
                          tus intereses para identificar qué temas dominas y cuáles reforzar.
                        </p>
                      </div>
                    </div>

                    <AdaptiveQuizHub isCalmMode={isCalmMode} />
                  </div>
                </div>

                <aside className="learning-space-side-col">
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">Mapa de dominio por tema</h2>
                    </div>

                    {assessments.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.88rem', margin: 0 }}>
                        Todavía no hay temas evaluados. Registra tu autoevaluación rápida abajo o
                        verifica tu comprensión en &ldquo;Aprende a tu manera&rdquo;.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {assessments.map((item) => {
                          const meta = MASTERY_LABELS[item.mastery_level];
                          return (
                            <div key={item.id} className="topic-mastery-card">
                              <div className="topic-mastery-card__header">
                                <span className="subject-chip">{item.subject_name}</span>
                                <span className={`status-badge ${meta.badgeClass}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <h4 className="topic-mastery-card__title">{item.topic_name}</h4>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    handleOpenStageInExplain(
                                      item.subject_name,
                                      item.topic_name,
                                      `Consolidar ${item.topic_name}`,
                                      item.mastery_level === 'necesita_practicar'
                                        ? 'paso_a_paso'
                                        : 'comprobar'
                                    )
                                  }
                                >
                                  Repasar tema
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Registro rápido de autoevaluación de un tema */}
                  <div className="panel">
                    <div className="panel__header">
                      <h2 className="panel__title">Registrar estado de un tema</h2>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!evalSubject.trim() || !evalTopic.trim()) return;
                        const formData = new FormData(e.currentTarget);
                        const levelScore = Number(formData.get('QuickScore') || 80);
                        const saved = await learningSpaceService.recordTopicAssessment({
                          subject_name: evalSubject.trim(),
                          topic_name: evalTopic.trim(),
                          score: levelScore,
                          total_questions: 100,
                        });
                        setAssessments((prev) => [
                          saved,
                          ...prev.filter(
                            (a) =>
                              !(
                                a.subject_name.toLowerCase() === saved.subject_name.toLowerCase() &&
                                a.topic_name.toLowerCase() === saved.topic_name.toLowerCase()
                              )
                          ),
                        ]);
                        setEvalTopic('');
                      }}
                      className="auth-form"
                      style={{ gap: '0.75rem' }}
                    >
                      <div className="form-group">
                        <label htmlFor="eval-subject">Asignatura</label>
                        <input
                          id="eval-subject"
                          type="text"
                          list="catalog-subjects-list"
                          value={evalSubject}
                          onChange={(e) => setEvalSubject(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="eval-topic">Tema evaluado</label>
                        <input
                          id="eval-topic"
                          type="text"
                          value={evalTopic}
                          onChange={(e) => setEvalTopic(e.target.value)}
                          placeholder="Ej: Normalización 3FN"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="eval-score">¿Cómo sientes tu dominio actual?</label>
                        <select id="eval-score" name="QuickScore" defaultValue="85">
                          <option value="90">Tema consolidado (lo comprendo y puedo aplicarlo)</option>
                          <option value="65">Tema en desarrollo (entiendo la base, me falta práctica)</option>
                          <option value="35">Necesita volver a practicarse (requiero paso a paso o tutor)</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-outline"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Guardar estado del tema
                      </button>
                    </form>
                  </div>
                </aside>
              </div>
            )}

            {/* =================================================================
                6. PERFIL DE APRENDIZAJE PERSONALIZABLE (PROFILE)
               ================================================================= */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveLearningConfig} className="panel">
                <div className="panel__header">
                  <div>
                    <h2 className="panel__title" style={{ fontSize: '1.25rem' }}>
                      <SlidersIcon size={20} /> Mi perfil de aprendizaje personalizable
                    </h2>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.92rem' }}>
                      Selecciona las preferencias funcionales que mejor se adaptan a tu forma de
                      estudiar. Nunca solicitamos diagnósticos clínicos y esta configuración es
                      estrictamente privada para tu cuenta ({user?.email}).
                    </p>
                  </div>
                  <span className="badge badge--verified">
                    <ShieldCheckIcon size={14} /> Privado y voluntario
                  </span>
                </div>

                {/* 4 Categorías estructuradas de la Sección 3.3 */}
                <div className="learning-profile-categories-grid">
                  {(
                    Object.keys(LEARNING_PROFILE_CATEGORIES) as Array<
                      keyof typeof LEARNING_PROFILE_CATEGORIES
                    >
                  ).map((catKey) => {
                    const category = LEARNING_PROFILE_CATEGORIES[catKey];
                    const selectedItems = config[catKey] || [];
                    return (
                      <div key={catKey} className="learning-profile-category-box">
                        <h3>{category.title}</h3>
                        <div className="learning-profile-options">
                          {category.options.map((opt) => {
                            const checked = selectedItems.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`learning-profile-option ${checked ? 'checked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCategoryPreference(catKey, opt.id)}
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Asignaturas a reforzar, meta general y bloques de tiempo */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.25rem',
                    marginTop: '1.5rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div className="form-group">
                    <label htmlFor="goal-summary">Mi objetivo académico principal este semestre</label>
                    <textarea
                      id="goal-summary"
                      rows={3}
                      value={config.learningGoalSummary}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, learningGoalSummary: e.target.value }))
                      }
                      placeholder="Ej: Superar mis asignaturas de programación e integrarme a un proyecto práctico paso a paso."
                    />
                  </div>

                  <div className="form-group">
                    <label>Asignaturas que quiero reforzar</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        list="catalog-subjects-list"
                        value={newReinforceSubjectInput}
                        onChange={(e) => setNewReinforceSubjectInput(e.target.value)}
                        placeholder="Ej: Modelamiento de Base de Datos"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleAddSubjectToReinforce}
                      >
                        Agregar
                      </button>
                    </div>
                    <div className="subject-chips">
                      {config.subjectsToReinforce.map((subj) => (
                        <span key={subj} className="subject-chip">
                          {subj}{' '}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubjectToReinforce(subj)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              marginLeft: '0.35rem',
                              color: 'inherit',
                              fontWeight: 700,
                            }}
                            aria-label={`Quitar ${subj}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Intervalos predeterminados de estudio y descanso</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          Bloque de estudio (minutos)
                        </span>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={config.defaultStudyIntervalMinutes}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              defaultStudyIntervalMinutes: Number(e.target.value) || 20,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          Pausa recomendada (minutos)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={config.defaultBreakMinutes}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              defaultBreakMinutes: Number(e.target.value) || 5,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-subtle, #f8fafc)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.88rem',
                          fontWeight: 500,
                          color: 'var(--color-text)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(config.shareWithTutors)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              shareWithTutors: e.target.checked,
                            }))
                          }
                          style={{ marginTop: '0.2rem' }}
                        />
                        <span>
                          <strong>Privacidad con tutores pares:</strong> Autorizar compartir mis
                          preferencias de formato y ritmo con mi tutor únicamente cuando solicite
                          una sesión (desactivado por defecto; tu perfil nunca se expone
                          públicamente).
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Ficha "Mis apoyos para aprender" (privada por defecto, consentimiento granular) */}
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-subtle, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Ficha "Mis apoyos para aprender"
                      </h3>
                      <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem' }}>
                        Información práctica para adaptar tu experiencia. Es privada por defecto: tú decides qué compartir, con quién y puedes revocarlo en cualquier momento.
                      </p>
                    </div>
                    <span className="badge badge--primary">Privada por defecto</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                    {SUPPORT_PASSPORT_OPTIONS.map((opt) => {
                      const passport = config.supportPassport || {
                        selectedSupports: [],
                        customNotes: '',
                        sharedWithTutorIds: [],
                        sharedWithProjectIds: [],
                        sharedItemKeys: [],
                      };
                      const checked = passport.selectedSupports.includes(opt.key);
                      const sharedItem = passport.sharedItemKeys.includes(opt.key);
                      return (
                        <div
                          key={opt.key}
                          style={{
                            padding: '0.6rem 0.75rem',
                            borderRadius: '10px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface, #fff)',
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.86rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const nextSelected = checked
                                  ? passport.selectedSupports.filter((k) => k !== opt.key)
                                  : [...passport.selectedSupports, opt.key];
                                const nextSharedItems = checked
                                  ? passport.sharedItemKeys.filter((k) => k !== opt.key)
                                  : passport.sharedItemKeys;
                                setConfig((prev) => ({
                                  ...prev,
                                  supportPassport: {
                                    ...passport,
                                    selectedSupports: nextSelected,
                                    sharedItemKeys: nextSharedItems,
                                  },
                                }));
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                          {checked && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', marginTop: '0.35rem', paddingLeft: '1.4rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={sharedItem}
                                onChange={() => {
                                  const nextSharedItems = sharedItem
                                    ? passport.sharedItemKeys.filter((k) => k !== opt.key)
                                    : [...passport.sharedItemKeys, opt.key];
                                  setConfig((prev) => ({
                                    ...prev,
                                    supportPassport: {
                                      ...passport,
                                      sharedItemKeys: nextSharedItems,
                                    },
                                  }));
                                }}
                              />
                              Incluir este punto si autorizo compartir mi ficha
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label htmlFor="support-passport-notes">Notas prácticas adicionales (opcional)</label>
                    <textarea
                      id="support-passport-notes"
                      rows={2}
                      maxLength={600}
                      placeholder="Ej: Prefiero recibir los ejercicios en formato lista numerada..."
                      value={config.supportPassport?.customNotes || ''}
                      onChange={(e) => {
                        const passport = config.supportPassport || {
                          selectedSupports: [],
                          customNotes: '',
                          sharedWithTutorIds: [],
                          sharedWithProjectIds: [],
                          sharedItemKeys: [],
                        };
                        setConfig((prev) => ({
                          ...prev,
                          supportPassport: { ...passport, customNotes: e.target.value },
                        }));
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Proyectos autorizados a ver los puntos marcados
                      </div>
                      {relatedProjects.length === 0 ? (
                        <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                          No hay proyectos cargados en tu sesión actual.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {relatedProjects.slice(0, 6).map((proj) => {
                            const passport = config.supportPassport || {
                              selectedSupports: [],
                              customNotes: '',
                              sharedWithTutorIds: [],
                              sharedWithProjectIds: [],
                              sharedItemKeys: [],
                            };
                            const isShared = passport.sharedWithProjectIds.includes(proj.id);
                            return (
                              <label key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={isShared}
                                  onChange={() => {
                                    const nextIds = isShared
                                      ? passport.sharedWithProjectIds.filter((id) => id !== proj.id)
                                      : [...passport.sharedWithProjectIds, proj.id];
                                    setConfig((prev) => ({
                                      ...prev,
                                      supportPassport: { ...passport, sharedWithProjectIds: nextIds },
                                    }));
                                  }}
                                />
                                <span>{proj.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Tutores autorizados ({config.supportPassport?.sharedWithTutorIds.length || 0})
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.45rem' }}>
                        <input
                          type="text"
                          placeholder="UUID del tutor a autorizar"
                          value={passportTutorIdInput}
                          onChange={(e) => setPassportTutorIdInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.82rem' }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const trimmed = passportTutorIdInput.trim();
                            if (!trimmed) return;
                            const passport = config.supportPassport || {
                              selectedSupports: [],
                              customNotes: '',
                              sharedWithTutorIds: [],
                              sharedWithProjectIds: [],
                              sharedItemKeys: [],
                            };
                            if (!passport.sharedWithTutorIds.includes(trimmed)) {
                              setConfig((prev) => ({
                                ...prev,
                                supportPassport: {
                                  ...passport,
                                  sharedWithTutorIds: [...passport.sharedWithTutorIds, trimmed],
                                },
                              }));
                            }
                            setPassportTutorIdInput('');
                          }}
                        >
                          Autorizar
                        </button>
                      </div>
                      {(config.supportPassport?.sharedWithTutorIds || []).map((tid) => (
                        <div key={tid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                          <span>{tid}</span>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              const passport = config.supportPassport!;
                              setConfig((prev) => ({
                                ...prev,
                                supportPassport: {
                                  ...passport,
                                  sharedWithTutorIds: passport.sharedWithTutorIds.filter((x) => x !== tid),
                                },
                              }));
                            }}
                          >
                            Revocar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel directo de Apariencia Visual: Modo Claro / Modo Oscuro / Modo Calma y Tamaño de Letra */}
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-subtle, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Ajuste rápido de Apariencia, Tema Visual y Tamaño de Letra
                      </h3>
                      <p className="text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem' }}>
                        Cambia en cualquier momento entre Modo Claro, Modo Oscuro o Modo Calma y ajusta el tamaño del texto.
                      </p>
                    </div>
                    <span className="status-badge status-badge--accepted">Aplicación inmediata</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Tema visual preferido</label>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${themeMode === 'light' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setThemeMode('light')}
                        >
                          Modo Claro
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${themeMode === 'dark' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setThemeMode('dark')}
                        >
                          Modo Oscuro
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${themeMode === 'calm' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setThemeMode('calm')}
                        >
                          Modo Calma
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="ls-font-size">Tamaño de letra</label>
                      <select
                        id="ls-font-size"
                        value={preferences.fontSize}
                        onChange={(e) =>
                          updatePreferences({
                            fontSize: e.target.value as 'normal' | 'large' | 'xlarge',
                          })
                        }
                      >
                        <option value="normal">Normal (100%)</option>
                        <option value="large">Grande (108%)</option>
                        <option value="xlarge">Extra Grande (116%)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="ls-spacing">Espaciado de lectura</label>
                      <select
                        id="ls-spacing"
                        value={preferences.spacing}
                        onChange={(e) =>
                          updatePreferences({
                            spacing: e.target.value as 'standard' | 'spacious',
                          })
                        }
                      >
                        <option value="standard">Estándar</option>
                        <option value="spacious">Amplio y despejado</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <Link to="/settings" className="btn btn-outline btn-sm">
                    Más opciones de accesibilidad y notificaciones
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={savingConfig}>
                    {savingConfig ? 'Guardando preferencias...' : 'Guardar mi perfil de aprendizaje'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
    </div>
  );
};

export default LearningSpace;
