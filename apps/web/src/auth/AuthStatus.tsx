import { useAuth } from './AuthContext'

export default function AuthStatus() {
  const { state, canRetry, retry } = useAuth()
  if (state.status === 'loading') {
    return <p role="status">Restoring sign-in...</p>
  }
  if (state.status === 'error') {
    return (
      <>
        <p role="alert">{state.error}</p>
        {canRetry && (
          <button type="button" onClick={retry}>
            Retry authentication
          </button>
        )}
      </>
    )
  }
  return null
}
