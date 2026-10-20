import React, { useState } from 'react';
import {
  BookOpenIcon,
  PlusIcon,
  DownloadIcon,
  XIcon,
} from '../../../components/common/Icons';

export interface TutorUploadedMaterial {
  id: string;
  title: string;
  subjectName: string;
  format: 'png' | 'word' | 'pdf' | 'text';
  fileName?: string;
  textContent?: string;
  uploadedAt: string;
}

interface TutorMaterialsSectionProps {
  materials: TutorUploadedMaterial[];
  onUploadMaterial: (data: {
    title: string;
    subjectName: string;
    format: 'png' | 'word' | 'pdf' | 'text';
    fileName?: string;
    textContent?: string;
  }) => void;
  onDeleteMaterial: (id: string) => void;
  onDownload: (title: string) => void;
}

export default function TutorMaterialsSection({
  materials,
  onUploadMaterial,
  onDeleteMaterial,
  onDownload,
}: TutorMaterialsSectionProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [matTitle, setMatTitle] = useState('');
  const [matSubject, setMatSubject] = useState('');
  const [matFormat, setMatFormat] = useState<'png' | 'word' | 'pdf' | 'text'>('word');
  const [matFileName, setMatFileName] = useState('');
  const [matTextContent, setMatTextContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim()) return;

    onUploadMaterial({
      title: matTitle.trim(),
      subjectName: matSubject.trim() || 'General',
      format: matFormat,
      fileName: matFileName.trim() || undefined,
      textContent: matTextContent.trim() || undefined,
    });

    setMatTitle('');
    setMatSubject('');
    setMatFileName('');
    setMatTextContent('');
    setIsUploadModalOpen(false);
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Material de Estudio Publicado por Ti
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0' }}>
            Comparte guías de ejercicios, resúmenes en Word o diagramas en imagen PNG con los estudiantes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="ia-btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '0.86rem',
            fontWeight: 700,
            background: '#d97706',
            borderColor: '#b45309',
          }}
        >
          <PlusIcon size={16} color="#ffffff" />
          <span>Publicar Nuevo Material</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {materials.map((mat) => (
          <div
            key={mat.id}
            className="ia-card"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    background:
                      mat.format === 'word'
                        ? '#dbeafe'
                        : mat.format === 'png'
                        ? '#dcfce7'
                        : mat.format === 'pdf'
                        ? '#fee2e2'
                        : '#f1f5f9',
                    color:
                      mat.format === 'word'
                        ? '#1e40af'
                        : mat.format === 'png'
                        ? '#166534'
                        : mat.format === 'pdf'
                        ? '#991b1b'
                        : '#334155',
                  }}
                >
                  {mat.format === 'word'
                    ? 'Documento Word'
                    : mat.format === 'png'
                    ? 'Imagen PNG'
                    : mat.format === 'pdf'
                    ? 'Archivo PDF'
                    : 'Nota de Texto'}
                </span>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{mat.uploadedAt}</span>
              </div>

              <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                {mat.title}
              </h3>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginBottom: '8px' }}>
                {mat.subjectName}
              </div>

              {mat.fileName && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpenIcon size={14} color="#64748b" />
                  <span>{mat.fileName}</span>
                </div>
              )}

              {mat.textContent && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#475569',
                    marginTop: '8px',
                    maxHeight: '80px',
                    overflow: 'hidden',
                  }}
                >
                  {mat.textContent}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => onDownload(mat.title)}
                className="ia-btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <DownloadIcon size={14} /> Descargar
              </button>
              <button
                type="button"
                onClick={() => onDeleteMaterial(mat.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para Subir Nuevo Apunte del Tutor */}
      {isUploadModalOpen && (
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
              maxWidth: '540px',
              width: '100%',
              padding: '26px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Subir Apunte o Material para Estudiantes
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Título del material / apunte *
                </label>
                <input
                  type="text"
                  required
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="ej: Guía de Ejercicios Resueltos de POO"
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

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Asignatura relacionada
                </label>
                <input
                  type="text"
                  value={matSubject}
                  onChange={(e) => setMatSubject(e.target.value)}
                  placeholder="ej: Programación de Algoritmos, Bases de Datos..."
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

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Formato del recurso *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMatFormat('word')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: matFormat === 'word' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: matFormat === 'word' ? '#eff6ff' : '#ffffff',
                      color: matFormat === 'word' ? '#1d4ed8' : '#475569',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    📄 Documento Word (.docx)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatFormat('png')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: matFormat === 'png' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: matFormat === 'png' ? '#f0fdf4' : '#ffffff',
                      color: matFormat === 'png' ? '#15803d' : '#475569',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🖼️ Imagen PNG / Captura
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatFormat('pdf')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: matFormat === 'pdf' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: matFormat === 'pdf' ? '#fef2f2' : '#ffffff',
                      color: matFormat === 'pdf' ? '#b91c1c' : '#475569',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    📑 Archivo PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatFormat('text')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: matFormat === 'text' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: matFormat === 'text' ? '#faf5ff' : '#ffffff',
                      color: matFormat === 'text' ? '#6d28d9' : '#475569',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✍️ Notas de Texto Directo
                  </button>
                </div>
              </div>

              {matFormat !== 'text' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Seleccionar Archivo ({matFormat === 'word' ? '.docx, .doc' : matFormat === 'png' ? '.png, .jpg' : '.pdf'})
                  </label>
                  <input
                    type="file"
                    accept={matFormat === 'word' ? '.docx,.doc' : matFormat === 'png' ? '.png,.jpg,.jpeg' : '.pdf'}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setMatFileName(e.target.files[0].name);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                    }}
                  />
                  {matFileName && (
                    <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
                      ✓ Archivo seleccionado: {matFileName}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Contenido escrito del apunte
                  </label>
                  <textarea
                    rows={4}
                    value={matTextContent}
                    onChange={(e) => setMatTextContent(e.target.value)}
                    placeholder="Escribe aquí las fórmulas, definiciones o explicaciones que deseas compartir..."
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
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.88rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ia-btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.88rem', background: '#d97706', borderColor: '#b45309' }}
                >
                  Guardar y Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
