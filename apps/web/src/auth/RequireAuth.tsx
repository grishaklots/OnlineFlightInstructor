import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import AuthStatus from './AuthStatus'

export default function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status !== 'ready') {
    return (
      <main id="main-content" tabIndex={-1}>
        <h1>Instructor sign-in</h1>
        <AuthStatus />
      </main>
    )
  }
  if (!state.session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
