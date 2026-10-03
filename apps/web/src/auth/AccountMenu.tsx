import { useState } from 'react'
import { authErrorMessage, useAuth } from './AuthContext'

export default function AccountMenu() {
  const { state, signOut } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!state.session) return null

  async function logout() {
    setPending(true)
    setError(null)
    try {
      await signOut()
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-label="Instructor account">
      <p>Signed in as {state.session.user.email ?? 'instructor'}</p>
      <button type="button" disabled={pending} onClick={() => void logout()}>
        {pending ? 'Signing out...' : 'Logout'}
      </button>
      {error && <p role="alert">Logout failed: {error}</p>}
    </section>
  )
}
