import { describe, expect, it } from 'vitest';
import { assertLocalhost, getSupabaseTestConfig } from './setup/supabase-config.js';

describe('localhost safety guard', () => {
  it('accepts local stack URLs', () => {
    expect(() => assertLocalhost('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertLocalhost('http://localhost:54321')).not.toThrow();
  });

  it('refuses cloud and LAN hosts', () => {
    expect(() => assertLocalhost('https://abcdefgh.supabase.co')).toThrow(/non-local/);
    expect(() => assertLocalhost('http://192.168.1.10:54321')).toThrow(/non-local/);
    expect(() => assertLocalhost('https://db.example.com')).toThrow(/non-local/);
  });

  it('the resolved test config itself points at localhost', () => {
    const config = getSupabaseTestConfig();
    expect(['127.0.0.1', 'localhost']).toContain(new URL(config.url).hostname);
  });
});
