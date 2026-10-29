import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  projectService,
  type PositionInputDTO,
} from '../../services/project.service';
import type {
  Project,
  ProjectPosition,
  ProjectMember,
  ProjectApplication,
  ProjectStatus,
  ProjectModality,
  ProjectCompensationType,
  PositionStatus,
  ProjectMilestone,
} from '../../types/project';
import { getUserDisplayName } from '../../utils/formatters';
import {
  BriefcaseIcon,
  PlusIcon,
  UsersIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  SearchIcon,
  TrashIcon,
  EditIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
} from '../../components/common/Icons';

const PROJECT_CATEGORIES = [
  'Desarrollo de Software',
  'Aplicación Móvil / Web',
  'Inteligencia Artificial y Datos',
  'Ciberseguridad y Redes',
  'Videojuegos y Modelado 3D',
  'UX/UI y Diseño Digital',
  'Innovación e Investigación',
  'Hardware / IoT',
];

const QUICK_ROLE_PRESETS = [
  'Frontend Developer',
  'Backend Developer',
  'Especialista Base de Datos',
  'Diseñador UX/UI',
  'QA / Testing',
  'Artista / Modelador 3D',
  'Analista de Ciberseguridad',
  'Investigador / Documentación',
];

const COMPENSATION_LABELS: Record<ProjectCompensationType, { label: string; badgeClass: string }> = {
  unpaid_academic: { label: 'Académico / Colaborativo (Sin pago)', badgeClass: 'ia-badge-blue' },
  paid: { label: 'Remunerado', badgeClass: 'ia-badge-success' },
  milestone_based: { label: 'Pago por Hitos / Entregables', badgeClass: 'ia-badge-purple' },
  revenue_share: { label: 'Participación / Revenue Share', badgeClass: 'ia-badge-amber' },
  negotiable: { label: 'Compensación a Convenir', badgeClass: 'ia-badge-neutral' },
};

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'Borrador', badgeClass: 'ia-badge-neutral' },
  open: { label: 'Abierto · Buscando Equipo', badgeClass: 'ia-badge-success' },
  recruiting: { label: 'Abierto · Buscando Equipo', badgeClass: 'ia-badge-success' },
  in_progress: { label: 'En Desarrollo', badgeClass: 'ia-badge-blue' },
  completed: { label: 'Finalizado', badgeClass: 'ia-badge-purple' },
  cancelled: { label: 'Cancelado', badgeClass: 'ia-badge-neutral' },
};

const MODALITY_LABELS: Record<ProjectModality, string> = {
  online: '100% Online / Remoto',
  presencial: 'Presencial en Sede',
  hibrido: 'Híbrido (Online + Sede)',
};

