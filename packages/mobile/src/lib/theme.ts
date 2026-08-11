import {
  nalvitaColors,
  nalvitaStatusColors,
  type NalvitaStatus,
  type NalvitaThemeColors,
  type StatusColorPair,
} from '@nalvita/core';
import { useColorScheme } from 'react-native';

/**
 * The Nalvita palette for React Native.
 *
 * The values come straight from `@nalvita/core`'s `tokens.ts` — the same module
 * the web app mirrors into CSS variables — so the two apps cannot drift. There
 * is no Tailwind here and no CSS: the tokens are plain hex data, which is
 * exactly why they were kept framework-free.
 */

export type ThemeName = 'light' | 'dark';

export interface NalvitaTheme {
  name: ThemeName;
  colors: NalvitaThemeColors;
  status: Record<NalvitaStatus, StatusColorPair>;
}

export function themeFor(name: ThemeName): NalvitaTheme {
  return {
    name,
    colors: nalvitaColors[name],
    status: nalvitaStatusColors[name],
  };
}

/**
 * The active theme, following the OS setting.
 *
 * Unlike web there is no in-app override yet: `useColorScheme` returns null
 * before the system value is known, and light is the safe default — a
 * momentarily light screen is better than a flash of dark on a light phone.
 */
export function useTheme(): NalvitaTheme {
  const scheme = useColorScheme();
  return themeFor(scheme === 'dark' ? 'dark' : 'light');
}

/**
 * Type scale. Plus Jakarta Sans and Inter are not loaded yet — that needs
 * `expo-font` and the font files, which belongs with the screens in KAR-57 —
 * so these carry size and weight only and fall back to the system face.
 */
export const typeScale = {
  heading1: { fontSize: 28, fontWeight: '700' },
  heading2: { fontSize: 22, fontWeight: '700' },
  heading3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

/** Spacing steps, in points. Keeps screens on a common rhythm. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
