import type { AccessibilityPreferences, CalmTone, VisualThemeMode } from '../types/profile';

export type VisualStyleId = 'light' | 'dark' | 'calm-sage' | 'calm-sand' | 'calm-dusk';

export interface VisualStylePreviewPalette {
  bgBody: string;
  bgTopbar: string;
  bgCard: string;
  border: string;
  textMain: string;
  textMuted: string;
  primaryBg: string;
  primaryText: string;
  chipBg: string;
}

export interface VisualStyleOption {
  id: VisualStyleId;
  category: 'light' | 'dark' | 'calm';
  categoryLabel: string;
  name: string;
  shortDescription: string;
  themeMode: VisualThemeMode;
  calmTone?: CalmTone;
  preview: VisualStylePreviewPalette;
}

/**
 * Catálogo único y centralizado de los estilos visuales existentes en InterAula.
 * Representa fielmente los tokens CSS reales de Claro, Oscuro y Modo Calma (Salvia, Arena, Crepúsculo).
 */
export const VISUAL_STYLE_OPTIONS: readonly VisualStyleOption[] = [
  {
    id: 'light',
    category: 'light',
    categoryLabel: 'Claro',
    name: 'Claro',
    shortDescription: 'Fondo luminoso y nítido para lectura diurna.',
    themeMode: 'light',
    preview: {
      bgBody: '#f8fafc',
      bgTopbar: '#ffffff',
      bgCard: '#ffffff',
      border: '#e2e8f0',
      textMain: '#0f172a',
      textMuted: '#64748b',
      primaryBg: '#2563eb',
      primaryText: '#ffffff',
      chipBg: '#eff6ff',
    },
  },
  {
    id: 'dark',
    category: 'dark',
    categoryLabel: 'Oscuro',
    name: 'Oscuro',
    shortDescription: 'Menor brillo para ambientes con poca luz.',
    themeMode: 'dark',
    preview: {
      bgBody: '#0b1120',
      bgTopbar: '#111827',
      bgCard: '#111827',
      border: '#1f2937',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      primaryBg: '#3b82f6',
      primaryText: '#ffffff',
      chipBg: '#1e293b',
    },
  },
  {
    id: 'calm-sage',
    category: 'calm',
    categoryLabel: 'Calma',
    name: 'Salvia',
    shortDescription: 'Verde suave de baja saturación y menos estímulos.',
    themeMode: 'calm',
    calmTone: 'sage',
    preview: {
      bgBody: '#ebf0e8',
      bgTopbar: '#f6f8f4',
      bgCard: '#f6f8f4',
      border: '#cdd8c9',
      textMain: '#1c2b24',
      textMuted: '#4e6257',
      primaryBg: '#2c5b6c',
      primaryText: '#ffffff',
      chipBg: '#e2e9df',
    },
  },
  {
    id: 'calm-sand',
    category: 'calm',
    categoryLabel: 'Calma',
    name: 'Arena',
    shortDescription: 'Tono cálido tipo papel para lectura prolongada.',
    themeMode: 'calm',
    calmTone: 'sand',
    preview: {
      bgBody: '#f2eadc',
      bgTopbar: '#faf5eb',
      bgCard: '#faf5eb',
      border: '#d8cbb7',
      textMain: '#2b2418',
      textMuted: '#665845',
      primaryBg: '#6b5335',
      primaryText: '#ffffff',
      chipBg: '#e9dfd0',
    },
  },
  {
    id: 'calm-dusk',
    category: 'calm',
    categoryLabel: 'Calma',
    name: 'Crepúsculo',
    shortDescription: 'Superficie oscura serena de contraste suave.',
    themeMode: 'calm',
    calmTone: 'dusk',
    preview: {
      bgBody: '#1b2329',
      bgTopbar: '#242e36',
      bgCard: '#242e36',
      border: '#384652',
      textMain: '#edf2f5',
      textMuted: '#a5b5c0',
      primaryBg: '#7eb0c2',
      primaryText: '#102029',
      chipBg: '#2c3842',
    },
  },
] as const;

