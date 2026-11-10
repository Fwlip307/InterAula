import { safeNoteHtml, escapeHtml } from '../../../utils/safeHtml';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  LayersIcon,
  BookOpenIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
} from '../../../components/common/Icons';

interface AcademicNoteEditorProps {
  initialNote?: AcademicNote | null;
  subjectsList: string[];
  onClose: () => void;
  onSaved: (note: AcademicNote) => void;
}

type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';
export type DocumentFormatMode = 'document' | 'presentation';
export type PaperSizeOption = 'carta' | 'oficio' | 'a4' | 'widescreen';
export type PageOrientationOption = 'portrait' | 'landscape';
export type MarginSizeOption = 'narrow' | 'normal' | 'wide';
export type DocFontFamilyOption = 'sans' | 'serif' | 'mono';

interface SlideItem {
  id: string;
  title: string;
  layout: 'cover' | 'bullets' | 'two_cols' | 'code' | 'summary';
  htmlContent: string;
}

const PAPER_SIZE_SPECS: Record<
  PaperSizeOption,
  {
    label: string;
    dimensionsCm: string;
    portraitWidthPx: number;
    portraitMinHeightPx: number;
    landscapeWidthPx: number;
    landscapeMinHeightPx: number;
  }
> = {
  carta: {
    label: 'Carta (US Letter)',
    dimensionsCm: '21.6 × 27.9 cm',
    portraitWidthPx: 780,
    portraitMinHeightPx: 980,
    landscapeWidthPx: 980,
    landscapeMinHeightPx: 680,
  },
  oficio: {
    label: 'Oficio / Legal Chileno',
    dimensionsCm: '21.6 × 33.0 cm',
    portraitWidthPx: 780,
    portraitMinHeightPx: 1160,
    landscapeWidthPx: 1060,
    landscapeMinHeightPx: 680,
  },
  a4: {
    label: 'A4 Estándar ISO',
    dimensionsCm: '21.0 × 29.7 cm',
    portraitWidthPx: 760,
    portraitMinHeightPx: 1040,
    landscapeWidthPx: 1000,
    landscapeMinHeightPx: 690,
  },
  widescreen: {
    label: 'Panorámico 16:9',
    dimensionsCm: '29.7 × 16.7 cm',
    portraitWidthPx: 680,
    portraitMinHeightPx: 1020,
    landscapeWidthPx: 1020,
    landscapeMinHeightPx: 574,
  },
};

const FONT_FAMILY_MAP: Record<DocFontFamilyOption, string> = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  serif: "'Georgia', 'Cambria', 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
};

const MARGIN_PADDING_MAP: Record<MarginSizeOption, string> = {
  narrow: '24px 28px',
  normal: '40px 48px',
  wide: '54px 68px',
};

const DEFAULT_TEMPLATE_HTML = `<h2>1. Objetivo del Documento / Tema</h2>
<p>Escribe aquí los conceptos fundamentales, definiciones o desarrollo del informe revisado en clases.</p>
<blockquote><strong>Concepto clave:</strong> Resume la idea central o propiedad que debes recordar para la evaluación o entrega.</blockquote>
<h2>2. Desarrollo y Análisis Práctico</h2>
<ul>
  <li>Punto clave o propiedad principal del tema</li>
  <li>Caso práctico, supuesto de entrada o restricción de diseño</li>
</ul>
<h2>3. Síntesis / Fórmulas / Código</h2>
<pre><code>// Ejemplo de implementación o consulta estructurada
SELECT id, nombre FROM estudiantes WHERE activo = true;</code></pre>`;

function buildDefaultSlides(title: string, subject: string, career: string): SlideItem[] {
  return [
    {
      id: 'slide-1',
      title: title || `Presentación de ${subject}`,
      layout: 'cover',
      htmlContent: `<div style="text-align:center; padding: 36px 20px;">
        <p style="font-size:0.85rem; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${subject} · ${career}</p>
        <h1 style="font-size:2.1rem; font-weight:800; margin:0 0 14px 0;">${title || 'Título de la Presentación Académica'}</h1>
        <p style="font-size:1.05rem; color:#475569; max-width:620px; margin:0 auto;">Exposición estructurada paso a paso · Comunidad Universitaria InterAula</p>
      </div>`,
    },
    {
      id: 'slide-2',
      title: '1. Conceptos Clave y Contexto',
      layout: 'bullets',
      htmlContent: `<h2>1. Conceptos Clave y Contexto</h2>
      <p>Puntos esenciales que abordaremos en esta sesión:</p>
      <ul>
        <li><strong>Definición base:</strong> ¿Qué problema resuelve este concepto dentro de ${subject}?</li>
        <li><strong>Supuestos de entrada:</strong> Datos y condiciones necesarias antes de aplicar la regla.</li>
        <li><strong>Aplicación directa:</strong> Cómo se conecta con casos reales de laboratorio.</li>
      </ul>`,
    },
    {
      id: 'slide-3',
      title: '2. Comparación y Caso Práctico',
      layout: 'two_cols',
      htmlContent: `<h2>2. Comparación y Caso Práctico</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:12px;">
        <div style="padding:14px; border-radius:10px; background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.2);">
          <h3 style="margin-top:0; color:#1d4ed8;">Enfoque Estructurado</h3>
          <p>Valida las entradas primero, aplica la transformación modular y comprueba la salida.</p>
        </div>
        <div style="padding:14px; border-radius:10px; background:rgba(5,150,105,0.06); border:1px solid rgba(5,150,105,0.2);">
          <h3 style="margin-top:0; color:#047857;">Resultado Verificable</h3>
          <p>Previene errores de borde y facilita el trabajo colaborativo en el equipo.</p>
        </div>
      </div>`,
    },
  ];
}

