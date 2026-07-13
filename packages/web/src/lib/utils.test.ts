import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins and deduplicates conflicting Tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', 'font-medium')).toBe('text-sm font-medium');
  });

  it('handles conditional values', () => {
    expect(cn('base', false, undefined, 'extra')).toBe('base extra');
  });
});
