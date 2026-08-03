/** Blood groups — mirrors the `blood_group` Postgres enum. */
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

/** Document categories. */
export const DOCUMENT_CATEGORIES = [
  'lab_report',
  'xray_scan',
  'prescription',
  'consultation',
  'vaccination',
  'insurance',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Max upload size: 20 MB. */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

/** Medicine schedule. */
export const MEDICINE_FREQUENCIES = [
  'once_daily',
  'twice_daily',
  'thrice_daily',
  'as_needed',
] as const;
export type MedicineFrequency = (typeof MEDICINE_FREQUENCIES)[number];

export const MEDICINE_TIMINGS = ['morning', 'afternoon', 'night'] as const;
export type MedicineTiming = (typeof MEDICINE_TIMINGS)[number];

export const MEDICINE_STATUSES = ['active', 'stopped'] as const;
export type MedicineStatus = (typeof MEDICINE_STATUSES)[number];

/** Vital types. */
export const VITAL_TYPES = [
  'blood_pressure',
  'blood_sugar_fasting',
  'blood_sugar_post_meal',
  'weight',
  'heart_rate',
] as const;
export type VitalType = (typeof VITAL_TYPES)[number];

export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export const CONDITION_STATUSES = ['active', 'managed', 'resolved'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

/** Health Circle roles — mirrors the `circle_role` Postgres enum. */
export const CIRCLE_ROLES = ['viewer', 'caregiver', 'manager'] as const;
export type CircleRole = (typeof CIRCLE_ROLES)[number];

/** Membership lifecycle — mirrors the `membership_status` Postgres enum. */
export const MEMBERSHIP_STATUSES = ['pending', 'active', 'revoked'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Invite lifecycle — mirrors the `invite_status` Postgres enum. */
export const INVITE_STATUSES = ['pending', 'accepted', 'declined', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/** Digits in the manual-entry invite code; the link carries a longer secret. */
export const INVITE_CODE_LENGTH = 6;

/** How long an invite stays valid — mirrors the `circle_invites.expires_at` default. */
export const INVITE_TTL_HOURS = 24;

/**
 * Categories a Health Circle membership can share. These match the health
 * table names used by `has_circle_access()`; 'all' is a wildcard.
 */
export const SHARE_CATEGORIES = [
  'all',
  'profiles',
  'documents',
  'medicines',
  'vitals',
  'allergies',
  'conditions',
  'doctors',
] as const;
export type ShareCategory = (typeof SHARE_CATEGORIES)[number];

/**
 * Reference ranges for vital status badges.
 * BP: Normal < 120/80, Elevated 120–129/<80, High ≥ 130/80.
 * Fasting sugar: Normal 70–99, Prediabetic 100–125, Diabetic ≥ 126 mg/dL.
 * Heart rate: Normal 60–100 bpm at rest.
 */
export const VITAL_REFERENCE_RANGES = {
  blood_pressure: { normalSystolic: 120, elevatedSystolic: 130, normalDiastolic: 80 },
  blood_sugar_fasting: { normalMin: 70, normalMax: 99, borderlineMax: 125 },
  heart_rate: { normalMin: 60, normalMax: 100 },
} as const;

export const VITAL_STATUSES = ['normal', 'borderline', 'high', 'low'] as const;
export type VitalStatus = (typeof VITAL_STATUSES)[number];