function serializeSlidesToHtml(slides: SlideItem[]): string {
  return slides
    .map(
      (s, idx) =>
        `<section data-slide-index="${idx + 1}" data-slide-layout="${s.layout}" style="margin-bottom:28px; padding-bottom:20px; border-bottom:2px dashed #cbd5e1;">${s.htmlContent}</section>`
    )
    .join('\n');
}

function extractSlidesFromNote(
  note: AcademicNote | null | undefined,
  fallbackTitle: string,
  fallbackSubject: string,
  fallbackCareer: string
): SlideItem[] {
  const jsonSlides = note?.contentJson?.slides;
  if (Array.isArray(jsonSlides) && jsonSlides.length > 0) {
    return jsonSlides;
  }
  return buildDefaultSlides(fallbackTitle, fallbackSubject, fallbackCareer);
}

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

  // Estados de Formato de Documento/Informe vs Presentación y Configuración de Página
  const initialMeta = (initialNote?.contentJson || {}) as Record<string, any>;
  const [documentFormat, setDocumentFormat] = useState<DocumentFormatMode>(
    initialMeta.documentFormat === 'presentation' ? 'presentation' : 'document'
  );
  const [pageSize, setPageSize] = useState<PaperSizeOption>(
    initialMeta.pageSize || 'carta'
  );
  const [orientation, setOrientation] = useState<PageOrientationOption>(
    initialMeta.orientation || (initialMeta.documentFormat === 'presentation' ? 'landscape' : 'portrait')
  );
  const [marginSize, setMarginSize] = useState<MarginSizeOption>(
    initialMeta.marginSize || 'normal'
  );
  const [docFontFamily, setDocFontFamily] = useState<DocFontFamilyOption>(
    initialMeta.docFontFamily || 'sans'
  );
  const [docFontSizePt, setDocFontSizePt] = useState<number>(
    Number(initialMeta.docFontSizePt) || 12
  );
  const [docLineSpacing, setDocLineSpacing] = useState<number>(
    Number(initialMeta.docLineSpacing) || 1.6
  );

  // Estados exclusivos del modo Presentación (Diapositivas)
  const [slides, setSlides] = useState<SlideItem[]>(() =>
    extractSlidesFromNote(
      initialNote,
      initialNote?.title || '',
      initialNote?.subjectName || subjectsList[0] || 'Programación de Algoritmos',
      initialNote?.career || 'Ingeniería en Informática'
    )
  );
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [draggedSlideIdx, setDraggedSlideIdx] = useState<number | null>(null);
  const [isFullscreenPresenting, setIsFullscreenPresenting] = useState<boolean>(false);

  // Estados de herramientas auxiliares del editor
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialNote ? 'saved' : 'pending');
  const [saveError, setSaveError] = useState<string>('');
  const [mathPromptOpen, setMathPromptOpen] = useState<boolean>(false);
  const [mathInput, setMathInput] = useState<string>('f(x) = \\int_{a}^{b} x^2 \\, dx');
  const [linkPromptOpen, setLinkPromptOpen] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string>('https://');
  const [linkLabel, setLinkLabel] = useState<string>('Referencia académica');
  const [tableBuilderOpen, setTableBuilderOpen] = useState<boolean>(false);
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);
  const [metadataCollapsed, setMetadataCollapsed] = useState<boolean>(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef<boolean>(false);
  const saveSequenceRef = useRef<number>(0);
  const versionRef = useRef<number>(initialNote?.version || 1);
  const noteIdRef = useRef<string | null>(initialNote?.id || null);

  // Sincronizar el lienzo editable cuando cambia el modo o la diapositiva activa
  useEffect(() => {
    if (!editorRef.current || editorMode !== 'edit') return;
    if (documentFormat === 'presentation') {
      const targetSlide = slides[activeSlideIdx] || slides[0];
      if (targetSlide && editorRef.current.innerHTML !== targetSlide.htmlContent) {
        editorRef.current.innerHTML = safeNoteHtml(targetSlide.htmlContent);
      }
    } else {
      if (editorRef.current.innerHTML !== contentHtml) {
        editorRef.current.innerHTML = safeNoteHtml(contentHtml);
      }
    }
  }, [editorMode, documentFormat, activeSlideIdx]);

  // Navegación por teclado en modo Presentación a pantalla completa
  useEffect(() => {
    if (!isFullscreenPresenting) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenPresenting(false);
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSlideIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreenPresenting, slides.length]);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setSaveStatus('pending');
    setSaveError('');
  }, []);

  const syncEditorHtml = useCallback(() => {
    if (!editorRef.current) return contentHtml;
    const current = editorRef.current.innerHTML;

    if (documentFormat === 'presentation') {
      setSlides((prev) => {
        const next = prev.map((sl, idx) =>
          idx === activeSlideIdx ? { ...sl, htmlContent: current } : sl
        );
        const combined = serializeSlidesToHtml(next);
        setContentHtml(combined);
        return next;
      });
      return current;
    }

    setContentHtml(current);
    return current;
  }, [contentHtml, documentFormat, activeSlideIdx]);

  const handleSwitchFormat = (nextFormat: DocumentFormatMode) => {
    if (nextFormat === documentFormat) return;
    syncEditorHtml();
    setDocumentFormat(nextFormat);
    if (nextFormat === 'presentation') {
      setOrientation('landscape');
      if (slides.length === 0) {
        const defaultSls = buildDefaultSlides(title, subjectName, career);
        setSlides(defaultSls);
        setActiveSlideIdx(0);
      }
    } else {
      setOrientation('portrait');
    }
    markDirty();
  };

  // Gestión de Diapositivas en modo Presentación
  const handleAddSlide = (layout: SlideItem['layout'] = 'bullets') => {
    syncEditorHtml();
    const newIndex = slides.length + 1;
    const layoutTemplates: Record<SlideItem['layout'], { title: string; html: string }> = {
      cover: {
        title: `Portada ${newIndex}`,
        html: `<div style="text-align:center; padding: 36px 20px;">
          <p style="font-size:0.85rem; font-weight:800; color:#2563eb; text-transform:uppercase;">${subjectName}</p>
          <h1 style="font-size:2rem; font-weight:800; margin:8px 0 12px;">${title || 'Título de la Sección'}</h1>
          <p style="font-size:1rem; color:#475569;">Subtítulo o idea fuerza de la diapositiva</p>
        </div>`,
      },
      bullets: {
        title: `Diapositiva ${newIndex}: Ideas Clave`,
        html: `<h2>${newIndex}. Título de la Diapositiva</h2>
        <ul>
          <li><strong>Idea principal:</strong> Explica el concepto de forma directa y visual.</li>
          <li><strong>Paso intermedio:</strong> Conecta con el ejemplo visto en clases.</li>
          <li><strong>Conclusión verificable:</strong> ¿Qué debemos recordar de este punto?</li>
        </ul>`,
      },
      two_cols: {
        title: `Diapositiva ${newIndex}: Comparativa`,
        html: `<h2>${newIndex}. Análisis en Dos Columnas</h2>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px;">
          <div style="padding:14px; border-radius:10px; background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.2);">
            <h3 style="margin-top:0;">Columna A · Concepto</h3>
            <p>Características principales, entradas y reglas.</p>
          </div>
          <div style="padding:14px; border-radius:10px; background:rgba(124,58,237,0.06); border:1px solid rgba(124,58,237,0.2);">
            <h3 style="margin-top:0;">Columna B · Aplicación</h3>
            <p>Ejemplo práctico, ventajas y casos borde.</p>
          </div>
        </div>`,
      },
      code: {
        title: `Diapositiva ${newIndex}: Código / Esquema`,
        html: `<h2>${newIndex}. Implementación y Sintaxis</h2>
        <p>Observa la estructura paso a paso:</p>
        <pre style="background:#0f172a; color:#f8fafc; padding:14px; border-radius:10px; font-family:monospace;"><code>// Bloque técnico para proyectar en clases
function resolverPasoAPaso(entrada) {
  return entrada.validar();
}</code></pre>`,
      },
      summary: {
        title: `Diapositiva ${newIndex}: Síntesis`,
        html: `<h2>${newIndex}. Resumen y Preguntas de Cierre</h2>
        <blockquote><strong>En síntesis:</strong> Dominar este tema permite estructurar soluciones limpias y verificables en ${subjectName}.</blockquote>
        <p><strong>¿Qué dudas quedan abiertas para resolver en equipo o en tutoría?</strong></p>`,
      },
    };

    const tpl = layoutTemplates[layout];
    const newSlide: SlideItem = {
      id: `slide-${Date.now()}`,
      title: tpl.title,
      layout,
      htmlContent: tpl.html,
    };

    setSlides((prev) => {
      const next = [...prev, newSlide];
      setContentHtml(serializeSlidesToHtml(next));
      return next;
    });
    setActiveSlideIdx(slides.length);
    markDirty();
  };

  const handleDuplicateSlide = (idx: number) => {
    syncEditorHtml();
    const source = slides[idx];
    if (!source) return;
    const copy: SlideItem = {
      ...source,
      id: `slide-${Date.now()}`,
      title: `${source.title} (Copia)`,
    };
    setSlides((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setContentHtml(serializeSlidesToHtml(next));
      return next;
    });
    setActiveSlideIdx(idx + 1);
    markDirty();
  };

  const handleDeleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    syncEditorHtml();
    setSlides((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setContentHtml(serializeSlidesToHtml(next));
      return next;
    });
    setActiveSlideIdx((prev) => Math.max(0, Math.min(prev, slides.length - 2)));
    markDirty();
  };

  const handleMoveSlide = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= slides.length || fromIdx === toIdx) return;
    syncEditorHtml();
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setContentHtml(serializeSlidesToHtml(next));
      return next;
    });
    setActiveSlideIdx(toIdx);
    markDirty();
  };

  const buildContentJsonPayload = useCallback(
    (currentSlides: SlideItem[]) => ({
      documentFormat,
      pageSize,
      orientation,
      marginSize,
      docFontFamily,
      docFontSizePt,
      docLineSpacing,
      slides: documentFormat === 'presentation' ? currentSlides : undefined,
    }),
    [documentFormat, pageSize, orientation, marginSize, docFontFamily, docFontSizePt, docLineSpacing]
  );

  const performSave = useCallback(
    async (overrideDraft?: boolean) => {
      let currentSlides = slides;
      let htmlToSave = contentHtml;

      if (editorRef.current) {
        const liveHtml = editorRef.current.innerHTML;
        if (documentFormat === 'presentation') {
          currentSlides = slides.map((sl, idx) =>
            idx === activeSlideIdx ? { ...sl, htmlContent: liveHtml } : sl
          );
          htmlToSave = serializeSlidesToHtml(currentSlides);
        } else {
          htmlToSave = liveHtml;
        }
      }

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
      const contentJson = buildContentJsonPayload(currentSlides);

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
            content_json: contentJson,
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
            content_json: contentJson,
            source_type: 'editor',
            tags: parsedTags,
            visibility,
            is_draft: targetDraft,
          });
        }

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
    [
      title,
      summary,
      subjectName,
      career,
      category,
      folder,
      tagsText,
      visibility,
      isDraft,
      contentHtml,
      slides,
      activeSlideIdx,
      documentFormat,
      buildContentJsonPayload,
      onSaved,
    ]
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
  }, [
    title,
    summary,
    subjectName,
    career,
    category,
    folder,
    tagsText,
    visibility,
    isDraft,
    contentHtml,
    documentFormat,
    pageSize,
    orientation,
    marginSize,
    docFontFamily,
    docFontSizePt,
    docLineSpacing,
    performSave,
  ]);

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
      document.execCommand('insertHTML', false, safeNoteHtml(snippet));
      syncEditorHtml();
      markDirty();
    }
  };

  const handleInsertCoverPage = () => {
    const todayStr = new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const coverHtml = `
      <div style="border: 2px solid #cbd5e1; border-radius: 12px; padding: 36px 28px; margin-bottom: 28px; text-align: center; background: #f8fafc;">
        <p style="margin: 0 0 6px 0; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em; color: #2563eb; text-transform: uppercase;">
          COMUNIDAD ACADÉMICA INTERAULA · ${career.toUpperCase()}
        </p>
        <p style="margin: 0 0 24px 0; font-size: 0.95rem; font-weight: 700; color: #475569;">
          Asignatura: ${subjectName} · ${category}
        </p>
        <h1 style="margin: 0 0 16px 0; font-size: 2rem; font-weight: 800; color: #0f172a;">
          ${title || 'Título del Informe o Guía Académica'}
        </h1>
        <p style="margin: 0 auto 24px auto; max-width: 560px; font-size: 0.96rem; color: #334155;">
          ${summary || 'Documento estructurado de estudio colaborativo, síntesis teórica y resolución práctica.'}
        </p>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px auto; width: 60%;" />
        <p style="margin: 0; font-size: 0.85rem; color: #64748b;">
          <strong>Fecha de edición:</strong> ${todayStr} &nbsp;|&nbsp; <strong>Unidad:</strong> ${folder}
        </p>
      </div><p><br/></p>`;
    insertHtmlSnippet(coverHtml);
  };

  const handleInsertCallout = (kind: 'concept' | 'example' | 'warning' | 'checklist') => {
    if (kind === 'checklist') {
      const checkHtml = `
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:14px 18px; margin:12px 0;">
          <strong style="display:block; margin-bottom:8px; color:#0f172a;">☑ Lista de verificación de estudio:</strong>
          <ul style="list-style:none; padding-left:4px; margin:0;">
            <li>☐ Comprender la definición e invariantes del concepto</li>
            <li>☐ Resolver el ejemplo guiado paso a paso</li>
            <li>☐ Probar un caso borde o condición límite</li>
          </ul>
        </div><p><br/></p>`;
      insertHtmlSnippet(checkHtml);
      return;
    }

    const styles = {
      concept: {
        bg: '#eff6ff',
        border: '#2563eb',
        titleColor: '#1e40af',
        title: 'Definición / Concepto Clave',
        body: 'Escribe aquí la regla fundamental o propiedad que debe recordarse con claridad.',
      },
      example: {
        bg: '#f0fdf4',
        border: '#16a34a',
        titleColor: '#166534',
        title: 'Ejemplo Práctico Aplicado',
        body: 'Describe aquí cómo se aplica este concepto en un ejercicio real o caso de laboratorio.',
      },
      warning: {
        bg: '#fffbeb',
        border: '#d97706',
        titleColor: '#92400e',
        title: 'Atención / Caso Borde Frecuente',
        body: 'Ten especial cuidado con esta condición límite o error frecuente durante el certamen.',
      },
    }[kind];

    const boxHtml = `
      <div style="background:${styles.bg}; border-left:4px solid ${styles.border}; padding:12px 16px; border-radius:8px; margin:12px 0;">
        <strong style="display:block; color:${styles.titleColor}; margin-bottom:4px;">${styles.title}:</strong>
        <span>${styles.body}</span>
      </div><p><br/></p>`;
    insertHtmlSnippet(boxHtml);
  };

  const handleInsertCustomTable = () => {
    const rCount = Math.max(1, Math.min(12, tableRows));
    const cCount = Math.max(1, Math.min(8, tableCols));

    let headerCells = '';
    for (let c = 1; c <= cCount; c++) {
      headerCells += `<th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; background: #eff6ff; font-weight: 700;">Columna ${c}</th>`;
    }

    let bodyRows = '';
    for (let r = 1; r <= rCount; r++) {
      let rowCells = '';
      for (let c = 1; c <= cCount; c++) {
        rowCells += `<td style="border: 1px solid #cbd5e1; padding: 8px 10px;">Dato ${r}.${c}</td>`;
      }
      bodyRows += `<tr>${rowCells}</tr>`;
    }

    const tableHtml = `
      <table style="width:100%; border-collapse: collapse; margin: 14px 0; border: 1px solid #cbd5e1;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table><p><br/></p>`;
    insertHtmlSnippet(tableHtml);
    setTableBuilderOpen(false);
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
        if (imported.contentJson) {
          if (imported.contentJson.documentFormat) setDocumentFormat(imported.contentJson.documentFormat);
          if (imported.contentJson.pageSize) setPageSize(imported.contentJson.pageSize);
          if (imported.contentJson.orientation) setOrientation(imported.contentJson.orientation);
          if (Array.isArray(imported.contentJson.slides)) setSlides(imported.contentJson.slides);
        }
        const nextHtml = safeNoteHtml(imported.contentHtml || `<p>${escapeHtml(imported.contentMarkdown || '')}</p>`);
        setContentHtml(nextHtml);
        if (editorRef.current) editorRef.current.innerHTML = safeNoteHtml(nextHtml);
        markDirty();
      } else {
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^.]+$/, ''));
        }
        const paragraphs = rawText
          .split(/\r?\n\r?\n/)
          .map((block) => `<p>${block.replace(/\r?\n/g, '<br/>')}</p>`)
          .join('');
        setContentHtml(paragraphs);
        if (editorRef.current) editorRef.current.innerHTML = safeNoteHtml(paragraphs);
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
    let currentHtml = editorRef.current ? editorRef.current.innerHTML : contentHtml;
    let currentSlides = slides;
    if (documentFormat === 'presentation' && editorRef.current) {
      currentSlides = slides.map((sl, idx) =>
        idx === activeSlideIdx ? { ...sl, htmlContent: editorRef.current!.innerHTML } : sl
      );
      currentHtml = serializeSlidesToHtml(currentSlides);
    }

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
      contentJson: buildContentJsonPayload(currentSlides),
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

  // Estadísticas en vivo del documento
  const liveStats = useMemo(() => {
    const rawHtml =
      documentFormat === 'presentation'
        ? slides.map((s) => s.htmlContent).join(' ')
        : contentHtml;
    const plain = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plain ? plain.split(' ').length : 0;
    const chars = plain.length;
    const readingMins = Math.max(1, Math.ceil(words / 180));
    const estimatedPages = Math.max(1, Math.ceil(words / 320));
    return { words, chars, readingMins, estimatedPages };
  }, [contentHtml, slides, documentFormat]);

  // Dimensiones visuales de la hoja según Carta / Oficio / A4 / 16:9 y Vertical / Horizontal
  const paperSpec = PAPER_SIZE_SPECS[pageSize] || PAPER_SIZE_SPECS.carta;
  const sheetMaxWidth =
    orientation === 'landscape' ? paperSpec.landscapeWidthPx : paperSpec.portraitWidthPx;
  const sheetMinHeight =
    orientation === 'landscape' ? paperSpec.landscapeMinHeightPx : paperSpec.portraitMinHeightPx;

  return (
    <div className="ia-card" style={{ padding: '24px' }}>
      {/* Modal de Presentación en Pantalla Completa */}
      {isFullscreenPresenting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Modo presentación a pantalla completa"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#090d16',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '28px 40px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ia-badge ia-badge-blue">
                Presentación InterAula · {subjectName}
              </span>
              <strong style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>
                {title || 'Exposición Académica'}
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Diapositiva {activeSlideIdx + 1} de {slides.length} (Usa ← / → o Esc)
              </span>
              <button
                type="button"
                className="ia-btn-secondary"
                onClick={() => setIsFullscreenPresenting(false)}
              >
                Salir de pantalla completa (Esc)
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '20px 0',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '1060px',
                minHeight: '560px',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '18px',
                padding: '48px 56px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
                fontFamily: FONT_FAMILY_MAP[docFontFamily],
                fontSize: `${docFontSizePt + 3}pt`,
                lineHeight: docLineSpacing,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{
                __html: safeNoteHtml(slides[activeSlideIdx]?.htmlContent || ''),
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="ia-btn-secondary"
              disabled={activeSlideIdx === 0}
              onClick={() => setActiveSlideIdx((prev) => Math.max(0, prev - 1))}
            >
              ← Diapositiva anterior
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              {slides.map((sl, idx) => (
                <button
                  key={sl.id}
                  type="button"
                  onClick={() => setActiveSlideIdx(idx)}
                  style={{
                    width: idx === activeSlideIdx ? '28px' : '10px',
                    height: '10px',
                    borderRadius: '999px',
                    border: 'none',
                    background: idx === activeSlideIdx ? '#3b82f6' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  aria-label={`Ir a diapositiva ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="ia-btn-primary"
              disabled={activeSlideIdx >= slides.length - 1}
              onClick={() => setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))}
            >
              Siguiente diapositiva →
            </button>
          </div>
        </div>
      )}

      {/* Barra superior del Estudio de Apuntes */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--ia-border)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="ia-btn-secondary" onClick={onClose}>
            <ArrowLeftIcon size={16} />
            <span>Volver a la Biblioteca</span>
          </button>

          <div>
            <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
              {noteId ? 'Estudio de Edición Académica' : 'Nuevo Documento o Presentación Académica'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {saveStatus === 'saved' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-success)', fontWeight: 600 }}>
                  ✓ Guardado automáticamente (v{version})
                </span>
              )}
              {saveStatus === 'saving' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-primary)', fontWeight: 600 }}>
                  ⟳ Guardando cambios...
                </span>
              )}
              {saveStatus === 'pending' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-amber)', fontWeight: 600 }}>
                  ● Cambios listos para guardar
                </span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ia-danger)', fontWeight: 600 }}>
                  {saveError || 'Error al guardar'}
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
            onClick={() => setMetadataCollapsed((prev) => !prev)}
          >
            {metadataCollapsed ? 'Mostrar ficha y datos' : 'Compactar ficha'}
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
            <span>{noteId && !isDraft ? 'Guardar Cambios' : 'Publicar en Biblioteca'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SELECTOR PRINCIPAL DE FORMATO (DOCUMENTO / INFORME vs PRESENTACIÓN)
          Y CONFIGURACIÓN DE HOJA (CARTA, OFICIO, A4, VERTICAL, HORIZONTAL)
         ===================================================================== */}
      <div
        style={{
          background: 'var(--ia-bg-subtle)',
          border: '1.5px solid var(--ia-border-strong)',
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* 1. Elegir entre Documento / Informe o Presentación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
              1. Tipo de Formato:
            </span>
            <button
              type="button"
              onClick={() => handleSwitchFormat('document')}
              className={documentFormat === 'document' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              style={{ padding: '7px 14px', fontSize: '0.84rem' }}
            >
              <BookOpenIcon size={15} />
              <span>Documento / Informe Académico</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchFormat('presentation')}
              className={documentFormat === 'presentation' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              style={{ padding: '7px 14px', fontSize: '0.84rem' }}
            >
              <LayersIcon size={15} />
              <span>Presentación / Diapositivas ({slides.length})</span>
            </button>
          </div>

          {/* 2. Elegir Tamaño de Hoja (Carta, Oficio, A4, 16:9) y Orientación (Vertical / Horizontal) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
              2. Formato de Hoja:
            </span>
            {(['carta', 'oficio', 'a4', 'widescreen'] as PaperSizeOption[]).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  setPageSize(sz);
                  if (sz === 'widescreen') setOrientation('landscape');
                  markDirty();
                }}
                className={pageSize === sz ? 'ia-btn-primary' : 'ia-btn-secondary'}
                style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                title={PAPER_SIZE_SPECS[sz].dimensionsCm}
              >
                {sz === 'carta'
                  ? 'Carta'
                  : sz === 'oficio'
                  ? 'Oficio'
                  : sz === 'a4'
                  ? 'A4'
                  : '16:9'}
              </button>
            ))}

            <span style={{ width: '1px', height: '20px', background: 'var(--ia-border-strong)' }} />

            <button
              type="button"
              onClick={() => {
                setOrientation('portrait');
                markDirty();
              }}
              className={orientation === 'portrait' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
            >
              ▯ Vertical
            </button>
            <button
              type="button"
              onClick={() => {
                setOrientation('landscape');
                markDirty();
              }}
              className={orientation === 'landscape' ? 'ia-btn-primary' : 'ia-btn-secondary'}
              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
            >
              ▭ Horizontal
            </button>
          </div>
        </div>

        {/* Sub-barra de Tipografía, Tamaño de fuente, Interlineado y Márgenes */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--ia-border)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span>Tipografía:</span>
              <select
                className="ia-select"
                style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
                value={docFontFamily}
                onChange={(e) => {
                  setDocFontFamily(e.target.value as DocFontFamilyOption);
                  markDirty();
                }}
              >
                <option value="sans">Inter / Sans-Serif (Moderna)</option>
                <option value="serif">Georgia / Times (Informe Formal)</option>
                <option value="mono">JetBrains / Consolas (Técnica)</option>
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span>Letra base:</span>
              <select
                className="ia-select"
                style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
                value={docFontSizePt}
                onChange={(e) => {
                  setDocFontSizePt(Number(e.target.value));
                  markDirty();
                }}
              >
                <option value={10}>10 pt (Compacto)</option>
                <option value={11}>11 pt (Estándar)</option>
                <option value={12}>12 pt (Académico APA)</option>
                <option value={14}>14 pt (Lectura amplia)</option>
                <option value={16}>16 pt (Exposición)</option>
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span>Interlineado:</span>
              <select
                className="ia-select"
                style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
                value={docLineSpacing}
                onChange={(e) => {
                  setDocLineSpacing(Number(e.target.value));
                  markDirty();
                }}
              >
                <option value={1.2}>1.2 (Simple)</option>
                <option value={1.6}>1.5 (Académico)</option>
                <option value={2.0}>2.0 (Doble APA)</option>
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span>Márgenes:</span>
              <select
                className="ia-select"
                style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
                value={marginSize}
                onChange={(e) => {
                  setMarginSize(e.target.value as MarginSizeOption);
                  markDirty();
                }}
              >
                <option value="narrow">Estrecho (1.5 cm)</option>
                <option value="normal">Normal (2.5 cm)</option>
                <option value="wide">Informe Amplio (3.2 cm)</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ia-badge ia-badge-blue">
              {PAPER_SIZE_SPECS[pageSize].label} ({PAPER_SIZE_SPECS[pageSize].dimensionsCm}) ·{' '}
              {orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
            </span>
            {documentFormat === 'presentation' && (
              <button
                type="button"
                className="ia-btn-primary"
                style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                onClick={() => {
                  syncEditorHtml();
                  setIsFullscreenPresenting(true);
                }}
              >
                <PlayIcon size={13} color="#ffffff" />
                <span>Presentar Diapositivas</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metadatos del Apunte (Colapsable para dar más espacio al editor cuando se desee) */}
      {!metadataCollapsed ? (
        <div className="ia-form-grid" style={{ marginBottom: '16px' }}>
          <div className="ia-form-group full">
            <label className="ia-label" htmlFor="note-editor-title">
              Título del {documentFormat === 'presentation' ? 'Presentación' : 'Documento / Informe'} *
            </label>
            <input
              id="note-editor-title"
              type="text"
              className="ia-input"
              style={{ fontSize: '1.05rem', fontWeight: 700 }}
              placeholder="Ej: Informe de Normalización (1FN, 2FN, 3FN) y Álgebra Relacional"
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
              placeholder="Breve síntesis de los contenidos que abarca este documento o presentación..."
              value={summary}
              maxLength={BUSINESS_RULES.NOTES.MAX_SUMMARY_LENGTH}
              onChange={(e) => {
                setSummary(e.target.value);
                markDirty();
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            className="ia-input"
            style={{ fontSize: '1.05rem', fontWeight: 800 }}
            placeholder="Título del documento o presentación *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
          />
        </div>
      )}

      {/* =====================================================================
          BARRA DE HERRAMIENTAS DE EDICIÓN AVANZADA (FORMATO + BLOQUES RÁPIDOS)
         ===================================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          background: 'var(--ia-bg-subtle)',
          border: '1px solid var(--ia-border)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}
      >
        {/* Fila 1: Estilos de texto, colores, alineación e historial */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
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

            <span style={{ width: '1px', height: '18px', background: 'var(--ia-border-strong)', margin: '0 2px' }} />

            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 800 }}
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
              Párrafo
            </button>

            <span style={{ width: '1px', height: '18px', background: 'var(--ia-border-strong)', margin: '0 2px' }} />

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
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 9px', fontSize: '0.8rem', textDecoration: 'line-through' }}
              onClick={() => execFormat('strikeThrough')}
              title="Tachado"
            >
              S
            </button>

            {/* Selector rápido de color de texto y resaltador */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '6px',
                border: '1px solid var(--ia-border)',
                background: 'var(--ia-bg-card)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Color de texto"
            >
              <span>A</span>
              <input
                type="color"
                defaultValue="#1d4ed8"
                onChange={(e) => execFormat('foreColor', e.target.value)}
                style={{ width: '18px', height: '18px', border: 'none', padding: 0, cursor: 'pointer' }}
              />
            </label>

            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#fef08a', color: '#713f12' }}
              onClick={() => execFormat('hiliteColor', '#fef08a')}
              title="Destacar texto en amarillo"
            >
              Resaltar
            </button>

            <span style={{ width: '1px', height: '18px', background: 'var(--ia-border-strong)', margin: '0 2px' }} />

            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
              onClick={() => execFormat('justifyLeft')}
              title="Alinear a la izquierda"
            >
              ⇤ Izq
            </button>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
              onClick={() => execFormat('justifyCenter')}
              title="Centrar texto"
            >
              ⇔ Centro
            </button>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
              onClick={() => execFormat('justifyRight')}
              title="Alinear a la derecha"
            >
              Der ⇥
            </button>
            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
              onClick={() => execFormat('justifyFull')}
              title="Justificar texto (estilo informe)"
            >
              ☰ Justificar
            </button>

            <button
              type="button"
              className="ia-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
              onClick={() => execFormat('removeFormat')}
              title="Limpiar formato del texto seleccionado"
            >
              Tx Limpiar
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

        {/* Fila 2: Inserción rápida de bloques académicos (Portada, Callouts, Tablas, Fórmulas, Listas) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            paddingTop: '6px',
            borderTop: '1px dashed var(--ia-border)',
          }}
        >
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ia-text-muted)' }}>
            Insertar bloque:
          </span>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 9px', fontSize: '0.76rem', fontWeight: 700 }}
            onClick={handleInsertCoverPage}
            title="Insertar portada formal universitaria con los datos del documento"
          >
            <SparklesIcon size={13} /> Portada Informe
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('insertUnorderedList')}
          >
            • Viñetas
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('insertOrderedList')}
          >
            1. Numerada
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => handleInsertCallout('checklist')}
          >
            ☑ Checklist
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => handleInsertCallout('concept')}
          >
            💡 Concepto Clave
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => handleInsertCallout('example')}
          >
            ✓ Ejemplo
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => handleInsertCallout('warning')}
          >
            ⚠ Caso Borde
          </button>

          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => setTableBuilderOpen((prev) => !prev)}
          >
            ⊞ Tabla ({tableRows}×{tableCols})
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={handleInsertCodeBlock}
          >
            {'</>'} Código
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => setMathPromptOpen((prev) => !prev)}
          >
            ∑ Fórmula
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => setLinkPromptOpen((prev) => !prev)}
          >
            Enlace
          </button>
          <button
            type="button"
            className="ia-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
            onClick={() => execFormat('insertHorizontalRule')}
          >
            ― Divisor
          </button>
        </div>
      </div>

      {/* Constructor rápido de Tablas a medida */}
      {tableBuilderOpen && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--ia-bg-subtle)',
            border: '1px solid var(--ia-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: '0.82rem' }}>Configurar Tabla Académica:</strong>
          <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Filas:
            <input
              type="number"
              min={1}
              max={12}
              value={tableRows}
              onChange={(e) => setTableRows(Number(e.target.value) || 3)}
              className="ia-input"
              style={{ width: '64px', padding: '4px 8px' }}
            />
          </label>
          <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Columnas:
            <input
              type="number"
              min={1}
              max={8}
              value={tableCols}
              onChange={(e) => setTableCols(Number(e.target.value) || 3)}
              className="ia-input"
              style={{ width: '64px', padding: '4px 8px' }}
            />
          </label>
          <button type="button" className="ia-btn-primary" style={{ padding: '5px 12px', fontSize: '0.8rem' }} onClick={handleInsertCustomTable}>
            Insertar Tabla {tableRows}×{tableCols}
          </button>
          <button type="button" className="ia-btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => setTableBuilderOpen(false)}>
            Cerrar
          </button>
        </div>
      )}

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

      {/* =====================================================================
          ESCRITORIO DE TRABAJO: MODO DOCUMENTO/INFORME vs MODO PRESENTACIÓN
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            documentFormat === 'presentation' ? '270px minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: '16px',
          background: 'var(--ia-bg-body)',
          border: '1px solid var(--ia-border-strong)',
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          padding: '20px',
          overflowX: 'auto',
        }}
      >
        {/* Barra lateral de Diapositivas cuando está activo el formato Presentación */}
        {documentFormat === 'presentation' && (
          <aside
            style={{
              background: 'var(--ia-bg-card)',
              border: '1px solid var(--ia-border)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignSelf: 'start',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.84rem', color: 'var(--ia-text-main)' }}>
                Diapositivas ({slides.length})
              </strong>
              <button
                type="button"
                className="ia-btn-primary"
                style={{ padding: '4px 9px', fontSize: '0.75rem' }}
                onClick={() => handleAddSlide('bullets')}
              >
                <PlusIcon size={13} color="#ffffff" /> Nueva
              </button>
            </div>

            {/* Plantillas rápidas de nueva diapositiva */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ia-btn-secondary"
                style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                onClick={() => handleAddSlide('cover')}
              >
                + Portada
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                onClick={() => handleAddSlide('two_cols')}
              >
                + 2 Columnas
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                onClick={() => handleAddSlide('code')}
              >
                + Código
              </button>
              <button
                type="button"
                className="ia-btn-secondary"
                style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                onClick={() => handleAddSlide('summary')}
              >
                + Cierre
              </button>
            </div>

            {/* Lista arrastrable de diapositivas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
              {slides.map((sl, idx) => {
                const isCurrent = idx === activeSlideIdx;
                return (
                  <div
                    key={sl.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedSlideIdx(idx);
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from =
                        draggedSlideIdx !== null
                          ? draggedSlideIdx
                          : Number(e.dataTransfer.getData('text/plain'));
                      if (!Number.isNaN(from)) {
                        handleMoveSlide(from, idx);
                      }
                      setDraggedSlideIdx(null);
                    }}
                    onClick={() => {
                      syncEditorHtml();
                      setActiveSlideIdx(idx);
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: `2px solid ${isCurrent ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
                      background: isCurrent ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ia-primary)' }}>
                        ⋮⋮ #{idx + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="ia-btn-secondary"
                          style={{ padding: '1px 5px', fontSize: '0.68rem', minHeight: '22px' }}
                          disabled={idx === 0}
                          onClick={() => handleMoveSlide(idx, idx - 1)}
                          title="Subir diapositiva"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ia-btn-secondary"
                          style={{ padding: '1px 5px', fontSize: '0.68rem', minHeight: '22px' }}
                          disabled={idx === slides.length - 1}
                          onClick={() => handleMoveSlide(idx, idx + 1)}
                          title="Bajar diapositiva"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ia-btn-secondary"
                          style={{ padding: '1px 5px', fontSize: '0.68rem', minHeight: '22px' }}
                          onClick={() => handleDuplicateSlide(idx)}
                          title="Duplicar diapositiva"
                        >
                          ⧉
                        </button>
                        {slides.length > 1 && (
                          <button
                            type="button"
                            className="ia-btn-secondary"
                            style={{ padding: '1px 5px', fontSize: '0.68rem', minHeight: '22px', color: 'var(--ia-danger)' }}
                            onClick={() => handleDeleteSlide(idx)}
                            title="Eliminar diapositiva"
                          >
                            <TrashIcon size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--ia-text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sl.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Contenedor de la Hoja Dimensionada (Carta / Oficio / A4 / 16:9, Vertical u Horizontal) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Regla superior visual de la hoja */}
          <div
            style={{
              width: '100%',
              maxWidth: `${sheetMaxWidth}px`,
              background: 'var(--ia-bg-subtle)',
              border: '1px solid var(--ia-border)',
              borderBottom: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              padding: '4px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.7rem',
              color: 'var(--ia-text-muted)',
              fontFamily: 'monospace',
            }}
          >
            <span>
              {documentFormat === 'presentation'
                ? `DIAPOSITIVA ${activeSlideIdx + 1} DE ${slides.length}`
                : `HOJA ${pageSize.toUpperCase()} (${PAPER_SIZE_SPECS[pageSize].dimensionsCm})`}
            </span>
            <span>0 cm &nbsp; · &nbsp; 5 cm &nbsp; · &nbsp; 10 cm &nbsp; · &nbsp; 15 cm &nbsp; · &nbsp; 20 cm</span>
            <span>{orientation === 'landscape' ? 'HORIZONTAL' : 'VERTICAL'}</span>
          </div>

          {editorMode === 'edit' ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onPaste={(event) => {
                const html = event.clipboardData.getData('text/html');
                if (html) {
                  event.preventDefault();
                  insertHtmlSnippet(html);
                }
              }}
              onInput={() => {
                syncEditorHtml();
                markDirty();
              }}
              onKeyDown={handleKeyDown}
              aria-label="Lienzo de edición del documento o presentación"
              style={{
                width: '100%',
                maxWidth: `${sheetMaxWidth}px`,
                minHeight: `${documentFormat === 'presentation' ? Math.min(540, sheetMinHeight) : sheetMinHeight}px`,
                padding: MARGIN_PADDING_MAP[marginSize],
                border: '1px solid var(--ia-border-strong)',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                background: 'var(--ia-bg-card)',
                color: 'var(--ia-text-main)',
                fontFamily: FONT_FAMILY_MAP[docFontFamily],
                fontSize: `${docFontSizePt}pt`,
                lineHeight: docLineSpacing,
                boxShadow: '0 8px 28px rgba(15, 23, 42, 0.08)',
                outline: 'none',
                overflowY: 'auto',
                transition: 'max-width 0.2s ease, min-height 0.2s ease, padding 0.2s ease',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: `${sheetMaxWidth}px`,
                minHeight: `${documentFormat === 'presentation' ? Math.min(540, sheetMinHeight) : sheetMinHeight}px`,
                padding: MARGIN_PADDING_MAP[marginSize],
                border: '1px solid var(--ia-border)',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                background: 'var(--ia-bg-card)',
                color: 'var(--ia-text-main)',
                fontFamily: FONT_FAMILY_MAP[docFontFamily],
                fontSize: `${docFontSizePt}pt`,
                lineHeight: docLineSpacing,
                boxShadow: '0 8px 28px rgba(15, 23, 42, 0.08)',
              }}
            >
              <div style={{ borderBottom: '2px solid var(--ia-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                <span className="ia-badge ia-badge-blue" style={{ marginBottom: '8px' }}>
                  {documentFormat === 'presentation' ? 'Presentación' : category} · {subjectName} ({pageSize.toUpperCase()} {orientation === 'landscape' ? 'Horizontal' : 'Vertical'})
                </span>
                <h1 style={{ margin: '4px 0 6px 0', fontSize: '1.6rem', fontWeight: 800 }}>
                  {title || 'Documento Académico Sin Título'}
                </h1>
                {summary && (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ia-text-muted)' }}>
                    {summary}
                  </p>
                )}
              </div>
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    safeNoteHtml(documentFormat === 'presentation'
                      ? serializeSlidesToHtml(slides)
                      : contentHtml),
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Barra Inferior de Estadísticas en Vivo y Exportación Multi-Formato */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--ia-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--ia-text-muted)' }}>
          <span>
            <strong>{liveStats.words}</strong> palabras
          </span>
          <span>·</span>
          <span>
            <strong>{liveStats.chars}</strong> caracteres
          </span>
          <span>·</span>
          <span>
            {documentFormat === 'presentation' ? (
              <>
                <strong>{slides.length}</strong> diapositivas
              </>
            ) : (
              <>
                ~<strong>{liveStats.estimatedPages}</strong> pág. ({pageSize.toUpperCase()}{' '}
                {orientation === 'landscape' ? 'Horizontal' : 'Vertical'})
              </>
            )}
          </span>
          <span>·</span>
          <span>Lectura: ~{liveStats.readingMins} min</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ia-btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => exportNoteToPdf(buildCurrentNoteSnapshot())}
          >
            <DownloadIcon size={14} color="#ffffff" />
            <span>
              Exportar PDF ({pageSize.toUpperCase()} {orientation === 'landscape' ? 'Horiz.' : 'Vert.'})
            </span>
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
