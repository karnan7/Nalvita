import { describe, expect, it } from 'vitest';

import {
  NALVITA_STATUSES,
  nalvitaColors,
  nalvitaFonts,
  nalvitaStatusColors,
} from './tokens.js';

// These tokens are the source of truth mirrored into web CSS variables. The
// tests guard internal consistency: every token exists in both themes, and the
// values stay in the expected hex format (a drift-detector against typos).

const HEX = /^#[0-9A-F]{6}$/;

describe('design tokens', () => {
  it('defines the same colour keys for light and dark themes', () => {
    expect(Object.keys(nalvitaColors.dark)).toEqual(Object.keys(nalvitaColors.light));
  });

  it('uses uppercase 6-digit hex for every theme colour', () => {
    for (const theme of Object.values(nalvitaColors)) {
      for (const value of Object.values(theme)) {
        expect(value).toMatch(HEX);
      }
    }
  });

  it('provides a bg/fg pair for every status in both themes', () => {
    for (const theme of Object.values(nalvitaStatusColors)) {
      for (const status of NALVITA_STATUSES) {
        expect(theme[status].bg).toMatch(HEX);
        expect(theme[status].fg).toMatch(HEX);
      }
    }
  });

  it('names Plus Jakarta Sans for headings and Inter for body', () => {
    expect(nalvitaFonts.heading).toContain('Plus Jakarta Sans');
    expect(nalvitaFonts.body).toContain('Inter');
  });
});
