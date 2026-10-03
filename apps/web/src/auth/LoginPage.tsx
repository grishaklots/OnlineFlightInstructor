import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authErrorMessage, useAuth } from './AuthContext'
import AuthStatus from './AuthStatus'

function returnPath(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    typeof value.from === 'string' &&
    (['/students', '/landing-slots', '/admin'].includes(value.from) ||
      /^\/students\/[^/?#\\]+$/.test(value.from))
  ) {
    return value.from
  }
  return '/students'
}

export default function LoginPage() {
  const { state, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.session) {
    return <Navigate to={returnPath(location.state)} replace />
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      setPending(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <h1>Login</h1>
      {state.status !== 'ready' ? (
        <AuthStatus />
      ) : (
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <p>Sign in with your existing instructor account.</p>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            disabled={pending}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      )}
    </main>
  )
}
