/**
 * Nalvita design tokens — the single source of truth for palette and type,
 * extracted from `design/Nalvita.dc.html`.
 *
 * The web app mirrors these values as CSS variables (see
 * `packages/web/src/index.css`) and consumes them only through Tailwind
 * utilities — never as raw hex. Phase 2's React Native app will consume this
 * module directly, so keep it framework-free (plain data, no imports).
 */

/** Semantic colours that flip between light and dark themes. */
export interface NalvitaThemeColors {
  /** Primary body/heading text (AAA on `bgSurface`). */
  textPrimary: string;
  /** Secondary text — labels, captions (AAA). */
  textSecondary: string;
  /** Muted text — hints, metadata (AA). */
  textMuted: string;
  /** Text on `interactiveDefault` fills. */
  textInverse: string;
  /** Page canvas. */
  bgApp: string;
  /** Cards & sheets. */
  bgSurface: string;
  /** Menus / raised surfaces (dark gets a +6% lightness lift). */
  bgRaised: string;
  /** Wells & search fields. */
  bgSunken: string;
  /** Row dividers. */
  borderSubtle: string;
  /** Card outlines. */
  borderDefault: string;
  /** Inputs & focus targets. */
  borderStrong: string;
  /** Primary actions. */
  interactiveDefault: string;
  interactiveHover: string;
  interactivePressed: string;
  /** Non-interactive-by-design fills. */
  interactiveDisabled: string;
  /** Focus ring. */
  focusRing: string;
}

export const nalvitaColors: Readonly<Record<'light' | 'dark', NalvitaThemeColors>> = {
  light: {
    textPrimary: '#16201D',
    textSecondary: '#3C463F',
    textMuted: '#6A746F',
    textInverse: '#FFFFFF',
    bgApp: '#F1F4F3',
    bgSurface: '#FFFFFF',
    bgRaised: '#FFFFFF',
    bgSunken: '#EDF1F0',
    borderSubtle: '#F0F2F1',
    borderDefault: '#ECEFEE',
    borderStrong: '#D3DAD7',
    interactiveDefault: '#0F6E56',
    interactiveHover: '#0C5B47',
    interactivePressed: '#094A3A',
    interactiveDisabled: '#A9B4AF',
    focusRing: '#0E7C90',
  },
  dark: {
    textPrimary: '#E9F0ED',
    textSecondary: '#C2CFC9',
    textMuted: '#93A29B',
    textInverse: '#0C1310',
    bgApp: '#0C1310',
    bgSurface: '#141E1A',
    bgRaised: '#1A2621',
    bgSunken: '#0A100D',
    borderSubtle: '#212E29',
    borderDefault: '#26332E',
    borderStrong: '#3A4842',
    interactiveDefault: '#34B48C',
    interactiveHover: '#46C79D',
    interactivePressed: '#2AA07C',
    interactiveDisabled: '#33423C',
    focusRing: '#6BD5EE',
  },
} as const;

/**
 * Health status palette. `high` is the amber "borderline" tone; `critical` is
 * the red alert tone used for the allergy banner. Each entry is an AA
 * background/foreground pair.
 */
export const NALVITA_STATUSES = ['normal', 'high', 'low', 'critical'] as const;
export type NalvitaStatus = (typeof NALVITA_STATUSES)[number];

export interface StatusColorPair {
  bg: string;
  fg: string;
}

export const nalvitaStatusColors: Readonly<
  Record<'light' | 'dark', Record<NalvitaStatus, StatusColorPair>>
> = {
  light: {
    normal: { bg: '#E5F2EB', fg: '#1E7A52' },
    high: { bg: '#FBF1E1', fg: '#B7791F' },
    low: { bg: '#E6EFF9', fg: '#2563A8' },
    critical: { bg: '#FBEAE7', fg: '#A8362A' },
  },
  dark: {
    normal: { bg: '#123024', fg: '#54C692' },
    high: { bg: '#2C2415', fg: '#E7B968' },
    low: { bg: '#14263B', fg: '#6FB0E8' },
    critical: { bg: '#331D19', fg: '#EE9082' },
  },
} as const;

/** Font stacks. Plus Jakarta Sans for headings, Inter for UI & body. */
export const nalvitaFonts = {
  heading: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  body: "'Inter', ui-sans-serif, system-ui, sans-serif",
} as const;
