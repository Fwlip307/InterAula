import React, { useState, useEffect } from 'react';
import {
  XIcon,
  CheckIcon,
  AlertCircleIcon,
  MailIcon,
  AwardIcon,
  SendIcon,
} from '../../../components/common/Icons';

interface TeacherEndorsementModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSubjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  userInstitution?: string;
  userName?: string;
  onSuccess?: (data: { professorName: string; professorEmail: string; subjectName: string }) => void;
}

export default function TeacherEndorsementModal({
  isOpen,
  onClose,
  availableSubjects,
  defaultSubjectId,
  userInstitution,
  userName,
  onSuccess,
}: TeacherEndorsementModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    defaultSubjectId || availableSubjects[0]?.id || ''
  );

  useEffect(() => {
    if (isOpen) {
      if (defaultSubjectId && availableSubjects.some((s) => s.id === defaultSubjectId)) {
        setSelectedSubjectId(defaultSubjectId);
      } else if (availableSubjects.length > 0 && (!selectedSubjectId || !availableSubjects.some((s) => s.id === selectedSubjectId))) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    }
  }, [isOpen, defaultSubjectId, availableSubjects]);
  const [professorName, setProfessorName] = useState('');
  const [professorEmail, setProfessorEmail] = useState('');
  const [institutionName, setInstitutionName] = useState(userInstitution || '');
  const [customMessage, setCustomMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const activeSubject = availableSubjects.find((s) => s.id === selectedSubjectId) || availableSubjects[0];
  const subjectName = activeSubject?.name || 'Materia';

  const validateInstitutionalEmail = (email: string): boolean => {
    const trimmed = email.trim().toLowerCase();
    const disallowedDomains = [
      'gmail.com',
      'yahoo.com',
      'yahoo.es',
      'hotmail.com',
      'hotmail.es',
      'outlook.com',
      'live.com',
      'icloud.com',
    ];

    const atIndex = trimmed.indexOf('@');
    if (atIndex === -1) return false;

    const domain = trimmed.slice(atIndex + 1);
    if (disallowedDomains.includes(domain)) {
      return false;
    }

    return domain.includes('.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!professorName.trim()) {
      setErrorMessage('Por favor ingresa el nombre del profesor o profesora titular.');
      return;
    }

    if (!professorEmail.trim() || !validateInstitutionalEmail(professorEmail)) {
      setErrorMessage(
        'Debes ingresar un correo electrónico institucional oficial (por ejemplo: @duoc.cl, @profesor.duoc.cl, @uchile.cl, @inacap.cl). No se admiten correos personales gratuitos como Gmail o Hotmail.'
      );
      return;
    }

    setIsSubmitting(true);

    // Simulación del envío de token de validación docente
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess({
          professorName: professorName.trim(),
          professorEmail: professorEmail.trim(),
          subjectName,
        });
      }
    }, 1000);
  };

  const handleResetAndClose = () => {
    setProfessorName('');
    setProfessorEmail('');
    setCustomMessage('');
    setErrorMessage('');
    setIsSuccess(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AwardIcon size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>
                Solicitud de Respaldo Docente
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Certificación Institucional con Enlace Seguro de Aprobación
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar ventana"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #86efac',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckIcon size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                Solicitud Enviada al Docente
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, margin: '0 auto 16px', maxWidth: '440px' }}>
                Hemos enviado un correo formal con un enlace seguro de confirmación al profesor <strong>{professorName}</strong> ({professorEmail}).
              </p>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  textAlign: 'left',
                  fontSize: '0.8rem',
                  color: '#64748b',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                }}
              >
                <div><strong>Materia:</strong> {subjectName}</div>
                <div><strong>Institución:</strong> {institutionName || 'Tu institución'}</div>
                <div><strong>Estado:</strong> Pendiente de confirmación docente</div>
              </div>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="ia-btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.88rem' }}
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: '#1e40af',
                  lineHeight: 1.45,
                }}
              >
                <strong>¿Cómo funciona?</strong> InterAula enviará un correo institucional a tu docente con un enlace de acceso directo. Tu profesor podrá certificar con un solo clic que cuentas con las competencias académicas para enseñar esta materia.
              </div>

              {errorMessage && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    color: '#b91c1c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircleIcon size={16} color="#b91c1c" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Selector de Asignatura */}
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                  Asignatura a respaldar:
                </label>
                <select
                  className="ia-input"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.88rem', fontWeight: 600 }}
                >
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre del Profesor */}
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                  Nombre del profesor o profesora titular:
                </label>
                <input
                  type="text"
                  className="ia-input"
                  placeholder="Ej: Prof. Andrea Valenzuela"
                  value={professorName}
                  onChange={(e) => setProfessorName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              {/* Correo Institucional */}
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                  Correo electrónico institucional del profesor:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="ia-input"
                    placeholder="profesor@tu-universidad.cl"
                    value={professorEmail}
                    onChange={(e) => setProfessorEmail(e.target.value)}
                    style={{ width: '100%', fontSize: '0.88rem', paddingLeft: '34px' }}
                  />
                  <div style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }}>
                    <MailIcon size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Solo correos con dominio educativo oficial (@duoc.cl, @inacap.cl, @uchile.cl, etc.). Se rechazan correos personales.
                </div>
              </div>

              {/* Institución / Universidad */}
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                  Institución o universidad:
                </label>
                <input
                  type="text"
                  className="ia-input"
                  placeholder="Ej: INACAP, Duoc UC, Universidad de Chile, etc."
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              {/* Mensaje opcional para el docente */}
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                  Mensaje personalizado para tu profesor (opcional):
                </label>
                <textarea
                  className="ia-input"
                  rows={3}
                  placeholder={`Estimado/a profesor/a, soy ${userName || 'su estudiante'} y postulo para ser tutor de ${subjectName} en InterAula. Agradecería su respaldo académico para validar mi perfil.`}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="ia-btn-secondary"
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ia-btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{isSubmitting ? 'Enviando...' : 'Enviar Solicitud al Profesor'}</span>
                  <SendIcon size={14} color="#ffffff" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
