import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';

import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/lib/theme';

/** Compact icon button that flips between light and dark (for the top nav). */
export function ThemeToggle() {
  const { resolvedTheme, setPreference } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setPreference(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong text-content-secondary transition-colors hover:bg-sunken"
    >
      {resolvedTheme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

/** Segmented Light / System / Dark control for the Settings page. */
export function ThemeSelect() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex gap-1 rounded-lg border border-border-strong bg-sunken p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-muted hover:text-content',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