export const VISUAL_WELCOME_USER_KEY_PREFIX = 'ia_visual_welcome_done_';

export function getVisualWelcomeStorageKey(userId: string): string {
  return `${VISUAL_WELCOME_USER_KEY_PREFIX}${userId}`;
}

export function resolveVisualStyleId(
  prefs?: Partial<AccessibilityPreferences> | null
): VisualStyleId {
  if (!prefs) return 'light';
  const isDark = Boolean(prefs.darkMode || prefs.themeMode === 'dark');
  if (isDark) return 'dark';
  const isCalm = Boolean(prefs.calmMode || prefs.themeMode === 'calm');
  if (isCalm) {
    const tone = prefs.calmTone || 'sage';
    if (tone === 'sand') return 'calm-sand';
    if (tone === 'dusk') return 'calm-dusk';
    return 'calm-sage';
  }
  return 'light';
}

export function buildVisualStylePatch(
  option: Pick<VisualStyleOption, 'themeMode' | 'calmTone'>,
  currentPrefs?: Partial<AccessibilityPreferences>
): Partial<AccessibilityPreferences> {
  const isCalm = option.themeMode === 'calm';
  const isDark = option.themeMode === 'dark';
  return {
    themeMode: option.themeMode,
    darkMode: isDark,
    calmMode: isCalm,
    calmTone: isCalm ? option.calmTone || currentPrefs?.calmTone || 'sage' : currentPrefs?.calmTone || 'sage',
    reduceMotion: isCalm ? true : Boolean(currentPrefs?.reduceMotion),
  };
}

/**
 * Determina si un objeto de preferencias guardado ya contiene una elección explícita de tema visual.
 */
export function hasSavedVisualPreference(
  prefs?: Partial<AccessibilityPreferences> | null,
  legacyCalmRaw?: string | null
): boolean {
  if (legacyCalmRaw === 'true') return true;
  if (!prefs || typeof prefs !== 'object') return false;
  if (prefs.visualOnboardingCompleted === true) return true;
  if (prefs.darkMode === true || prefs.calmMode === true) return true;
  if (prefs.themeMode === 'dark' || prefs.themeMode === 'calm') return true;
  return false;
}

/**
 * Determina si una cuenta en servidor ya tenía preferencias visuales registradas previamente.
 * Si el perfil remoto ya guardó `themeMode` (incluyendo `'light'` al guardar desde Configuración),
 * `darkMode`, `calmMode` o `visualOnboardingCompleted`, se respeta sin volver a mostrar la bienvenida.
 */
export function hasRemoteVisualPreference(
  remotePrefs?: Partial<AccessibilityPreferences> | null
): boolean {
  if (!remotePrefs || typeof remotePrefs !== 'object') return false;
  if (remotePrefs.visualOnboardingCompleted === true) return true;
  if (remotePrefs.themeMode === 'light' || remotePrefs.themeMode === 'dark' || remotePrefs.themeMode === 'calm') {
    return true;
  }
  if (remotePrefs.darkMode === true || remotePrefs.calmMode === true) return true;
  if (remotePrefs.calmTone === 'sage' || remotePrefs.calmTone === 'sand' || remotePrefs.calmTone === 'dusk') {
    return true;
  }
  return false;
}

export function shouldPromptVisualWelcome(params: {
  hasUser: boolean;
  hadLocalVisualChoiceOnBoot: boolean;
  userLocalDone: boolean;
  remotePrefs?: Partial<AccessibilityPreferences> | null;
}): boolean {
  if (!params.hasUser) return false;
  if (params.userLocalDone) return false;
  if (params.hadLocalVisualChoiceOnBoot) return false;
  if (hasRemoteVisualPreference(params.remotePrefs)) return false;
  return true;
}
