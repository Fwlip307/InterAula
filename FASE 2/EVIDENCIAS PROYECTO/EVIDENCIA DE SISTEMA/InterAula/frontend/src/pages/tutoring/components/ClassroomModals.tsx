import { AlertCircleIcon, AwardIcon } from '../../../components/common/Icons';

interface ClassroomFinishModalProps {
  isOpen: boolean;
  elapsedSeconds: number;
  formatTimer: (seconds: number) => string;
  finishingClass: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClassroomFinishModal({
  isOpen,
  elapsedSeconds,
  formatTimer,
  finishingClass,
  onCancel,
  onConfirm,
}: ClassroomFinishModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          border: '1px solid #ef4444',
          padding: '26px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0,
            }}
          >
            <AlertCircleIcon size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              ¿Finalizar la Clase en Vivo?
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Tiempo transcurrido: {formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
          Esta acción concluirá la sesión académica para todos los estudiantes conectados y actualizará el estado del taller a completado en InterAula.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={finishingClass}
            className="ia-btn ia-btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            Continuar en clase
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={finishingClass}
            className="ia-btn"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '8px 18px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {finishingClass ? 'Finalizando...' : 'Finalizar Clase para Todos'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClassroomExitModalProps {
  isOpen: boolean;
  elapsedSeconds: number;
  formatTimer: (seconds: number) => string;
  isWorkshop: boolean;
  isTutor: boolean;
  isStudent: boolean;
  sessionStatus?: string;
  finishingClass: boolean;
  onCancel: () => void;
  onFinishForEveryone: () => void;
  onExit: () => void;
}

export function ClassroomExitModal({
  isOpen,
  elapsedSeconds,
  formatTimer,
  isWorkshop,
  isTutor,
  isStudent,
  sessionStatus,
  finishingClass,
  onCancel,
  onFinishForEveryone,
  onExit,
}: ClassroomExitModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          border: '1px solid #334155',
          padding: '24px',
          borderRadius: '12px',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
          ¿Deseas salir del Aula Virtual?
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
          Tiempo acumulado en la sesión: <strong>{formatTimer(elapsedSeconds)}</strong>.
          {isWorkshop
            ? isTutor
              ? ' Como anfitrión, puedes salir dejando la sala disponible para los alumnos, o dar la clase por terminada definitivamente.'
              : ' Podrás volver a ingresar en cualquier momento mientras el taller continúe activo.'
            : isStudent && sessionStatus === 'accepted'
            ? ' Al salir, la sesión se registrará como completada y podrás evaluar el desempeño pedagógico del tutor.'
            : ' Tu asistencia quedará registrada en el historial de la sesión.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            className="ia-btn ia-btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            Permanecer en clase
          </button>

          {isTutor && isWorkshop && (
            <button
              type="button"
              onClick={onFinishForEveryone}
              disabled={finishingClass}
              className="ia-btn"
              style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '8px 16px', fontWeight: 700 }}
            >
              Finalizar para Todos
            </button>
          )}

          <button
            type="button"
            onClick={onExit}
            className="ia-btn"
            style={{
              backgroundColor: isTutor && isWorkshop ? '#334155' : '#dc2626',
              color: '#ffffff',
              padding: '8px 16px',
              fontWeight: 700,
              border: isTutor && isWorkshop ? '1px solid #475569' : 'none',
            }}
          >
            {isTutor && isWorkshop ? 'Solo Salir' : 'Salir y Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClassroomNoticeModalProps {
  isOpen: boolean;
  onProceed: () => void;
}

export function ClassroomFinishedNoticeModal({
  isOpen,
  onProceed,
}: ClassroomNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: '16px',
      }}
    >
      <div
        className="ia-card"
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          border: '1px solid #38bdf8',
          padding: '28px',
          borderRadius: '12px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            margin: '0 auto 16px',
          }}
        >
          <AwardIcon size={32} />
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
          ¡La Clase en Vivo ha Concluido!
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
          El tutor ha dado por finalizada la sesión académica grupal. Tu asistencia ha quedado guardada en el historial.
        </p>
        <button
          type="button"
          onClick={onProceed}
          className="ia-btn ia-btn-primary"
          style={{ width: '100%', padding: '10px 20px', fontWeight: 800 }}
        >
          Ir a Mis Tutorías
        </button>
      </div>
    </div>
  );
}