export default function ProjectsHub() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'explore' | 'my_projects' | 'my_applications'>('explore');
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myApplications, setMyApplications] = useState<ProjectApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros de descubrimiento
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterModality, setFilterModality] = useState<string>('all');
  const [filterCompensation, setFilterCompensation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [onlyOpenVacancies, setOnlyOpenVacancies] = useState<boolean>(false);

  // Vista de Detalle / Workspace de un Proyecto
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'roles' | 'team' | 'milestones' | 'applications'>('overview');
  const [projectPositions, setProjectPositions] = useState<ProjectPosition[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectApplications, setProjectApplications] = useState<ProjectApplication[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Nuevo hito en el workspace
  const [newMilestoneTitle, setNewMilestoneTitle] = useState<string>('');
  const [newMilestoneDue, setNewMilestoneDue] = useState<string>('');

  // Modal de Creación / Edición de Proyecto
  const [showBuilderModal, setShowBuilderModal] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formShortDesc, setFormShortDesc] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formProblem, setFormProblem] = useState<string>('');
  const [formObjectives, setFormObjectives] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  const [formCareer, setFormCareer] = useState<string>('Ingeniería en Informática');
  const [formTechnologies, setFormTechnologies] = useState<string>('React, TypeScript, Node.js, PostgreSQL');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('open');
  const [formModality, setFormModality] = useState<ProjectModality>('online');
  const [formDedication, setFormDedication] = useState<number>(6);
  const [formMaxMembers, setFormMaxMembers] = useState<number>(5);
  const [formRequirements, setFormRequirements] = useState<string>('');
  const [formCompType, setFormCompType] = useState<ProjectCompensationType>('unpaid_academic');
  const [formCompAmount, setFormCompAmount] = useState<string>('');
  const [formCompCurrency, setFormCompCurrency] = useState<string>('CLP');
  const [formCompPeriodicity, setFormCompPeriodicity] = useState<string>('por_hito');
  const [formCompNotes, setFormCompNotes] = useState<string>('');
  const [formAgreementSchedule, setFormAgreementSchedule] = useState<string>('Reunión semanal de seguimiento y coordinación asíncrona');
  const [formAgreementTools, setFormAgreementTools] = useState<string>('GitHub, Discord/Teams, Tablero Kanban');
  const [formAgreementDeliverables, setFormAgreementDeliverables] = useState<string>('Entregas iterativas por sprint / hito académico');
  const [formAgreementIp, setFormAgreementIp] = useState<string>('Coautoría académica compartida entre los integrantes activos');
  const [formGithubUrl, setFormGithubUrl] = useState<string>('');
  const [formFigmaUrl, setFormFigmaUrl] = useState<string>('');
  const [formPositions, setFormPositions] = useState<PositionInputDTO[]>([
    {
      title: 'Frontend Developer',
      description: 'Construcción de interfaz responsiva e integración con API.',
      skills_required: ['React', 'TypeScript', 'CSS'],
      mandatory_requirements: ['Conocimientos base de componentes web'],
      dedication_hours: 6,
      slots: 1,
      status: 'open',
    },
    {
      title: 'Backend Developer',
      description: 'Diseño de endpoints, lógica de negocio y persistencia de datos.',
      skills_required: ['Node.js', 'SQL'],
      mandatory_requirements: ['Manejo de APIs REST'],
      dedication_hours: 6,
      slots: 1,
      status: 'open',
    },
  ]);
  const [savingProject, setSavingProject] = useState<boolean>(false);

  // Modal de Postulación a un Rol
  const [applyingPosition, setApplyingPosition] = useState<{ project: Project; position: ProjectPosition } | null>(null);
  const [applyMessage, setApplyMessage] = useState<string>('');
  const [applySkills, setApplySkills] = useState<string>('');
  const [applyPortfolio, setApplyPortfolio] = useState<string>('');
  const [applyAvailability, setApplyAvailability] = useState<string>('Disponible 6 horas semanales');
  const [applyAcceptedAgreements, setApplyAcceptedAgreements] = useState<boolean>(false);
  const [submittingApplication, setSubmittingApplication] = useState<boolean>(false);

  // Confirmación de eliminación
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<boolean>(false);

  // Notificaciones
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4500);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [pub, mine, apps] = await Promise.all([
        projectService.getProjects(),
        user ? projectService.getMyProjects() : Promise.resolve([]),
        user ? projectService.getMyApplications() : Promise.resolve([]),
      ]);
      setProjects(pub);
      setMyProjects(mine);
      setMyApplications(apps);
    } catch (err: any) {
      console.error('[ProjectsHub] Error al cargar proyectos:', err);
      setErrorMsg('No fue posible cargar el listado de proyectos.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openProjectWorkspace = async (project: Project) => {
    setSelectedProject(project);
    setWorkspaceTab('overview');
    setLoadingDetail(true);
    try {
      const isOwner = Boolean(user?.id && project.owner_id === user.id);
      const [detail, positions, members, apps] = await Promise.all([
        projectService.getProjectById(project.id),
        projectService.getProjectPositions(project.id),
        projectService.getProjectMembers(project.id),
        isOwner ? projectService.getProjectApplications(project.id) : Promise.resolve([]),
      ]);
      if (detail) setSelectedProject(detail);
      setProjectPositions(positions.length > 0 ? positions : detail?.positions || []);
      setProjectMembers(members.length > 0 ? members : detail?.members || []);
      setProjectApplications(apps);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setFormTitle('');
    setFormShortDesc('');
    setFormDescription('');
    setFormProblem('');
    setFormObjectives('');
    setFormCategory(PROJECT_CATEGORIES[0]);
    setFormCareer('Ingeniería en Informática');
    setFormTechnologies('React, TypeScript, Node.js, PostgreSQL');
    setFormStatus('open');
    setFormModality('online');
    setFormDedication(6);
    setFormMaxMembers(5);
    setFormRequirements('');
    setFormCompType('unpaid_academic');
    setFormCompAmount('');
    setFormCompCurrency('CLP');
    setFormCompPeriodicity('por_hito');
    setFormCompNotes('');
    setFormAgreementSchedule('Reunión semanal de seguimiento y coordinación asíncrona');
    setFormAgreementTools('GitHub, Discord/Teams, Tablero Kanban');
    setFormAgreementDeliverables('Entregas iterativas por sprint / hito académico');
    setFormAgreementIp('Coautoría académica compartida entre los integrantes activos');
    setFormGithubUrl('');
    setFormFigmaUrl('');
    setFormPositions([
      {
        title: 'Frontend Developer',
        description: 'Construcción de interfaz responsiva e integración con API.',
        skills_required: ['React', 'TypeScript'],
        mandatory_requirements: ['Compromiso con entregas semanales'],
        dedication_hours: 6,
        slots: 1,
        status: 'open',
      },
    ]);
    setShowBuilderModal(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormTitle(proj.title);
    setFormShortDesc(proj.short_description || '');
    setFormDescription(proj.description || '');
    setFormProblem(proj.problem_statement || '');
    setFormObjectives(proj.objectives || '');
    setFormCategory(proj.category || PROJECT_CATEGORIES[0]);
    setFormCareer(proj.career || 'Ingeniería en Informática');
    setFormTechnologies((proj.technologies || []).join(', '));
    setFormStatus(proj.status || 'open');
    setFormModality(proj.modality || 'online');
    setFormDedication(proj.dedication_hours || 6);
    setFormMaxMembers(proj.max_members || 4);
    setFormRequirements(proj.requirements || '');
    setFormCompType(proj.compensation_type || 'unpaid_academic');
    setFormCompAmount(proj.compensation_amount ? String(proj.compensation_amount) : '');
    setFormCompCurrency(proj.compensation_currency || 'CLP');
    setFormCompPeriodicity(proj.compensation_periodicity || 'por_hito');
    setFormCompNotes(proj.compensation_notes || '');
    setFormAgreementSchedule(proj.agreements?.schedule || 'Reunión semanal de coordinación');
    setFormAgreementTools(proj.agreements?.tools || 'GitHub, Discord');
    setFormAgreementDeliverables(proj.agreements?.deliverables || 'Entregas por hito');
    setFormAgreementIp(proj.agreements?.intellectual_property || 'Coautoría compartida');
    setFormGithubUrl(proj.external_links?.github || '');
    setFormFigmaUrl(proj.external_links?.figma || '');

    const currentPos = proj.positions && proj.positions.length > 0 ? proj.positions : projectPositions;
    setFormPositions(
      currentPos.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        skills_required: p.skills_required || [],
        mandatory_requirements: p.mandatory_requirements || [],
        dedication_hours: p.dedication_hours || 6,
        slots: p.slots || 1,
        status: p.status || 'open',
      }))
    );
    setShowBuilderModal(true);
  };

  const handleAddRoleRow = (presetTitle = '') => {
    setFormPositions((prev) => [
      ...prev,
      {
        title: presetTitle || 'Nuevo Rol Especialista',
        description: `Responsable de ${presetTitle || 'tareas técnicas del área'} en el proyecto.`,
        skills_required: presetTitle ? [presetTitle] : [],
        mandatory_requirements: ['Compromiso con los acuerdos del equipo'],
        dedication_hours: formDedication,
        slots: 1,
        status: 'open',
      },
    ]);
  };

  const handleUpdateRoleRow = (idx: number, patch: Partial<PositionInputDTO>) => {
    setFormPositions((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const handleRemoveRoleRow = (idx: number) => {
    setFormPositions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || savingProject) return;

    setSavingProject(true);
    setErrorMsg('');

    const parsedTechs = formTechnologies
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: formTitle.trim(),
      short_description: formShortDesc.trim() || formDescription.trim().slice(0, 160),
      description: formDescription.trim() || formShortDesc.trim() || 'Proyecto colaborativo interdisciplinario.',
      problem_statement: formProblem.trim() || undefined,
      objectives: formObjectives.trim() || undefined,
      category: formCategory,
      career: formCareer.trim() || 'Ingeniería en Informática',
      technologies: parsedTechs,
      tags: parsedTechs.slice(0, 8),
      status: formStatus,
      visibility: 'public' as const,
      modality: formModality,
      dedication_hours: Number(formDedication) || 6,
      max_members: Number(formMaxMembers) || 4,
      requirements: formRequirements.trim() || undefined,
      compensation_type: formCompType,
      compensation_amount:
        formCompType !== 'unpaid_academic' && formCompAmount.trim()
          ? Number(formCompAmount)
          : null,
      compensation_currency: formCompCurrency,
      compensation_periodicity: formCompPeriodicity,
      compensation_notes: formCompNotes.trim() || undefined,
      agreements: {
        schedule: formAgreementSchedule.trim(),
        tools: formAgreementTools.trim(),
        deliverables: formAgreementDeliverables.trim(),
        intellectual_property: formAgreementIp.trim(),
      },
      external_links: {
        github: formGithubUrl.trim(),
        figma: formFigmaUrl.trim(),
      },
      positions: formPositions.filter((p) => p.title && p.title.trim()),
    };

    try {
      if (editingProject) {
        const updated = await projectService.updateProject(editingProject.id, payload);
        showFeedback('Proyecto actualizado exitosamente.');
        setShowBuilderModal(false);
        await loadAll();
        if (selectedProject?.id === editingProject.id) {
          await openProjectWorkspace(updated);
        }
      } else {
        const created = await projectService.createProject(payload);
        showFeedback('¡Proyecto publicado exitosamente con sus roles y acuerdos!');
        setShowBuilderModal(false);
        await loadAll();
        await openProjectWorkspace(created);
      }
    } catch (err: any) {
      showFeedback(err?.message || 'Error al guardar el proyecto.', true);
    } finally {
      setSavingProject(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete || deletingProject) return;
    setDeletingProject(true);
    try {
      await projectService.deleteProject(projectToDelete.id);
      if (selectedProject?.id === projectToDelete.id) {
        setSelectedProject(null);
      }
      setProjectToDelete(null);
      showFeedback('Proyecto eliminado correctamente.');
      await loadAll();
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo eliminar el proyecto.', true);
    } finally {
      setDeletingProject(false);
    }
  };

  const handleOpenApplyModal = (project: Project, position: ProjectPosition) => {
    setApplyingPosition({ project, position });
    setApplyMessage('');
    setApplySkills((position.skills_required || []).join(', '));
    setApplyPortfolio('');
    setApplyAvailability(`Disponible ${position.dedication_hours || project.dedication_hours || 6} hrs/semana`);
    setApplyAcceptedAgreements(false);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingPosition || submittingApplication) return;
    if (!applyAcceptedAgreements) {
      showFeedback('Debes aceptar explícitamente los acuerdos y condiciones del proyecto para postular.', true);
      return;
    }

    setSubmittingApplication(true);
    try {
      const skillsArr = applySkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await projectService.applyToPosition(applyingPosition.project.id, applyingPosition.position.id, {
        message: applyMessage.trim(),
        relevant_skills: skillsArr,
        portfolio_url: applyPortfolio.trim() || undefined,
        availability_notes: applyAvailability.trim() || undefined,
        accepted_agreements: true,
      });

      setApplyingPosition(null);
      showFeedback(`¡Postulación enviada al rol "${applyingPosition.position.title}"! El creador revisará tu perfil.`);
      await loadAll();
    } catch (err: any) {
      showFeedback(err?.message || 'No fue posible enviar la postulación.', true);
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleReviewApplication = async (applicationId: string, status: 'accepted' | 'rejected') => {
    try {
      await projectService.reviewApplication(applicationId, status);
      showFeedback(
        status === 'accepted'
          ? '¡Postulante aceptado e incorporado automáticamente al equipo del proyecto!'
          : 'Postulación rechazada.'
      );
      if (selectedProject) {
        await openProjectWorkspace(selectedProject);
      }
      await loadAll();
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo procesar la postulación.', true);
    }
  };

  const handleWithdrawApplication = async (applicationId: string) => {
    try {
      await projectService.withdrawApplication(applicationId);
      showFeedback('Has retirado tu postulación.');
      await loadAll();
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo retirar la postulación.', true);
    }
  };

  const handleTogglePositionStatus = async (pos: ProjectPosition, nextStatus: PositionStatus) => {
    if (!selectedProject) return;
    try {
      await projectService.updatePositionStatus(selectedProject.id, pos.id, nextStatus);
      setProjectPositions((prev) =>
        prev.map((item) => (item.id === pos.id ? { ...item, status: nextStatus } : item))
      );
      showFeedback(`Estado de la vacante "${pos.title}" actualizado a ${nextStatus}.`);
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo actualizar la vacante.', true);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMilestoneTitle.trim()) return;
    const currentMilestones: ProjectMilestone[] = selectedProject.milestones || [];
    const nextMilestones: ProjectMilestone[] = [
      ...currentMilestones,
      {
        id: `ms-${Date.now()}`,
        title: newMilestoneTitle.trim(),
        due_date: newMilestoneDue || undefined,
        completed: false,
      },
    ];
    try {
      const updated = await projectService.updateProject(selectedProject.id, {
        milestones: nextMilestones,
      });
      setSelectedProject(updated);
      setNewMilestoneTitle('');
      setNewMilestoneDue('');
      showFeedback('Hito / entregable agregado al plan del proyecto.');
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo agregar el hito.', true);
    }
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    if (!selectedProject) return;
    const nextMilestones = (selectedProject.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    try {
      const updated = await projectService.updateProject(selectedProject.id, {
        milestones: nextMilestones,
      });
      setSelectedProject(updated);
    } catch (err: any) {
      showFeedback(err?.message || 'No se pudo actualizar el hito.', true);
    }
  };

  // Filtrado de proyectos para Explorar
  const filteredProjects = projects.filter((proj) => {
    if (filterCategory !== 'all' && proj.category !== filterCategory) return false;
    if (filterModality !== 'all' && (proj.modality || 'online') !== filterModality) return false;
    if (filterCompensation !== 'all' && (proj.compensation_type || 'unpaid_academic') !== filterCompensation) return false;
    if (filterStatus !== 'all' && proj.status !== filterStatus) return false;

    if (onlyOpenVacancies) {
      const openSlots =
        typeof proj.open_slots_count === 'number'
          ? proj.open_slots_count
          : (proj.positions || []).filter((p) => p.status === 'open').length;
      if (openSlots <= 0 && (proj.positions || []).length > 0) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchTitle = proj.title.toLowerCase().includes(term);
      const matchDesc = (proj.description || '').toLowerCase().includes(term) || (proj.short_description || '').toLowerCase().includes(term);
      const matchTech = (proj.technologies || []).some((t) => t.toLowerCase().includes(term));
      const matchRoles = (proj.positions || []).some((p) => p.title.toLowerCase().includes(term));
      if (!matchTitle && !matchDesc && !matchTech && !matchRoles) return false;
    }

    return true;
  });

  return (
    <div>
      {/* Cabecera distintiva del Hub de Proyectos */}
      <div className="ia-page-header">
        <div>
          <h1 className="ia-page-title">Hub de Proyectos Académicos e Interdisciplinarios</h1>
          <p className="ia-page-subtitle">
            Publica iniciativas de desarrollo, innovación o investigación, define roles específicos, establece acuerdos transparentes y recluta talento estudiantil.
          </p>
        </div>

        <div className="ia-page-actions">
          {selectedProject && (
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={() => setSelectedProject(null)}
            >
              <ArrowLeftIcon size={16} />
              <span>Volver al Catálogo</span>
            </button>
          )}
          <button type="button" className="ia-btn-primary" onClick={openCreateModal}>
            <PlusIcon size={16} color="#ffffff" />
            <span>Publicar Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'var(--ia-danger-bg)',
            border: '1px solid var(--ia-danger-border)',
            color: 'var(--ia-danger)',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircleIcon size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'var(--ia-success-bg)',
            border: '1px solid var(--ia-success-border)',
            color: 'var(--ia-success)',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckIcon size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* MODAL CONSTRUCTOR / EDITOR DE PROYECTO (CON ROLES Y ACUERDOS) */}
      {showBuilderModal && (
        <div className="ia-card" style={{ marginBottom: '24px', border: '1px solid var(--ia-primary-border)', padding: '24px' }}>
          <div className="ia-card-header">
            <h2 className="ia-card-title">
              <BriefcaseIcon size={18} color="var(--ia-primary)" />
              <span>{editingProject ? 'Editar Proyecto y Vacantes' : 'Publicar Nuevo Proyecto Colaborativo'}</span>
            </h2>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setShowBuilderModal(false)}
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSaveProject}>
            {/* Sección 1: Datos Generales */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ia-primary)', margin: '0 0 12px 0' }}>
              1. Identidad y Alcance del Proyecto
            </h3>
            <div className="ia-form-grid" style={{ marginBottom: '20px' }}>
              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="proj-title">
                  Título del Proyecto *
                </label>
                <input
                  id="proj-title"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: Plataforma de Monitoreo IoT para Laboratorios Universitarios"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-category">
                  Categoría / Área Principal
                </label>
                <select
                  id="proj-category"
                  className="ia-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {PROJECT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-career">
                  Carrera o Escuela de Origen
                </label>
                <input
                  id="proj-career"
                  type="text"
                  className="ia-input"
                  value={formCareer}
                  onChange={(e) => setFormCareer(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-modality">
                  Modalidad de Trabajo
                </label>
                <select
                  id="proj-modality"
                  className="ia-select"
                  value={formModality}
                  onChange={(e) => setFormModality(e.target.value as ProjectModality)}
                >
                  <option value="online">100% Online / Remoto</option>
                  <option value="hibrido">Híbrido (Online + Reuniones en Sede)</option>
                  <option value="presencial">Presencial en Sede</option>
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-status">
                  Estado del Proyecto
                </label>
                <select
                  id="proj-status"
                  className="ia-select"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                >
                  <option value="open">Abierto · Buscando Integrantes</option>
                  <option value="in_progress">En Desarrollo</option>
                  <option value="draft">Borrador (Solo visible para mí)</option>
                  <option value="completed">Finalizado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-dedication">
                  Dedicación Estimada (Horas / Semana)
                </label>
                <input
                  id="proj-dedication"
                  type="number"
                  min={1}
                  max={45}
                  className="ia-input"
                  value={formDedication}
                  onChange={(e) => setFormDedication(Number(e.target.value))}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-max-members">
                  Tamaño Máximo del Equipo
                </label>
                <input
                  id="proj-max-members"
                  type="number"
                  min={1}
                  max={30}
                  className="ia-input"
                  value={formMaxMembers}
                  onChange={(e) => setFormMaxMembers(Number(e.target.value))}
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="proj-short-desc">
                  Resumen Ejecutivo (1-2 líneas)
                </label>
                <input
                  id="proj-short-desc"
                  type="text"
                  className="ia-input"
                  placeholder="Síntesis rápida del proyecto para la tarjeta del catálogo..."
                  value={formShortDesc}
                  onChange={(e) => setFormShortDesc(e.target.value)}
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="proj-desc">
                  Descripción General del Proyecto *
                </label>
                <textarea
                  id="proj-desc"
                  className="ia-textarea"
                  rows={3}
                  placeholder="Explica en qué consiste la iniciativa, su contexto académico o práctico y el impacto esperado..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-problem">
                  Problema o Necesidad que Resuelve
                </label>
                <textarea
                  id="proj-problem"
                  className="ia-textarea"
                  rows={3}
                  placeholder="¿Qué dolor, desafío técnico o oportunidad aborda este proyecto?"
                  value={formProblem}
                  onChange={(e) => setFormProblem(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-objectives">
                  Objetivos y Entregables Clave
                </label>
                <textarea
                  id="proj-objectives"
                  className="ia-textarea"
                  rows={3}
                  placeholder="Ej: 1. Prototipo funcional en Figma, 2. MVP en React/Node, 3. Presentación en feria..."
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="proj-techs">
                  Tecnologías y Herramientas Previstas (separadas por coma)
                </label>
                <input
                  id="proj-techs"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: React, TypeScript, Python, PostgreSQL, Docker, Blender, Figma"
                  value={formTechnologies}
                  onChange={(e) => setFormTechnologies(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-github">
                  Repositorio GitHub / GitLab (Opcional)
                </label>
                <input
                  id="proj-github"
                  type="url"
                  className="ia-input"
                  placeholder="https://github.com/..."
                  value={formGithubUrl}
                  onChange={(e) => setFormGithubUrl(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="proj-figma">
                  Enlace de Diseño / Documentación (Opcional)
                </label>
                <input
                  id="proj-figma"
                  type="url"
                  className="ia-input"
                  placeholder="https://figma.com/..."
                  value={formFigmaUrl}
                  onChange={(e) => setFormFigmaUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Sección 2: Roles y Vacantes */}
            <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ia-primary)', margin: 0 }}>
                    2. Roles y Vacantes del Equipo ({formPositions.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)' }}>
                    Agrega los perfiles específicos que necesitas reclutar para el proyecto.
                  </span>
                </div>
                <button
                  type="button"
                  className="ia-btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                  onClick={() => handleAddRoleRow('')}
                >
                  + Añadir Rol Personalizado
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {QUICK_ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="ia-tag"
                    onClick={() => handleAddRoleRow(preset)}
                    title={`Añadir vacante de ${preset}`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formPositions.map((pos, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--ia-border)',
                      background: 'var(--ia-bg-body)',
                    }}
                  >
                    <div className="ia-form-grid">
                      <div className="ia-form-group">
                        <label className="ia-label">Nombre del Rol *</label>
                        <input
                          type="text"
                          className="ia-input"
                          value={pos.title}
                          onChange={(e) => handleUpdateRoleRow(idx, { title: e.target.value })}
                          placeholder="Ej: Especialista Base de Datos"
                          required
                        />
                      </div>

                      <div className="ia-form-group" style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label className="ia-label">Cupos</label>
                          <input
                            type="number"
                            min={1}
                            max={15}
                            className="ia-input"
                            value={pos.slots || 1}
                            onChange={(e) => handleUpdateRoleRow(idx, { slots: Number(e.target.value) })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="ia-label">Hrs/sem</label>
                          <input
                            type="number"
                            min={1}
                            max={45}
                            className="ia-input"
                            value={pos.dedication_hours || 6}
                            onChange={(e) => handleUpdateRoleRow(idx, { dedication_hours: Number(e.target.value) })}
                          />
                        </div>
                        {formPositions.length > 1 && (
                          <button
                            type="button"
                            className="ia-btn-icon-danger"
                            onClick={() => handleRemoveRoleRow(idx)}
                            title="Quitar este rol"
                          >
                            <TrashIcon size={15} />
                          </button>
                        )}
                      </div>

                      <div className="ia-form-group full">
                        <label className="ia-label">Tareas y Responsabilidades del Rol</label>
                        <input
                          type="text"
                          className="ia-input"
                          value={pos.description || ''}
                          onChange={(e) => handleUpdateRoleRow(idx, { description: e.target.value })}
                          placeholder="Describe qué construirá o investigará quien ocupe esta vacante..."
                        />
                      </div>

                      <div className="ia-form-group">
                        <label className="ia-label">Habilidades Deseadas (separadas por coma)</label>
                        <input
                          type="text"
                          className="ia-input"
                          value={(pos.skills_required || []).join(', ')}
                          onChange={(e) =>
                            handleUpdateRoleRow(idx, {
                              skills_required: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Ej: PostgreSQL, Modelamiento ER, Índices"
                        />
                      </div>

                      <div className="ia-form-group">
                        <label className="ia-label">Requisitos Obligatorios</label>
                        <input
                          type="text"
                          className="ia-input"
                          value={(pos.mandatory_requirements || []).join(', ')}
                          onChange={(e) =>
                            handleUpdateRoleRow(idx, {
                              mandatory_requirements: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Ej: Haber aprobado Base de Datos I"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección 3: Condiciones Económicas y Acuerdos */}
            <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '18px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ia-primary)', margin: '0 0 12px 0' }}>
                3. Condiciones Económicas y Acuerdos de Trabajo Transparentes
              </h3>

              <div className="ia-form-grid">
                <div className="ia-form-group">
                  <label className="ia-label" htmlFor="proj-comp-type">
                    Modalidad de Compensación
                  </label>
                  <select
                    id="proj-comp-type"
                    className="ia-select"
                    value={formCompType}
                    onChange={(e) => setFormCompType(e.target.value as ProjectCompensationType)}
                  >
                    <option value="unpaid_academic">Proyecto Académico / Portafolio (Sin remuneración)</option>
                    <option value="paid">Remunerado (Monto fijo o periódico)</option>
                    <option value="milestone_based">Pago por Hitos / Entregables cumplidos</option>
                    <option value="revenue_share">Participación / Reparto de beneficios futuros</option>
                    <option value="negotiable">Compensación a convenir según rol</option>
                  </select>
                </div>

                {formCompType !== 'unpaid_academic' && (
                  <div className="ia-form-group" style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <div style={{ flex: 2 }}>
                      <label className="ia-label">Monto Estimado</label>
                      <input
                        type="number"
                        min={0}
                        className="ia-input"
                        placeholder="Ej: 150000"
                        value={formCompAmount}
                        onChange={(e) => setFormCompAmount(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="ia-label">Moneda</label>
                      <select
                        className="ia-select"
                        value={formCompCurrency}
                        onChange={(e) => setFormCompCurrency(e.target.value)}
                      >
                        <option value="CLP">CLP ($)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <label className="ia-label">Periodicidad</label>
                      <select
                        className="ia-select"
                        value={formCompPeriodicity}
                        onChange={(e) => setFormCompPeriodicity(e.target.value)}
                      >
                        <option value="por_hito">Por Hito</option>
                        <option value="mensual">Mensual</option>
                        <option value="unico">Pago Único</option>
                        <option value="por_hora">Por Hora</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="ia-form-group full">
                  <label className="ia-label">Detalle de Condiciones Económicas / Beneficios para el Postulante</label>
                  <input
                    type="text"
                    className="ia-input"
                    placeholder="Ej: Proyecto para concurso de innovación con fondo adjudicable o crédito académico..."
                    value={formCompNotes}
                    onChange={(e) => setFormCompNotes(e.target.value)}
                  />
                </div>

                <div className="ia-form-group">
                  <label className="ia-label">Acuerdo de Horarios y Reuniones</label>
                  <input
                    type="text"
                    className="ia-input"
                    value={formAgreementSchedule}
                    onChange={(e) => setFormAgreementSchedule(e.target.value)}
                  />
                </div>

                <div className="ia-form-group">
                  <label className="ia-label">Herramientas de Trabajo del Equipo</label>
                  <input
                    type="text"
                    className="ia-input"
                    value={formAgreementTools}
                    onChange={(e) => setFormAgreementTools(e.target.value)}
                  />
                </div>

                <div className="ia-form-group">
                  <label className="ia-label">Compromiso de Entregables</label>
                  <input
                    type="text"
                    className="ia-input"
                    value={formAgreementDeliverables}
                    onChange={(e) => setFormAgreementDeliverables(e.target.value)}
                  />
                </div>

                <div className="ia-form-group">
                  <label className="ia-label">Propiedad Intelectual y Reconocimiento</label>
                  <input
                    type="text"
                    className="ia-input"
                    value={formAgreementIp}
                    onChange={(e) => setFormAgreementIp(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="ia-btn-secondary" onClick={() => setShowBuilderModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="ia-btn-primary" disabled={savingProject}>
                {savingProject
                  ? 'Guardando proyecto...'
                  : editingProject
                  ? 'Guardar Cambios del Proyecto'
                  : 'Publicar Proyecto y Abrir Vacantes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL AUDITABLE DE POSTULACIÓN A UNA VACANTE */}
      {applyingPosition && (
        <div className="ia-card" style={{ marginBottom: '24px', border: '2px solid var(--ia-primary)', padding: '24px' }}>
          <div className="ia-card-header">
            <h2 className="ia-card-title">
              Postular al Rol: {applyingPosition.position.title} · {applyingPosition.project.title}
            </h2>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setApplyingPosition(null)}
            >
              Cancelar
            </button>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--ia-bg-subtle)',
              border: '1px solid var(--ia-border)',
              marginBottom: '16px',
              fontSize: '0.84rem',
              color: 'var(--ia-text-body)',
            }}
          >
            <strong>Resumen de Condiciones y Acuerdos del Proyecto:</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', lineHeight: 1.55 }}>
              <li>
                <strong>Compensación:</strong>{' '}
                {COMPENSATION_LABELS[applyingPosition.project.compensation_type || 'unpaid_academic']?.label}
                {applyingPosition.project.compensation_amount
                  ? ` (${applyingPosition.project.compensation_amount} ${applyingPosition.project.compensation_currency || 'CLP'} / ${applyingPosition.project.compensation_periodicity || 'hito'})`
                  : ''}
              </li>
              <li>
                <strong>Dedicación estimada:</strong>{' '}
                {applyingPosition.position.dedication_hours || applyingPosition.project.dedication_hours || 6} horas/semana ·{' '}
                {MODALITY_LABELS[applyingPosition.project.modality || 'online']}
              </li>
              {applyingPosition.project.agreements?.schedule && (
                <li>
                  <strong>Coordinación:</strong> {applyingPosition.project.agreements.schedule}
                </li>
              )}
              {applyingPosition.project.agreements?.intellectual_property && (
                <li>
                  <strong>Autoría / Propiedad Intelectual:</strong> {applyingPosition.project.agreements.intellectual_property}
                </li>
              )}
            </ul>
          </div>

          <form onSubmit={handleSubmitApplication}>
            <div className="ia-form-grid">
              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="apply-motivation">
                  Mensaje de Motivación y Experiencia para el Rol *
                </label>
                <textarea
                  id="apply-motivation"
                  className="ia-textarea"
                  rows={3}
                  placeholder="Cuéntale al creador del proyecto qué asignaturas o proyectos previos has realizado y cómo aportarás en este rol..."
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="apply-skills">
                  Habilidades Relevantes que Dominas
                </label>
                <input
                  id="apply-skills"
                  type="text"
                  className="ia-input"
                  value={applySkills}
                  onChange={(e) => setApplySkills(e.target.value)}
                  placeholder="Ej: React, TypeScript, Diseño de APIs"
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="apply-portfolio">
                  Enlace a Portafolio / GitHub (Opcional)
                </label>
                <input
                  id="apply-portfolio"
                  type="url"
                  className="ia-input"
                  value={applyPortfolio}
                  onChange={(e) => setApplyPortfolio(e.target.value)}
                  placeholder="https://github.com/tu-usuario"
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="apply-availability">
                  Disponibilidad Horaria
                </label>
                <input
                  id="apply-availability"
                  type="text"
                  className="ia-input"
                  value={applyAvailability}
                  onChange={(e) => setApplyAvailability(e.target.value)}
                />
              </div>

              <div className="ia-form-group full">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--ia-primary-subtle)',
                    border: '1px solid var(--ia-primary-border)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'var(--ia-text-main)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={applyAcceptedAgreements}
                    onChange={(e) => setApplyAcceptedAgreements(e.target.checked)}
                    style={{ marginTop: '3px' }}
                    required
                  />
                  <span>
                    <strong>Aceptación Explícita de Acuerdos:</strong> He leído y acepto las condiciones económicas ({COMPENSATION_LABELS[applyingPosition.project.compensation_type || 'unpaid_academic']?.label}), la dedicación horaria estimada y los acuerdos de trabajo y coautoría definidos en este proyecto.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" className="ia-btn-secondary" onClick={() => setApplyingPosition(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                className="ia-btn-primary"
                disabled={submittingApplication || !applyAcceptedAgreements}
              >
                {submittingApplication ? 'Enviando postulación...' : 'Confirmar y Enviar Postulación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmación de Eliminación de Proyecto */}
      {projectToDelete && (
        <div
          className="ia-card"
          style={{
            marginBottom: '20px',
            border: '1px solid var(--ia-danger-border)',
            background: 'var(--ia-danger-bg)',
          }}
        >
          <h3 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: 'var(--ia-danger)' }}>
            ¿Eliminar el proyecto "{projectToDelete.title}"?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--ia-text-body)' }}>
            Esta acción eliminará el proyecto, sus vacantes y postulaciones asociadas.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="ia-btn-primary"
              style={{ background: 'var(--ia-danger)' }}
              onClick={handleConfirmDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? 'Eliminando...' : 'Sí, eliminar proyecto'}
            </button>
            <button type="button" className="ia-btn-secondary" onClick={() => setProjectToDelete(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VISTA WORKSPACE / DETALLE COMPLETO DEL PROYECTO */}
      {selectedProject ? (
        <div>
          <div className="ia-card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`ia-badge ${STATUS_LABELS[selectedProject.status]?.badgeClass || 'ia-badge-success'}`}>
                  {STATUS_LABELS[selectedProject.status]?.label || selectedProject.status}
                </span>
                <span className="ia-badge ia-badge-blue">{selectedProject.category || 'Desarrollo'}</span>
                <span className="ia-badge ia-badge-neutral">
                  {MODALITY_LABELS[selectedProject.modality || 'online']}
                </span>
                <span
                  className={`ia-badge ${
                    COMPENSATION_LABELS[selectedProject.compensation_type || 'unpaid_academic']?.badgeClass
                  }`}
                >
                  {COMPENSATION_LABELS[selectedProject.compensation_type || 'unpaid_academic']?.label}
                </span>
              </div>

              {user?.id && selectedProject.owner_id === user.id && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => openEditModal(selectedProject)}
                  >
                    <EditIcon size={15} />
                    <span>Editar Proyecto</span>
                  </button>
                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => setProjectToDelete(selectedProject)}
                    title="Eliminar proyecto"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              )}
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: '0 0 8px 0' }}>
              {selectedProject.title}
            </h2>

            <p style={{ fontSize: '0.95rem', color: 'var(--ia-text-body)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              {selectedProject.description || selectedProject.short_description}
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.83rem', color: 'var(--ia-text-muted)', paddingTop: '12px', borderTop: '1px solid var(--ia-border)' }}>
              <span>
                Líder del Proyecto:{' '}
                <Link
                  to={`/profile/${selectedProject.owner_id}`}
                  style={{ color: 'var(--ia-primary)', fontWeight: 700, textDecoration: 'none' }}
                >
                  {getUserDisplayName(selectedProject.owner as any)}
                </Link>
              </span>
              <span>Carrera: <strong>{selectedProject.career || 'Ingeniería en Informática'}</strong></span>
              <span>Dedicación: <strong>{selectedProject.dedication_hours || 6} hrs/semana</strong></span>
              <span>Equipo máximo: <strong>{selectedProject.max_members} integrantes</strong></span>
            </div>

            {/* Pestañas internas del Workspace */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--ia-border)' }}>
              <button
                type="button"
                className={workspaceTab === 'overview' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                onClick={() => setWorkspaceTab('overview')}
              >
                Visión General y Acuerdos
              </button>
              <button
                type="button"
                className={workspaceTab === 'roles' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                onClick={() => setWorkspaceTab('roles')}
              >
                Roles y Vacantes ({projectPositions.length})
              </button>
              <button
                type="button"
                className={workspaceTab === 'team' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                onClick={() => setWorkspaceTab('team')}
              >
                Equipo Actual ({projectMembers.length})
              </button>
              <button
                type="button"
                className={workspaceTab === 'milestones' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                onClick={() => setWorkspaceTab('milestones')}
              >
                Hitos y Entregables ({(selectedProject.milestones || []).length})
              </button>
              {user?.id && selectedProject.owner_id === user.id && (
                <button
                  type="button"
                  className={workspaceTab === 'applications' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                  onClick={() => setWorkspaceTab('applications')}
                >
                  Postulaciones Recibidas ({projectApplications.length})
                </button>
              )}
            </div>
          </div>

          {loadingDetail ? (
            <div className="ia-card" style={{ textAlign: 'center', padding: '28px' }}>
              <p style={{ margin: 0, color: 'var(--ia-text-muted)' }}>Cargando espacio del proyecto...</p>
            </div>
          ) : workspaceTab === 'overview' ? (
            <div className="ia-content-grid">
              <div>
                <div className="ia-card">
                  <h3 className="ia-card-title" style={{ marginBottom: '10px' }}>
                    Planteamiento del Problema y Objetivos
                  </h3>
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--ia-text-muted)', display: 'block', marginBottom: '4px' }}>
                      PROBLEMA O NECESIDAD:
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ia-text-body)', lineHeight: 1.55 }}>
                      {selectedProject.problem_statement || 'El proyecto busca resolver un desafío práctico mediante colaboración interdisciplinaria entre estudiantes.'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--ia-text-muted)', display: 'block', marginBottom: '4px' }}>
                      OBJETIVOS Y RESULTADOS ESPERADOS:
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ia-text-body)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {selectedProject.objectives || 'Construir un prototipo funcional validado y documentado.'}
                    </p>
                  </div>
                </div>

                <div className="ia-card">
                  <h3 className="ia-card-title" style={{ marginBottom: '12px' }}>
                    Acuerdos de Trabajo y Gobernanza del Equipo
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.86rem' }}>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--ia-bg-body)', border: '1px solid var(--ia-border)' }}>
                      <strong>Coordinación y Horarios:</strong>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--ia-text-body)' }}>
                        {selectedProject.agreements?.schedule || 'Reuniones semanales de coordinación'}
                      </p>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--ia-bg-body)', border: '1px solid var(--ia-border)' }}>
                      <strong>Herramientas de Colaboración:</strong>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--ia-text-body)' }}>
                        {selectedProject.agreements?.tools || 'GitHub, Discord, Kanban'}
                      </p>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--ia-bg-body)', border: '1px solid var(--ia-border)' }}>
                      <strong>Compromiso de Entregables:</strong>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--ia-text-body)' }}>
                        {selectedProject.agreements?.deliverables || 'Entregas iterativas por hito'}
                      </p>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--ia-bg-body)', border: '1px solid var(--ia-border)' }}>
                      <strong>Propiedad Intelectual / Créditos:</strong>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--ia-text-body)' }}>
                        {selectedProject.agreements?.intellectual_property || 'Coautoría académica compartida'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside>
                <div className="ia-card">
                  <h3 className="ia-card-title" style={{ marginBottom: '10px' }}>
                    Condiciones Económicas
                  </h3>
                  <div style={{ marginBottom: '10px' }}>
                    <span
                      className={`ia-badge ${
                        COMPENSATION_LABELS[selectedProject.compensation_type || 'unpaid_academic']?.badgeClass
                      }`}
                    >
                      {COMPENSATION_LABELS[selectedProject.compensation_type || 'unpaid_academic']?.label}
                    </span>
                  </div>
                  {selectedProject.compensation_amount && (
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: '0 0 6px 0' }}>
                      {selectedProject.compensation_amount.toLocaleString('es-CL')}{' '}
                      {selectedProject.compensation_currency || 'CLP'}{' '}
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ia-text-muted)' }}>
                        ({selectedProject.compensation_periodicity || 'por hito'})
                      </span>
                    </p>
                  )}
                  <p style={{ fontSize: '0.84rem', color: 'var(--ia-text-body)', margin: 0, lineHeight: 1.5 }}>
                    {selectedProject.compensation_notes ||
                      'Este proyecto se rige bajo los acuerdos transparentes publicados por su creador.'}
                  </p>
                </div>

                <div className="ia-card">
                  <h3 className="ia-card-title" style={{ marginBottom: '10px' }}>
                    Stack Tecnológico y Enlaces
                  </h3>
                  <div className="ia-tags-cloud" style={{ marginBottom: '14px' }}>
                    {(selectedProject.technologies || selectedProject.tags || ['Software']).map((tech) => (
                      <span key={tech} className="ia-tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                  {selectedProject.external_links?.github && (
                    <a
                      href={selectedProject.external_links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ia-btn-secondary"
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      <ExternalLinkIcon size={14} /> Repositorio del Proyecto
                    </a>
                  )}
                  {selectedProject.external_links?.figma && (
                    <a
                      href={selectedProject.external_links.figma}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ia-btn-secondary"
                      style={{ width: '100%' }}
                    >
                      <ExternalLinkIcon size={14} /> Diseño / Documentación
                    </a>
                  )}
                </div>
              </aside>
            </div>
          ) : workspaceTab === 'roles' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {projectPositions.map((pos) => {
                const isOwner = Boolean(user?.id && selectedProject.owner_id === user.id);
                const filled = pos.slots_filled || 0;
                const remaining = Math.max(0, (pos.slots || 1) - filled);
                const alreadyApplied = myApplications.some(
                  (a) => a.position_id === pos.id && a.status !== 'withdrawn'
                );

                return (
                  <div key={pos.id} className="ia-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          className={`ia-badge ${
                            pos.status === 'open' && remaining > 0
                              ? 'ia-badge-success'
                              : pos.status === 'paused'
                              ? 'ia-badge-amber'
                              : 'ia-badge-neutral'
                          }`}
                        >
                          {pos.status === 'open' && remaining > 0
                            ? `${remaining} de ${pos.slots} vacante(s) disponible(s)`
                            : pos.status === 'paused'
                            ? 'Vacante en pausa'
                            : 'Vacante cubierta'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                          {pos.dedication_hours || selectedProject.dedication_hours || 6} hrs/sem
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: '0 0 6px 0' }}>
                        {pos.title}
                      </h3>
                      <p style={{ fontSize: '0.86rem', color: 'var(--ia-text-body)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                        {pos.description || 'Participación técnica activa en el equipo del proyecto.'}
                      </p>

                      {pos.skills_required && pos.skills_required.length > 0 && (
                        <div className="ia-tags-cloud" style={{ marginBottom: '10px' }}>
                          {pos.skills_required.map((sk) => (
                            <span key={sk} className="ia-tag" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      {pos.mandatory_requirements && pos.mandatory_requirements.length > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                          <strong>Requisitos:</strong> {pos.mandatory_requirements.join(' · ')}
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '12px' }}>
                      {isOwner ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={pos.status === 'open' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                            style={{ flex: 1, padding: '6px', fontSize: '0.76rem' }}
                            onClick={() => handleTogglePositionStatus(pos, 'open')}
                          >
                            Abierta
                          </button>
                          <button
                            type="button"
                            className={pos.status === 'paused' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                            style={{ flex: 1, padding: '6px', fontSize: '0.76rem' }}
                            onClick={() => handleTogglePositionStatus(pos, 'paused')}
                          >
                            Pausar
                          </button>
                          <button
                            type="button"
                            className={pos.status === 'filled' ? 'ia-btn-primary' : 'ia-btn-secondary'}
                            style={{ flex: 1, padding: '6px', fontSize: '0.76rem' }}
                            onClick={() => handleTogglePositionStatus(pos, 'filled')}
                          >
                            Cubierta
                          </button>
                        </div>
                      ) : alreadyApplied ? (
                        <span className="ia-badge ia-badge-blue" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>
                          ✓ Ya postulaste a esta vacante
                        </span>
                      ) : pos.status === 'open' && remaining > 0 ? (
                        <button
                          type="button"
                          className="ia-btn-primary"
                          style={{ width: '100%' }}
                          onClick={() => handleOpenApplyModal(selectedProject, pos)}
                        >
                          Postular a este Rol
                        </button>
                      ) : (
                        <button type="button" className="ia-btn-secondary" style={{ width: '100%' }} disabled>
                          Vacante no disponible
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : workspaceTab === 'team' ? (
            <div className="ia-card">
              <h3 className="ia-card-title" style={{ marginBottom: '14px' }}>
                Integrantes del Equipo ({projectMembers.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {projectMembers.map((m) => (
                  <div
                    key={`${m.project_id}-${m.profile_id}`}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--ia-border)',
                      background: 'var(--ia-bg-body)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Link
                        to={`/profile/${m.profile_id}`}
                        style={{ fontWeight: 700, color: 'var(--ia-primary)', textDecoration: 'none', fontSize: '0.92rem' }}
                      >
                        {m.profile_name || getUserDisplayName(m.profile as any)}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ia-text-body)', marginTop: '2px' }}>
                        {m.role_name || m.position?.title || (m.member_role === 'owner' ? 'Líder del Proyecto' : 'Integrante')}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--ia-text-muted)' }}>
                        {m.profile_institution || 'Duoc UC'}
                      </div>
                    </div>
                    <span className={`ia-badge ${m.member_role === 'owner' ? 'ia-badge-purple' : 'ia-badge-blue'}`}>
                      {m.member_role === 'owner' ? 'Creador' : 'Miembro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : workspaceTab === 'milestones' ? (
            <div className="ia-card">
              <h3 className="ia-card-title" style={{ marginBottom: '12px' }}>
                Plan de Hitos y Entregables del Proyecto
              </h3>

              {user?.id && selectedProject.owner_id === user.id && (
                <form
                  onSubmit={handleAddMilestone}
                  style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}
                >
                  <input
                    type="text"
                    className="ia-input"
                    style={{ flex: 2, minWidth: '220px' }}
                    placeholder="Nuevo hito o entregable (Ej: Entrega Arquitectura y Modelo ER)"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    required
                  />
                  <input
                    type="date"
                    className="ia-input"
                    style={{ width: '170px' }}
                    value={newMilestoneDue}
                    onChange={(e) => setNewMilestoneDue(e.target.value)}
                  />
                  <button type="submit" className="ia-btn-primary">
                    + Añadir Hito
                  </button>
                </form>
              )}

              {(selectedProject.milestones || []).length === 0 ? (
                <div className="ia-empty-box" style={{ padding: '24px' }}>
                  <p className="ia-empty-title">Aún no se han registrado hitos específicos</p>
                  <p className="ia-empty-desc">
                    El líder del proyecto puede definir aquí las entregas parciales y metas del equipo.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedProject.milestones || []).map((ms) => (
                    <div
                      key={ms.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--ia-border)',
                        background: ms.completed ? 'var(--ia-success-bg)' : 'var(--ia-bg-body)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={ms.completed}
                          disabled={!(user?.id && selectedProject.owner_id === user.id)}
                          onChange={() => handleToggleMilestone(ms.id)}
                        />
                        <span style={{ textDecoration: ms.completed ? 'line-through' : 'none' }}>
                          {ms.title}
                        </span>
                      </label>
                      {ms.due_date && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                          Meta: {ms.due_date}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Pestaña de Postulaciones Recibidas (Solo Creador) */
            <div className="ia-card">
              <h3 className="ia-card-title" style={{ marginBottom: '14px' }}>
                Postulaciones Recibidas ({projectApplications.length})
              </h3>
              {projectApplications.length === 0 ? (
                <div className="ia-empty-box" style={{ padding: '24px' }}>
                  <p className="ia-empty-title">Aún no hay postulaciones en este proyecto</p>
                  <p className="ia-empty-desc">
                    Cuando otros estudiantes postulen a tus vacantes abiertas, podrás revisar su perfil y aceptarlos aquí.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {projectApplications.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid var(--ia-border)',
                        background: 'var(--ia-bg-body)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                        <div>
                          <Link
                            to={`/profile/${app.applicant_id}`}
                            style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--ia-primary)', textDecoration: 'none' }}
                          >
                            {app.applicant_name || (app.applicant as any)?.display_name || 'Estudiante Postulante'}
                          </Link>
                          <span style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)', marginLeft: '8px' }}>
                            postuló a <strong>{app.position?.title || 'Vacante'}</strong>
                          </span>
                        </div>
                        <span
                          className={`ia-badge ${
                            app.status === 'accepted'
                              ? 'ia-badge-success'
                              : app.status === 'rejected'
                              ? 'ia-badge-neutral'
                              : 'ia-badge-amber'
                          }`}
                        >
                          {app.status === 'accepted'
                            ? 'Aceptada'
                            : app.status === 'rejected'
                            ? 'Rechazada'
                            : 'Pendiente de revisión'}
                        </span>
                      </div>

                      <p style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--ia-text-main)', lineHeight: 1.5 }}>
                        "{app.message || 'Interesado en aportar al proyecto.'}"
                      </p>

                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginBottom: '10px' }}>
                        {app.relevant_skills && app.relevant_skills.length > 0 && (
                          <span>Habilidades: <strong>{app.relevant_skills.join(', ')}</strong></span>
                        )}
                        {app.availability_notes && (
                          <span>Disponibilidad: <strong>{app.availability_notes}</strong></span>
                        )}
                        {app.portfolio_url && (
                          <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ia-primary)', fontWeight: 600 }}>
                            Ver Portafolio / GitHub ↗
                          </a>
                        )}
                        {app.accepted_agreements && (
                          <span style={{ color: 'var(--ia-success)', fontWeight: 600 }}>
                            ✓ Aceptó acuerdos y condiciones del proyecto
                          </span>
                        )}
                      </div>

                      {app.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="ia-btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            onClick={() => handleReviewApplication(app.id, 'accepted')}
                          >
                            <CheckIcon size={14} color="#ffffff" /> Aceptar e Incorporar al Equipo
                          </button>
                          <button
                            type="button"
                            className="ia-btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            onClick={() => handleReviewApplication(app.id, 'rejected')}
                          >
                            <XIcon size={14} /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VISTA CATÁLOGO Y DESCUBRIMIENTO DE PROYECTOS */
        <>
          {/* Pestañas Principales */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeTab === 'explore' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('explore')}
            >
              Explorar Proyectos ({projects.length})
            </button>
            <button
              type="button"
              className={activeTab === 'my_projects' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('my_projects')}
            >
              Mis Proyectos ({myProjects.length})
            </button>
            <button
              type="button"
              className={activeTab === 'my_applications' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('my_applications')}
            >
              Mis Postulaciones ({myApplications.length})
            </button>
          </div>

          {activeTab === 'explore' && (
            <div className="ia-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                    <SearchIcon size={16} />
                  </span>
                  <input
                    type="text"
                    className="ia-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="Buscar por proyecto, rol (Frontend, 3D, QA...), tecnología o problema..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select
                  aria-label="Filtrar por categoría"
                  className="ia-select"
                  style={{ width: 'auto', minWidth: '175px' }}
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">Todas las áreas</option>
                  {PROJECT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por modalidad"
                  className="ia-select"
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={filterModality}
                  onChange={(e) => setFilterModality(e.target.value)}
                >
                  <option value="all">Modalidad: Todas</option>
                  <option value="online">Online / Remoto</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="presencial">Presencial</option>
                </select>

                <select
                  aria-label="Filtrar por estado"
                  className="ia-select"
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Estado: Todos</option>
                  <option value="open">Abiertos</option>
                  <option value="in_progress">En Desarrollo</option>
                  <option value="completed">Finalizados</option>
                </select>

                <select
                  aria-label="Filtrar por compensación"
                  className="ia-select"
                  style={{ width: 'auto', minWidth: '175px' }}
                  value={filterCompensation}
                  onChange={(e) => setFilterCompensation(e.target.value)}
                >
                  <option value="all">Compensación: Todas</option>
                  <option value="unpaid_academic">Académico (Sin pago)</option>
                  <option value="paid">Remunerado</option>
                  <option value="milestone_based">Por Hitos</option>
                  <option value="revenue_share">Participación</option>
                  <option value="negotiable">A convenir</option>
                </select>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={onlyOpenVacancies}
                    onChange={(e) => setOnlyOpenVacancies(e.target.checked)}
                  />
                  <span>Solo con vacantes abiertas</span>
                </label>
              </div>
            </div>
          )}

          {loading ? (
            <div className="ia-card" style={{ textAlign: 'center', padding: '36px' }}>
              <p style={{ margin: 0, color: 'var(--ia-text-muted)' }}>Cargando proyectos colaborativos...</p>
            </div>
          ) : activeTab === 'my_applications' ? (
            myApplications.length === 0 ? (
              <div className="ia-empty-box">
                <div className="ia-empty-icon">
                  <BriefcaseIcon size={22} />
                </div>
                <p className="ia-empty-title">Aún no has postulado a vacantes de proyectos</p>
                <p className="ia-empty-desc">
                  Explora los proyectos abiertos, revisa sus roles y condiciones y postula al equipo donde quieras aportar.
                </p>
                <button type="button" className="ia-btn-primary" onClick={() => setActiveTab('explore')}>
                  Explorar Proyectos Disponibles
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myApplications.map((app) => (
                  <div key={app.id} className="ia-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span className="ia-badge ia-badge-blue" style={{ marginBottom: '6px' }}>
                          Rol: {app.position?.title || 'Especialista'}
                        </span>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>
                          {app.project?.title || 'Proyecto Colaborativo'}
                        </h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--ia-text-body)' }}>
                          Tu mensaje: "{app.message || 'Sin mensaje adicional'}"
                        </p>
                        {app.accepted_agreements && (
                          <span style={{ fontSize: '0.76rem', color: 'var(--ia-success)', fontWeight: 600 }}>
                            ✓ Acuerdos del proyecto aceptados
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className={`ia-badge ${
                            app.status === 'accepted'
                              ? 'ia-badge-success'
                              : app.status === 'rejected'
                              ? 'ia-badge-neutral'
                              : app.status === 'withdrawn'
                              ? 'ia-badge-neutral'
                              : 'ia-badge-amber'
                          }`}
                        >
                          {app.status === 'accepted'
                            ? '¡Aceptado en el equipo!'
                            : app.status === 'rejected'
                            ? 'No seleccionado'
                            : app.status === 'withdrawn'
                            ? 'Retirada'
                            : 'En revisión'}
                        </span>

                        {app.status === 'pending' && (
                          <button
                            type="button"
                            className="ia-btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => handleWithdrawApplication(app.id)}
                          >
                            Retirar postulación
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Listado de Proyectos (Explorar o Mis Proyectos) */
            (() => {
              const list = activeTab === 'my_projects' ? myProjects : filteredProjects;
              if (list.length === 0) {
                return (
                  <div className="ia-empty-box">
                    <div className="ia-empty-icon">
                      <UsersIcon size={22} />
                    </div>
                    <p className="ia-empty-title">
                      {activeTab === 'my_projects'
                        ? 'Aún no has creado ningún proyecto propio'
                        : 'No se encontraron proyectos con estos filtros'}
                    </p>
                    <p className="ia-empty-desc">
                      Publica tu iniciativa académica, técnica o interdisciplinaria, define las vacantes que necesitas y recluta compañeros.
                    </p>
                    <button type="button" className="ia-btn-primary" onClick={openCreateModal}>
                      <PlusIcon size={15} color="#ffffff" /> Publicar Nuevo Proyecto
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '18px' }}>
                  {list.map((proj) => {
                    const isOwner = Boolean(user?.id && proj.owner_id === user.id);
                    const compMeta = COMPENSATION_LABELS[proj.compensation_type || 'unpaid_academic'];
                    const statusMeta = STATUS_LABELS[proj.status] || STATUS_LABELS.open;
                    const positionsList = proj.positions || [];

                    return (
                      <article
                        key={proj.id}
                        className="ia-card"
                        style={{
                          marginBottom: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '14px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span className={`ia-badge ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                            <span className={`ia-badge ${compMeta?.badgeClass || 'ia-badge-blue'}`}>
                              {compMeta?.label || 'Académico'}
                            </span>
                          </div>

                          <h2
                            style={{
                              fontSize: '1.1rem',
                              fontWeight: 800,
                              color: 'var(--ia-text-main)',
                              margin: '0 0 4px 0',
                              cursor: 'pointer',
                            }}
                            onClick={() => openProjectWorkspace(proj)}
                          >
                            {proj.title}
                          </h2>

                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ia-primary)', marginBottom: '8px' }}>
                            {proj.category || 'Desarrollo'} · {MODALITY_LABELS[proj.modality || 'online']} · {proj.dedication_hours || 6} hrs/sem
                          </div>

                          <p style={{ fontSize: '0.86rem', color: 'var(--ia-text-body)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                            {proj.short_description || proj.description || 'Proyecto colaborativo abierto a estudiantes.'}
                          </p>

                          {/* Roles buscados */}
                          {positionsList.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ia-text-muted)', display: 'block', marginBottom: '4px' }}>
                                ROLES REQUERIDOS ({positionsList.length}):
                              </span>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {positionsList.map((pos) => (
                                  <span
                                    key={pos.id}
                                    className="ia-badge"
                                    style={{
                                      background: pos.status === 'open' ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-subtle)',
                                      color: pos.status === 'open' ? 'var(--ia-primary)' : 'var(--ia-text-muted)',
                                      border: '1px solid var(--ia-border)',
                                    }}
                                  >
                                    {pos.title} ({Math.max(0, (pos.slots || 1) - (pos.slots_filled || 0))})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tecnologías */}
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div className="ia-tags-cloud">
                              {proj.technologies.slice(0, 5).map((t) => (
                                <span key={t} className="ia-tag" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginBottom: '10px' }}>
                            <span>
                              Por{' '}
                              <Link
                                to={`/profile/${proj.owner_id}`}
                                style={{ color: 'var(--ia-primary)', fontWeight: 600, textDecoration: 'none' }}
                              >
                                {getUserDisplayName(proj.owner as any)}
                              </Link>
                            </span>
                            <span>Máx {proj.max_members} miembros</span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="ia-btn-primary"
                              style={{ flex: 1 }}
                              onClick={() => openProjectWorkspace(proj)}
                            >
                              Ver Proyecto y Vacantes
                            </button>

                            {isOwner && (
                              <>
                                <button
                                  type="button"
                                  className="ia-btn-secondary"
                                  style={{ padding: '7px 10px' }}
                                  onClick={() => openEditModal(proj)}
                                  title="Editar proyecto"
                                >
                                  <EditIcon size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="ia-btn-icon-danger"
                                  onClick={() => setProjectToDelete(proj)}
                                  title="Eliminar proyecto"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}
