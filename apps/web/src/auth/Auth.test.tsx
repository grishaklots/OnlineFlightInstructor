import { AuthError, type Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { createAuthMock, createTestSession } from '../test/auth'
import { useAuth } from './AuthContext'
import AuthProvider from './AuthProvider'
import { getAuthClient } from './client'

vi.mock('./client', () => ({ getAuthClient: vi.fn() }))

let auth = createAuthMock()
let queryClient: QueryClient
let observedSession: Session | null

beforeEach(() => {
  auth = createAuthMock()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  observedSession = null
  vi.mocked(getAuthClient).mockReset().mockReturnValue(auth.client)
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (input) =>
          new Response(
            JSON.stringify(
              String(input).endsWith('/api/me')
                ? { id: observedSession?.user.id ?? 'instructor-a' }
                : { status: 'ok', database: 'ok' },
            ),
          ),
      ),
  )
})

function SessionProbe() {
  const session = useAuth().state.session
  useEffect(() => {
    observedSession = session
  }, [session])
  return null
}

function renderApp(path = '/login', routeState?: unknown) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProbe />
        <MemoryRouter initialEntries={[{ pathname: path, state: routeState }]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

async function enterCredentials() {
  const user = userEvent.setup()
  await user.type(
    await screen.findByLabelText('Email'),
    'instructor-a@example.invalid',
  )
  await user.type(screen.getByLabelText('Password'), 'synthetic-password')
  return user
}

it('logs in through Supabase and returns to the requested instructor page', async () => {
  renderApp('/landing-slots')
  const user = await enterCredentials()

  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  await screen.findByRole('heading', { name: 'Landing slots' })
  expect(auth.client.signInWithPassword).toHaveBeenCalledWith({
    email: 'instructor-a@example.invalid',
    password: 'synthetic-password',
  })
  expect(screen.getByText(/Signed in as/)).toHaveTextContent(
    'instructor-a@example.invalid',
  )
  expect(screen.queryByText('synthetic-token')).not.toBeInTheDocument()
})

it('displays invalid credentials without exposing an instructor page', async () => {
  auth.client.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: new AuthError('Invalid login credentials', 400),
  })
  renderApp('/students')
  const user = await enterCredentials()

  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid login credentials',
  )
  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})

it('displays rejected network requests and permits retrying login', async () => {
  auth.client.signInWithPassword.mockRejectedValueOnce(
    new TypeError('Failed to fetch'),
  )
  renderApp()
  const user = await enterCredentials()
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')

  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('heading', { name: 'Students' })
})

it('disables duplicate submissions while login is pending', async () => {
  auth.client.signInWithPassword.mockReturnValue(new Promise(() => {}))
  renderApp()
  const user = await enterCredentials()

  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
  expect(screen.getByLabelText('Email')).toBeDisabled()
  expect(screen.getByLabelText('Password')).toBeDisabled()
  expect(auth.client.signInWithPassword).toHaveBeenCalledTimes(1)
})

it('requires valid email and password fields', async () => {
  renderApp()
  await screen.findByLabelText('Email')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(auth.client.signInWithPassword).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Email'), 'not-an-email')
  await user.type(screen.getByLabelText('Password'), 'synthetic-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(auth.client.signInWithPassword).not.toHaveBeenCalled()
})

it('restores an existing session on page startup without logging in again', async () => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  const first = renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  first.unmount()

  renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  expect(auth.client.getSession).toHaveBeenCalledTimes(2)
  expect(auth.client.signInWithPassword).not.toHaveBeenCalled()
})

it('logs out and clears cached data for the previous instructor', async () => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  await screen.findByText('Backend identity: verified')
  queryClient.setQueryData(['instructor-private'], 'old data')
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Logout' }))

  await screen.findByLabelText('Email')
  expect(auth.client.signOut).toHaveBeenCalledOnce()
  expect(queryClient.getQueryData(['instructor-private'])).toBeUndefined()
  expect(queryClient.getQueryData(['api-me', 'instructor-a'])).toBeUndefined()
  expect(observedSession).toBeNull()
})

it('shows logout errors and keeps the current session', async () => {
  auth = createAuthMock(createTestSession())
  auth.client.signOut.mockResolvedValue({
    error: new AuthError('Service unavailable', 503),
  })
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Logout' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Logout failed: Service unavailable',
  )
  expect(observedSession).not.toBeNull()
  expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument()
})

