import {
  SparklesIcon,
  ClockIcon,
  ShieldCheckIcon,
  CheckIcon,
  AlertCircleIcon,
} from '../../../components/common/Icons';
import type { AcademicLevel } from '../../../types/profile';

interface TutorValidationIntroProps {
  isGenerating: boolean;
  generationSeconds: number;
  getGenerationStatus: (sec: number) => string;
  subjectName: string;
  selectedSubjectId: string;
  onSelectSubjectId: (id: string) => void;
  selectedLevel: AcademicLevel;
  onSelectLevel: (lvl: AcademicLevel) => void;
  availableSubjects: { id: string; name: string }[];
  isCustomSubject: boolean;
  onToggleCustomSubject: () => void;
  customSubjectInput: string;
  onCustomSubjectInputChange: (val: string) => void;
  userInstitution?: string;
  userCareer?: string;
  aiEnabled: boolean;
  errorMessage: string | null;
  onStartChallenge: () => void;
}

export default function TutorValidationIntro({
  isGenerating,
  generationSeconds,
  getGenerationStatus,
  subjectName,
  selectedSubjectId,
  onSelectSubjectId,
  selectedLevel,
  onSelectLevel,
  availableSubjects,
  isCustomSubject,
  onToggleCustomSubject,
  customSubjectInput,
  onCustomSubjectInputChange,
  userInstitution,
  userCareer,
  aiEnabled,
  errorMessage,
  onStartChallenge,
}: TutorValidationIntroProps) {
  if (isGenerating) {
    return (
      <div
        style={{
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '22px',
          minHeight: '420px',
          margin: 'auto 0',
        }}
      >
        {/* Spinner animado y halo central */}
        <div style={{ position: 'relative', width: '78px', height: '78px' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '4px solid #e2e8f0',
              borderTopColor: '#059669',
              animation: 'ia-spin 0.9s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '8px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              animation: 'ia-pulse-scale 2s ease-in-out infinite',
            }}
          >
            <SparklesIcon size={32} color="#059669" />
          </div>
        </div>

        {/* Temporizador y estado dinámico */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#ecfdf5',
              border: '1.5px solid #a7f3d0',
              borderRadius: '24px',
              padding: '6px 16px',
              color: '#065f46',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            <ClockIcon size={16} color="#059669" />
            <span>Generando preguntas:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 800 }}>
              {`00:${generationSeconds < 10 ? `0${generationSeconds}` : generationSeconds}`}s
            </span>
          </div>

          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', marginTop: '4px' }}>
            Preparando Evaluación Técnica
          </div>

          <div
            style={{
              fontSize: '0.92rem',
              color: '#047857',
              fontWeight: 700,
              minHeight: '26px',
              maxWidth: '480px',
              lineHeight: 1.4,
            }}
          >
            {getGenerationStatus(generationSeconds)}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Materia: <strong>{subjectName}</strong> · Nivel:{' '}
            <strong>
              {selectedLevel === 'basic' ? 'Básico' : selectedLevel === 'advanced' ? 'Avanzado' : 'Intermedio'}
            </strong>
          </div>
        </div>

        {/* Barra de progreso indeterminada animada */}
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            height: '6px',
            backgroundColor: '#e2e8f0',
            borderRadius: '6px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '45%',
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              borderRadius: '6px',
              animation: 'ia-indeterminate 1.6s ease-in-out infinite',
            }}
          />
        </div>

        {/* Nota de contexto */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '0.8rem',
            color: '#64748b',
            maxWidth: '500px',
            lineHeight: 1.45,
          }}
        >
          El motor de Inteligencia Artificial está generando 10 preguntas adaptadas al temario oficial. La prueba comenzará automáticamente en pantalla completa al finalizar la carga.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: 'auto 0' }}>
      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          gap: '14px',
        }}
      >
        <div style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }}>
          <ShieldCheckIcon size={24} />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: '#065f46', fontSize: '1.1rem', marginBottom: '6px', letterSpacing: '-0.01em' }}>
            Evaluación Práctica para Acreditación de Tutores
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#166534', lineHeight: 1.55 }}>
            Para habilitarte como tutor y apoyar a tus compañeros en InterAula, necesitas rendir esta evaluación práctica con nuestro Asistente Evaluador:
          </p>
          <ul style={{ margin: '10px 0 0 18px', padding: 0, fontSize: '0.92rem', color: '#15803d', lineHeight: 1.6 }}>
            <li><strong>10 preguntas prácticas</strong> calibradas estrictamente con el temario oficial de la materia.</li>
            <li><strong>3 niveles formativos</strong>: elige entre Básico, Intermedio o Avanzado según tu dominio.</li>
            <li><strong>Tiempos específicos por pregunta</strong>: 15 segundos en alternativas y 45 segundos en desarrollo técnico para agilidad.</li>
            <li><strong>Modo de enfoque en pantalla completa</strong>: evaluación inmersiva con detección de cambio de pestañas.</li>
            <li><strong>Redacción manual</strong>: respuestas auténticas por teclado (copiado y pegado bloqueado).</li>
          </ul>
        </div>
      </div>

      {/* Selector de Asignatura */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="ia-label" style={{ fontWeight: 700, margin: 0 }}>
            Asignatura a evaluar:
          </label>
          <button
            type="button"
            onClick={onToggleCustomSubject}
            style={{
              background: 'none',
              border: 'none',
              color: '#059669',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '2px 4px',
            }}
          >
            {isCustomSubject ? '← Elegir del catálogo sugerido' : '¿No está tu materia? Escríbela'}
          </button>
        </div>

        {isCustomSubject ? (
          <div>
            <input
              type="text"
              className="ia-input"
              placeholder="Ej. Contabilidad General, Costos y Presupuestos, Microeconomía..."
              value={customSubjectInput}
              onChange={(e) => onCustomSubjectInputChange(e.target.value)}
              style={{ width: '100%', fontWeight: 600, fontSize: '0.98rem' }}
            />
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px' }}>
              El motor de IA generará 10 preguntas técnicas especializadas para esta materia.
            </div>
          </div>
        ) : (
          <select
            className="ia-input"
            value={selectedSubjectId}
            onChange={(e) => onSelectSubjectId(e.target.value)}
            style={{ width: '100%', fontWeight: 600, fontSize: '0.98rem' }}
          >
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {userInstitution && (
          <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheckIcon size={13} color="#059669" />
            <span>
              Evaluación calibrada con el temario formativo de <strong>{userInstitution}</strong> {userCareer ? `[${userCareer}]` : ''}.
            </span>
          </div>
        )}

        {/* Feedback dinámico con Gemini */}
        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              fontSize: '0.82rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <SparklesIcon size={16} color="#059669" />
            <span>
              <strong>Evaluación Dinámica con IA:</strong> Las 10 preguntas para <strong>"{subjectName}"</strong> se generarán dinámicamente según el temario oficial y tu nivel formativo.
            </span>
          </div>
        </div>
      </div>

      {/* Selector de Nivel de Dificultad Académica */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <label className="ia-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
          Nivel de Tutoría a Acreditar:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {[
            {
              id: 'basic' as AcademicLevel,
              badge: 'Nivel Básico',
              title: 'Tutor Inicial',
              desc: 'Fundamentos nucleares, etiquetas, selectores y conceptos base.',
            },
            {
              id: 'intermediate' as AcademicLevel,
              badge: 'Nivel Intermedio',
              title: 'Tutor Comunitario',
              desc: 'Lógica aplicada, llamadas a APIs, eventos y debugging práctico.',
            },
            {
              id: 'advanced' as AcademicLevel,
              badge: 'Nivel Avanzado',
              title: 'Tutor Senior',
              desc: 'Arquitectura, seguridad web, rendimiento y optimización crítica.',
            },
          ].map((lvl) => {
            const isSelected = selectedLevel === lvl.id;
            return (
              <div
                key={lvl.id}
                onClick={() => onSelectLevel(lvl.id)}
                style={{
                  border: `2px solid ${isSelected ? '#059669' : '#e2e8f0'}`,
                  backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: isSelected ? '#047857' : '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {lvl.badge}
                  </span>
                  {isSelected && <CheckIcon size={14} color="#059669" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                  {lvl.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                  {lvl.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tarjeta del Motor de Evaluación y Estado de IA */}
      <div
        style={{
          backgroundColor: aiEnabled ? '#f8faff' : '#f8fafc',
          border: `1.5px solid ${aiEnabled ? '#bfdbfe' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}
          >
            <SparklesIcon size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
              Motor de Evaluación con Inteligencia Artificial
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Generación de retos en tiempo real para cualquier materia y evaluación semántica inteligente de respuestas.
            </div>
          </div>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            border: '1px solid #86efac',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.72rem',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          <CheckIcon size={12} color="#16a34a" />
          Activo
        </span>
      </div>

      {/* Mensaje de error si la materia no tiene preguntas */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.84rem',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircleIcon size={16} color="#dc2626" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Aclaración sobre Tutor Certificado Institucional */}
      <div style={{ padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.45 }}>
          <strong>Aviso Institucional:</strong> Esta prueba te acredita como <strong>Tutor Comunitario Habilitado</strong> en el nivel elegido. Para obtener el sello de <strong>Tutor Certificado Institucional</strong>, puedes solicitar respaldo formal a tu profesor titular o adjuntar tu Concentración de Notas oficial (nota 5.5 o superior).
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
        <button
          type="button"
          onClick={onStartChallenge}
          disabled={isGenerating}
          className="ia-btn-primary"
          style={{
            padding: '12px 30px',
            fontSize: '0.98rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            borderColor: '#047857',
            boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
            cursor: isGenerating ? 'wait' : 'pointer',
          }}
        >
          {isGenerating
            ? 'Generando preguntas con IA...'
            : `Iniciar Evaluación [Nivel ${
                selectedLevel === 'basic'
                  ? 'Básico'
                  : selectedLevel === 'advanced'
                  ? 'Avanzado'
                  : 'Intermedio'
              }]`}
        </button>
      </div>
    </div>
  );
}
