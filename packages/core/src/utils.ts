import type { VitalStatus, VitalType } from './constants.js';
import { VITAL_REFERENCE_RANGES } from './constants.js';

/** Computes age in full years from a YYYY-MM-DD date of birth. */
export function calculateAge(dateOfBirth: string, now: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Status badge for a vitals reading, from the standard reference ranges.
 * `value2` is the diastolic value for blood pressure. Weight has no
 * universal range, so it always reads as normal.
 */
export function getVitalStatus(type: VitalType, value1: number, value2?: number | null): VitalStatus {
  switch (type) {
    case 'blood_pressure': {
      const r = VITAL_REFERENCE_RANGES.blood_pressure;
      const diastolic = value2 ?? 0;
      if (value1 >= r.elevatedSystolic || diastolic >= r.normalDiastolic) return 'high';
      if (value1 >= r.normalSystolic) return 'borderline';
      return 'normal';
    }
    case 'blood_sugar_fasting': {
      const r = VITAL_REFERENCE_RANGES.blood_sugar_fasting;
      if (value1 < r.normalMin) return 'low';
      if (value1 <= r.normalMax) return 'normal';
      if (value1 <= r.borderlineMax) return 'borderline';
      return 'high';
    }
    case 'heart_rate': {
      const r = VITAL_REFERENCE_RANGES.heart_rate;
      if (value1 < r.normalMin) return 'low';
      if (value1 > r.normalMax) return 'high';
      return 'normal';
    }
    case 'blood_sugar_post_meal':
    case 'weight':
      return 'normal';
  }
}
