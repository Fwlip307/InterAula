import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  notesService,
  type AcademicNote,
  type NoteVisibility,
} from '../../../services/notes.service';
import {
  exportNoteToPdf,
  exportNoteToInterAulaFormat,
  exportNoteToMarkdown,
  exportNoteToPlainText,
  exportNoteToWordDoc,
  htmlToMarkdown,
  parseInterAulaNoteFile,
} from '../../../utils/noteExporter';
import { BUSINESS_RULES } from '../../../constants/businessRules';
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';

interface AcademicNoteEditorProps {
  initialNote?: AcademicNote | null;
  subjectsList: string[];
  onClose: () => void;
  onSaved: (note: AcademicNote) => void;
}

type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';

const DEFAULT_TEMPLATE_HTML = `<h2>1. Objetivo de la Sesión / Tema</h2>
<p>Escribe aquí los conceptos fundamentales, definiciones o teoremas revisados en clases.</p>
<blockquote><strong>Concepto clave:</strong> Resume la idea central o propiedad que debes recordar para el certamen.</blockquote>
<h2>2. Desarrollo y Ejemplos</h2>
<ul>
  <li>Punto clave o propiedad 1</li>
  <li>Caso práctico o restricción de diseño</li>
</ul>
<h2>3. Síntesis / Fórmulas / Código</h2>
<pre><code>// Ejemplo de implementación o pseudocódigo
SELECT id, nombre FROM estudiantes WHERE activo = true;</code></pre>`;

