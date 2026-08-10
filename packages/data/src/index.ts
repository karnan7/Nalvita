/**
 * @nalvita/data — the app's data layer, shared by web and React Native.
 *
 * Everything here is React Query hooks over Supabase, plus the small amount of
 * presentation-free logic that goes with them (labels, formatters, permission
 * checks). It holds no UI and touches no browser API: the Supabase client and
 * the two or three platform capabilities it needs arrive through
 * `NalvitaDataProvider`, so the same hooks back both apps.
 *
 * Row-level security is still the whole authorization layer — nothing here
 * grants access, it only asks.
 */

export * from './client.js';
export * from './auth-context.js';
export * from './auth-provider.js';
export * from './active-profile-context.js';

export * from './profile.js';
export * from './documents.js';
export * from './medicines.js';
export * from './vitals.js';
export * from './allergies.js';
export * from './conditions.js';
export * from './doctors.js';
export * from './dashboard.js';
export * from './timeline.js';
export * from './circle.js';
export * from './managed-profiles.js';
export * from './family-overview.js';
export * from './audit.js';
export * from './secrets.js';
