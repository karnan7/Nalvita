import { describe, expect, it } from 'vitest';
import { NOTIFICATION_DETAIL_LEVELS, NOTIFICATION_TYPES, PUSH_PLATFORMS } from '../constants.js';
import {
  notificationPayloadSchema,
  notificationSendSchema,
  pushTokenInsertSchema,
  pushTokenSchema,
} from './push-token.js';

const USER = '11111111-1111-4111-8111-111111111111';

describe('pushTokenSchema', () => {
  it('parses a row as the database returns it', () => {
    const result = pushTokenSchema.safeParse({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: USER,
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'android',
      device_label: 'Pixel 7',
      last_seen_at: '2026-08-20T10:00:00+00:00',
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a device that never gave itself a name', () => {
    const result = pushTokenSchema.safeParse({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: USER,
      token: 'token-1',
      platform: 'web',
      device_label: null,
      last_seen_at: '2026-08-20T10:00:00+00:00',
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a platform the send path has no way to reach', () => {
    const result = pushTokenSchema.safeParse({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: USER,
      token: 'token-1',
      platform: 'blackberry',
      device_label: null,
      last_seen_at: '2026-08-20T10:00:00+00:00',
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty token, which would register a device that cannot be reached', () => {
    const result = pushTokenSchema.safeParse({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: USER,
      token: '',
      platform: 'ios',
      device_label: null,
      last_seen_at: '2026-08-20T10:00:00+00:00',
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(false);
  });
});

describe('pushTokenInsertSchema', () => {
  /**
   * The account is taken from the session at the call site. Accepting one from
   * the caller would let a client register a device against somebody else.
   */
  it('does not accept an account from the caller', () => {
    const parsed = pushTokenInsertSchema.parse({
      token: 'token-1',
      platform: 'ios',
      device_label: 'iPhone',
      user_id: USER,
    });

    expect(parsed).not.toHaveProperty('user_id');
  });

  it('mirrors the columns the app actually supplies', () => {
    expect(Object.keys(pushTokenInsertSchema.shape).sort()).toEqual([
      'device_label',
      'platform',
      'token',
    ]);
  });
});

describe('notificationSendSchema', () => {
  it('parses a delivery record', () => {
    const result = notificationSendSchema.safeParse({
      id: 1,
      user_id: USER,
      notification_type: 'medicine_reminder',
      device_count: 2,
      delivered_count: 1,
      failed_count: 1,
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(true);
  });

  /**
   * The privacy invariant behind the whole table: it counts sends, it does not
   * remember them. A body field appearing here would be a health-data leak
   * wearing a monitoring badge.
   */
  it('has no field that could hold what a notification said', () => {
    const fields = Object.keys(notificationSendSchema.shape);

    expect(fields).not.toContain('body');
    expect(fields).not.toContain('title');
    expect(fields).not.toContain('payload');
    expect(fields).not.toContain('resource_id');
  });

  it('rejects a negative count, which is a bug rather than a delivery', () => {
    const result = notificationSendSchema.safeParse({
      id: 1,
      user_id: USER,
      notification_type: 'medicine_reminder',
      device_count: -1,
      delivered_count: 0,
      failed_count: 0,
      created_at: '2026-08-20T10:00:00+00:00',
    });

    expect(result.success).toBe(false);
  });
});

describe('notificationPayloadSchema', () => {
  const payload = {
    user_id: USER,
    type: 'medicine_reminder',
    title: 'Medicine reminder',
    body: 'Time for your Metformin',
    genericBody: 'Time for your 2pm medicine',
  };

  it('parses what a feature hands the send function', () => {
    expect(notificationPayloadSchema.safeParse(payload).success).toBe(true);
  });

  /**
   * Both bodies are required rather than the generic one being derived. Only
   * the feature knows how to say its own thing without naming a medicine — a
   * truncation rule applied centrally would leak by accident.
   */
  it('will not accept a detailed body without a generic one to fall back to', () => {
    const { genericBody: _omitted, ...withoutGeneric } = payload;

    expect(notificationPayloadSchema.safeParse(withoutGeneric).success).toBe(false);
  });

  it('rejects a type no feature declared, so the set stays enumerable', () => {
    const result = notificationPayloadSchema.safeParse({ ...payload, type: 'something_new' });

    expect(result.success).toBe(false);
  });

  it('leaves the route out when there is nowhere particular to land', () => {
    const parsed = notificationPayloadSchema.parse(payload);

    expect(parsed.route).toBeUndefined();
  });
});

describe('the constants these mirror', () => {
  it('covers the three places a token can live', () => {
    expect([...PUSH_PLATFORMS]).toEqual(['ios', 'android', 'web']);
  });

  /**
   * Order matters here: 'generic' is first because it is the database default,
   * and the safe mode is the one a user who never opens settings gets.
   */
  it('makes the private detail level the default one', () => {
    expect(NOTIFICATION_DETAIL_LEVELS[0]).toBe('generic');
  });

  it('has a type reserved for proving the pipeline works', () => {
    expect([...NOTIFICATION_TYPES]).toContain('test_notification');
  });
});
