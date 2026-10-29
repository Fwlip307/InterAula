import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profile.service';
import {
  notesService,
  validateNoteFile,
  type AcademicNote,
  type NoteVisibility,
} from '../../services/notes.service';
import {
  exportNoteToPdf,
  exportNoteToInterAulaFormat,
  exportNoteToMarkdown,
  exportNoteToPlainText,
  exportNoteToWordDoc,
} from '../../utils/noteExporter';
import { BUSINESS_RULES } from '../../constants/businessRules';
import AcademicNoteEditor from './components/AcademicNoteEditor';
import {
  BookOpenIcon,
  SearchIcon,
  PlusIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from '../../components/common/Icons';

const DEFAULT_SUBJECTS = [
  'Programación de Algoritmos',
  'Programación Orientada a Objetos',
  'Programación Web',
  'Modelamiento de Base de Datos',
  'Consultas de Bases de Datos',
  'Nivelación Matemática',
  'Arquitectura de Software',
  'Seguridad Informática',
];

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Documento nativo';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function Resources() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'community' | 'mine' | 'drafts'>('community');
  const [notes, setNotes] = useState<AcademicNote[]>([]);
  const [myNotes, setMyNotes] = useState<AcademicNote[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>(DEFAULT_SUBJECTS);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros de búsqueda y organización
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'title'>('recent');
  const [visibleCount, setVisibleCount] = useState<number>(BUSINESS_RULES.NOTES.PAGE_SIZE);

  // Estado de vista activa: Biblioteca, Editor Integrado o Lector Detallado
  const [viewMode, setViewMode] = useState<'library' | 'editor' | 'reader'>('library');
  const [selectedNote, setSelectedNote] = useState<AcademicNote | null>(null);

  // Modal de subida de archivo externo
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSummary, setUploadSummary] = useState<string>('');
  const [uploadSubject, setUploadSubject] = useState<string>(DEFAULT_SUBJECTS[0]);
  const [uploadCareer, setUploadCareer] = useState<string>('Ingeniería en Informática');
  const [uploadCategory, setUploadCategory] = useState<string>(BUSINESS_RULES.NOTES.CATEGORIES[0]);
  const [uploadFolder, setUploadFolder] = useState<string>('General');
  const [uploadTags, setUploadTags] = useState<string>('');
  const [uploadVisibility, setUploadVisibility] = useState<NoteVisibility>('public');
  const [uploading, setUploading] = useState<boolean>(false);

  // Confirmación de eliminación
  const [noteToDelete, setNoteToDelete] = useState<AcademicNote | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Mensajes de feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  useEffect(() => {
    profileService
      .getSubjects()
      .then((subs) => {
        if (Array.isArray(subs) && subs.length > 0) {
          const names = Array.from(new Set([...subs.map((s) => s.name), ...DEFAULT_SUBJECTS]));
          setSubjectsList(names);
        }
      })
      .catch(() => {});
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const [publicData, ownData] = await Promise.all([
        notesService.getNotes({
          search: searchTerm,
          subject_name: selectedSubject,
          category: selectedCategory,
          folder: selectedFolder,
          source_type: selectedFormat,
          sort: sortBy,
        }),
        user ? notesService.getMyNotes() : Promise.resolve([]),
      ]);
      setNotes(publicData);
      setMyNotes(ownData);
    } catch (err) {
      console.error('[Resources] Error al cargar apuntes:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedSubject, selectedCategory, selectedFolder, selectedFormat, sortBy, user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleOpenNewEditor = () => {
    setSelectedNote(null);
    setViewMode('editor');
  };

  const handleOpenEditNote = (note: AcademicNote) => {
    setSelectedNote(note);
    setViewMode('editor');
  };

  const handleOpenReader = (note: AcademicNote) => {
    setSelectedNote(note);
    setViewMode('reader');
  };

  const handleNoteSaved = (saved: AcademicNote) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      if (saved.isDraft) return prev.filter((n) => n.id !== saved.id);
      return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
    });
    setMyNotes((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateNoteFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Archivo no válido', true);
      e.target.value = '';
      return;
    }
    setUploadFileObj(file);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFileObj || !uploadTitle.trim() || uploading) return;

    setUploading(true);
    setErrorMsg('');

    try {
      const uploadedMeta = await notesService.uploadFile(user.id, uploadFileObj);
      const parsedTags = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await notesService.createNote({
        title: uploadTitle.trim(),
        summary: uploadSummary.trim() || `Archivo académico (${uploadedMeta.fileName})`,
        subject_name: uploadSubject,
        career: uploadCareer,
        category: uploadCategory,
        folder: uploadFolder.trim() || 'General',
        source_type: 'upload',
        file_url: uploadedMeta.fileUrl,
        file_name: uploadedMeta.fileName,
        file_mime: uploadedMeta.fileMime,
        file_size: uploadedMeta.fileSize,
        file_extension: uploadedMeta.fileExtension,
        content_markdown: uploadedMeta.extractedText || '',
        content_html: uploadedMeta.extractedText
          ? `<pre style="white-space:pre-wrap; font-family:inherit;">${uploadedMeta.extractedText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</pre>`
          : `<p>Archivo adjunto: <strong>${uploadedMeta.fileName}</strong> (${formatFileSize(uploadedMeta.fileSize)})</p>`,
        tags: parsedTags,
        visibility: uploadVisibility,
        is_draft: false,
      });

      handleNoteSaved(created);
      setShowUploadModal(false);
      setUploadFileObj(null);
      setUploadTitle('');
      setUploadSummary('');
      setUploadTags('');
      showToast('Archivo subido y catalogado exitosamente en la biblioteca.');
    } catch (err: any) {
      showToast(err?.message || 'Error al subir el archivo.', true);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete || deleting) return;
    setDeleting(true);
    try {
      await notesService.deleteNote(noteToDelete.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setMyNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      if (selectedNote?.id === noteToDelete.id) {
        setSelectedNote(null);
        setViewMode('library');
      }
      setNoteToDelete(null);
      showToast('Apunte eliminado correctamente.');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo eliminar el apunte.', true);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadNote = async (
    note: AcademicNote,
    format: 'pdf' | 'original' | 'md' | 'txt' | 'doc' | 'interaula'
  ) => {
    const nextDownloads = await notesService.registerDownload(note.id);
    if (typeof nextDownloads === 'number') {
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, downloadsCount: nextDownloads } : n))
      );
      setMyNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, downloadsCount: nextDownloads } : n))
      );
      if (selectedNote?.id === note.id) {
        setSelectedNote((prev) => (prev ? { ...prev, downloadsCount: nextDownloads } : prev));
      }
    }

    if (format === 'original' && note.fileUrl) {
      const a = document.createElement('a');
      a.href = note.fileUrl;
      a.download = note.fileName || `${note.title}${note.fileExtension || ''}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Descargando archivo original: ${note.fileName}`);
      return;
    }

    if (format === 'md') {
      exportNoteToMarkdown(note);
      showToast('Apunte exportado en formato Markdown (.md)');
    } else if (format === 'txt') {
      exportNoteToPlainText(note);
      showToast('Apunte exportado en Texto Plano (.txt)');
    } else if (format === 'doc') {
      exportNoteToWordDoc(note);
      showToast('Apunte exportado en formato Word (.doc)');
    } else if (format === 'interaula') {
      exportNoteToInterAulaFormat(note);
      showToast('Apunte descargado en formato nativo InterAula (.interaula.json)');
    } else {
      exportNoteToPdf(note);
      showToast('Apunte exportado en PDF académico estructurado (.pdf)');
    }
  };

  // Si el usuario está en el Editor Integrado
  if (viewMode === 'editor') {
    return (
      <AcademicNoteEditor
        initialNote={selectedNote}
        subjectsList={subjectsList}
        onClose={() => {
          setViewMode('library');
          fetchNotes();
        }}
        onSaved={handleNoteSaved}
      />
    );
  }

  // Filtrar lista según pestaña activa
  const foldersAvailable = Array.from(
    new Set(
      [...notes, ...myNotes]
        .map((n) => n.folder)
        .filter((f): f is string => Boolean(f && f.trim()))
    )
  );

  const displayedList = (() => {
    if (activeTab === 'mine') {
      return myNotes.filter((n) => !n.isDraft);
    }
    if (activeTab === 'drafts') {
      return myNotes.filter((n) => n.isDraft);
    }
    return notes.filter((n) => !n.isDraft);
  })();

  const visibleNotes = displayedList.slice(0, visibleCount);

  return (
    <div>
      {/* Cabecera de la Biblioteca y Editor */}
      <div className="ia-page-header">
        <div>
          <h1 className="ia-page-title">Biblioteca y Editor de Apuntes Académicos</h1>
          <p className="ia-page-subtitle">
            Crea apuntes enriquecidos directamente en InterAula, sube guías o resúmenes y descarga material estructurado en PDF, Word, Markdown o formato nativo.
          </p>
        </div>

        <div className="ia-page-actions">
          {viewMode === 'reader' && (
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={() => {
                setSelectedNote(null);
                setViewMode('library');
              }}
            >
              <ArrowLeftIcon size={16} />
              <span>Volver al repositorio</span>
            </button>
          )}
          <button
            type="button"
            className="ia-btn-secondary"
            onClick={() => setShowUploadModal((prev) => !prev)}
          >
            <span>Subir Archivo (PDF / DOCX / MD)</span>
          </button>
          <button type="button" className="ia-btn-primary" onClick={handleOpenNewEditor}>
            <PlusIcon size={16} color="#ffffff" />
            <span>Crear Apunte en Editor</span>
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      {feedbackMsg && (
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
          <span>{feedbackMsg}</span>
        </div>
      )}

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

      {/* Modal de Subida de Archivo */}
      {showUploadModal && (
        <div className="ia-card" style={{ marginBottom: '22px', border: '1px solid var(--ia-primary-border)' }}>
          <div className="ia-card-header">
            <h2 className="ia-card-title">Subir Documento o Material Académico</h2>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setShowUploadModal(false)}
            >
              Cerrar
            </button>
          </div>
          <form onSubmit={handleUploadSubmit}>
            <div className="ia-form-grid">
              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="note-upload-file">
                  Archivo académico ({BUSINESS_RULES.NOTES.ALLOWED_EXTENSIONS.join(', ')} · Máx {BUSINESS_RULES.NOTES.MAX_FILE_SIZE_MB} MB) *
                </label>
                <input
                  id="note-upload-file"
                  type="file"
                  accept={BUSINESS_RULES.NOTES.ALLOWED_EXTENSIONS.join(',')}
                  className="ia-input"
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="note-upload-title">
                  Título del documento *
                </label>
                <input
                  id="note-upload-title"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: Guía de Ejercicios Resueltos de Consultas SQL y Subconsultas"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-subject">
                  Asignatura
                </label>
                <select
                  id="note-upload-subject"
                  className="ia-select"
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                >
                  {subjectsList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-category">
                  Categoría
                </label>
                <select
                  id="note-upload-category"
                  className="ia-select"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                >
                  {BUSINESS_RULES.NOTES.CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-folder">
                  Carpeta / Unidad
                </label>
                <input
                  id="note-upload-folder"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: Certamen 1, Unidad 3"
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-visibility">
                  Visibilidad
                </label>
                <select
                  id="note-upload-visibility"
                  className="ia-select"
                  value={uploadVisibility}
                  onChange={(e) => setUploadVisibility(e.target.value as NoteVisibility)}
                >
                  <option value="public">Público (Comunidad)</option>
                  <option value="shared">Compartido (Usuarios autenticados)</option>
                  <option value="private">Privado (Solo yo)</option>
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-career">
                  Carrera
                </label>
                <input
                  id="note-upload-career"
                  type="text"
                  className="ia-input"
                  value={uploadCareer}
                  onChange={(e) => setUploadCareer(e.target.value)}
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="note-upload-tags">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  id="note-upload-tags"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: Certamen, SQL, Guía"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="note-upload-summary">
                  Descripción / Resumen del material
                </label>
                <textarea
                  id="note-upload-summary"
                  className="ia-textarea"
                  rows={3}
                  placeholder="Describe brevemente qué incluye este archivo y para qué evaluación sirve..."
                  value={uploadSummary}
                  onChange={(e) => setUploadSummary(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" className="ia-btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="ia-btn-primary" disabled={uploading || !uploadFileObj}>
                {uploading ? 'Subiendo archivo...' : 'Publicar Archivo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmación de Eliminación */}
      {noteToDelete && (
        <div
          className="ia-card"
          style={{
            marginBottom: '20px',
            border: '1px solid var(--ia-danger-border)',
            background: 'var(--ia-danger-bg)',
          }}
        >
          <h3 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: 'var(--ia-danger)' }}>
            ¿Eliminar este apunte de la biblioteca?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: 'var(--ia-text-body)' }}>
            Se eliminará permanentemente <strong>"{noteToDelete.title}"</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="ia-btn-primary"
              style={{ background: 'var(--ia-danger)' }}
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar apunte'}
            </button>
            <button type="button" className="ia-btn-secondary" onClick={() => setNoteToDelete(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VISTA LECTOR DETALLADO DE APUNTE */}
      {viewMode === 'reader' && selectedNote ? (
        <div className="ia-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="ia-badge ia-badge-blue">{selectedNote.category}</span>
              <span className="ia-badge ia-badge-neutral">{selectedNote.subjectName}</span>
              <span className="ia-badge ia-badge-purple">Carpeta: {selectedNote.folder}</span>
              <span className="ia-badge ia-badge-success">
                v{selectedNote.version} · {selectedNote.downloadsCount} descargas
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {user?.id && selectedNote.authorId === user.id && (
                <>
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => handleOpenEditNote(selectedNote)}
                  >
                    <EditIcon size={15} />
                    <span>Editar en Editor</span>
                  </button>
                  <button
                    type="button"
                    className="ia-btn-icon-danger"
                    onClick={() => setNoteToDelete(selectedNote)}
                    title="Eliminar apunte"
                  >
                    <TrashIcon size={15} />
                  </button>
                </>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: '0 0 8px 0' }}>
            {selectedNote.title}
          </h2>

          {selectedNote.summary && (
            <p style={{ fontSize: '0.94rem', color: 'var(--ia-text-muted)', margin: '0 0 14px 0' }}>
              {selectedNote.summary}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--ia-bg-subtle)',
              fontSize: '0.82rem',
              color: 'var(--ia-text-body)',
              marginBottom: '20px',
            }}
          >
            <div>
              Autor:{' '}
              {selectedNote.authorId ? (
                <Link
                  to={`/profile/${selectedNote.authorId}`}
                  style={{ color: 'var(--ia-primary)', fontWeight: 700, textDecoration: 'none' }}
                >
                  {selectedNote.authorName}
                </Link>
              ) : (
                <strong>{selectedNote.authorName}</strong>
              )}{' '}
              · {selectedNote.authorInstitution} · Carrera: {selectedNote.career}
            </div>
            <div>
              Actualizado: {new Date(selectedNote.updatedAt).toLocaleDateString('es-CL')} ·{' '}
              {selectedNote.sourceType === 'upload'
                ? `${selectedNote.fileName || 'Archivo'} (${formatFileSize(selectedNote.fileSize)})`
                : 'Apunte nativo InterAula'}
            </div>
          </div>

          {/* Contenido renderizado del apunte */}
          <div
            style={{
              padding: '24px',
              borderRadius: '10px',
              border: '1px solid var(--ia-border)',
              background: 'var(--ia-bg-card)',
              lineHeight: 1.75,
              fontSize: '0.96rem',
              marginBottom: '20px',
            }}
            dangerouslySetInnerHTML={{
              __html:
                selectedNote.contentHtml ||
                `<p>${(selectedNote.contentMarkdown || selectedNote.summary || '').replace(/\n/g, '<br/>')}</p>`,
            }}
          />

          {/* Panel de exportación / descarga */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '14px',
              borderTop: '1px solid var(--ia-border)',
            }}
          >
            <strong style={{ fontSize: '0.85rem', color: 'var(--ia-text-main)' }}>
              Opciones de Descarga y Exportación:
            </strong>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedNote.sourceType === 'upload' && selectedNote.fileUrl && (
                <button
                  type="button"
                  className="ia-btn-primary"
                  onClick={() => handleDownloadNote(selectedNote, 'original')}
                >
                  <DownloadIcon size={15} color="#ffffff" />
                  <span>Descargar Archivo Original ({selectedNote.fileExtension || 'Archivo'})</span>
                </button>
              )}
              <button
                type="button"
                className="ia-btn-primary"
                onClick={() => handleDownloadNote(selectedNote, 'pdf')}
              >
                <DownloadIcon size={15} color="#ffffff" />
                <span>Descargar PDF Estructurado (.pdf)</span>
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => handleDownloadNote(selectedNote, 'doc')}
              >
                <span>Word (.doc)</span>
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => handleDownloadNote(selectedNote, 'md')}
              >
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => handleDownloadNote(selectedNote, 'txt')}
              >
                <span>Texto (.txt)</span>
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => handleDownloadNote(selectedNote, 'interaula')}
              >
                <span>Formato InterAula (.interaula.json)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA BIBLIOTECA Y BUSCADOR */
        <>
          {/* Pestañas de navegación de la Biblioteca */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeTab === 'community' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('community')}
            >
              Explorar Comunidad ({notes.filter((n) => !n.isDraft).length})
            </button>
            <button
              type="button"
              className={activeTab === 'mine' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('mine')}
            >
              Mis Apuntes Publicados ({myNotes.filter((n) => !n.isDraft).length})
            </button>
            <button
              type="button"
              className={activeTab === 'drafts' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              onClick={() => setActiveTab('drafts')}
            >
              Mis Borradores ({myNotes.filter((n) => n.isDraft).length})
            </button>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="ia-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 250px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <SearchIcon size={16} />
                </span>
                <input
                  type="text"
                  className="ia-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Buscar por título, contenido, asignatura, autor o etiqueta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                aria-label="Filtrar por asignatura"
                className="ia-select"
                style={{ width: 'auto', minWidth: '180px' }}
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="all">Todas las asignaturas</option>
                {subjectsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por categoría"
                className="ia-select"
                style={{ width: 'auto', minWidth: '160px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Todos los tipos</option>
                {BUSINESS_RULES.NOTES.CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {foldersAvailable.length > 0 && (
                <select
                  aria-label="Filtrar por carpeta"
                  className="ia-select"
                  style={{ width: 'auto', minWidth: '145px' }}
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                >
                  <option value="all">Todas las carpetas</option>
                  {foldersAvailable.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Filtrar por origen"
                className="ia-select"
                style={{ width: 'auto', minWidth: '145px' }}
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
              >
                <option value="all">Origen: Todos</option>
                <option value="editor">Editor InterAula</option>
                <option value="upload">Archivos subidos</option>
              </select>

              <select
                aria-label="Ordenar apuntes"
                className="ia-select"
                style={{ width: 'auto', minWidth: '155px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'title')}
              >
                <option value="recent">Más recientes</option>
                <option value="popular">Más descargados</option>
                <option value="title">Orden alfabético</option>
              </select>
            </div>
          </div>

          {/* Grilla de Apuntes */}
          {loading ? (
            <div className="ia-card" style={{ textAlign: 'center', padding: '36px' }}>
              <p style={{ margin: 0, color: 'var(--ia-text-muted)' }}>Cargando biblioteca de apuntes...</p>
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="ia-empty-box">
              <div className="ia-empty-icon">
                <BookOpenIcon size={22} />
              </div>
              <p className="ia-empty-title">
                {activeTab === 'drafts'
                  ? 'No tienes borradores pendientes'
                  : activeTab === 'mine'
                  ? 'Aún no has publicado apuntes propios'
                  : 'Todavía no hay apuntes registrados con estos filtros'}
              </p>
              <p className="ia-empty-desc">
                Utiliza el Editor Académico Integrado para redactar apuntes con código, tablas y fórmulas o sube tus archivos de estudio para compartirlos.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="ia-btn-primary" onClick={handleOpenNewEditor}>
                  <PlusIcon size={15} color="#ffffff" /> Crear Apunte en Editor
                </button>
                <button type="button" className="ia-btn-secondary" onClick={() => setShowUploadModal(true)}>
                  Subir Archivo Existente
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '18px',
                }}
              >
                {visibleNotes.map((note) => {
                  const isOwner = Boolean(user?.id && note.authorId === user.id);

                  return (
                    <article
                      key={note.id}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="ia-badge ia-badge-blue">{note.category}</span>
                            {note.isDraft && <span className="ia-badge ia-badge-amber">Borrador</span>}
                            {note.visibility === 'private' && <span className="ia-badge ia-badge-neutral">Privado</span>}
                          </div>

                          <span style={{ fontSize: '0.75rem', color: 'var(--ia-text-muted)' }}>
                            📁 {note.folder}
                          </span>
                        </div>

                        <h2
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: 'var(--ia-text-main)',
                            margin: '0 0 4px 0',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleOpenReader(note)}
                        >
                          {note.title}
                        </h2>

                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ia-primary)', marginBottom: '8px' }}>
                          {note.subjectName} · {note.career}
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--ia-text-body)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                          {note.summary || 'Apunte académico estructurado disponible para lectura y exportación.'}
                        </p>

                        {note.tags.length > 0 && (
                          <div className="ia-tags-cloud" style={{ marginBottom: '10px' }}>
                            {note.tags.map((t) => (
                              <span key={t} className="ia-tag" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginBottom: '10px' }}>
                          <span>
                            Por{' '}
                            {note.authorId ? (
                              <Link
                                to={`/profile/${note.authorId}`}
                                style={{ color: 'var(--ia-primary)', fontWeight: 600, textDecoration: 'none' }}
                              >
                                {note.authorName}
                              </Link>
                            ) : (
                              <strong>{note.authorName}</strong>
                            )}
                          </span>
                          <span>
                            ⬇ {note.downloadsCount} · v{note.version}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="ia-btn-secondary"
                            style={{ flex: 1, padding: '7px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleOpenReader(note)}
                          >
                            Leer Apunte
                          </button>

                          <button
                            type="button"
                            className="ia-btn-primary"
                            style={{ flex: 1, padding: '7px 10px', fontSize: '0.8rem' }}
                            onClick={() =>
                              handleDownloadNote(
                                note,
                                note.sourceType === 'upload' && note.fileUrl ? 'original' : 'pdf'
                              )
                            }
                          >
                            <DownloadIcon size={14} color="#ffffff" />
                            <span>
                              {note.sourceType === 'upload' && note.fileExtension
                                ? `Descargar (${note.fileExtension})`
                                : 'PDF'}
                            </span>
                          </button>

                          {isOwner && (
                            <>
                              <button
                                type="button"
                                className="ia-btn-secondary"
                                style={{ padding: '7px 9px' }}
                                onClick={() => handleOpenEditNote(note)}
                                title="Editar en Editor Integrado"
                              >
                                <EditIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="ia-btn-icon-danger"
                                onClick={() => setNoteToDelete(note)}
                                title="Eliminar apunte"
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

              {displayedList.length > visibleCount && (
                <div style={{ textAlign: 'center', marginTop: '18px' }}>
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => setVisibleCount((prev) => prev + BUSINESS_RULES.NOTES.PAGE_SIZE)}
                  >
                    Cargar más apuntes ({displayedList.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
