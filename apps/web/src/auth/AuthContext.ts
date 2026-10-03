import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'ready'; session: Session | null }
  | { status: 'error'; session: null; error: string }

type AuthContextValue = {
  state: AuthState
  canRetry: boolean
  retry: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}

export function authErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected authentication error occurred.'
}
