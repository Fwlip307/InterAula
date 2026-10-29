import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import {
  persistentStore,
  isSchemaMissingError,
  resolveProfileSummary,
  type StoredAcademicNote,
} from '../lib/persistentStore.js';
import { BUSINESS_RULES } from '../constants/businessRules.js';
import type { AuthenticatedUser } from '../types/index.js';

function validateUploadedFileMeta(body: {
  source_type?: 'editor' | 'upload';
  file_name?: string | null;
  file_size?: number;
  file_extension?: string | null;
}) {
  if (body.source_type !== 'upload') return;

  if (!body.file_name || !body.file_name.trim()) {
    throw new Error('Debes indicar el nombre del archivo subido');
  }

  const ext = (
    body.file_extension ||
    (body.file_name.includes('.') ? `.${body.file_name.split('.').pop()!.toLowerCase()}` : '')
  ).toLowerCase();

  const allowed = BUSINESS_RULES.NOTES.ALLOWED_EXTENSIONS as readonly string[];
  if (!allowed.includes(ext)) {
    throw new Error(
      `Extensión de archivo no permitida (${ext || 'desconocida'}). Formatos aceptados: ${allowed.join(', ')}`
    );
  }

  if (typeof body.file_size === 'number' && body.file_size > BUSINESS_RULES.NOTES.MAX_FILE_SIZE_BYTES) {
    throw new Error('El archivo supera el límite máximo permitido de 15 MB');
  }
}

function mapNoteToDto(item: any) {
  const authorProfile = item.author;
  const authorName =
    item.author_name ||
    (authorProfile
      ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Estudiante'
      : 'Estudiante');
  const authorInstitution = item.author_institution || authorProfile?.institution || 'Duoc UC';

  return {
    id: item.id,
    authorId: item.author_id,
    authorName,
    authorInstitution,
    subjectId: item.subject_id || null,
    subjectName: item.subject_name || 'General',
    career: item.career || 'Ingeniería en Informática',
    category: item.category || 'Apunte de Clase',
    folder: item.folder || 'General',
    title: item.title,
    summary: item.summary || '',
    contentHtml: item.content_html || '',
    contentMarkdown: item.content_markdown || '',
    contentJson: item.content_json || {},
    sourceType: item.source_type || 'editor',
    fileUrl: item.file_url || null,
    fileName: item.file_name || null,
    fileMime: item.file_mime || null,
    fileSize: item.file_size ?? 0,
    fileExtension: item.file_extension || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    visibility: item.visibility || 'public',
    isDraft: Boolean(item.is_draft),
    downloadsCount: item.downloads_count ?? 0,
    version: item.version ?? 1,
    createdAt: item.created_at,
    updatedAt: item.updated_at || item.created_at,
  };
}

export interface NotesQueryOptions {
  search?: string;
  subjectId?: string;
  subjectName?: string;
  career?: string;
  category?: string;
  folder?: string;
  sourceType?: string;
  authorId?: string;
  sort?: 'recent' | 'popular' | 'title';
  currentUserId?: string;
}