it('receives refreshed tokens without clearing same-user cached data', async () => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  queryClient.setQueryData(['instructor-private'], 'current data')
  const refreshed = createTestSession(
    'instructor-a',
    'synthetic-refreshed-token',
  )

  act(() => auth.emit('TOKEN_REFRESHED', refreshed))

  expect(observedSession?.access_token).toBe('synthetic-refreshed-token')
  expect(queryClient.getQueryData(['instructor-private'])).toBe('current data')
})

it('clears cached data on account switches and reacts to sign-out events', async () => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  renderApp('/students')
  await screen.findByRole('heading', { name: 'Students' })
  await screen.findByText('Backend identity: verified')
  queryClient.setQueryData(['instructor-private'], 'old data')

  act(() => auth.emit('SIGNED_IN', createTestSession('instructor-b')))
  expect(queryClient.getQueryData(['instructor-private'])).toBeUndefined()
  expect(queryClient.getQueryData(['api-me', 'instructor-a'])).toBeUndefined()
  act(() => auth.emit('SIGNED_OUT', null))

  await screen.findByLabelText('Email')
  expect(observedSession).toBeNull()
})

it('surfaces restoration errors and retries initialization', async () => {
  auth.client.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: new AuthError('Session restore unavailable', 503),
  })
  renderApp('/students')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Session restore unavailable',
  )
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  const user = userEvent.setup()

  await user.click(screen.getByRole('button', { name: 'Retry authentication' }))

  await screen.findByLabelText('Email')
  expect(auth.client.getSession).toHaveBeenCalledTimes(2)
  expect(auth.unsubscribe).toHaveBeenCalledTimes(1)
})

it('surfaces unexpectedly rejected restoration requests', async () => {
  auth.client.getSession.mockRejectedValue(new TypeError('Failed to fetch'))
  renderApp('/students')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to restore sign-in: Failed to fetch',
  )
})

it('does not let stale restoration overwrite a newer sign-out event', async () => {
  let resolve:
    | ((value: Awaited<ReturnType<typeof auth.client.getSession>>) => void)
    | undefined
  auth.client.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  renderApp('/students')
  expect(screen.getByText('Restoring sign-in...')).toBeInTheDocument()
  act(() => auth.emit('SIGNED_OUT', null))
  await screen.findByLabelText('Email')

  const finish = resolve
  if (!finish) throw new Error('The deferred restoration was not initialized.')
  await act(async () => {
    finish({ data: { session: createTestSession() }, error: null })
  })

  expect(observedSession).toBeNull()
  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
})

it('unsubscribes and ignores late restoration when unmounted', async () => {
  let resolve:
    | ((value: Awaited<ReturnType<typeof auth.client.getSession>>) => void)
    | undefined
  auth.client.getSession.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  const view = renderApp('/students')
  view.unmount()
  queryClient.setQueryData(['instructor-private'], 'retained data')

  const finish = resolve
  if (!finish) throw new Error('The deferred restoration was not initialized.')
  await act(async () => {
    auth.emit('SIGNED_IN', createTestSession())
    finish({ data: { session: createTestSession() }, error: null })
  })

  expect(auth.unsubscribe).toHaveBeenCalledOnce()
  expect(queryClient.getQueryData(['instructor-private'])).toBe('retained data')
})

it('reports missing configuration without a stuck loading state', async () => {
  vi.mocked(getAuthClient).mockImplementation(() => {
    throw new Error('Set public frontend configuration, then restart Vite.')
  })
  renderApp()

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Authentication configuration failed',
  )
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Retry authentication' }),
  ).not.toBeInTheDocument()
  await screen.findByText('API status: online')
})

it('keeps the student portal public even without instructor configuration', () => {
  vi.mocked(getAuthClient).mockImplementation(() => {
    throw new Error('Not configured')
  })
  renderApp('/student/synthetic-link')

  expect(
    screen.getByRole('heading', { name: 'Student portal' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

it.each([
  '//outside.example.invalid',
  '/\\outside.example.invalid',
  '/login?again=1',
])('rejects unsafe or looping return paths: %s', async (from) => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  renderApp('/login', { from })

  await screen.findByRole('heading', { name: 'Students' })
})
