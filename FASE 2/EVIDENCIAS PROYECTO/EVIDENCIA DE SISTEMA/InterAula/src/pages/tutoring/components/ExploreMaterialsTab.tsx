import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, DownloadIcon, PlusIcon } from '../../../components/common/Icons';
import { notesService, type AcademicNote } from '../../../services/notes.service';
import { exportNoteToPdf } from '../../../utils/noteExporter';
import type { Subject } from '../../../types/profile';

interface ExploreMaterialsTabProps {
  searchTerm: string;
  selectedSubjectId: string;
  subjects: Subject[];
  onDownload: (title: string) => void;
}

export default function ExploreMaterialsTab({
  searchTerm,
  selectedSubjectId,
  subjects,
  onDownload,
}: ExploreMaterialsTabProps) {
  const [notes, setNotes] = useState<AcademicNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const selectedSubjectObj = subjects.find((s) => s.id === selectedSubjectId);
    notesService
      .getNotes({
        search: searchTerm,
        subject_name: selectedSubjectObj ? selectedSubjectObj.name : undefined,
      })
      .then((data) => {
        if (active) setNotes(data.filter((n) => !n.isDraft));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchTerm, selectedSubjectId, subjects]);

  const handleRealDownload = async (note: AcademicNote) => {
    await notesService.registerDownload(note.id);
    if (note.sourceType === 'upload' && note.fileUrl) {
      const a = document.createElement('a');
      a.href = note.fileUrl;
      a.download = note.fileName || note.title;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      exportNoteToPdf(note);
    }
    onDownload(note.title);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--ia-text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <BookOpenIcon size={20} color="var(--ia-success)" />
            Banco de Apuntes y Recursos de Estudio
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--ia-text-muted)' }}>
            Apuntes creados con el Editor Académico Integrado y documentos subidos por tutores y estudiantes.
          </span>
        </div>

        <Link to="/resources" className="ia-btn-primary">
          <PlusIcon size={15} color="#ffffff" />
          <span>Ir a Biblioteca y Editor Completo</span>
        </Link>
      </div>

      {loading ? (
        <div className="ia-card" style={{ textAlign: 'center', padding: '28px' }}>
          <p style={{ margin: 0, color: 'var(--ia-text-muted)' }}>Cargando apuntes de la comunidad...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="ia-empty-box">
          <div className="ia-empty-icon">
            <BookOpenIcon size={20} />
          </div>
          <p className="ia-empty-title">Todavía no hay apuntes publicados en esta asignatura</p>
          <p className="ia-empty-desc">
            Crea el primer apunte usando nuestro Editor Académico Integrado o sube tus guías en PDF, DOCX o Markdown.
          </p>
          <Link to="/resources" className="ia-btn-primary">
            <PlusIcon size={15} color="#ffffff" />
            <span>Crear o Subir Apunte en la Biblioteca</span>
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '18px',
          }}
        >
          {notes.map((note) => (
            <div
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="ia-badge ia-badge-blue">{note.category}</span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--ia-text-muted)' }}>
                    📁 {note.folder}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ia-text-main)', margin: '0 0 4px 0' }}>
                  {note.title}
                </h3>

                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ia-primary)', marginBottom: '8px' }}>
                  {note.subjectName}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--ia-text-body)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                  {note.summary || 'Apunte estructurado disponible para lectura y descarga directa.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginBottom: '10px' }}>
                  <span>Por <strong>{note.authorName}</strong></span>
                  <span>⬇ {note.downloadsCount} descargas</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to="/resources" className="ia-btn-secondary" style={{ flex: 1 }}>
                    Abrir en Biblioteca
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRealDownload(note)}
                    className="ia-btn-primary"
                    style={{ flex: 1 }}
                  >
                    <DownloadIcon size={15} color="#ffffff" />
                    <span>Descargar PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