export default function AcademicNoteEditor({
  initialNote,
  subjectsList,
  onClose,
  onSaved,
}: AcademicNoteEditorProps) {
  const [noteId, setNoteId] = useState<string | null>(initialNote?.id || null);
  const [version, setVersion] = useState<number>(initialNote?.version || 1);

  const [title, setTitle] = useState<string>(initialNote?.title || '');
  const [summary, setSummary] = useState<string>(initialNote?.summary || '');
  const [subjectName, setSubjectName] = useState<string>(
    initialNote?.subjectName || subjectsList[0] || 'Programación de Algoritmos'
  );
  const [career, setCareer] = useState<string>(
    initialNote?.career || 'Ingeniería en Informática'
  );
  const [category, setCategory] = useState<string>(
    initialNote?.category || BUSINESS_RULES.NOTES.CATEGORIES[0]
  );
  const [folder, setFolder] = useState<string>(initialNote?.folder || 'General');
  const [tagsText, setTagsText] = useState<string>(
    (initialNote?.tags || []).join(', ')
  );
  const [visibility, setVisibility] = useState<NoteVisibility>(
    initialNote?.visibility || 'public'
  );
  const [isDraft, setIsDraft] = useState<boolean>(initialNote?.isDraft ?? false);
  const [contentHtml, setContentHtml] = useState<string>(
    initialNote?.contentHtml || DEFAULT_TEMPLATE_HTML
  );

  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialNote ? 'saved' : 'pending');
  const [saveError, setSaveError] = useState<string>('');
  const [mathPromptOpen, setMathPromptOpen] = useState<boolean>(false);
  const [mathInput, setMathInput] = useState<string>('f(x) = \\int_{a}^{b} x^2 \\, dx');
  const [linkPromptOpen, setLinkPromptOpen] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string>('https://');
  const [linkLabel, setLinkLabel] = useState<string>('Referencia académica');

  const editorRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef<boolean>(false);
  const saveSequenceRef = useRef<number>(0);
  const versionRef = useRef<number>(initialNote?.version || 1);
  const noteIdRef = useRef<string | null>(initialNote?.id || null);

  useEffect(() => {
    if (editorRef.current && editorMode === 'edit') {
      if (editorRef.current.innerHTML !== contentHtml) {
        editorRef.current.innerHTML = contentHtml;
      }
    }
  }, [editorMode]);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setSaveStatus('pending');
    setSaveError('');
  }, []);

  const syncEditorHtml = useCallback(() => {
    if (editorRef.current) {
      const current = editorRef.current.innerHTML;
      setContentHtml(current);
      return current;
    }
    return contentHtml;
  }, [contentHtml]);

  const performSave = useCallback(
    async (overrideDraft?: boolean) => {
      const htmlToSave = editorRef.current ? editorRef.current.innerHTML : contentHtml;
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < BUSINESS_RULES.NOTES.MIN_TITLE_LENGTH) {
        setSaveStatus('error');
        setSaveError(`El título debe tener al menos ${BUSINESS_RULES.NOTES.MIN_TITLE_LENGTH} caracteres.`);
        return null;
      }

      const seq = ++saveSequenceRef.current;
      setSaveStatus('saving');
      setSaveError('');

      const parsedTags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const targetDraft = typeof overrideDraft === 'boolean' ? overrideDraft : isDraft;
      const markdown = htmlToMarkdown(htmlToSave);

      try {
        let saved: AcademicNote;
        if (noteIdRef.current) {
          saved = await notesService.updateNote(noteIdRef.current, {
            title: trimmedTitle,
            summary: summary.trim(),
            subject_name: subjectName,
            career,
            category,
            folder: folder.trim() || 'General',
            content_html: htmlToSave,
            content_markdown: markdown,
            tags: parsedTags,
            visibility,
            is_draft: targetDraft,
            expected_version: versionRef.current,
          });
        } else {
          saved = await notesService.createNote({
            title: trimmedTitle,
            summary: summary.trim(),
            subject_name: subjectName,
            career,
            category,
            folder: folder.trim() || 'General',
            content_html: htmlToSave,
            content_markdown: markdown,
            source_type: 'editor',
            tags: parsedTags,
            visibility,
            is_draft: targetDraft,
          });
        }

        // Ignorar respuestas obsoletas si ya se disparó un guardado más nuevo
        if (seq < saveSequenceRef.current) {
          return saved;
        }

        noteIdRef.current = saved.id;
        versionRef.current = saved.version;
        setNoteId(saved.id);
        setVersion(saved.version);
        setIsDraft(saved.isDraft);
        isDirtyRef.current = false;
        setSaveStatus('saved');
        onSaved(saved);
        return saved;
      } catch (err: any) {
        if (seq === saveSequenceRef.current) {
          setSaveStatus('error');
          setSaveError(err?.message || 'Error al guardar cambios.');
        }
        return null;
      }
    },
    [title, summary, subjectName, career, category, folder, tagsText, visibility, isDraft, contentHtml, onSaved]
  );

  // Autoguardado con debounce cuando hay cambios pendientes y título válido
  useEffect(() => {
    if (!isDirtyRef.current) return;
    if (title.trim().length < BUSINESS_RULES.NOTES.MIN_TITLE_LENGTH) return;

    const timer = window.setTimeout(() => {
      if (isDirtyRef.current) {
        performSave();
      }
    }, BUSINESS_RULES.NOTES.AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [title, summary, subjectName, career, category, folder, tagsText, visibility, isDraft, contentHtml, performSave]);

  const execFormat = (command: string, value?: string) => {
    if (editorMode !== 'edit') setEditorMode('edit');
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      syncEditorHtml();
      markDirty();
    }
  };

  const insertHtmlSnippet = (snippet: string) => {
    if (editorMode !== 'edit') setEditorMode('edit');
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, snippet);
      syncEditorHtml();
      markDirty();
    }
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse; margin: 12px 0; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background: #eff6ff;">
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Concepto / Criterio</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Definición / Fórmula</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Ejemplo Práctico</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Elemento 1</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Descripción técnica</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Caso de uso</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Elemento 2</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Descripción técnica</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Caso de uso</td>
          </tr>
        </tbody>
      </table><p><br/></p>`;
    insertHtmlSnippet(tableHtml);
  };

  const handleInsertCodeBlock = () => {
    const codeHtml = `<pre style="background:#0f172a; color:#f8fafc; padding:12px 14px; border-radius:8px; font-family:monospace; overflow-x:auto; margin:10px 0;"><code>// Escribe aquí tu bloque de código o consulta SQL
