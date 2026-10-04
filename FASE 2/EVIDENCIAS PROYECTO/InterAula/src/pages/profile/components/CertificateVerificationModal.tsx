import React, { useState } from 'react';
import type { TutorVerificationRequest } from '../../../types/verification';
import { verificationService } from '../../../services/verification.service';
import { processCertificatePdf, validatePdfFile } from '../../../utils/pdfExtractor';
import {
  XIcon,
  CheckIcon,
  AlertCircleIcon,
  FileTextIcon,
  UploadCloudIcon,
  LoaderIcon,
  ShieldCheckIcon,
  ExternalLinkIcon,
  ClockIcon,
} from '../../../components/common/Icons';

interface CertificateVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  subjectName: string;
  existingRequest?: TutorVerificationRequest | null;
  onSuccess: (updatedRequest: TutorVerificationRequest) => void;
}

type ProcessStep = 'idle' | 'extracting' | 'uploading' | 'saving' | 'done';

export default function CertificateVerificationModal({
  isOpen,
  onClose,
  subjectId,
  subjectName,
  existingRequest,
  onSuccess,
}: CertificateVerificationModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processStep, setProcessStep] = useState<ProcessStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentRequest, setCurrentRequest] = useState<TutorVerificationRequest | null>(
    existingRequest || null
  );
  const [isUploadingNew, setIsUploadingNew] = useState(!existingRequest?.document_path);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);
  const [showAllExtractedSubjects, setShowAllExtractedSubjects] = useState(false);

  // Obtener enlace seguro para visualizar el documento privado
  const handleLoadSignedUrl = async (path: string) => {
    try {
      setLoadingSignedUrl(true);
      const url = await verificationService.getDocumentSignedUrl(path);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMessage('No fue posible generar el enlace seguro para este documento.');
      }
    } catch (err: any) {
      console.error('[CertificateVerificationModal] Error al obtener URL firmada:', err);
      setErrorMessage(err.message || 'Error al acceder al documento');
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Archivo no válido');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleProcessAndUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Por favor selecciona un archivo PDF');
      return;
    }

    setErrorMessage('');

    try {
      // 1. Asegurar o crear la solicitud de verificación en tutor_verification_requests
      let req = currentRequest;
      if (!req) {
        req = await verificationService.createVerificationRequest({ subject_id: subjectId });
        setCurrentRequest(req);
      }

      // 2. Extracción y cruce local en el navegador con pdfjs-dist
      setProcessStep('extracting');
      const processResult = await processCertificatePdf(selectedFile, subjectName);

      if (processResult.validationError || !processResult.extractedData) {
        throw new Error(processResult.validationError || 'No fue posible extraer la información del documento');
      }

      // 3. Subida al bucket privado 'verification-documents'
      setProcessStep('uploading');
      const uploadRes = await verificationService.uploadCertificateDocument(req.id, selectedFile);

      // 4. Persistir datos estructurados y cruce preliminar en tutor_verification_requests
      setProcessStep('saving');
      const updatedReq = await verificationService.saveCertificateExtraction(req.id, {
        document_path: uploadRes.document_path,
        document_filename: uploadRes.document_filename,
        document_size_bytes: uploadRes.document_size_bytes,
        document_extraction_status: processResult.extractionStatus || 'completed',
        document_extracted_data: processResult.extractedData,
        matched_subject_name: processResult.matchedSubjectName,
        matched_grade: processResult.matchedGrade,
        matched_status: processResult.matchedStatus,
        calculated_level: processResult.calculatedLevel,
      });

      setProcessStep('done');
      setCurrentRequest(updatedReq);
      setIsUploadingNew(false);
      onSuccess(updatedReq);
    } catch (err: any) {
      console.error('[CertificateVerificationModal] Error procesando certificado:', err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al procesar el certificado PDF.');
      setProcessStep('idle');
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getMatchStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'found':
        return (
          <span className="ia-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
            <CheckIcon size={12} color="#059669" /> Encontrada
          </span>
        );
      case 'manual_review_required':
        return (
          <span className="ia-badge ia-badge-amber">
            <AlertCircleIcon size={12} color="#d97706" /> Requiere revisión
          </span>
        );
      case 'grade_below_min':
        return (
          <span className="ia-badge ia-badge-amber">
            <AlertCircleIcon size={12} color="#d97706" /> Nota bajo el umbral
          </span>
        );
      case 'not_found':
        return (
          <span className="ia-badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            <AlertCircleIcon size={12} color="#dc2626" /> No detectada
          </span>
        );
      default:
        return (
          <span className="ia-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
            Pendiente
          </span>
        );
    }
  };

  const isProcessing = processStep !== 'idle' && processStep !== 'done';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '16px',
        overflowY: 'auto',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '680px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Verificación Académica con Certificado PDF
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '3px 0 0 0' }}>
              Asignatura a verificar: <strong style={{ color: '#1e293b' }}>{subjectName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              background: 'none',
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar modal"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {errorMessage && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircleIcon size={18} color="#b91c1c" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VISTA 1: Documento y Datos ya Extraídos */}
          {currentRequest?.document_path && !isUploadingNew ? (
            <div>
              {/* Tarjeta de Resumen del Documento */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileTextIcon size={22} color="#2563eb" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                        {currentRequest.document_filename || 'Certificado Académico.pdf'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {formatBytes(currentRequest.document_size_bytes)} • Almacenado en bucket privado seguro
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => handleLoadSignedUrl(currentRequest.document_path!)}
                    disabled={loadingSignedUrl}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <ExternalLinkIcon size={14} />
                    {loadingSignedUrl ? 'Generando visor...' : 'Ver documento'}
                  </button>
                </div>
              </div>

              {/* Resultado del Cruce con la Asignatura Solicitada */}
              <div
                style={{
                  background: currentRequest.matched_grade ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${currentRequest.matched_grade ? '#bbf7d0' : '#fde68a'}`,
                  borderRadius: '12px',
                  padding: '18px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                    Cruce Preliminar con Asignatura
                  </span>
                  {getMatchStatusBadge(currentRequest.matched_status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '2px' }}>Asignatura:</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                      {currentRequest.matched_subject_name || 'No identificada'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '2px' }}>Nota obtenida:</div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: currentRequest.matched_grade ? '#15803d' : '#64748b' }}>
                      {currentRequest.matched_grade !== null && currentRequest.matched_grade !== undefined
                        ? currentRequest.matched_grade.toFixed(1)
                        : 'Sin nota'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>Nivel calculado:</div>
                    {(() => {
                      const level = currentRequest.calculated_level;
                      if (level === 'basic') {
                        return (
                          <span className="ia-badge ia-badge-blue" style={{ fontWeight: 700 }}>
                            Básico
                          </span>
                        );
                      }
                      if (level === 'intermediate') {
                        return (
                          <span className="ia-badge" style={{ background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc', fontWeight: 700 }}>
                            Intermedio
                          </span>
                        );
                      }
                      if (level === 'advanced') {
                        return (
                          <span className="ia-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                            Avanzado
                          </span>
                        );
                      }
                      return (
                        <span className="ia-badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                          Sin nivel (&lt; 5.5)
                        </span>
                      );
                    })()}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>Estado del cruce:</div>
                    {getMatchStatusBadge(currentRequest.matched_status)}
                  </div>
                </div>
              </div>

              {/* Datos Estructurados del Alumno Extraídos */}
              {currentRequest.document_extracted_data && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '18px',
                  }}
                >
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', margin: '0 0 12px 0' }}>
                    Datos Estructurados Extraídos del Certificado
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.84rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Nombre del Alumno:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {currentRequest.document_extracted_data.student_name || 'No detectado'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Carrera / Programa:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {currentRequest.document_extracted_data.program || 'No detectado'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Código / Folio Certificado:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {currentRequest.document_extracted_data.certificate_id || 'No detectado'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Materias Extraídas:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {currentRequest.document_extracted_data.subjects?.length || 0} registradas
                      </strong>
                    </div>
                  </div>

                  {/* Tabla Colapsable de Materias Extraídas */}
                  {currentRequest.document_extracted_data.subjects && currentRequest.document_extracted_data.subjects.length > 0 && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAllExtractedSubjects(!showAllExtractedSubjects)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '0.8rem',
                          color: '#2563eb',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {showAllExtractedSubjects
                          ? 'Ocultar listado completo de asignaturas extraídas'
                          : `Ver todas las asignaturas extraídas (${currentRequest.document_extracted_data.subjects.length})`}
                      </button>

                      {showAllExtractedSubjects && (
                        <div style={{ marginTop: '10px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '6px 10px', color: '#64748b' }}>Código</th>
                                <th style={{ padding: '6px 10px', color: '#64748b' }}>Asignatura</th>
                                <th style={{ padding: '6px 10px', color: '#64748b' }}>Nota</th>
                                <th style={{ padding: '6px 10px', color: '#64748b' }}>Periodo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentRequest.document_extracted_data.subjects.map((s, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#475569' }}>{s.code || '-'}</td>
                                  <td style={{ padding: '6px 10px', color: '#1e293b' }}>{s.name}</td>
                                  <td style={{ padding: '6px 10px', fontWeight: 700, color: s.grade ? '#15803d' : '#64748b' }}>
                                    {s.grade !== null ? s.grade.toFixed(1) : '-'}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#64748b' }}>
                                    {s.semester ? `Sem ${s.semester}` : ''} {s.year || ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Aviso Institucional y Estado del Flujo */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  marginBottom: '18px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <ClockIcon size={18} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Aviso institucional:</strong> La extracción de datos se procesó localmente para apoyar el registro académico.
                  Este proceso no valida la autenticidad del certificado ni otorga aprobación automática. Tu postulación será revisada por la coordinación docente.
                </div>
              </div>

              {/* Botón para Reemplazar Certificado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="ia-btn-secondary"
                  onClick={() => setIsUploadingNew(true)}
                  style={{ fontSize: '0.82rem' }}
                >
                  <UploadCloudIcon size={15} />
                  Subir otro certificado
                </button>

                <button
                  type="button"
                  className="ia-btn-primary"
                  onClick={onClose}
                  style={{ fontSize: '0.85rem' }}
                >
                  Listo
                </button>
              </div>
            </div>
          ) : (
            /* VISTA 2: Carga y Procesamiento de Certificado */
            <div>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
                Adjunta tu <strong>Certificado de Concentración de Notas</strong> oficial emitido por tu institución de educación superior (formato PDF).
                El sistema extraerá tus datos y cruzará la nota de <strong>{subjectName}</strong> de manera local en tu navegador antes de enviarlo al repositorio seguro.
              </p>

              {/* Zona de Drop / Input de Archivo */}
              <div
                style={{
                  border: `2px dashed ${selectedFile ? '#2563eb' : '#cbd5e1'}`,
                  background: selectedFile ? '#eff6ff' : '#f8fafc',
                  borderRadius: '12px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: '16px',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                  id="certificate-pdf-input"
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: selectedFile ? '#dbeafe' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selectedFile ? '#2563eb' : '#64748b',
                    }}
                  >
                    <UploadCloudIcon size={24} color={selectedFile ? '#2563eb' : '#64748b'} />
                  </div>

                  {selectedFile ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {formatBytes(selectedFile.size)} • PDF listo para procesar
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        Haz clic aquí o arrastra tu certificado PDF
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Documentos PDF hasta 10 MB
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Indicador de Pasos del Proceso */}
              {isProcessing && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ animation: 'spin 1s linear infinite' }}>
                      <LoaderIcon size={18} color="#2563eb" />
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                      {processStep === 'extracting' && 'Paso 1: Extrayendo texto del PDF localmente y buscando asignatura...'}
                      {processStep === 'uploading' && 'Paso 2: Guardando PDF en almacenamiento seguro...'}
                      {processStep === 'saving' && 'Paso 3: Registrando información estructurada en tu solicitud...'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    La extracción se ejecuta en tu navegador para proteger tu privacidad.
                  </p>
                </div>
              )}

              {/* Nota de Privacidad y Alcance */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <ShieldCheckIcon size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Privacidad:</strong> Tu certificado se almacena en un repositorio privado accesible únicamente por ti y por el equipo de coordinación docente de InterAula. Nunca se expondrá públicamente.
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                {currentRequest?.document_path && (
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => setIsUploadingNew(false)}
                    disabled={isProcessing}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Volver a documento actual
                  </button>
                )}
                <button
                  type="button"
                  className="ia-btn-secondary"
                  onClick={onClose}
                  disabled={isProcessing}
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ia-btn-primary"
                  onClick={handleProcessAndUpload}
                  disabled={!selectedFile || isProcessing}
                  style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <UploadCloudIcon size={16} color="#ffffff" />
                  {isProcessing ? 'Procesando certificado...' : 'Procesar y guardar certificado'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
