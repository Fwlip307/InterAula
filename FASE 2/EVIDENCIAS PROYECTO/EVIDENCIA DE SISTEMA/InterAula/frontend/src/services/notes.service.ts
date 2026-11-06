import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { BUSINESS_RULES } from '../constants/businessRules';

export type NoteVisibility = 'private' | 'shared' | 'public';
export type NoteSourceType = 'editor' | 'upload';

export interface AcademicNote {
  id: string;
  authorId: string;
  authorName: string;
  authorInstitution: string;
  subjectId: string | null;
  subjectName: string;
  career: string;
  category: string;
  folder: string;
  title: string;
  summary: string;
  contentHtml: string;
  contentMarkdown: string;
  contentJson: Record<string, any>;
  sourceType: NoteSourceType;
  fileUrl: string | null;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number;
  fileExtension: string | null;
  tags: string[];
  visibility: NoteVisibility;
  isDraft: boolean;
  downloadsCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotePayload {
  title: string;
  summary?: string;
  subject_id?: string | null;
  subject_name?: string;
  career?: string;
  category?: string;
  folder?: string;
  content_html?: string;
  content_markdown?: string;
  content_json?: Record<string, any>;
  source_type?: NoteSourceType;
  file_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number;
  file_extension?: string | null;
  tags?: string[];
  visibility?: NoteVisibility;
  is_draft?: boolean;
}

export interface UpdateNotePayload extends Partial<CreateNotePayload> {
  expected_version?: number;
}

export interface NoteFilterParams {
  search?: string;
  subject_id?: string;
  subject_name?: string;
  career?: string;
  category?: string;
  folder?: string;
  source_type?: string;
  author_id?: string;
  sort?: 'recent' | 'popular' | 'title';
}

export function validateNoteFile(file: File): { valid: boolean; error?: string; extension: string } {
  const name = file.name || '';
  const ext = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
  const allowedExts = BUSINESS_RULES.NOTES.ALLOWED_EXTENSIONS as readonly string[];

  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      extension: ext,
      error: `Formato no permitido (${ext || 'sin extensión'}). Se permiten: ${allowedExts.join(', ')}`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      extension: ext,
      error: 'El archivo seleccionado está vacío.',
    };
  }

  if (file.size > BUSINESS_RULES.NOTES.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      extension: ext,
      error: `El archivo supera el tamaño máximo de ${BUSINESS_RULES.NOTES.MAX_FILE_SIZE_MB} MB.`,
    };
  }

  return { valid: true, extension: ext };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado'));
    reader.readAsDataURL(file);
  });
}

export const notesService = {
  /**
   * Obtiene los apuntes disponibles según filtros y permisos de visibilidad.
   */
  async getNotes(filters?: NoteFilterParams): Promise<AcademicNote[]> {
    try {
      const qs = new URLSearchParams();
      if (filters?.search?.trim()) qs.set('search', filters.search.trim());
      if (filters?.subject_id && filters.subject_id !== 'all') qs.set('subject_id', filters.subject_id);
      if (filters?.subject_name && filters.subject_name !== 'all') qs.set('subject_name', filters.subject_name);
      if (filters?.career && filters.career !== 'all') qs.set('career', filters.career);
      if (filters?.category && filters.category !== 'all') qs.set('category', filters.category);
      if (filters?.folder && filters.folder !== 'all') qs.set('folder', filters.folder);
      if (filters?.source_type && filters.source_type !== 'all') qs.set('source_type', filters.source_type);
      if (filters?.author_id) qs.set('author_id', filters.author_id);
      if (filters?.sort) qs.set('sort', filters.sort);

      const queryStr = qs.toString();
      const endpoint = queryStr ? `${API_ENDPOINTS.NOTES.BASE}?${queryStr}` : API_ENDPOINTS.NOTES.BASE;
      const notes = await apiClient.get<AcademicNote[]>(endpoint);
      return Array.isArray(notes) ? notes : [];
    } catch (err) {
      console.error('[notesService] Error en getNotes:', err);
      return [];
    }
  },

  /**
   * Obtiene los apuntes y borradores propios del usuario autenticado.
   */
  async getMyNotes(): Promise<AcademicNote[]> {
    try {
      const notes = await apiClient.get<AcademicNote[]>(API_ENDPOINTS.NOTES.ME);
      return Array.isArray(notes) ? notes : [];
    } catch (err) {
      console.error('[notesService] Error en getMyNotes:', err);
      return [];
    }
  },

  /**
   * Obtiene el detalle de un apunte por su ID.
   */
  async getNoteById(noteId: string): Promise<AcademicNote | null> {
    try {
      return await apiClient.get<AcademicNote>(API_ENDPOINTS.NOTES.BY_ID(noteId));
    } catch (err) {
      console.error('[notesService] Error en getNoteById:', err);
      return null;
    }
  },

  /**
   * Crea un nuevo apunte académico o registra un documento subido.
   */
  async createNote(payload: CreateNotePayload): Promise<AcademicNote> {
    return apiClient.post<AcademicNote>(API_ENDPOINTS.NOTES.BASE, payload);
  },

  /**
   * Actualiza un apunte propio con control de versiones para prevenir sobrescritura accidental.
   */
  async updateNote(noteId: string, payload: UpdateNotePayload): Promise<AcademicNote> {
    return apiClient.put<AcademicNote>(API_ENDPOINTS.NOTES.BY_ID(noteId), payload);
  },

  /**
   * Elimina un apunte propio.
   */
  async deleteNote(noteId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.NOTES.BY_ID(noteId));
  },

  /**
   * Incrementa el contador real de descargas de un apunte.
   */
  async registerDownload(noteId: string): Promise<number | null> {
    try {
      const res = await apiClient.post<{ success: boolean; downloadsCount: number }>(
        API_ENDPOINTS.NOTES.DOWNLOAD(noteId)
      );
      return res?.downloadsCount ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Sube un archivo académico validado a Supabase Storage (o genera Data URL segura si el bucket aún no está creado en remoto).
   */
  async uploadFile(userId: string, file: File): Promise<{
    fileUrl: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    fileExtension: string;
    extractedText?: string;
  }> {
    const check = validateNoteFile(file);
    if (!check.valid) {
      throw new Error(check.error || 'Archivo no válido');
    }

    let extractedText = '';
    if (check.extension === '.txt' || check.extension === '.md') {
      try {
        extractedText = await file.text();
      } catch {
        extractedText = '';
      }
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${Date.now()}_${sanitizedName}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from('academic-notes')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubData } = supabase.storage.from('academic-notes').getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          return {
            fileUrl: pubData.publicUrl,
            fileName: file.name,
            fileMime: file.type || 'application/octet-stream',
            fileSize: file.size,
            fileExtension: check.extension,
            extractedText,
          };
        }
      }
    } catch {
      // Si el bucket remoto aún no ha sido creado en Supabase, continuamos con almacenamiento embebido seguro
    }

    // Si el archivo es <= 3MB lo codificamos en Data URL para descarga directa persistente; si es mayor, usamos Blob URL de sesión
    const fileUrl =
      file.size <= 3 * 1024 * 1024 ? await fileToDataUrl(file) : URL.createObjectURL(file);

    return {
      fileUrl,
      fileName: file.name,
      fileMime: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileExtension: check.extension,
      extractedText,
    };
  },
};

