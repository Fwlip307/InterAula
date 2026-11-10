import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import { profileService } from '../../services/profile.service';
import {
  LEARNING_PREFERENCES,
  type LearningPreference,
  type FontSizeScale,
  type ContrastLevel,
  type SpacingMode,
} from '../../types/profile';
import {
  SettingsIcon,
  ShieldCheckIcon,
  LockIcon,
  ArrowLeftIcon,
  SparklesIcon,
  CheckIcon,
  AlertCircleIcon,
} from '../../components/common/Icons';

export default function Settings() {
  const { user } = useAuth();
  const {hash}=useLocation();
  useEffect(()=>{
    const id=hash.slice(1);
    if(['accessibility','learning-preferences','notifications','security'].includes(id)) {
      const section=document.getElementById(id);
      section?.scrollIntoView({block:'start'});section?.focus({preventScroll:true});
    }
  },[hash]);
  const { preferences, themeMode, setThemeMode, updatePreferences, resetPreferences } = useCalmMode();

  const [learningPrefs, setLearningPrefs] = useState<LearningPreference[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function loadUserSettings() {
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      try {
        const profile = await profileService.getMyProfile();
        if (!active || !profile) return;

        if (Array.isArray(profile.learning_preferences)) {
          setLearningPrefs(profile.learning_preferences);
        }
        if (profile.accessibility_preferences) {
          updatePreferences(profile.accessibility_preferences);
        }
      } catch (err) {
        console.warn('[Settings] No se pudieron cargar preferencias remotas:', err);
      } finally {
        if (active) setLoadingProfile(false);
      }
    }
    loadUserSettings();
    return () => {
      active = false;
    };
  }, [user, updatePreferences]);

  const toggleLearningPref = (prefId: LearningPreference) => {
    setLearningPrefs((prev) =>
      prev.includes(prefId) ? prev.filter((id) => id !== prefId) : [...prev, prefId]
    );
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      await profileService.updateMyProfile({
        learning_preferences: learningPrefs,
        accessibility_preferences: preferences,
      });
      setSaveSuccess('Tus preferencias de accesibilidad, aprendizaje y notificaciones se han guardado en tu cuenta.');
      setTimeout(() => setSaveSuccess(''), 5000);
    } catch (err: any) {
      setSaveError(err?.message || 'Se aplicaron en este dispositivo, pero ocurrió un error al sincronizar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Cabecera */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/dashboard" className="ia-btn-icon-back" aria-label="Volver al panel" title="Volver al panel">
            <ArrowLeftIcon size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: 0 }}>
              Accesibilidad, Aprendizaje y Configuración
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--ia-text-muted)', margin: '2px 0 0 0' }}>
              InterAula: Aprender juntos, a nuestra manera · Adapta la plataforma a tu ritmo y comodidad visual.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ia-btn-secondary"
            onClick={resetPreferences}
          >
            Restaurar valores visuales
          </button>
          <button
            type="button"
            className="ia-btn-primary"
            onClick={handleSaveAll}
            disabled={saving || loadingProfile}
          >
            <CheckIcon size={16} color="#ffffff" />
            <span>{saving ? 'Guardando...' : 'Guardar en mi cuenta'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div
          role="status"
          style={{
            background: 'var(--ia-success-bg)',
            border: '1px solid var(--ia-success-border)',
            color: 'var(--ia-success)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          <CheckIcon size={18} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          style={{
            background: 'var(--ia-danger-bg)',
            border: '1px solid var(--ia-danger-border)',
            color: 'var(--ia-danger)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          <AlertCircleIcon size={18} />
          <span>{saveError}</span>
        </div>
      )}

      {/* 1. Preferencias de Accesibilidad Visual y Sensorial */}
      <div className="ia-card ia-search-section" id="accessibility" tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <h2 className="ia-card-title" style={{ margin: 0 }}>
            <SettingsIcon size={20} color="#2563eb" /> Preferencias de Accesibilidad y Confort Sensorial
          </h2>
          <span className="ia-badge ia-badge-blue">Efecto inmediato en toda la plataforma</span>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--ia-text-body)', margin: '0 0 18px 0', lineHeight: 1.5 }}>
          Cada estudiante aprende y procesa la información de manera distinta. Ajusta el tema visual (Claro, Oscuro o Calma),
          el tamaño del texto, el contraste, las animaciones y el espaciado según lo que te resulte más cómodo hoy.
        </p>

        {/* Selector de Tema Visual: Modo Claro / Modo Oscuro / Modo Calma */}
        <div style={{ marginBottom: '20px' }}>
          <label className="ia-label" style={{ display: 'block', marginBottom: '8px' }}>
            Tema de apariencia visual (Modo Claro, Oscuro o Calma)
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: `2px solid ${themeMode === 'light' ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
                background: themeMode === 'light' ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-card)',
                color: 'var(--ia-text-main)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <strong style={{ fontSize: '0.92rem' }}>Modo Claro Estándar</strong>
                {themeMode === 'light' && (
                  <span className="ia-badge ia-badge-blue" style={{ fontSize: '0.7rem' }}>
                    Activo
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', lineHeight: 1.4 }}>
                Fondo luminoso limpio con acentos académicos azules de alta legibilidad diurna.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: `2px solid ${themeMode === 'dark' ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
                background: themeMode === 'dark' ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-card)',
                color: 'var(--ia-text-main)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <strong style={{ fontSize: '0.92rem' }}>Modo Oscuro (Nocturno)</strong>
                {themeMode === 'dark' && (
                  <span className="ia-badge ia-badge-blue" style={{ fontSize: '0.7rem' }}>
                    Activo
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', lineHeight: 1.4 }}>
                Superficies oscuras de bajo brillo para reducir la fatiga ocular y estudiar de noche.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setThemeMode('calm')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: `2px solid ${themeMode === 'calm' ? 'var(--ia-success)' : 'var(--ia-border)'}`,
                background: themeMode === 'calm' ? 'var(--ia-success-bg)' : 'var(--ia-bg-card)',
                color: 'var(--ia-text-main)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <strong style={{ fontSize: '0.92rem' }}>Modo Calma (Baja saturación)</strong>
                {themeMode === 'calm' && (
                  <span className="ia-badge ia-badge-success" style={{ fontSize: '0.7rem' }}>
                    Activo
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', lineHeight: 1.4 }}>
                Paleta serena en tonos piedra y salvia sin gradientes ni estímulos intensos.
              </span>
            </button>
          </div>
        </div>

        <div className="ia-form-grid" style={{ marginBottom: '18px' }}>
          {/* Tamaño de texto */}
          <div className="ia-form-group">
            <label className="ia-label" htmlFor="acc-font-size">
              Tamaño de texto
            </label>
            <select
              id="acc-font-size"
              className="ia-select"
              value={preferences.fontSize}
              onChange={(e) => updatePreferences({ fontSize: e.target.value as FontSizeScale })}
            >
              <option value="normal">Normal (100%)</option>
              <option value="large">Grande (108% — Lectura cómoda)</option>
              <option value="xlarge">Extra Grande (116% — Máxima visibilidad)</option>
            </select>
            <span className="ia-input-help">Escala proporcionalmente los textos de todas las páginas.</span>
          </div>

          {/* Contraste visual */}
          <div className="ia-form-group">
            <label className="ia-label" htmlFor="acc-contrast">
              Contraste visual (WCAG 2.2 AA)
            </label>
            <select
              id="acc-contrast"
              className="ia-select"
              value={preferences.contrast}
              onChange={(e) => updatePreferences({ contrast: e.target.value as ContrastLevel })}
            >
              <option value="standard">Estándar (Equilibrado)</option>
              <option value="high">Alto contraste claro (Bordes y textos reforzados)</option>
            </select>
            <span className="ia-input-help">Refuerza la definición de bordes, controles y tipografía en fondo claro.</span>
          </div>

          {/* Espaciado y legibilidad */}
          <div className="ia-form-group">
            <label className="ia-label" htmlFor="acc-spacing">
              Espaciado y legibilidad
            </label>
            <select
              id="acc-spacing"
              className="ia-select"
              value={preferences.spacing}
              onChange={(e) => updatePreferences({ spacing: e.target.value as SpacingMode })}
            >
              <option value="standard">Estándar</option>
              <option value="spacious">Amplio (Mayor interlineado y separación entre bloques)</option>
            </select>
            <span className="ia-input-help">Facilita el seguimiento de líneas en apuntes, foros y enunciados largos.</span>
          </div>
        </div>

        {/* Interruptores sensoriales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '14px',
              borderRadius: '10px',
              border: `1.5px solid ${preferences.calmMode ? 'var(--ia-success)' : 'var(--ia-border)'}`,
              background: preferences.calmMode ? 'var(--ia-success-bg)' : 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.calmMode}
              onChange={(e) => updatePreferences({ calmMode: e.target.checked, reduceMotion: e.target.checked ? true : preferences.reduceMotion })}
              style={{ width: '18px', height: '18px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ia-text-main)' }}>
                Modo Calma Global (Menos estímulos visuales)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                Suaviza colores intensos, elimina gradientes brillantes y simplifica sombras en toda la plataforma.
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '14px',
              borderRadius: '10px',
              border: `1.5px solid ${preferences.reduceMotion ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
              background: preferences.reduceMotion ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.reduceMotion}
              onChange={(e) => updatePreferences({ reduceMotion: e.target.checked })}
              style={{ width: '18px', height: '18px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ia-text-main)' }}>
                Reducir animaciones y transiciones
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                Desactiva desplazamientos automáticos y efectos de movimiento al navegar o abrir ventanas.
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '14px',
              borderRadius: '10px',
              border: `1.5px solid ${preferences.untimedQuizzes ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
              background: preferences.untimedQuizzes ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.untimedQuizzes}
              onChange={(e) => updatePreferences({ untimedQuizzes: e.target.checked })}
              style={{ width: '18px', height: '18px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ia-text-main)' }}>
                Cuestionarios de estudio sin presión de tiempo
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ia-text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                Permite responder los cuestionarios adaptativos a tu propio ritmo, dando tiempo suficiente para leer y analizar.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Perfil Privado de Preferencias de Aprendizaje */}
      <div className="ia-card ia-search-section" id="learning-preferences" tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <h2 className="ia-card-title" style={{ margin: 0 }}>
            <SparklesIcon size={20} color="#2563eb" /> Mi Forma de Aprender (Privado y Opcional)
          </h2>
          <span className="ia-badge ia-badge-success">
            <LockIcon size={12} /> Privado · No se muestra como etiqueta pública
          </span>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--ia-text-body)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Selecciona las opciones que mejor describan cómo prefieres estudiar. Estas preferencias son privadas y se utilizan
          para preconfigurar tus solicitudes de tutoría y adaptar tus herramientas de estudio, sin exponer datos personales en tu perfil público.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '10px' }}>
          {LEARNING_PREFERENCES.map((pref) => {
            const selected = learningPrefs.includes(pref.id);
            return (
              <label
                key={pref.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${selected ? 'var(--ia-primary)' : 'var(--ia-border)'}`,
                  background: selected ? 'var(--ia-primary-subtle)' : 'var(--ia-bg-card)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleLearningPref(pref.id)}
                  style={{ width: '17px', height: '17px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ia-text-main)' }}>
                    {pref.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                    {pref.description}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Preferencias de Notificaciones */}
      <div className="ia-card ia-search-section" id="notifications" tabIndex={-1}>
        <h2 className="ia-card-title" style={{ marginBottom: '12px' }}>
          <SettingsIcon size={20} color="#2563eb" /> Preferencias de Avisos y Notificaciones
        </h2>
        <p style={{ fontSize: '0.86rem', color: 'var(--ia-text-muted)', margin: '0 0 16px 0' }}>
          Controla qué avisos deseas recibir y evita interrupciones innecesarias mientras estudias.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--ia-border)',
              background: 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.quietNotifications}
              onChange={(e) => updatePreferences({ quietNotifications: e.target.checked })}
              style={{ width: '17px', height: '17px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ia-text-main)' }}>
                Notificaciones discretas sin destellos
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginTop: '2px' }}>
                Muestra confirmaciones estáticas y silenciosas en lugar de avisos emergentes llamativos.
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--ia-border)',
              background: 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.emailTutoring}
              onChange={(e) => updatePreferences({ emailTutoring: e.target.checked })}
              style={{ width: '17px', height: '17px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ia-text-main)' }}>
                Avisos de solicitudes y sesiones de tutoría
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginTop: '2px' }}>
                Recibir avisos cuando un tutor acepta tu solicitud o cuando recibes una nueva consulta.
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--ia-border)',
              background: 'var(--ia-bg-body)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={preferences.emailProjects}
              onChange={(e) => updatePreferences({ emailProjects: e.target.checked })}
              style={{ width: '17px', height: '17px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ia-text-main)' }}>
                Actualizaciones del Hub de Proyectos
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)', marginTop: '2px' }}>
                Avisos sobre el estado de tus postulaciones a vacantes y nuevos integrantes en tus equipos.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Seguridad y Autenticación */}
      <div className="ia-card ia-search-section" id="security" tabIndex={-1}>
        <h2 className="ia-card-title" style={{ marginBottom: '16px' }}>
          <ShieldCheckIcon size={20} color="#16a34a" /> Seguridad y Autenticación de la Cuenta
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          <div>
            <label htmlFor="settings-email" style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)', display: 'block', marginBottom: '4px' }}>
              Correo electrónico registrado
            </label>
            <input
              id="settings-email"
              type="text"
              className="ia-input"
              value={user?.email || ''}
              disabled
            />
          </div>

          <div>
            <label htmlFor="settings-password" style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)', display: 'block', marginBottom: '4px' }}>
              Contraseña de acceso
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                id="settings-password"
                type="password"
                className="ia-input"
                value="••••••••••••"
                disabled
              />
              <Link to="/update-password" className="ia-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                <LockIcon size={16} /> Cambiar contraseña
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