function ejemplo() {
  return true;
}</code></pre><p><br/></p>`;
    insertHtmlSnippet(codeHtml);
  };

  const handleInsertMathFormula = () => {
    if (!mathInput.trim()) return;
    const escaped = mathInput
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const mathHtml = `<div data-math="true" style="background:#f8fafc; border-left:4px solid #2563eb; padding:10px 14px; margin:10px 0; font-family:'Cambria Math', 'Times New Roman', monospace; font-size:1.02rem; color:#1e293b;"><strong>∑ Expresión Matemática:</strong> <code>${escaped}</code></div><p><br/></p>`;
    insertHtmlSnippet(mathHtml);
    setMathPromptOpen(false);
  };

  const handleInsertLink = () => {
    if (!linkUrl.trim()) return;
    const safeUrl = linkUrl.trim();
    const safeLabel = (linkLabel.trim() || safeUrl).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    insertHtmlSnippet(
      `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">${safeLabel}</a>&nbsp;`
    );
    setLinkPromptOpen(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      if (file.name.endsWith('.interaula.json') || file.name.endsWith('.json')) {
        const imported = parseInterAulaNoteFile(rawText);
        if (imported.title) setTitle(imported.title);
        if (imported.summary) setSummary(imported.summary);
        if (imported.subjectName) setSubjectName(imported.subjectName);
        if (imported.career) setCareer(imported.career);
        if (imported.category) setCategory(imported.category);
        if (imported.folder) setFolder(imported.folder);
        if (Array.isArray(imported.tags)) setTagsText(imported.tags.join(', '));
        const nextHtml = imported.contentHtml || `<p>${imported.contentMarkdown || ''}</p>`;
        setContentHtml(nextHtml);
        if (editorRef.current) editorRef.current.innerHTML = nextHtml;
        markDirty();
      } else {
        // Archivo Markdown o TXT
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^.]+$/, ''));
        }
        const paragraphs = rawText
          .split(/\r?\n\r?\n/)
          .map((block) => `<p>${block.replace(/\r?\n/g, '<br/>')}</p>`)
          .join('');
        setContentHtml(paragraphs);
        if (editorRef.current) editorRef.current.innerHTML = paragraphs;
        markDirty();
      }
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'No se pudo importar el archivo seleccionado.');
    } finally {
      e.target.value = '';
    }
  };

  const buildCurrentNoteSnapshot = (): Partial<AcademicNote> => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : contentHtml;
    return {
      id: noteId || 'preview',
      title: title.trim() || 'Apunte Académico',
      summary: summary.trim(),
      subjectName,
      career,
      category,
      folder,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      contentHtml: currentHtml,
      contentMarkdown: htmlToMarkdown(currentHtml),
      version,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      performSave();
    }
  };

  return (
    <div className="ia-card" style={{ padding: '24px' }}>
      {/* Barra superior del Editor */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--ia-border)',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="ia-btn-secondary" onClick={onClose}>
            <ArrowLeftIcon size={16} />
            <span>Volver a la Biblioteca</span>
          </button>

          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--ia-text-main)' }}>
              {noteId ? 'Editor Académico Integrado' : 'Nuevo Apunte Académico'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {saveStatus === 'saved' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-success)', fontWeight: 600 }}>
                  ✓ Guardado (v{version})
                </span>
              )}
              {saveStatus === 'saving' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-primary)', fontWeight: 600 }}>
                  ⟳ Guardando cambios...
                </span>
              )}
              {saveStatus === 'pending' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-amber)', fontWeight: 600 }}>
                  ● Cambios pendientes de guardar
                </span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-danger)', fontWeight: 600 }}>
                  ⚠ {saveError || 'Error al guardar'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,.md,.txt"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="ia-btn-secondary"
            onClick={() => importFileRef.current?.click()}
            title="Importar archivo .interaula.json, .md o .txt al editor"
          >
            Importar (.json / .md)
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            onClick={() => {
              setIsDraft(true);
              performSave(true);
            }}
          >
            Guardar Borrador
          </button>

          <button
            type="button"
            className="ia-btn-primary"
            onClick={() => {
              setIsDraft(false);
              performSave(false);
            }}
          >
            <CheckIcon size={15} color="#ffffff" />
            <span>{noteId && !isDraft ? 'Guardar Cambios' : 'Publicar Apunte'}</span>
          </button>
        </div>
      </div>

      {/* Metadatos del Apunte */}
      <div className="ia-form-grid" style={{ marginBottom: '16px' }}>
        <div className="ia-form-group full">
          <label className="ia-label" htmlFor="note-editor-title">
            Título del Apunte o Guía *
          </label>
          <input
            id="note-editor-title"
            type="text"
            className="ia-input"
            style={{ fontSize: '1.05rem', fontWeight: 700 }}
            placeholder="Ej: Resumen Completo de Normalización (1FN, 2FN, 3FN) y Álgebra Relacional"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-subject">
            Asignatura / Ramo
          </label>
          <input
            id="note-editor-subject"
            list="interaula-subjects-datalist"
            className="ia-input"
            value={subjectName}
            onChange={(e) => {
              setSubjectName(e.target.value);
              markDirty();
            }}
            placeholder="Escribe o selecciona la asignatura"
          />
          <datalist id="interaula-subjects-datalist">
            {subjectsList.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-career">
            Carrera / Área
          </label>
          <input
            id="note-editor-career"
            type="text"
            className="ia-input"
            value={career}
            onChange={(e) => {
              setCareer(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-category">
            Tipo de Material
          </label>
          <select
            id="note-editor-category"
            className="ia-select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              markDirty();
            }}
          >
            {BUSINESS_RULES.NOTES.CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-visibility">
            Visibilidad del Apunte
          </label>
          <select
            id="note-editor-visibility"
            className="ia-select"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as NoteVisibility);
              markDirty();
            }}
          >
            <option value="public">Público (Toda la comunidad)</option>
            <option value="shared">Compartido (Estudiantes autenticados)</option>
            <option value="private">Privado (Solo yo)</option>
          </select>
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-folder">
            Carpeta / Unidad
          </label>
          <input
            id="note-editor-folder"
            type="text"
            className="ia-input"
            placeholder="Ej: Certamen 1, Unidad 2, Laboratorios"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div className="ia-form-group">
          <label className="ia-label" htmlFor="note-editor-tags">
            Etiquetas (separadas por coma)
          </label>
          <input
            id="note-editor-tags"
            type="text"
            className="ia-input"
            placeholder="Ej: SQL, Normalización, Certamen 2, Ejercicios"
            value={tagsText}
            onChange={(e) => {
              setTagsText(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div className="ia-form-group full">
          <label className="ia-label" htmlFor="note-editor-summary">
            Resumen ejecutivo (visible en la tarjeta de la biblioteca)
          </label>
          <input
            id="note-editor-summary"
            type="text"
            className="ia-input"
            placeholder="Breve síntesis de los contenidos que abarca este apunte..."
            value={summary}
            maxLength={BUSINESS_RULES.NOTES.MAX_SUMMARY_LENGTH}
            onChange={(e) => {
              setSummary(e.target.value);
              markDirty();
            }}
          />
        </div>
      </div>

      {/* Barra de Herramientas de Formato Académico */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '10px 12px',
          background: 'var(--ia-bg-subtle)',
          border: '1px solid var(--ia-border)',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 700 }}
            onClick={() => execFormat('formatBlock', 'H1')}
            title="Título principal H1"
          >
            H1
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 700 }}
            onClick={() => execFormat('formatBlock', 'H2')}
            title="Subtítulo H2"
          >
            H2
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 700 }}
            onClick={() => execFormat('formatBlock', 'H3')}
            title="Sección H3"
          >
            H3
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => execFormat('formatBlock', 'P')}
            title="Párrafo normal"
          >
            P
          </button>

          <span style={{ width: '1px', height: '20px', background: 'var(--ia-border-strong)', margin: '0 4px' }} />

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 9px', fontSize: '0.8rem', fontWeight: 800 }}
            onClick={() => execFormat('bold')}
            title="Negrita (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 9px', fontSize: '0.8rem', fontStyle: 'italic' }}
            onClick={() => execFormat('italic')}
            title="Cursiva (Ctrl+I)"
          >
            I
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 9px', fontSize: '0.8rem', textDecoration: 'underline' }}
            onClick={() => execFormat('underline')}
            title="Subrayado (Ctrl+U)"
          >
            U
          </button>

          <span style={{ width: '1px', height: '20px', background: 'var(--ia-border-strong)', margin: '0 4px' }} />

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => execFormat('insertUnorderedList')}
            title="Lista con viñetas"
          >
            • Lista
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => execFormat('insertOrderedList')}
            title="Lista numerada"
          >
            1. Lista
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => execFormat('formatBlock', 'BLOCKQUOTE')}
            title="Cita o definición destacada"
          >
            ❝ Cita
          </button>

          <span style={{ width: '1px', height: '20px', background: 'var(--ia-border-strong)', margin: '0 4px' }} />

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={handleInsertCodeBlock}
            title="Insertar bloque de código"
          >
            {'</>'} Código
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => setMathPromptOpen((prev) => !prev)}
            title="Insertar fórmula o expresión matemática"
          >
            ∑ Fórmula
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={handleInsertTable}
            title="Insertar tabla académica"
          >
            ⊞ Tabla
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => setLinkPromptOpen((prev) => !prev)}
            title="Insertar enlace"
          >
            🔗 Enlace
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            onClick={() => execFormat('insertHorizontalRule')}
            title="Insertar divisor horizontal"
          >
            ― Divisor
          </button>

          <span style={{ width: '1px', height: '20px', background: 'var(--ia-border-strong)', margin: '0 4px' }} />

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('justifyLeft')}
            title="Alinear a la izquierda"
          >
            ⇤
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('justifyCenter')}
            title="Centrar texto"
          >
            ⇔
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('undo')}
            title="Deshacer (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('redo')}
            title="Rehacer (Ctrl+Y)"
          >
            ↷
          </button>
        </div>

        {/* Selector Edición vs Vista Previa */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={editorMode === 'edit' ? 'ia-btn-primary' : 'ia-btn-secondary'}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              syncEditorHtml();
              setEditorMode('edit');
            }}
          >
            Modo Edición
          </button>
          <button
            type="button"
            className={editorMode === 'preview' ? 'ia-btn-primary' : 'ia-btn-secondary'}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              syncEditorHtml();
              setEditorMode('preview');
            }}
          >
            Vista Lectura
          </button>
        </div>
      </div>

      {/* Panel auxiliar para insertar Fórmulas Matemáticas */}
      {mathPromptOpen && (
        <div
          style={{
            padding: '12px',
            background: 'var(--ia-primary-subtle)',
            border: '1px solid var(--ia-primary-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: '0.82rem', color: 'var(--ia-primary)' }}>
            Expresión Matemática / LaTeX:
          </strong>
          <input
            type="text"
            className="ia-input"
            style={{ flex: 1, minWidth: '220px', fontFamily: 'monospace' }}
            value={mathInput}
            onChange={(e) => setMathInput(e.target.value)}
            placeholder="Ej: \lim_{x \to 0} \frac{\sin(x)}{x} = 1"
          />
          <button type="button" className="ia-btn-primary" style={{ padding: '6px 12px' }} onClick={handleInsertMathFormula}>
            Insertar Fórmula
          </button>
          <button type="button" className="ia-btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setMathPromptOpen(false)}>
            Cerrar
          </button>
        </div>
      )}

      {/* Panel auxiliar para insertar Enlaces */}
      {linkPromptOpen && (
        <div
          style={{
            padding: '12px',
            background: 'var(--ia-bg-subtle)',
            border: '1px solid var(--ia-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            className="ia-input"
            style={{ width: '200px' }}
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Texto del enlace"
          />
          <input
            type="url"
            className="ia-input"
            style={{ flex: 1, minWidth: '220px' }}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
          />
          <button type="button" className="ia-btn-primary" style={{ padding: '6px 12px' }} onClick={handleInsertLink}>
            Insertar Enlace
          </button>
          <button type="button" className="ia-btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setLinkPromptOpen(false)}>
            Cerrar
          </button>
        </div>
      )}

      {/* Lienzo del Editor o Vista de Lectura */}
      {editorMode === 'edit' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            syncEditorHtml();
            markDirty();
          }}
          onKeyDown={handleKeyDown}
          aria-label="Contenido del apunte académico"
          style={{
            minHeight: '420px',
            padding: '24px',
            border: '1px solid var(--ia-border-strong)',
            borderTop: 'none',
            borderBottomLeftRadius: '10px',
            borderBottomRightRadius: '10px',
            background: 'var(--ia-bg-card)',
            color: 'var(--ia-text-main)',
            fontSize: '0.96rem',
            lineHeight: 1.7,
            outline: 'none',
            overflowY: 'auto',
          }}
        />
      ) : (
        <div
          style={{
            minHeight: '420px',
            padding: '28px 32px',
            border: '1px solid var(--ia-border)',
            borderTop: 'none',
            borderBottomLeftRadius: '10px',
            borderBottomRightRadius: '10px',
            background: 'var(--ia-bg-card)',
            color: 'var(--ia-text-main)',
            lineHeight: 1.75,
          }}
        >
          <div style={{ borderBottom: '2px solid var(--ia-border)', paddingBottom: '14px', marginBottom: '20px' }}>
            <span className="ia-badge ia-badge-blue" style={{ marginBottom: '8px' }}>
              {category} · {subjectName}
            </span>
            <h1 style={{ margin: '4px 0 6px 0', fontSize: '1.6rem', fontWeight: 800 }}>
              {title || 'Apunte Académico Sin Título'}
            </h1>
            {summary && (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ia-text-muted)' }}>
                {summary}
              </p>
            )}
          </div>
          <div
            style={{ fontSize: '0.96rem' }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      )}

      {/* Barra Inferior de Exportación y Descarga Directa */}
      <div
        style={{
          marginTop: '18px',
          paddingTop: '14px',
          borderTop: '1px solid var(--ia-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)', fontWeight: 600 }}>
          Descargar o exportar este apunte en formato estructurado:
        </span>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ia-btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToPdf(buildCurrentNoteSnapshot())}
          >
            <DownloadIcon size={14} color="#ffffff" />
            <span>Exportar PDF (.pdf)</span>
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToWordDoc(buildCurrentNoteSnapshot())}
          >
            <span>Word (.doc)</span>
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToMarkdown(buildCurrentNoteSnapshot())}
          >
            <span>Markdown (.md)</span>
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToPlainText(buildCurrentNoteSnapshot())}
          >
            <span>Texto (.txt)</span>
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToInterAulaFormat(buildCurrentNoteSnapshot())}
          >
            <span>Formato InterAula (.interaula.json)</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--ia-danger-bg)',
            border: '1px solid var(--ia-danger-border)',
            color: 'var(--ia-danger)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircleIcon size={15} />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}

