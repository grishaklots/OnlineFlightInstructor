import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { apiIdentityQueryKey, getApiIdentity } from './api/identity'
import { useAuth } from './auth/AuthContext'

function SignedInIdentity({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const previousToken = useRef(session.access_token)
  const identity = useQuery({
    queryKey: apiIdentityQueryKey(session.user.id),
    queryFn: ({ signal }) =>
      getApiIdentity(session.access_token, session.user.id, signal),
    retry: false,
  })

  useEffect(() => {
    if (previousToken.current !== session.access_token) {
      previousToken.current = session.access_token
      const queryKey = apiIdentityQueryKey(session.user.id)
      void queryClient
        .cancelQueries({ queryKey })
        .then(() => queryClient.invalidateQueries({ queryKey }))
    }
  }, [session.access_token, session.user.id, queryClient])

  return (
    <section aria-label="Authenticated API connection">
      <p role="status">
        Backend identity:{' '}
        {identity.isFetching || identity.isPending
          ? 'checking...'
          : identity.isSuccess
            ? 'verified'
            : 'unavailable'}
      </p>
      {identity.isError && <p role="alert">{identity.error.message}</p>}
      <button
        type="button"
        disabled={identity.isFetching}
        onClick={() => void identity.refetch()}
      >
        Check identity
      </button>
    </section>
  )
}

export default function ApiIdentity() {
  const { state } = useAuth()
  return state.session ? (
    <SignedInIdentity key={state.session.user.id} session={state.session} />
  ) : null
}
