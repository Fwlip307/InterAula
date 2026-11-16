import { HttpError } from '../../lib/httpError.js';
import { sanitizeNoteHtml, sanitizeNoteJson } from '../../lib/html.js';
import { mapNoteToDto, validateUploadedFileMeta, type NotesQueryOptions } from '../notes.service.js';
import type { AuthenticatedUser } from '../../types/index.js';
import { clientFor, result, existing, attachProfiles } from './database.js';

const editable = ['title','summary','subject_id','subject_name','career','category','folder',
  'content_html','content_markdown','content_json','source_type','file_url','file_name','file_mime',
  'file_size','file_extension','tags','visibility','is_draft'];
function payload(body: Record<string, any>, userId: string) {
  validateUploadedFileMeta(body);
  const row = Object.fromEntries(editable.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (row.content_html !== undefined) row.content_html = sanitizeNoteHtml(row.content_html);
  if (row.content_json !== undefined) row.content_json = sanitizeNoteJson(row.content_json);
  if (row.file_url && (!String(row.file_url).startsWith(`storage://academic-notes/${userId}/`) || String(row.file_url).includes('..'))) {
    throw new HttpError(400, 'Vuelve a subir el archivo para guardarlo en el almacenamiento privado.');
  }
  return row;
}
async function dto(row: any, token?: string): Promise<any> {
  const joined = row.author ? row : (await attachProfiles([row], 'author_id', 'author', token))[0];
  const note = mapNoteToDto(joined);
  if (note.fileUrl?.startsWith('storage://academic-notes/')) {
    const storagePath = note.fileUrl.slice('storage://academic-notes/'.length);
    // RLS on Storage checks the parent note, including visibility and draft status.
    const signed = await result(clientFor(token).storage.from('academic-notes').createSignedUrl(storagePath, 300),
      'No fue posible abrir el archivo del apunte.');
    note.fileUrl = signed.signedUrl;
  } else if (note.fileUrl) {
    // Legacy public/blob/data URLs must be re-uploaded instead of bypassing note privacy.
    note.fileUrl = null;
  }
  return note;
}
export const remoteNotesService = {
  async getNotes(options: NotesQueryOptions = {}): Promise<any[]> {
    let query = clientFor(options.token).from('academic_notes').select('*').order('updated_at', { ascending: false });
    for (const [key, value] of Object.entries({
      author_id: options.authorId, subject_id: options.subjectId, subject_name: options.subjectName,
      career: options.career, category: options.category, folder: options.folder, source_type: options.sourceType,
    })) if (value && value !== 'all') query = query.eq(key, value);
    const rows: any[] = await result(query);
    const filtered = options.search ? rows.filter(row =>
      [row.title,row.summary,row.subject_name,...(row.tags || [])].join(' ').toLowerCase().includes(options.search!.toLowerCase())) : rows;
    if (options.sort === 'popular') filtered.sort((a,b) => b.downloads_count-a.downloads_count);
    if (options.sort === 'title') filtered.sort((a,b) => a.title.localeCompare(b.title,'es'));
    const joined = await attachProfiles(filtered, 'author_id', 'author', options.token);
    // File URLs are signed for five minutes under the requesting user's permissions.
    return Promise.all(joined.map(row => dto(row, options.token)));
  },
  async getMyNotes(user: AuthenticatedUser, token?: string): Promise<any[]> {
    return this.getNotes({authorId: user.id,currentUserId:user.id,token});
  },
  async getNoteById(id: string, _userId?: string, token?: string): Promise<any> {
    const row = await result(clientFor(token).from('academic_notes').select('*').eq('id',id).maybeSingle());
    return row ? dto(row,token) : null;
  },
  async createNote(user: AuthenticatedUser, token: string, body: Record<string,any>): Promise<any> {
    const row = await result(clientFor(token).from('academic_notes')
      .insert({...payload(body,user.id),author_id:user.id,version:1,downloads_count:0}).select('*').single(),
      'No se pudo guardar el apunte. Tus cambios siguen en el editor.');
    return dto(row,token);
  },
  async updateNote(user: AuthenticatedUser, token: string, id: string, body: Record<string,any>): Promise<any> {
    if (!Number.isInteger(body.expected_version)) throw new HttpError(400,'Indica la versión del apunte antes de guardar.');
    const current = await existing(clientFor(token).from('academic_notes').select('*').eq('id',id).maybeSingle(),'Apunte no encontrado');
    validateUploadedFileMeta({...current,...body});
    if (current.author_id !== user.id) throw new HttpError(403,'Solo el autor puede editar este apunte.');
    const row = await result(clientFor(token).from('academic_notes')
      .update({...payload(body,user.id),version:body.expected_version+1,updated_at:new Date().toISOString()})
      .eq('id',id).eq('author_id',user.id).eq('version',body.expected_version).select('*').maybeSingle());
    if (!row) throw new HttpError(409,'Conflicto de versión detectado. Recarga el apunte antes de guardar.');
    return dto(row,token);
  },
  async deleteNote(user: AuthenticatedUser, token: string, id: string): Promise<any> {
    await existing(clientFor(token).from('academic_notes').delete().eq('id',id).eq('author_id',user.id).select('id').maybeSingle(),'Apunte no encontrado o sin permisos.');
    return {success:true,id};
  },
  async registerDownload(id: string, _userId?: string, token?: string): Promise<any> {
    const count = await result(clientFor(token).rpc('register_note_download',{p_note_id:id}));
    return {success:true,downloadsCount:count};
  },
};
