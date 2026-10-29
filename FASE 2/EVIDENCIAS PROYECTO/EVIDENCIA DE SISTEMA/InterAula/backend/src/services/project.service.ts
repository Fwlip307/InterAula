import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import {
  persistentStore,
  isSchemaMissingError,
  resolveProfileSummary,
  type StoredProject,
  type StoredProjectPosition,
  type StoredProjectApplication,
  type StoredProjectMember,
} from '../lib/persistentStore.js';
import type { AuthenticatedUser } from '../types/index.js';

function mapStoredProjectToDto(
  p: StoredProject,
  positions: StoredProjectPosition[],
  members: StoredProjectMember[],
  applicationsCount = 0
) {
  const projPositions = positions.filter((pos) => pos.project_id === p.id);
  const projMembers = members.filter((m) => m.project_id === p.id);
  const openSlots = projPositions
    .filter((pos) => pos.status === 'open')
    .reduce((acc, pos) => acc + Math.max(0, pos.slots - (pos.slots_filled || 0)), 0);

  return {
    ...p,
    owner: {
      id: p.owner_id,
      display_name: p.owner_name,
      institution: p.owner_institution,
      career: p.owner_career || p.career,
    },
    positions: projPositions,
    members: projMembers,
    open_slots_count: openSlots,
    applications_count: applicationsCount,
  };
}