export const notesBackendService = {
  /**
   * Obtener apuntes accesibles (públicos, compartidos si hay sesión, y propios)
   */
  async getNotes(options: NotesQueryOptions = {}) {
    const {
      search,
      subjectId,
      subjectName,
      career,
      category,
      folder,
      sourceType,
      authorId,
      sort = 'recent',
      currentUserId,
    } = options;

    let remoteNotes: any[] = [];
    try {
      const { data, error } = await supabasePublic
        .from('academic_notes')
        .select('*, author:profiles(id, display_name, first_name, last_name, institution)')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteNotes = data;
      }
    } catch {
      // Fallback a persistentStore
    }

    const store = persistentStore.read();
    const combinedMap = new Map<string, any>();

    for (const r of remoteNotes) {
      combinedMap.set(r.id, mapNoteToDto(r));
    }
    for (const local of store.academic_notes) {
      combinedMap.set(local.id, mapNoteToDto(local));
    }

    let results = Array.from(combinedMap.values()).filter((note) => {
      // Reglas de visibilidad y borradores
      if (currentUserId && note.authorId === currentUserId) {
        return true;
      }
      if (note.isDraft) return false;
      if (note.visibility === 'public') return true;
      if (note.visibility === 'shared' && Boolean(currentUserId)) return true;
      return false;
    });

    if (authorId) {
      results = results.filter((n) => n.authorId === authorId);
    }
    if (subjectId && subjectId !== 'all') {
      results = results.filter((n) => n.subjectId === subjectId);
    }
    if (subjectName && subjectName !== 'all') {
      results = results.filter((n) => n.subjectName.toLowerCase() === subjectName.toLowerCase());
    }
    if (career && career !== 'all') {
      results = results.filter((n) => n.career.toLowerCase() === career.toLowerCase());
    }
    if (category && category !== 'all') {
      results = results.filter((n) => n.category.toLowerCase() === category.toLowerCase());
    }
    if (folder && folder !== 'all') {
      results = results.filter((n) => n.folder.toLowerCase() === folder.toLowerCase());
    }
    if (sourceType && sourceType !== 'all') {
      results = results.filter((n) => n.sourceType === sourceType);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      results = results.filter(
        (n) =>
          n.title.toLowerCase().includes(term) ||
          n.summary.toLowerCase().includes(term) ||
          n.subjectName.toLowerCase().includes(term) ||
          n.authorName.toLowerCase().includes(term) ||
          n.contentMarkdown.toLowerCase().includes(term) ||
          n.tags.some((t: string) => t.toLowerCase().includes(term))
      );
    }

    if (sort === 'popular') {
      results.sort((a, b) => b.downloadsCount - a.downloadsCount);
    } else if (sort === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    } else {
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return results;
  },

  /**
   * Obtener únicamente los apuntes y borradores del usuario autenticado
   */
  async getMyNotes(user: AuthenticatedUser) {
    return this.getNotes({
      authorId: user.id,
      currentUserId: user.id,
    });
  },

  /**
   * Obtener un apunte por ID verificando permisos de visibilidad
   */
  async getNoteById(noteId: string, currentUserId?: string) {
    const store = persistentStore.read();
    const localNote = store.academic_notes.find((n) => n.id === noteId);

    if (localNote) {
      const dto = mapNoteToDto(localNote);
      const isOwner = Boolean(currentUserId && dto.authorId === currentUserId);
      if (!isOwner) {
        if (dto.isDraft || dto.visibility === 'private') {
          throw new Error('Acceso denegado: Este apunte es privado');
        }
        if (dto.visibility === 'shared' && !currentUserId) {
          throw new Error('Debes iniciar sesión para acceder a este apunte compartido');
        }
      }
      return dto;
    }

    const { data, error } = await supabasePublic
      .from('academic_notes')
      .select('*, author:profiles(id, display_name, first_name, last_name, institution)')
      .eq('id', noteId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const dto = mapNoteToDto(data);
    const isOwner = Boolean(currentUserId && dto.authorId === currentUserId);
    if (!isOwner && (dto.isDraft || dto.visibility === 'private')) {
      throw new Error('Acceso denegado: Este apunte es privado');
    }

    return dto;
  },

  /**
   * Crear nuevo apunte o registrar archivo subido
   */
  async createNote(user: AuthenticatedUser, token: string, body: Record<string, any>) {
    validateUploadedFileMeta(body);

    const client = getAuthenticatedSupabase(token);
    const authorSummary = await resolveProfileSummary(user.id, user.email);
    const now = new Date().toISOString();

    const insertRow = {
      author_id: user.id,
      subject_id: body.subject_id || null,
      subject_name: body.subject_name || 'General',
      career: body.career || authorSummary.career || 'Ingeniería en Informática',
      category: body.category || 'Apunte de Clase',
      folder: body.folder || 'General',
      title: body.title.trim(),
      summary: (body.summary || '').trim(),
      content_html: body.content_html || '',
      content_markdown: body.content_markdown || '',
      content_json: body.content_json || {},
      source_type: body.source_type || 'editor',
      file_url: body.file_url || null,
      file_name: body.file_name || null,
      file_mime: body.file_mime || null,
      file_size: body.file_size ?? 0,
      file_extension: body.file_extension || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      visibility: body.visibility || 'public',
      is_draft: Boolean(body.is_draft),
      downloads_count: 0,
      version: 1,
    };

    const { data, error } = await client
      .from('academic_notes')
      .insert(insertRow)
      .select('*, author:profiles(id, display_name, first_name, last_name, institution)')
      .single();

    if (error && !isSchemaMissingError(error)) {
      throw new Error(error.message || 'Error al guardar el apunte');
    }

    const stored: StoredAcademicNote = {
      id: data?.id || persistentStore.newId(),
      author_id: user.id,
      author_name: authorSummary.name,
      author_institution: authorSummary.institution,
      subject_id: insertRow.subject_id,
      subject_name: insertRow.subject_name,
      career: insertRow.career,
      category: insertRow.category,
      folder: insertRow.folder,
      title: insertRow.title,
      summary: insertRow.summary,
      content_html: insertRow.content_html,
      content_markdown: insertRow.content_markdown,
      content_json: insertRow.content_json,
      source_type: insertRow.source_type,
      file_url: insertRow.file_url,
      file_name: insertRow.file_name,
      file_mime: insertRow.file_mime,
      file_size: insertRow.file_size,
      file_extension: insertRow.file_extension,
      tags: insertRow.tags,
      visibility: insertRow.visibility,
      is_draft: insertRow.is_draft,
      downloads_count: 0,
      version: 1,
      created_at: data?.created_at || now,
      updated_at: data?.updated_at || now,
    };

    persistentStore.write((db) => {
      db.academic_notes.unshift(stored);
    });

    return mapNoteToDto(stored);
  },

  /**
   * Actualizar apunte propio con control de versiones contra sobrescritura accidental
   */
  async updateNote(
    user: AuthenticatedUser,
    token: string,
    noteId: string,
    body: Record<string, any>
  ) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localNote = store.academic_notes.find((n) => n.id === noteId);

    let ownerId = localNote?.author_id;
    let currentVersion = localNote?.version ?? 1;

    if (!localNote) {
      const { data: remoteNote } = await client
        .from('academic_notes')
        .select('author_id, version')
        .eq('id', noteId)
        .maybeSingle();

      if (!remoteNote) {
        throw new Error('Apunte no encontrado');
      }
      ownerId = remoteNote.author_id;
      currentVersion = remoteNote.version ?? 1;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede editar este apunte');
    }

    if (
      typeof body.expected_version === 'number' &&
      body.expected_version < currentVersion
    ) {
      throw new Error(
        `Conflicto de versión detectado (versión enviada: ${body.expected_version}, versión actual: ${currentVersion}). Se evitó sobrescribir cambios más recientes.`
      );
    }

    const nextVersion = currentVersion + 1;
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: now,
      version: nextVersion,
    };

    const allowedFields = [
      'title',
      'summary',
      'subject_id',
      'subject_name',
      'career',
      'category',
      'folder',
      'content_html',
      'content_markdown',
      'content_json',
      'file_url',
      'file_name',
      'file_mime',
      'file_size',
      'file_extension',
      'tags',
      'visibility',
      'is_draft',
    ];

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updatePayload[key] = typeof body[key] === 'string' && key === 'title' ? body[key].trim() : body[key];
      }
    }

    await client
      .from('academic_notes')
      .update(updatePayload)
      .eq('id', noteId)
      .eq('author_id', ownerId);

    let updatedRecord: StoredAcademicNote | null = null;
    persistentStore.write((db) => {
      const existing = db.academic_notes.find((n) => n.id === noteId);
      if (existing) {
        Object.assign(existing, updatePayload);
        updatedRecord = existing;
      }
    });

    if (updatedRecord) {
      return mapNoteToDto(updatedRecord);
    }

    const refreshed = await this.getNoteById(noteId, user.id);
    if (!refreshed) throw new Error('Error al leer el apunte actualizado');
    return refreshed;
  },

  /**
   * Eliminar apunte propio (solo autor o admin)
   */
  async deleteNote(user: AuthenticatedUser, token: string, noteId: string) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localNote = store.academic_notes.find((n) => n.id === noteId);

    let ownerId = localNote?.author_id;
    if (!ownerId) {
      const { data: remoteNote } = await client
        .from('academic_notes')
        .select('author_id')
        .eq('id', noteId)
        .maybeSingle();

      if (!remoteNote) {
        throw new Error('Apunte no encontrado');
      }
      ownerId = remoteNote.author_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede eliminar este apunte');
    }

    await client.from('academic_notes').delete().eq('id', noteId);

    persistentStore.write((db) => {
      db.academic_notes = db.academic_notes.filter((n) => n.id !== noteId);
    });

    return { success: true, id: noteId };
  },

  /**
   * Registrar descarga real de un apunte
   */
  async registerDownload(noteId: string) {
    const store = persistentStore.read();
    const localNote = store.academic_notes.find((n) => n.id === noteId);

    let nextDownloads = (localNote?.downloads_count ?? 0) + 1;

    if (!localNote) {
      const { data: current } = await supabasePublic
        .from('academic_notes')
        .select('downloads_count')
        .eq('id', noteId)
        .maybeSingle();
      nextDownloads = (current?.downloads_count ?? 0) + 1;
    }

    await supabasePublic
      .from('academic_notes')
      .update({ downloads_count: nextDownloads })
      .eq('id', noteId);

    persistentStore.write((db) => {
      const existing = db.academic_notes.find((n) => n.id === noteId);
      if (existing) {
        existing.downloads_count = nextDownloads;
      }
    });

    return { success: true, downloadsCount: nextDownloads };
  },
};

