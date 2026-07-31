import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeSelect, ThemeToggle } from '@/components/ui-nalvita/theme-toggle';
import { renderWithProviders } from '@/test/render';

// matchMedia is mocked to `matches: false` in test setup, so the system theme
// resolves to light and first render starts in light mode.

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('switches to dark mode and persists the choice', () => {
    const { getByRole } = renderWithProviders(<ThemeToggle />);

    fireEvent.click(getByRole('button', { name: /switch to dark mode/i }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('nalvita-theme')).toBe('dark');
  });
});

describe('ThemeSelect', () => {
  it('marks the current preference and applies a new one on click', () => {
    const { getByRole } = renderWithProviders(<ThemeSelect />);

    // System is the default when nothing is stored.
    expect(getByRole('radio', { name: /system/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(getByRole('radio', { name: /dark/i }));

    expect(getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('nalvita-theme')).toBe('dark');

    fireEvent.click(getByRole('radio', { name: /light/i }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('nalvita-theme')).toBe('light');
  });
});
