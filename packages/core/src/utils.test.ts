import { describe, expect, it } from 'vitest';
import { calculateAge, getVitalStatus } from './utils.js';

describe('calculateAge', () => {
  const now = new Date('2026-07-08T12:00:00Z');

  it('counts full years around the birthday', () => {
    expect(calculateAge('1990-07-08', now)).toBe(36); // birthday today
    expect(calculateAge('1990-07-09', now)).toBe(35); // birthday tomorrow
    expect(calculateAge('1990-08-01', now)).toBe(35); // birthday next month
    expect(calculateAge('1990-06-30', now)).toBe(36); // birthday last month
  });

  it('handles a first birthday not yet reached', () => {
    expect(calculateAge('2026-01-01', now)).toBe(0);
  });
});

describe('getVitalStatus', () => {
  it('grades blood pressure by the standard reference ranges', () => {
    expect(getVitalStatus('blood_pressure', 118, 76)).toBe('normal');
    expect(getVitalStatus('blood_pressure', 124, 78)).toBe('borderline');
    expect(getVitalStatus('blood_pressure', 132, 84)).toBe('high');
    expect(getVitalStatus('blood_pressure', 118, 85)).toBe('high'); // diastolic alone
    expect(getVitalStatus('blood_pressure', 118, null)).toBe('normal'); // missing diastolic
  });

  it('grades fasting blood sugar including the low band', () => {
    expect(getVitalStatus('blood_sugar_fasting', 60)).toBe('low');
    expect(getVitalStatus('blood_sugar_fasting', 92)).toBe('normal');
    expect(getVitalStatus('blood_sugar_fasting', 110)).toBe('borderline');
    expect(getVitalStatus('blood_sugar_fasting', 130)).toBe('high');
  });

  it('grades heart rate', () => {
    expect(getVitalStatus('heart_rate', 55)).toBe('low');
    expect(getVitalStatus('heart_rate', 72)).toBe('normal');
    expect(getVitalStatus('heart_rate', 110)).toBe('high');
  });

  it('reads post-meal sugar and weight as normal (no universal range)', () => {
    expect(getVitalStatus('blood_sugar_post_meal', 180)).toBe('normal');
    expect(getVitalStatus('weight', 72.5)).toBe('normal');
  });
});
