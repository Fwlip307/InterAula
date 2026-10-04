import React, { useState } from 'react';
import type { Subject } from '../../../types/profile';
import { tutoringService } from '../../../services/tutoring.service';
import {
  XIcon,
  VideoIcon,
  AlertCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxStudents, setMaxStudents] = useState(20);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const minDate = new Date().toISOString().split('T')[0];
  const activeSubjectId = selectedSubjectId || availableSubjects[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Por favor ingresa un título representativo para el taller.');
      return;
    }

    if (!activeSubjectId) {
      setErrorMessage('Por favor selecciona la materia del taller.');
      return;
    }

    if (!date || !time) {
      setErrorMessage('Por favor indica la fecha y hora de inicio.');
      return;
    }

    const scheduledDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      setErrorMessage('Fecha u hora no válida.');
      return;
    }

    if (scheduledDateTime.getTime() <= Date.now()) {
      setErrorMessage('La fecha y hora del taller debe ser futura.');
      return;
    }

    try {
      setSubmitting(true);
      await tutoringService.createWorkshop({
        subject_id: activeSubjectId,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_at: scheduledDateTime.toISOString(),
        duration_minutes: durationMinutes,
        max_students: maxStudents,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[CreateWorkshopModal] Error:', err);
      setErrorMessage(err.message || 'No fue posible programar la clase en vivo.');
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
          maxWidth: '560px',
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
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe',
                }}
              >
                <VideoIcon size={12} color="#1d4ed8" /> Clase Abierta / Taller
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px' }}>
              Programar Taller o Clase en Vivo
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              Crea una sesión grupal proactiva para que tus compañeros se inscriban y asistan al Aula Virtual.
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
              placeholder="Ej: Repaso Intensivo Certamen 1: Algoritmos y Bucles"
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
              <optgroup label="Ramos Troncales de Informatica">
                {availableSubjects
                  .filter((s) => s.is_pilot || [
                    'Programación de Algoritmos',
                    'Nivelación Matemática',
                    'Modelamiento de Base de Datos',
                    'Consultas de Bases de Datos',
                    'Programación Web',
                    'Desarrollo de Software de Escritorio',
                    'Matemática Aplicada',
                    'Programación de Base de Datos',
                    'Arquitectura',
                    'Programación de Aplicaciones Móviles',
                    'Ingeniería de Software',
                  ].includes(s.name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            </select>

            {/* Garantía de Calidad Duoc UC */}
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
                <strong>Sello de Calidad Duoc UC:</strong> Si validaste tu concentracion de notas en tu perfil, el taller se publicara con distintivo de calidad certificada y reporte academico.
              </span>
            </div>
          </div>

          {/* Fecha y Hora */}
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
                required
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
                required
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Duración y Cupos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
                Duración
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
                Cupo Máximo de Alumnos
              </label>
              <select
                className="ia-select"
                value={maxStudents}
                onChange={(e) => setMaxStudents(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={10}>10 alumnos</option>
                <option value={15}>15 alumnos</option>
                <option value={20}>20 alumnos (Recomendado)</option>
                <option value={30}>30 alumnos</option>
                <option value={50}>50 alumnos</option>
              </select>
            </div>
          </div>

          {/* Temario / Descripción */}
          <div>
            <label className="ia-label" style={{ display: 'block', marginBottom: '4px' }}>
              Temario o Pauta a revisar (Opcional)
            </label>
            <textarea
              className="ia-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Revisaremos 3 ejercicios tipo prueba de bucles for/while y funciones. Traer dudas preparadas."
              style={{ width: '100%', fontSize: '0.84rem' }}
            />
          </div>

          {/* Aviso del Aula Virtual y Pauta Guiada */}
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
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <SparklesIcon size={16} color="#2563eb" />
              <span>Aula Virtual Interactiva con Banco de Quizzes y Pauta Guiada</span>
            </div>
            <div style={{ color: '#2563eb', lineHeight: 1.4 }}>
              Tu sesion contara con pauta visual estructurada de 4 fases, pausas de asimilación de 3 minutos para afianzar conceptos a un ritmo cómodo, y retos interactivos de código.
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="ia-btn-secondary" disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="ia-btn-primary" disabled={submitting}>
              {submitting ? 'Creando clase...' : 'Publicar Taller en Vivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
