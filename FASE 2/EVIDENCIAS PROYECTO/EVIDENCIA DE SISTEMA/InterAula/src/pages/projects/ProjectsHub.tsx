import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/project.service';
import type {
  Project,
  ProjectPosition,
  ProjectApplication,
} from '../../types/project';
import {
  BriefcaseIcon,
  CodeIcon,
  UsersIcon,
  SparklesIcon,
  SearchIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
} from '../../components/common/Icons';
import EmptyState from '../../components/common/EmptyState';
import { getUserDisplayName, getUserInitial } from '../../utils/formatters';

type TabType = 'explore' | 'my_projects' | 'my_applications';

interface SampleProjectWithPositions extends Project {
  positions: ProjectPosition[];
}

// Proyectos iniciales con contexto institucional Duoc UC
const DEFAULT_SAMPLE_PROJECTS: SampleProjectWithPositions[] = [
  {
    id: 'proj-sample-1',
    owner_id: 'sample-user-1',
    title: 'Sistema de Reserva de Laboratorios de Computación',
    short_description: 'Plataforma web para que alumnos reserven puestos y computadores de alta gama en sedes Duoc UC.',
    description: 'Buscamos crear una plataforma centralizada que permita a los estudiantes ver disponibilidad en tiempo real de los laboratorios de informática de la sede y reservar turnos con su cuenta institucional.',
    category: 'Desarrollo de Software',
    status: 'recruiting',
    visibility: 'public',
    max_members: 4,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    owner: {
      id: 'sample-user-1',
      email: 'carlos.navarrete@duocuc.cl',
      first_name: 'Carlos',
      last_name: 'Navarrete',
      display_name: 'Carlos Navarrete',
      institution: 'Duoc UC Plaza Vespucio',
      career: 'Ingeniería en Informática',
      avatar_url: null,
      bio: null,
      location: 'Santiago, Chile',
      profile_completed: true,
      available_for_tutoring: false,
      portfolio_url: null,
      github_url: null,
      linkedin_url: null,
      created_at: '',
      updated_at: '',
    },
    positions: [
      {
        id: 'pos-1',
        project_id: 'proj-sample-1',
        title: 'Frontend Developer (React / Tailwind)',
        description: 'Construcción de interfaz responsive y componentes de reserva interactiva.',
        skill_id: null,
        level_required: 'intermediate',
        slots: 1,
        status: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: 'pos-2',
        project_id: 'proj-sample-1',
        title: 'Backend Developer (Node.js / Supabase)',
        description: 'Modelado de base de datos relacional y lógica de reservas concurrentes.',
        skill_id: null,
        level_required: 'intermediate',
        slots: 1,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'proj-sample-2',
    owner_id: 'sample-user-2',
    title: 'App Móvil de Horarios y Buses Universitarios "DuocRuta"',
    short_description: 'App para consultar rutas, tiempos de espera y buses de acercamiento entre estaciones de metro y sedes.',
    description: 'Iniciativa colaborativa para desarrollar una app móvil simple y rápida que ayude a los compañeros a coordinar viajes y consultar los horarios de buses de acercamiento a sedes periféricas.',
    category: 'Desarrollo Móvil',
    status: 'recruiting',
    visibility: 'public',
    max_members: 3,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    owner: {
      id: 'sample-user-2',
      email: 'camila.fuentes@duocuc.cl',
      first_name: 'Camila',
      last_name: 'Fuentes',
      display_name: 'Camila Fuentes',
      institution: 'Duoc UC San Joaquín',
      career: 'Técnico en Programación y Análisis',
      avatar_url: null,
      bio: null,
      location: 'Santiago, Chile',
      profile_completed: true,
      available_for_tutoring: false,
      portfolio_url: null,
      github_url: null,
      linkedin_url: null,
      created_at: '',
      updated_at: '',
    },
    positions: [
      {
        id: 'pos-3',
        project_id: 'proj-sample-2',
        title: 'Diseñador/a UI/UX (Figma)',
        description: 'Prototipado rápido enfocado en accesibilidad móvil y modo oscuro.',
        skill_id: null,
        level_required: 'basic',
        slots: 1,
        status: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: 'pos-4',
        project_id: 'proj-sample-2',
        title: 'Desarrollador/a Móvil (React Native o Flutter)',
        description: 'Implementación del cliente móvil y consumo de API REST.',
        skill_id: null,
        level_required: 'intermediate',
        slots: 1,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'proj-sample-3',
    owner_id: 'sample-user-3',
    title: 'Monitor IoT de Temperatura y Ruido en Salas de Estudio',
    short_description: 'Proyecto de hardware y software con ESP32 para medir niveles de ruido en biblioteca y salas silenciosas.',
    description: 'Desarrollo de un dispositivo inteligente con panel web que permite ver qué salas de estudio de la sede tienen menor nivel de ruido en tiempo real, ideal para estudiar certámenes.',
    category: 'IoT y Redes',
    status: 'recruiting',
    visibility: 'public',
    max_members: 4,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    owner: {
      id: 'sample-user-3',
      email: 'matias.silva@duocuc.cl',
      first_name: 'Matías',
      last_name: 'Silva',
      display_name: 'Matías Silva',
      institution: 'Duoc UC Antonio Varas',
      career: 'Ingeniería en Redes y Telecomunicaciones',
      avatar_url: null,
      bio: null,
      location: 'Santiago, Chile',
      profile_completed: true,
      available_for_tutoring: false,
      portfolio_url: null,
      github_url: null,
      linkedin_url: null,
      created_at: '',
      updated_at: '',
    },
    positions: [
      {
        id: 'pos-5',
        project_id: 'proj-sample-3',
        title: 'Desarrollador Python / Backend API',
        description: 'Creación de endpoint FastAPI / Flask para recibir telemetría de sensores.',
        skill_id: null,
        level_required: 'intermediate',
        slots: 1,
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ],
  },
];

const CATEGORIES = [
  'Todas las Áreas',
  'Desarrollo de Software',
  'Desarrollo Móvil',
  'IoT y Redes',
  'Inteligencia Artificial',
  'Ciberseguridad',
  'Diseño UI/UX',
];

export default function ProjectsHub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('explore');
  const [projects, setProjects] = useState<SampleProjectWithPositions[]>([]);
  const [myApplications, setMyApplications] = useState<ProjectApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas las Áreas');
  const [onlyOpenPositions, setOnlyOpenPositions] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Desarrollo de Software');
  const [newShortDesc, setNewShortDesc] = useState('');
  const [newFullDesc, setNewFullDesc] = useState('');
  const [newMaxMembers, setNewMaxMembers] = useState(4);
  const [newPositions, setNewPositions] = useState<string>('Frontend Developer, Backend Developer');

  // Modal de postulación
  const [applyingToProject, setApplyingToProject] = useState<SampleProjectWithPositions | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [applicationPitch, setApplicationPitch] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Cargar proyectos (desde Supabase + persistencia local fallback)
  const loadProjectsData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Obtener proyectos de base de datos
      const dbProjects = await projectService.getProjects();

      // 2. Proyectos guardados localmente por el usuario
      let localProjects: SampleProjectWithPositions[] = [];
      try {
        const raw = localStorage.getItem('ia_local_custom_projects');
        if (raw) localProjects = JSON.parse(raw);
      } catch {}

      // Si Supabase aún no tiene proyectos de muestra, combinamos con el catálogo semilla
      let combined: SampleProjectWithPositions[] = [];
      if (dbProjects.length > 0) {
        // Enriquecer proyectos con posiciones si vienen de Supabase
        const enriched = await Promise.all(
          dbProjects.map(async (p) => {
            const pos = await projectService.getProjectPositions(p.id);
            return { ...p, positions: pos };
          })
        );
        combined = [...localProjects, ...enriched];
      } else {
        combined = [...localProjects, ...DEFAULT_SAMPLE_PROJECTS];
      }

      setProjects(combined);

      // Cargar postulaciones del usuario si está autenticado
      if (user) {
        const apps = await projectService.getMyApplications();
        let localApps: ProjectApplication[] = [];
        try {
          const rawApps = localStorage.getItem('ia_local_user_applications');
          if (rawApps) localApps = JSON.parse(rawApps);
        } catch {}
        setMyApplications([...localApps, ...apps]);
      }
    } catch (err: any) {
      console.error('[ProjectsHub] Error cargando datos:', err);
      // Fallback a proyectos semilla
      setProjects(DEFAULT_SAMPLE_PROJECTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectsData();
  }, [user]);

  // Manejo de crear proyecto
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const positionsList = newPositions
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const newProjId = `proj-${Date.now()}`;
    const createdPositions: ProjectPosition[] = positionsList.map((pTitle, idx) => ({
      id: `pos-${Date.now()}-${idx}`,
      project_id: newProjId,
      title: pTitle,
      description: `Participación activa en el rol de ${pTitle} para el proyecto.`,
      skill_id: null,
      level_required: 'intermediate',
      slots: 1,
      status: 'open',
      created_at: new Date().toISOString(),
    }));

    const newProj: SampleProjectWithPositions = {
      id: newProjId,
      owner_id: user?.id || 'current-user',
      title: newTitle.trim(),
      short_description: newShortDesc.trim() || newFullDesc.slice(0, 100),
      description: newFullDesc.trim() || newShortDesc.trim(),
      category: newCategory,
      status: 'recruiting',
      visibility: 'public',
      max_members: Number(newMaxMembers) || 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner: {
        id: user?.id || 'current-user',
        email: user?.email || '',
        first_name: user?.user_metadata?.first_name || 'Estudiante',
        last_name: user?.user_metadata?.last_name || '',
        display_name: getUserDisplayName(null, user?.user_metadata, user?.email),
        institution: 'Duoc UC',
        career: 'Informática y Telecomunicaciones',
        avatar_url: user?.user_metadata?.avatar_url || null,
        bio: null,
        location: 'Santiago, Chile',
        profile_completed: true,
        available_for_tutoring: false,
        portfolio_url: null,
        github_url: null,
        linkedin_url: null,
        created_at: '',
        updated_at: '',
      },
      positions: createdPositions,
    };

    const updatedProjects = [newProj, ...projects];
    setProjects(updatedProjects);

    // Guardar localmente
    try {
      const raw = localStorage.getItem('ia_local_custom_projects');
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem('ia_local_custom_projects', JSON.stringify([newProj, ...existing]));
    } catch {}

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewShortDesc('');
    setNewFullDesc('');
    setNewPositions('Frontend Developer, Backend Developer');
    setSuccessMsg('¡Proyecto colaborativo publicado exitosamente en el Hub!');
    setActiveTab('my_projects');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Abrir modal de postulación
  const handleOpenApplyModal = (project: SampleProjectWithPositions, positionId?: string) => {
    setApplyingToProject(project);
    const availablePos = project.positions.filter((p) => p.status === 'open');
    setSelectedPositionId(positionId || availablePos[0]?.id || '');
    setApplicationPitch('');
  };

  // Enviar postulación
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingToProject || !selectedPositionId) return;

    setIsApplying(true);
    try {
      const pos = applyingToProject.positions.find((p) => p.id === selectedPositionId);
      const newApp: ProjectApplication = {
        id: `app-${Date.now()}`,
        project_id: applyingToProject.id,
        position_id: selectedPositionId,
        applicant_id: user?.id || 'user-me',
        message: applicationPitch.trim() || 'Me gustaría unirme al equipo para aportar mis conocimientos en esta iniciativa.',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project: applyingToProject,
        position: pos,
      };

      const updatedApps = [newApp, ...myApplications];
      setMyApplications(updatedApps);
      try {
        localStorage.setItem('ia_local_user_applications', JSON.stringify(updatedApps));
      } catch {}

      setSuccessMsg(`¡Postulación enviada exitosamente para la vacante "${pos?.title || 'del proyecto'}"! El creador revisará tu solicitud.`);
      setTimeout(() => setSuccessMsg(''), 6000);
      setApplyingToProject(null);
    } catch (err: any) {
      setErrorMsg('No fue posible enviar tu postulación.');
    } finally {
      setIsApplying(false);
    }
  };

  // Retirar postulación
  const handleWithdrawApplication = (appId: string) => {
    const updated = myApplications.filter((a) => a.id !== appId);
    setMyApplications(updated);
    try {
      localStorage.setItem('ia_local_user_applications', JSON.stringify(updated));
    } catch {}
    setSuccessMsg('Has retirado tu postulación del proyecto.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Filtrado de proyectos para explorar
  const filteredProjects = projects.filter((proj) => {
    // Categoría
    if (selectedCategory !== 'Todas las Áreas' && proj.category !== selectedCategory) {
      return false;
    }
    // Búsqueda de texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = proj.title.toLowerCase().includes(term);
      const matchDesc = (proj.description || '').toLowerCase().includes(term) || (proj.short_description || '').toLowerCase().includes(term);
      const matchPos = (proj.positions || []).some((p) => p.title.toLowerCase().includes(term));
      const matchOwner = proj.owner ? getUserDisplayName(proj.owner).toLowerCase().includes(term) : false;
      if (!matchTitle && !matchDesc && !matchPos && !matchOwner) return false;
    }
    // Solo con vacantes abiertas
    if (onlyOpenPositions) {
      const hasOpen = (proj.positions || []).some((p) => p.status === 'open');
      if (!hasOpen) return false;
    }
    return true;
  });

  // Mis proyectos creados
  const myCreatedProjects = projects.filter(
    (p) => p.owner_id === user?.id || (user?.email && p.owner?.email === user.email)
  );

  return (
    <div>
      {/* Cabecera Principal del Hub de Proyectos */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#7c3aed',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: '#faf5ff',
                padding: '3px 10px',
                borderRadius: '9999px',
                border: '1px solid #e9d5ff',
              }}
            >
              Colaboración Multidisciplinaria
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>· Comunidad Duoc UC</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
            Hub de Proyectos Estudiantiles
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0, maxWidth: '720px' }}>
            Encuentra proyectos reales, forma equipos con estudiantes de distintas áreas y postula a vacantes para enriquecer tu portafolio académico y profesional.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="ia-btn-primary"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '0.88rem',
              fontWeight: 700,
            }}
          >
            <PlusIcon size={16} color="#ffffff" />
            <span>+ Publicar Proyecto</span>
          </button>
        </div>
      </div>

      {/* Alertas Globales */}
      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <CheckIcon size={18} color="#15803d" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircleIcon size={18} color="#b91c1c" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Métricas Visuales del Hub */}
      <div className="ia-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="ia-stat-card">
          <div className="ia-stat-icon blue">
            <BriefcaseIcon size={22} color="#2563eb" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {projects.length}
            </div>
            <div className="ia-stat-label">Iniciativas activas</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon amber">
            <CodeIcon size={22} color="#d97706" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {projects.reduce((acc, p) => acc + (p.positions ? p.positions.filter((pos) => pos.status === 'open').length : 0), 0)}
            </div>
            <div className="ia-stat-label">Vacantes abiertas</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon green">
            <UsersIcon size={22} color="#16a34a" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              Equipos Ágiles
            </div>
            <div className="ia-stat-label">Multidisciplinarios</div>
          </div>
        </div>

        <div className="ia-stat-card">
          <div className="ia-stat-icon purple">
            <SparklesIcon size={22} color="#9333ea" />
          </div>
          <div>
            <div className="ia-stat-value" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              Portafolio
            </div>
            <div className="ia-stat-label">Experiencia real Duoc UC</div>
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación del Hub */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          style={{
            padding: '12px 18px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'explore' ? '#2563eb' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'explore' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BriefcaseIcon size={18} color={activeTab === 'explore' ? '#2563eb' : '#64748b'} />
          <span>Explorar Proyectos ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_projects')}
          style={{
            padding: '12px 18px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'my_projects' ? '#16a34a' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_projects' ? '2px solid #16a34a' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CodeIcon size={18} color={activeTab === 'my_projects' ? '#16a34a' : '#64748b'} />
          <span>Mis Proyectos Publicados ({myCreatedProjects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_applications')}
          style={{
            padding: '12px 18px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: activeTab === 'my_applications' ? '#7c3aed' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_applications' ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <UsersIcon size={18} color={activeTab === 'my_applications' ? '#7c3aed' : '#64748b'} />
          <span>Mis Postulaciones ({myApplications.length})</span>
          {myApplications.length > 0 && (
            <span
              style={{
                background: '#7c3aed',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              {myApplications.length}
            </span>
          )}
        </button>
      </div>

      {/* CONTENIDO 1: EXPLORAR PROYECTOS */}
      {activeTab === 'explore' && (
        <div>
          {/* Barra de Filtros y Búsqueda */}
          <div
            className="ia-card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar proyectos por nombre, rol o tecnologías..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <SearchIcon size={16} color="#94a3b8" />
                </div>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={onlyOpenPositions}
                onChange={(e) => setOnlyOpenPositions(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Solo con vacantes abiertas</span>
            </label>
          </div>

          {/* Grilla de Proyectos */}
          {loading ? (
            <div className="ia-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b' }}>Cargando proyectos estudiantiles...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '50px 20px' }}
                icon={<BriefcaseIcon size={32} color="#2563eb" />}
                title="No se encontraron proyectos con esos criterios"
                description="Intenta buscar con otras palabras o publica tu propia idea de proyecto para convocar compañeros."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('Todas las Áreas');
                      setOnlyOpenPositions(false);
                    }}
                    className="ia-btn-secondary"
                  >
                    Restablecer filtros
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {filteredProjects.map((project) => {
                const openPositions = (project.positions || []).filter((p) => p.status === 'open');
                const isMyProject = project.owner_id === user?.id || (user?.email && project.owner?.email === user.email);

                return (
                  <div
                    key={project.id}
                    className="ia-card"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Cabecera de la Tarjeta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            textTransform: 'uppercase',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {project.category || 'Proyecto General'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: openPositions.length > 0 ? '#dcfce7' : '#f1f5f9',
                            color: openPositions.length > 0 ? '#15803d' : '#64748b',
                          }}
                        >
                          {openPositions.length > 0 ? `${openPositions.length} vacante${openPositions.length > 1 ? 's' : ''} disponible${openPositions.length > 1 ? 's' : ''}` : 'Equipo completo'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.35 }}>
                        {project.title}
                      </h3>

                      <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                        {project.short_description || project.description}
                      </p>

                      {/* Autor del Proyecto */}
                      {project.owner && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            marginBottom: '16px',
                          }}
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {getUserInitial(getUserDisplayName(project.owner))}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {getUserDisplayName(project.owner)} {isMyProject && '(Tú)'}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              {project.owner.career || project.owner.institution || 'Estudiante Duoc UC'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Vacantes del Proyecto */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Perfiles buscados:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(project.positions || []).slice(0, 3).map((pos) => (
                            <div
                              key={pos.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#f1f5f9',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                              }}
                            >
                              <span style={{ fontWeight: 600, color: '#334155' }}>{pos.title}</span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: pos.status === 'open' ? '#16a34a' : '#94a3b8',
                                }}
                              >
                                {pos.status === 'open' ? 'Cupo abierto' : 'Cubierto'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Acciones de la Tarjeta */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', display: 'flex', gap: '10px' }}>
                      {isMyProject ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('my_projects')}
                          className="ia-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem' }}
                        >
                          Administrar mi proyecto
                        </button>
                      ) : openPositions.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenApplyModal(project)}
                          className="ia-btn-primary"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem', fontWeight: 700 }}
                        >
                          Postular a una Vacante
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="ia-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem', opacity: 0.6, cursor: 'not-allowed' }}
                        >
                          Equipo Completo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO 2: MIS PROYECTOS PUBLICADOS */}
      {activeTab === 'my_projects' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Iniciativas Creadas por Ti
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0' }}>
                Gestiona las vacantes de tu equipo y aprueba las postulaciones de tus compañeros.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="ia-btn-primary"
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusIcon size={16} /> + Crear Nuevo Proyecto
            </button>
          </div>

          {myCreatedProjects.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '50px 20px' }}
                icon={<CodeIcon size={32} color="#16a34a" />}
                title="Aún no has publicado ningún proyecto"
                description="¿Tienes una idea de startup, app móvil, bot o proyecto para un certamen? Publícala y convoca compañeros con las habilidades que te faltan."
                action={
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="ia-btn-primary"
                    style={{ background: '#16a34a', borderColor: '#15803d' }}
                  >
                    + Publicar mi Primer Proyecto
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {myCreatedProjects.map((p) => (
                <div key={p.id} className="ia-card" style={{ padding: '20px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                      {p.category}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Máx {p.max_members} integrantes</span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>{p.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 14px 0' }}>{p.short_description}</p>
                  
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                    Vacantes definidas:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    {p.positions.map((pos) => (
                      <div key={pos.id} style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{pos.title}</span>
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>Activa</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: '#166534' }}>
                    ✓ Proyecto visible públicamente en el catálogo para toda la comunidad Duoc UC.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO 3: MIS POSTULACIONES */}
      {activeTab === 'my_applications' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Mis Postulaciones a Proyectos
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0' }}>
              Revisa el estado de tus solicitudes para integrarte a equipos y proyectos colaborativos.
            </p>
          </div>

          {myApplications.length === 0 ? (
            <div className="ia-card">
              <EmptyState
                style={{ padding: '50px 20px' }}
                icon={<UsersIcon size={32} color="#7c3aed" />}
                title="No has enviado postulaciones todavía"
                description="Explora las iniciativas creadas por compañeros en distintas sedes y postula a las posiciones acordes a tus conocimientos."
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab('explore')}
                    className="ia-btn-primary"
                    style={{ background: '#7c3aed', borderColor: '#6d28d9' }}
                  >
                    Explorar Vacantes Disponibles
                  </button>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {myApplications.map((app) => (
                <div
                  key={app.id}
                  className="ia-card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background:
                            app.status === 'accepted'
                              ? '#dcfce7'
                              : app.status === 'rejected'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            app.status === 'accepted'
                              ? '#15803d'
                              : app.status === 'rejected'
                              ? '#991b1b'
                              : '#b45309',
                        }}
                      >
                        {app.status === 'accepted'
                          ? 'Aceptada'
                          : app.status === 'rejected'
                          ? 'Rechazada'
                          : 'Pendiente de Respuesta'}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                        Postulado recientemente
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                      {app.project?.title || 'Proyecto Estudiantil'}
                    </h3>

                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>
                      Vacante: {app.position?.title || 'Desarrollador / Integrante'}
                    </div>

                    {app.message && (
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                        "{app.message}"
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {app.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleWithdrawApplication(app.id)}
                        className="ia-btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      >
                        Retirar postulación
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA CREAR PROYECTO */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '26px',
              borderRadius: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Publicar Nuevo Proyecto Estudiantil
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Título del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej: Portal de Reservas de Laboratorios Duoc UC"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Área o Categoría
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  >
                    <option value="Desarrollo de Software">Desarrollo de Software</option>
                    <option value="Desarrollo Móvil">Desarrollo Móvil</option>
                    <option value="IoT y Redes">IoT y Redes</option>
                    <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                    <option value="Ciberseguridad">Ciberseguridad</option>
                    <option value="Diseño UI/UX">Diseño UI/UX</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Cupo Máx. Integrantes
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={newMaxMembers}
                    onChange={(e) => setNewMaxMembers(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Descripción breve (resumen en 1 línea)
                </label>
                <input
                  type="text"
                  value={newShortDesc}
                  onChange={(e) => setNewShortDesc(e.target.value)}
                  placeholder="ej: App web interactiva para alumnos y docentes de la sede..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Detalles del Proyecto y Objetivos
                </label>
                <textarea
                  rows={3}
                  value={newFullDesc}
                  onChange={(e) => setNewFullDesc(e.target.value)}
                  placeholder="Describe de qué trata el proyecto, tecnologías tentativas (React, Python, etc.) y metas a alcanzar..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Perfiles o Vacantes buscadas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={newPositions}
                  onChange={(e) => setNewPositions(e.target.value)}
                  placeholder="ej: Frontend React, Backend Node, Diseñador UI/UX"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Cada rol se publicará como una vacante a la que tus compañeros podrán postular.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ia-btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Publicar Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA POSTULAR A UNA VACANTE */}
      {applyingToProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Postular a Proyecto
              </h2>
              <button
                type="button"
                onClick={() => setApplyingToProject(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Proyecto:</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>{applyingToProject.title}</div>
            </div>

            <form onSubmit={handleSubmitApplication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Selecciona la vacante a la que postulas *
                </label>
                <select
                  required
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                >
                  {applyingToProject.positions
                    .filter((p) => p.status === 'open')
                    .map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Mensaje o motivación para el equipo
                </label>
                <textarea
                  rows={4}
                  value={applicationPitch}
                  onChange={(e) => setApplicationPitch(e.target.value)}
                  placeholder="Cuéntale al creador qué tecnologías manejas, tus ramos aprobados o qué te motiva a sumarte a este proyecto..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setApplyingToProject(null)}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isApplying}
                  className="ia-btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  {isApplying ? 'Enviando...' : 'Confirmar Postulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
