import { MAX_MANAGED_PROFILES, type Profile } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import {
  claimLink,
  isAtProfileCap,
  managedName,
  remainingProfileSlots,
  viewingManagedProfile,
} from './managed-profiles.js';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '00000000-0000-4000-8000-0000000000ab',
    user_id: null,
    managed_by: '00000000-0000-4000-8000-000000000001',
    full_name: 'Amma',
    date_of_birth: '1955-03-12',
    gender: 'female',
    blood_group: 'O+',
    height_cm: null,
    weight_kg: null,
    is_minor: false,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function manyProfiles(count: number): Profile[] {
  return Array.from({ length: count }, (_, index) =>
    profile({ id: `00000000-0000-4000-8000-00000000ab${index}` }),
  );
}

describe('managedName', () => {
  it('uses their name', () => {
    expect(managedName(profile())).toBe('Amma');
  });

  it('falls back rather than showing an empty card', () => {
    expect(managedName(profile({ full_name: null }))).toBe('Unnamed profile');
    expect(managedName(profile({ full_name: '   ' }))).toBe('Unnamed profile');
  });
});

describe('the profile cap', () => {
  it('is not reached before the limit', () => {
    expect(isAtProfileCap(manyProfiles(MAX_MANAGED_PROFILES - 1))).toBe(false);
    expect(remainingProfileSlots(manyProfiles(MAX_MANAGED_PROFILES - 1))).toBe(1);
  });

  it('is reached at the limit', () => {
    expect(isAtProfileCap(manyProfiles(MAX_MANAGED_PROFILES))).toBe(true);
    expect(remainingProfileSlots(manyProfiles(MAX_MANAGED_PROFILES))).toBe(0);
  });

  it('never reports a negative number of slots', () => {
    expect(remainingProfileSlots(manyProfiles(MAX_MANAGED_PROFILES + 3))).toBe(0);
  });

  it('treats a profile list that has not loaded as empty', () => {
    expect(isAtProfileCap(undefined)).toBe(false);
    expect(remainingProfileSlots(undefined)).toBe(MAX_MANAGED_PROFILES);
  });
});

describe('viewingManagedProfile', () => {
  it('opens their records under their own profile id, with full access', () => {
    const person = viewingManagedProfile(profile());
    expect(person.counterpart_id).toBe('00000000-0000-4000-8000-0000000000ab');
    expect(person.counterpart_name).toBe('Amma');
    expect(person.role).toBe('manager');
    expect(person.shared_categories).toEqual(['all']);
    expect(person.status).toBe('active');
  });

  it('names the profile where a membership id would go, since there is none', () => {
    const managed = profile();
    expect(viewingManagedProfile(managed).membership_id).toBe(managed.id);
  });

  it('carries an unnamed profile through as null rather than inventing a name', () => {
    expect(viewingManagedProfile(profile({ full_name: null })).counterpart_name).toBeNull();
  });
});

describe('claimLink', () => {
  it('puts the secret in the link the person opens', () => {
    expect(claimLink('https://nalvita.app', 'deadbeef')).toBe(
      'https://nalvita.app/profile/claim?token=deadbeef',
    );
  });
});
