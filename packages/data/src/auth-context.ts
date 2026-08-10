import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export interface AuthState {
  /** The current Supabase session, or null when signed out. */
  session: Session | null;
  /** True until the initial session lookup finishes. */
  loading: boolean;
}

export const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}
