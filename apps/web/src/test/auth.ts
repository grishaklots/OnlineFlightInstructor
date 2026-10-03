import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { vi } from 'vitest'
import type { BrowserAuth } from '../auth/client'

export function createTestSession(
  id = 'instructor-a',
  token = 'synthetic-token',
): Session {
  return {
    access_token: token,
    refresh_token: 'synthetic-refresh-token',
    expires_in: 3600,
    expires_at: 2_000_000_000,
    token_type: 'bearer',
    user: {
      id,
      email: `${id}@example.invalid`,
      aud: 'authenticated',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

export function createAuthMock(initialSession: Session | null = null) {
  const listeners = new Set<Parameters<BrowserAuth['onAuthStateChange']>[0]>()
  const unsubscribe = vi.fn()

  function emit(event: AuthChangeEvent, session: Session | null) {
    for (const listener of listeners) void listener(event, session)
  }

  const client = {
    getSession: vi
      .fn<BrowserAuth['getSession']>()
      .mockResolvedValue(
        initialSession
          ? { data: { session: initialSession }, error: null }
          : { data: { session: null }, error: null },
      ),
    onAuthStateChange: vi
      .fn<BrowserAuth['onAuthStateChange']>()
      .mockImplementation((callback) => {
        listeners.add(callback)
        return {
          data: {
            subscription: {
              id: 'synthetic-subscription',
              callback,
              unsubscribe: () => {
                listeners.delete(callback)
                unsubscribe()
              },
            },
          },
        }
      }),
    signInWithPassword: vi
      .fn<BrowserAuth['signInWithPassword']>()
      .mockImplementation(async () => {
        const session = initialSession ?? createTestSession()
        emit('SIGNED_IN', session)
        return { data: { user: session.user, session }, error: null }
      }),
    signOut: vi.fn<BrowserAuth['signOut']>().mockImplementation(async () => {
      emit('SIGNED_OUT', null)
      return { error: null }
    }),
  } satisfies BrowserAuth

  return { client, emit, unsubscribe }
}
