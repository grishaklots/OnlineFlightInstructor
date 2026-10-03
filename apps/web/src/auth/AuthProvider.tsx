import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiHealthQueryKey } from '../api/health'
import { AuthContext, authErrorMessage, type AuthState } from './AuthContext'
import { getAuthClient, type BrowserAuth } from './client'

type ClientSetup =
  { client: BrowserAuth; error: null } | { client: null; error: string }

function initializeClient(): ClientSetup {
  try {
    return { client: getAuthClient(), error: null }
  } catch (error) {
    return {
      client: null,
      error: `Authentication configuration failed: ${authErrorMessage(error)}`,
    }
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [setup] = useState(initializeClient)
  const [state, setState] = useState<AuthState>(() =>
    setup.client
      ? { status: 'loading', session: null }
      : { status: 'error', session: null, error: setup.error },
  )
  const [attempt, setAttempt] = useState(0)
  const userId = useRef<string | null>(null)

  useEffect(() => {
    const client = setup.client
    if (!client) return
    let active = true
    let revision = 0

    function applySession(session: Session | null) {
      const nextUserId = session?.user.id ?? null
      if (!session || nextUserId !== userId.current) {
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== apiHealthQueryKey[0],
        })
      }
      userId.current = nextUserId
      setState({ status: 'ready', session })
    }

    const { data } = client.onAuthStateChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return
      revision += 1
      applySession(session)
    })

    const initialRevision = revision
    void client.getSession().then(
      ({ data: restored, error }) => {
        // A newer auth event must win over an older restoration result.
        if (!active || revision !== initialRevision) return
        if (error) {
          setState({
            status: 'error',
            session: null,
            error: `Unable to restore sign-in: ${error.message}`,
          })
        } else {
          applySession(restored.session)
        }
      },
      (error: unknown) => {
        if (!active || revision !== initialRevision) return
        setState({
          status: 'error',
          session: null,
          error: `Unable to restore sign-in: ${authErrorMessage(error)}`,
        })
      },
    )

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [setup, attempt, queryClient])

  function requireClient(): BrowserAuth {
    if (!setup.client) throw new Error(setup.error)
    return setup.client
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await requireClient().signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    if (!data.session) {
      throw new Error('Supabase did not return a signed-in session.')
    }
  }

  async function signOut() {
    const { error } = await requireClient().signOut()
    if (error) throw error
  }

  function retry() {
    requireClient()
    setState({ status: 'loading', session: null })
    setAttempt((value) => value + 1)
  }

  return (
    <AuthContext.Provider
      value={{
        state,
        canRetry: setup.client !== null,
        retry,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