export const projectBackendService = {
  /**
   * Obtener proyectos públicos activos con sus roles y equipo
   */
  async getProjects() {
    let remoteProjects: any[] = [];
    try {
      const { data, error } = await supabasePublic
        .from('projects')
        .select('*, owner:profiles(*)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteProjects = data;
      }
    } catch {
      // Continúa con persistentStore
    }

    const store = persistentStore.read();
    const localDtos = store.projects
      .filter((p) => p.visibility === 'public' && p.status !== 'draft')
      .map((p) =>
        mapStoredProjectToDto(
          p,
          store.project_positions,
          store.project_members,
          store.project_applications.filter((a) => a.project_id === p.id).length
        )
      );

    const combinedMap = new Map<string, any>();
    for (const rp of remoteProjects) {
      combinedMap.set(rp.id, rp);
    }
    for (const lp of localDtos) {
      combinedMap.set(lp.id, lp);
    }

    return Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Obtener detalle de proyecto por ID
   */
  async getProjectById(id: string) {
    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === id);
    if (localProj) {
      return mapStoredProjectToDto(
        localProj,
        store.project_positions,
        store.project_members,
        store.project_applications.filter((a) => a.project_id === id).length
      );
    }

    const { data, error } = await supabasePublic
      .from('projects')
      .select('*, owner:profiles(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) return null;
      throw new Error(`Error al buscar proyecto: ${error.message}`);
    }
    return data;
  },

  /**
   * Obtener proyectos del usuario autenticado (incluyendo borradores)
   */
  async getMyProjects(user: AuthenticatedUser, token: string) {
    const client = getAuthenticatedSupabase(token);
    let remoteData: any[] = [];

    try {
      const { data, error } = await client
        .from('projects')
        .select('*, owner:profiles(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteData = data;
      }
    } catch {
      // Continúa con persistentStore
    }

    const store = persistentStore.read();
    const localOwned = store.projects
      .filter((p) => p.owner_id === user.id)
      .map((p) =>
        mapStoredProjectToDto(
          p,
          store.project_positions,
          store.project_members,
          store.project_applications.filter((a) => a.project_id === p.id).length
        )
      );

    const combinedMap = new Map<string, any>();
    for (const r of remoteData) combinedMap.set(r.id, r);
    for (const l of localOwned) combinedMap.set(l.id, l);

    return Array.from(combinedMap.values());
  },

  /**
   * Obtener posiciones de un proyecto
   */
  async getProjectPositions(projectId: string) {
    const store = persistentStore.read();
    const localPositions = store.project_positions.filter((pos) => pos.project_id === projectId);
    if (localPositions.length > 0) {
      return localPositions;
    }

    const { data, error } = await supabasePublic
      .from('project_positions')
      .select('*, skill:skills(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isSchemaMissingError(error)) return [];
      throw new Error(`Error al consultar posiciones: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener miembros de un proyecto
   */
  async getProjectMembers(projectId: string) {
    const store = persistentStore.read();
    const localMembers = store.project_members
      .filter((m) => m.project_id === projectId)
      .map((m) => ({
        ...m,
        profile: {
          id: m.profile_id,
          display_name: m.profile_name,
          institution: m.profile_institution,
        },
        position: store.project_positions.find((pos) => pos.id === m.position_id) || null,
      }));

    if (localMembers.length > 0) {
      return localMembers;
    }

    const { data, error } = await supabasePublic
      .from('project_members')
      .select('*, profile:profiles(*), position:project_positions(*)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    if (error) {
      if (isSchemaMissingError(error)) return [];
      throw new Error(`Error al consultar miembros: ${error.message}`);
    }
    return data || [];
  },

  /**
   * Obtener postulaciones recibidas en un proyecto (solo el creador del proyecto)
   */
  async getProjectApplications(user: AuthenticatedUser, token: string, projectId: string) {
    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === projectId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localProj?.owner_id;
    if (!ownerId) {
      const { data: remoteProj } = await client
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();
      ownerId = remoteProj?.owner_id;
    }

    if (ownerId && ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el creador del proyecto puede revisar las postulaciones recibidas');
    }

    const localApps = store.project_applications
      .filter((a) => a.project_id === projectId)
      .map((a) => ({
        ...a,
        applicant: {
          id: a.applicant_id,
          display_name: a.applicant_name,
          institution: a.applicant_institution,
          career: a.applicant_career,
        },
        position: store.project_positions.find((pos) => pos.id === a.position_id) || null,
      }));

    return localApps;
  },

  /**
   * Obtener postulaciones del usuario autenticado
   */
  async getMyApplications(user: AuthenticatedUser, token: string) {
    const store = persistentStore.read();
    const localApps = store.project_applications
      .filter((a) => a.applicant_id === user.id)
      .map((a) => ({
        ...a,
        project: store.projects.find((p) => p.id === a.project_id) || null,
        position: store.project_positions.find((pos) => pos.id === a.position_id) || null,
      }));

    const client = getAuthenticatedSupabase(token);
    const { data, error } = await client
      .from('project_applications')
      .select('*, project:projects(*), position:project_positions(*)')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false });

    if (error && !isSchemaMissingError(error)) {
      throw new Error(`Error al consultar postulaciones: ${error.message}`);
    }

    const combined = new Map<string, any>();
    for (const r of data || []) combined.set(r.id, r);
    for (const l of localApps) combined.set(l.id, l);

    return Array.from(combined.values());
  },

  /**
   * Crear proyecto colaborativo con sus posiciones, condiciones económicas y acuerdos
   */
  async createProject(user: AuthenticatedUser, token: string, dto: Record<string, any>) {
    const client = getAuthenticatedSupabase(token);
    const ownerProfile = await resolveProfileSummary(user.id, user.email);
    const now = new Date().toISOString();

    const normalizedStatus = dto.status || 'open';

    const { data: remoteProject, error } = await client
      .from('projects')
      .insert({
        owner_id: user.id,
        title: dto.title.trim(),
        short_description: dto.short_description?.trim() || null,
        description: dto.description?.trim() || null,
        category: dto.category || 'Desarrollo de Software',
        status: normalizedStatus,
        visibility: dto.visibility || 'public',
        max_members: dto.max_members || 4,
      })
      .select('*, owner:profiles(*)')
      .single();

    if (error && !isSchemaMissingError(error)) {
      throw new Error(error.message || 'No fue posible crear el proyecto');
    }

    const projectId = remoteProject?.id || persistentStore.newId();

    const storedProject: StoredProject = {
      id: projectId,
      owner_id: user.id,
      owner_name: ownerProfile.name,
      owner_institution: ownerProfile.institution,
      owner_career: dto.career || ownerProfile.career,
      title: dto.title.trim(),
      short_description: dto.short_description?.trim() || null,
      description: dto.description?.trim() || null,
      problem_statement: dto.problem_statement?.trim() || null,
      objectives: dto.objectives?.trim() || null,
      category: dto.category || 'Desarrollo de Software',
      career: dto.career || ownerProfile.career || 'Ingeniería en Informática',
      technologies: Array.isArray(dto.technologies) ? dto.technologies : [],
      tags: Array.isArray(dto.tags) ? dto.tags : [],
      status: normalizedStatus,
      visibility: dto.visibility || 'public',
      modality: dto.modality || 'online',
      dedication_hours: dto.dedication_hours || 6,
      max_members: dto.max_members || 4,
      requirements: dto.requirements?.trim() || null,
      compensation_type: dto.compensation_type || 'unpaid_academic',
      compensation_amount: dto.compensation_amount ?? null,
      compensation_currency: dto.compensation_currency || 'CLP',
      compensation_periodicity: dto.compensation_periodicity || null,
      compensation_notes: dto.compensation_notes?.trim() || null,
      agreements: dto.agreements || {},
      external_links: dto.external_links || {},
      milestones: Array.isArray(dto.milestones)
        ? dto.milestones.map((m: any) => ({
            id: m.id || persistentStore.newId(),
            title: m.title,
            description: m.description || '',
            due_date: m.due_date || '',
            completed: Boolean(m.completed),
          }))
        : [],
      cover_url: dto.cover_url || null,
      created_at: remoteProject?.created_at || now,
      updated_at: now,
    };

    const rawPositions: any[] = Array.isArray(dto.positions)
      ? dto.positions
      : Array.isArray(dto.required_roles)
      ? dto.required_roles
      : [];

    const storedPositions: StoredProjectPosition[] = rawPositions
      .map((item): StoredProjectPosition | null => {
        if (typeof item === 'string') {
          const clean = item.trim();
          if (!clean) return null;
          return {
            id: persistentStore.newId(),
            project_id: projectId,
            title: clean,
            description: `Participación activa en el rol de ${clean} dentro del equipo del proyecto.`,
            skill_id: null,
            skills_required: [clean],
            mandatory_requirements: ['Compromiso con las entregas semestrales'],
            optional_requirements: [],
            level_required: 'intermediate',
            dedication_hours: storedProject.dedication_hours,
            slots: 1,
            slots_filled: 0,
            compensation_override: null,
            status: 'open',
            created_at: now,
          };
        }
        if (item && typeof item === 'object' && item.title) {
          return {
            id: persistentStore.newId(),
            project_id: projectId,
            title: String(item.title).trim(),
            description: item.description?.trim() || `Rol de ${item.title} en el proyecto.`,
            skill_id: null,
            skills_required: Array.isArray(item.skills_required) ? item.skills_required : [],
            mandatory_requirements: Array.isArray(item.mandatory_requirements) ? item.mandatory_requirements : [],
            optional_requirements: Array.isArray(item.optional_requirements) ? item.optional_requirements : [],
            level_required: item.level_required || 'intermediate',
            dedication_hours: Number(item.dedication_hours) || storedProject.dedication_hours,
            slots: Number(item.slots) || 1,
            slots_filled: 0,
            compensation_override: item.compensation_override || null,
            status: item.status || 'open',
            created_at: now,
          };
        }
        return null;
      })
      .filter((pos): pos is StoredProjectPosition => pos !== null);

    const ownerMember: StoredProjectMember = {
      id: persistentStore.newId(),
      project_id: projectId,
      profile_id: user.id,
      profile_name: ownerProfile.name,
      profile_institution: ownerProfile.institution,
      position_id: null,
      role_name: 'Líder / Creador del Proyecto',
      member_role: 'owner',
      joined_at: now,
    };

    persistentStore.write((db) => {
      db.projects.unshift(storedProject);
      db.project_positions.push(...storedPositions);
      db.project_members.push(ownerMember);
    });

    return mapStoredProjectToDto(storedProject, storedPositions, [ownerMember], 0);
  },

  /**
   * Actualizar proyecto propio y sus posiciones / hitos
   */
  async updateProject(
    user: AuthenticatedUser,
    token: string,
    projectId: string,
    dto: Record<string, any>
  ) {
    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === projectId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localProj?.owner_id;
    if (!ownerId) {
      const { data: remoteProj } = await client
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();
      if (!remoteProj) {
        throw new Error('Proyecto no encontrado');
      }
      ownerId = remoteProj.owner_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el creador del proyecto puede editarlo');
    }

    const now = new Date().toISOString();

    let updatedProject: StoredProject | null = null;
    persistentStore.write((db) => {
      const p = db.projects.find((item) => item.id === projectId);
      if (p) {
        const editableFields = [
          'title',
          'short_description',
          'description',
          'problem_statement',
          'objectives',
          'category',
          'career',
          'technologies',
          'tags',
          'status',
          'visibility',
          'modality',
          'dedication_hours',
          'max_members',
          'requirements',
          'compensation_type',
          'compensation_amount',
          'compensation_currency',
          'compensation_periodicity',
          'compensation_notes',
          'agreements',
          'external_links',
          'milestones',
          'cover_url',
        ];
        for (const key of editableFields) {
          if (dto[key] !== undefined) {
            (p as any)[key] = dto[key];
          }
        }
        p.updated_at = now;
        updatedProject = p;
      }

      if (Array.isArray(dto.positions)) {
        // Reemplazar posiciones o actualizar existentes conservando las que tienen postulaciones aceptadas
        const existingPositions = db.project_positions.filter((pos) => pos.project_id === projectId);
        db.project_positions = db.project_positions.filter((pos) => pos.project_id !== projectId);

        const nextPositions: StoredProjectPosition[] = dto.positions
          .map((item: any): StoredProjectPosition | null => {
            if (typeof item === 'string') {
              const clean = item.trim();
              if (!clean) return null;
              const prev = existingPositions.find((ep) => ep.title.toLowerCase() === clean.toLowerCase());
              return {
                id: prev?.id || persistentStore.newId(),
                project_id: projectId,
                title: clean,
                description: prev?.description || `Rol de ${clean} en el proyecto.`,
                skill_id: null,
                skills_required: prev?.skills_required || [clean],
                mandatory_requirements: prev?.mandatory_requirements || [],
                optional_requirements: prev?.optional_requirements || [],
                level_required: prev?.level_required || 'intermediate',
                dedication_hours: prev?.dedication_hours || 6,
                slots: prev?.slots || 1,
                slots_filled: prev?.slots_filled || 0,
                compensation_override: prev?.compensation_override || null,
                status: prev?.status || 'open',
                created_at: prev?.created_at || now,
              };
            }
            if (item && typeof item === 'object' && item.title) {
              const prev = existingPositions.find((ep) => ep.id === item.id || ep.title === item.title);
              return {
                id: prev?.id || persistentStore.newId(),
                project_id: projectId,
                title: String(item.title).trim(),
                description: item.description?.trim() || prev?.description || null,
                skill_id: null,
                skills_required: Array.isArray(item.skills_required) ? item.skills_required : prev?.skills_required || [],
                mandatory_requirements: Array.isArray(item.mandatory_requirements)
                  ? item.mandatory_requirements
                  : prev?.mandatory_requirements || [],
                optional_requirements: Array.isArray(item.optional_requirements)
                  ? item.optional_requirements
                  : prev?.optional_requirements || [],
                level_required: item.level_required || prev?.level_required || 'intermediate',
                dedication_hours: Number(item.dedication_hours) || prev?.dedication_hours || 6,
                slots: Number(item.slots) || prev?.slots || 1,
                slots_filled: prev?.slots_filled || 0,
                compensation_override: item.compensation_override ?? prev?.compensation_override ?? null,
                status: item.status || prev?.status || 'open',
                created_at: prev?.created_at || now,
              };
            }
            return null;
          })
          .filter((pos): pos is StoredProjectPosition => pos !== null);

        db.project_positions.push(...nextPositions);
      }
    });

    if (updatedProject) {
      const freshStore = persistentStore.read();
      return mapStoredProjectToDto(
        updatedProject,
        freshStore.project_positions,
        freshStore.project_members,
        freshStore.project_applications.filter((a) => a.project_id === projectId).length
      );
    }

    return this.getProjectById(projectId);
  },

  /**
   * Actualizar estado de una vacante específica (solo creador del proyecto)
   */
  async updatePositionStatus(
    user: AuthenticatedUser,
    token: string,
    projectId: string,
    positionId: string,
    status: 'open' | 'paused' | 'filled' | 'closed'
  ) {
    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === projectId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localProj?.owner_id;
    if (!ownerId) {
      const { data: remoteProj } = await client
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();
      ownerId = remoteProj?.owner_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el creador del proyecto puede modificar el estado de las vacantes');
    }

    let updatedPos: StoredProjectPosition | null = null;
    persistentStore.write((db) => {
      const pos = db.project_positions.find(
        (item) => item.id === positionId && item.project_id === projectId
      );
      if (pos) {
        pos.status = status;
        updatedPos = pos;
      }
    });

    return updatedPos || { id: positionId, project_id: projectId, status };
  },

  /**
   * Postular a una posición de proyecto con aceptación explícita de acuerdos
   */
  async applyToPosition(
    user: AuthenticatedUser,
    token: string,
    projectId: string,
    positionId: string,
    payload: {
      message?: string;
      relevant_skills?: string[];
      portfolio_url?: string | null;
      availability_notes?: string | null;
      accepted_agreements?: boolean;
    }
  ) {
    if (payload.accepted_agreements === false) {
      throw new Error('Debes aceptar explícitamente los acuerdos y condiciones del proyecto para postular');
    }

    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === projectId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localProj?.owner_id;
    if (!ownerId) {
      const { data: project, error: projErr } = await client
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();

      if (projErr && !isSchemaMissingError(projErr)) {
        throw new Error('Proyecto no encontrado');
      }
      if (!project && !localProj) {
        throw new Error('Proyecto no encontrado');
      }
      ownerId = project?.owner_id;
    }

    if (ownerId === user.id) {
      throw new Error('No puedes postular a tu propio proyecto');
    }

    // Verificar vacante abierta
    const localPosition = store.project_positions.find(
      (pos) => pos.id === positionId && pos.project_id === projectId
    );
    if (localPosition && (localPosition.status === 'filled' || localPosition.status === 'closed')) {
      throw new Error('Esta vacante ya se encuentra cubierta o cerrada');
    }

    // Evitar postulaciones duplicadas activas
    const duplicate = store.project_applications.find(
      (a) =>
        a.position_id === positionId &&
        a.applicant_id === user.id &&
        a.status !== 'withdrawn'
    );
    if (duplicate) {
      throw new Error('Ya tienes una postulación registrada para esta vacante');
    }

    const applicantProfile = await resolveProfileSummary(user.id, user.email);
    const now = new Date().toISOString();

    const { data: remoteApp, error } = await client
      .from('project_applications')
      .insert({
        project_id: projectId,
        position_id: positionId,
        applicant_id: user.id,
        message: payload.message?.trim() || null,
        status: 'pending',
      })
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error && !isSchemaMissingError(error)) {
      if (error.code === '23505') {
        throw new Error('Ya tienes una postulación activa para esta posición');
      }
      throw new Error(error.message || 'No fue posible enviar la postulación');
    }

    const storedApp: StoredProjectApplication = {
      id: remoteApp?.id || persistentStore.newId(),
      project_id: projectId,
      position_id: positionId,
      applicant_id: user.id,
      applicant_name: applicantProfile.name,
      applicant_institution: applicantProfile.institution,
      applicant_career: applicantProfile.career,
      message: payload.message?.trim() || null,
      relevant_skills: Array.isArray(payload.relevant_skills) ? payload.relevant_skills : [],
      portfolio_url: payload.portfolio_url?.trim() || null,
      availability_notes: payload.availability_notes?.trim() || null,
      accepted_agreements: true,
      accepted_agreements_at: now,
      status: 'pending',
      reviewer_feedback: null,
      created_at: remoteApp?.created_at || now,
      updated_at: now,
    };

    persistentStore.write((db) => {
      db.project_applications.unshift(storedApp);
    });

    return {
      ...storedApp,
      project: localProj || remoteApp?.project || null,
      position: localPosition || remoteApp?.position || null,
    };
  },

  /**
   * Retirar postulación propia
   */
  async withdrawApplication(user: AuthenticatedUser, token: string, applicationId: string) {
    const store = persistentStore.read();
    const localApp = store.project_applications.find((a) => a.id === applicationId);
    const client = getAuthenticatedSupabase(token);

    if (localApp) {
      if (localApp.applicant_id !== user.id) {
        throw new Error('Solo el postulante puede retirar su propia postulación');
      }
      persistentStore.write((db) => {
        const app = db.project_applications.find((a) => a.id === applicationId);
        if (app) {
          app.status = 'withdrawn';
          app.updated_at = new Date().toISOString();
        }
      });
      return {
        ...localApp,
        status: 'withdrawn',
        project: store.projects.find((p) => p.id === localApp.project_id) || null,
        position: store.project_positions.find((pos) => pos.id === localApp.position_id) || null,
      };
    }

    const { data, error } = await client
      .from('project_applications')
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .eq('applicant_id', user.id)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      throw new Error(error.message || 'No fue posible retirar la postulación');
    }

    return data;
  },

  /**
   * Revisar y dictaminar postulación (solo el dueño del proyecto).
   * Si se acepta, actualiza automáticamente los cupos ocupados e incorpora al postulante al equipo.
   */
  async reviewApplication(
    user: AuthenticatedUser,
    token: string,
    applicationId: string,
    status: 'accepted' | 'rejected',
    feedback?: string
  ) {
    const store = persistentStore.read();
    const localApp = store.project_applications.find((a) => a.id === applicationId);
    const client = getAuthenticatedSupabase(token);

    if (localApp) {
      const localProj = store.projects.find((p) => p.id === localApp.project_id);
      if (!localProj) {
        throw new Error('Proyecto asociado no encontrado');
      }
      if (localProj.owner_id !== user.id && user.role !== 'admin') {
        throw new Error('Solo el creador del proyecto puede aceptar o rechazar postulaciones');
      }

      const now = new Date().toISOString();
      let updatedApp: StoredProjectApplication | null = null;

      persistentStore.write((db) => {
        const app = db.project_applications.find((a) => a.id === applicationId);
        if (!app) return;
        app.status = status;
        app.reviewer_feedback = feedback?.trim() || null;
        app.updated_at = now;
        updatedApp = app;

        if (status === 'accepted') {
          const pos = db.project_positions.find((p) => p.id === app.position_id);
          if (pos) {
            pos.slots_filled = (pos.slots_filled || 0) + 1;
            if (pos.slots_filled >= pos.slots) {
              pos.status = 'filled';
            }
          }

          const alreadyMember = db.project_members.some(
            (m) => m.project_id === app.project_id && m.profile_id === app.applicant_id
          );
          if (!alreadyMember) {
            db.project_members.push({
              id: persistentStore.newId(),
              project_id: app.project_id,
              profile_id: app.applicant_id,
              profile_name: app.applicant_name,
              profile_institution: app.applicant_institution,
              position_id: app.position_id,
              role_name: pos?.title || 'Integrante del Equipo',
              member_role: 'member',
              joined_at: now,
            });
          }
        }
      });

      return updatedApp;
    }

    // Flujo remoto en Supabase
    const { data: application, error: appErr } = await client
      .from('project_applications')
      .select('*, project:projects(owner_id)')
      .eq('id', applicationId)
      .single();

    if (appErr || !application) {
      throw new Error('Postulación no encontrada');
    }

    const projectOwnerId = (application.project as any)?.owner_id;
    if (projectOwnerId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el creador del proyecto puede aceptar o rechazar postulaciones');
    }

    const { data, error } = await client
      .from('project_applications')
      .update({ status })
      .eq('id', applicationId)
      .select('*, project:projects(*), position:project_positions(*)')
      .single();

    if (error) {
      throw new Error(error.message || 'Error al resolver la postulación');
    }

    if (status === 'accepted') {
      await client
        .from('project_members')
        .insert({
          project_id: application.project_id,
          profile_id: application.applicant_id,
          position_id: application.position_id,
          member_role: 'member',
        })
        .maybeSingle();
    }

    return data;
  },

  /**
   * Eliminar proyecto propio (solo creador o admin)
   */
  async deleteProject(user: AuthenticatedUser, token: string, projectId: string) {
    const store = persistentStore.read();
    const localProj = store.projects.find((p) => p.id === projectId);
    const client = getAuthenticatedSupabase(token);

    if (localProj && localProj.owner_id !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el creador puede eliminar el proyecto');
    }

    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', user.id);

    if (error && !isSchemaMissingError(error)) {
      throw new Error(error.message || 'No fue posible eliminar el proyecto');
    }

    persistentStore.write((db) => {
      db.projects = db.projects.filter((p) => p.id !== projectId);
      db.project_positions = db.project_positions.filter((pos) => pos.project_id !== projectId);
      db.project_applications = db.project_applications.filter((a) => a.project_id !== projectId);
      db.project_members = db.project_members.filter((m) => m.project_id !== projectId);
    });

    return { success: true, message: 'Proyecto eliminado correctamente' };
  },
};
