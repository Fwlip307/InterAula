import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Subject } from '../../../types/profile';
import { tutoringService } from '../../../services/tutoring.service';
import { getAllCatalogSubjects } from '../../../services/catalogResolver';
import {
  XIcon,
  VideoIcon,
  AlertCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CalendarIcon,
} from '../../../components/common/Icons';

interface CreateWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableSubjects: Subject[];
}

export default function CreateWorkshopModal({
  isOpen,
  onClose,
  onSuccess,
  availableSubjects,
}: CreateWorkshopModalProps) {
  const navigate = useNavigate();
  const [isLiveNow, setIsLiveNow] = useState(true);
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxStudents, setMaxStudents] = useState(20);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const catalogSubjects = useMemo(() => {
    return getAllCatalogSubjects();
  }, []);

  if (!isOpen) return null;

  const minDate = new Date().toISOString().split('T')[0];
  const activeSubjectId =
    selectedSubjectId ||
    availableSubjects[0]?.id ||
    catalogSubjects[0]?.id ||
    '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Por favor ingresa un título representativo para la clase.');
      return;
    }

    if (!activeSubjectId) {
      setErrorMessage('Por favor selecciona la materia de la clase.');
      return;
    }

    let scheduledDateTime: Date;

    if (isLiveNow) {
      scheduledDateTime = new Date();
    } else {
      if (!date || !time) {
        setErrorMessage('Por favor indica la fecha y hora de inicio.');
        return;
      }

      scheduledDateTime = new Date(`${date}T${time}:00`);
      if (isNaN(scheduledDateTime.getTime())) {
        setErrorMessage('Fecha u hora no válida.');
        return;
      }

      if (scheduledDateTime.getTime() <= Date.now() - 60000) {
        setErrorMessage('La fecha y hora del taller programado debe ser futura.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const created = await tutoringService.createWorkshop({
        subject_id: activeSubjectId,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_at: scheduledDateTime.toISOString(),
        duration_minutes: durationMinutes,
        max_students: maxStudents,
      });

      onSuccess();
      onClose();

      if (created?.id) {
        try {
          const roomUrl = `${window.location.origin}/tutoring/room/${created.id}`;
          navigator.clipboard.writeText(roomUrl);
        } catch {}
        if (isLiveNow) {
          navigate(`/tutoring/room/${created.id}`);
        }
      }
    } catch (err: any) {
      console.error('[CreateWorkshopModal] Error:', err);
      setErrorMessage(err.message || 'No fue posible iniciar la clase en vivo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        className="ia-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '14px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: isLiveNow ? '#ecfdf5' : '#eff6ff',
                  color: isLiveNow ? '#15803d' : '#1d4ed8',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${isLiveNow ? '#bbf7d0' : '#bfdbfe'}`,
                }}
              >
                <VideoIcon size={12} color={isLiveNow ? '#15803d' : '#1d4ed8'} />
                {isLiveNow ? 'Clase en Vivo Inmediata' : 'Taller Programado'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px' }}>
              {isLiveNow ? 'Iniciar Clase en Vivo Ahora' : 'Programar Taller para otra Fecha'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              {isLiveNow
                ? 'Abre el aula virtual de inmediato y comparte el enlace para que tus compañeros se unan.'
                : 'Fija una fecha futura para que los estudiantes se inscriban y reciban recordatorios.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ia-btn-icon-back"
            style={{ width: '32px', height: '32px' }}
            title="Cerrar"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Selector de Modo: En Vivo Ahora vs Programar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '16px',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => setIsLiveNow(true)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isLiveNow ? '#ffffff' : 'transparent',
              color: isLiveNow ? '#15803d' : '#64748b',
              fontWeight: isLiveNow ? 800 : 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: isLiveNow ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <VideoIcon size={15} color={isLiveNow ? '#15803d' : '#64748b'} />
            Iniciar Ahora (En Vivo)
          </button>

          <button
            type="button"
            onClick={() => setIsLiveNow(false)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: !isLiveNow ? '#ffffff' : 'transparent',
              color: !isLiveNow ? '#2563eb' : '#64748b',
              fontWeight: !isLiveNow ? 800 : 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: !isLiveNow ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <CalendarIcon size={15} color={!isLiveNow ? '#2563eb' : '#64748b'} />
            Programar otra Fecha
          </button>
        </div>

        {/* Alerta de Error */}
        {errorMessage && (
          <div className="ia-banner-alert" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', marginBottom: '16px', padding: '10px 14px' }}>
            <div className="ia-banner-alert-content">
              <AlertCircleIcon size={18} color="#dc2626" />
              <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Título de la clase */}
          <div>
            <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
              Título o Temática de la Clase *
            </label>
            <input
              type="text"
              className="ia-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Repaso de Ejercicios y Resolución de Dudas en Vivo"
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* Materia del taller */}
          <div>
            <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
              Materia / Asignatura *
            </label>
            <select
              className="ia-select"
              value={activeSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              {availableSubjects.length > 0 && (
                <optgroup label="Mis Materias Habilitadas">
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="Catálogo Académico Nacional 2026">
                {catalogSubjects
                  .filter((cs) => !availableSubjects.some((as) => as.name?.toLowerCase() === cs.name.toLowerCase()))
                  .slice(0, 100)
                  .map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.name} ({cs.areaName})
                    </option>
                  ))}
              </optgroup>
            </select>

            {/* Garantía de Calidad */}
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.76rem',
                color: '#475569',
              }}
            >
              <ShieldCheckIcon size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span>
                <strong>Aula Virtual InterAula:</strong> La clase se iniciará con sala de videollamada integrada, soporte para compartir pantalla y enlace directo para invitar compañeros.
              </span>
            </div>
          </div>

          {/* Fecha y Hora (solo si está en modo programar) */}
          {!isLiveNow && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Fecha *
                </label>
                <input
                  type="date"
                  className="ia-input"
                  value={date}
                  min={minDate}
                  onChange={(e) => setDate(e.target.value)}
                  required={!isLiveNow}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Hora de Inicio *
                </label>
                <input
                  type="time"
                  className="ia-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required={!isLiveNow}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Duración y Cupos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
                Duración Estimada
              </label>
              <select
                className="ia-select"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={90}>90 minutos (1.5 horas)</option>
                <option value={120}>120 minutos (2 horas)</option>
              </select>
            </div>

            <div>
              <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
                Cupo Máximo
              </label>
              <select
                className="ia-select"
                value={maxStudents}
                onChange={(e) => setMaxStudents(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={10}>10 alumnos</option>
                <option value={20}>20 alumnos</option>
                <option value={30}>30 alumnos</option>
                <option value={50}>50 alumnos</option>
                <option value={100}>100 alumnos (Abierto)</option>
              </select>
            </div>
          </div>

          {/* Temario / Descripción */}
          <div>
            <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
              Descripción o Pauta de la Clase (Opcional)
            </label>
            <textarea
              className="ia-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Resolveremos ejercicios prácticos y repasaremos los puntos más difíciles."
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          {/* Aviso del Aula Virtual */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              fontSize: '0.78rem',
              color: '#1e40af',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <SparklesIcon size={16} color="#2563eb" />
              <span>Aula Virtual en Vivo con Invitación Instantánea</span>
            </div>
            <div style={{ color: '#2563eb', lineHeight: 1.4 }}>
              Al iniciar la clase, podrás copiar el enlace con un clic y enviárselo a tus compañeros por WhatsApp o redes. Podrán unirse directamente con audio, video y chat.
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="ia-btn-secondary" disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="ia-btn-primary"
              disabled={submitting}
              style={{
                backgroundColor: isLiveNow ? '#15803d' : '#2563eb',
                borderColor: isLiveNow ? '#166534' : '#1d4ed8',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <VideoIcon size={16} color="#ffffff" />
              {submitting
                ? (isLiveNow ? 'Iniciando aula...' : 'Programando...')
                : (isLiveNow ? 'Iniciar y Abrir Aula en Vivo' : 'Publicar Taller Programado')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
