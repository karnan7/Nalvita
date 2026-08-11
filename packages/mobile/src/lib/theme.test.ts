import { nalvitaColors, nalvitaStatusColors } from '@nalvita/core';

import { radius, spacing, themeFor, typeScale } from '@/lib/theme';

/**
 * The point of these is drift: the mobile theme must be the shared tokens, not
 * a hand-copied palette. If someone pastes a hex value in here, this fails.
 */
describe('themeFor', () => {
  it.each(['light', 'dark'] as const)('is exactly the shared %s palette', (name) => {
    const theme = themeFor(name);

    expect(theme.name).toBe(name);
    expect(theme.colors).toBe(nalvitaColors[name]);
    expect(theme.status).toBe(nalvitaStatusColors[name]);
  });

  it('flips background and text between the two themes', () => {
    const light = themeFor('light');
    const dark = themeFor('dark');

    expect(light.colors.bgApp).not.toBe(dark.colors.bgApp);
    expect(light.colors.textPrimary).not.toBe(dark.colors.textPrimary);
  });

  it('carries all four health statuses in both themes', () => {
    for (const name of ['light', 'dark'] as const) {
      const { status } = themeFor(name);
      expect(Object.keys(status).sort()).toEqual(['critical', 'high', 'low', 'normal']);
      for (const pair of Object.values(status)) {
        expect(pair.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(pair.fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('scales', () => {
  it('orders type from caption up to heading1', () => {
    expect(typeScale.caption.fontSize).toBeLessThan(typeScale.body.fontSize);
    expect(typeScale.body.fontSize).toBeLessThan(typeScale.heading1.fontSize);
  });

  it('keeps body text at 16pt or more — the audience includes elderly parents', () => {
    expect(typeScale.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('steps spacing and radius upward', () => {
    expect(spacing.xs).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.xl);
    expect(radius.sm).toBeLessThan(radius.lg);
  });
});
