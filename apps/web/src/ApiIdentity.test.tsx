import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import ApiIdentity from './ApiIdentity'
import { apiIdentityQueryKey, getApiIdentity } from './api/identity'
import { useAuth } from './auth/AuthContext'
import { createTestSession } from './test/auth'

vi.mock('./auth/AuthContext', () => ({ useAuth: vi.fn() }))

const fetchMock = vi.fn<typeof fetch>()
let session: ReturnType<typeof createTestSession> | null
let queryClient: QueryClient

function mockState() {
  vi.mocked(useAuth).mockReturnValue({
    state: { status: 'ready', session },
    canRetry: true,
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })
}

beforeEach(() => {
  session = createTestSession()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mockState()
  fetchMock
    .mockReset()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: session?.user.id })),
    )
  vi.stubGlobal('fetch', fetchMock)
})

function renderIdentity() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiIdentity />
    </QueryClientProvider>,
  )
}

it('does not send authenticated requests when signed out', () => {
  session = null
  mockState()
  renderIdentity()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByText(/Backend identity/)).not.toBeInTheDocument()
})

it('sends only the access token as a Bearer header and verifies the subject', async () => {
  renderIdentity()
  await screen.findByText('Backend identity: verified')
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/me', {
    signal: expect.any(AbortSignal),
    headers: { Authorization: 'Bearer synthetic-token' },
  })
  expect(queryClient.getQueryData(apiIdentityQueryKey('instructor-a'))).toEqual(
    { id: 'instructor-a' },
  )
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ),
  ).not.toContain('synthetic-token')
  expect(document.body.textContent).not.toContain('synthetic-token')
  expect(document.body.textContent).not.toContain('synthetic-refresh-token')
})

it('uses the configured API base URL', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8024')
  renderIdentity()
  await screen.findByText('Backend identity: verified')
  expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8024/api/me')
})

it('reports a rejected session without exposing the server response or token', async () => {
  fetchMock.mockResolvedValue(
    new Response('private server diagnostic', { status: 401 }),
  )
  renderIdentity()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'API rejected this session',
  )
  expect(screen.getByText('Backend identity: unavailable')).toBeInTheDocument()
  expect(document.body.textContent).not.toContain('private server diagnostic')
  expect(document.body.textContent).not.toContain('synthetic-token')
})

it('reports unavailable verification and permits retry', async () => {
  fetchMock.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
  renderIdentity()
  expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503')
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Check identity' }))
  await screen.findByText('Backend identity: verified')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each([null, {}, { id: 123 }, { id: '' }, { id: 'instructor-b' }])(
  'rejects an unexpected identity: %j',
  async (body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)))
    renderIdentity()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'unexpected authenticated identity',
    )
  },
)

it('does not treat network failure as successful verification', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  renderIdentity()
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
})

it('cancels the identity request when the signed-in account disappears', async () => {
  fetchMock.mockReturnValue(new Promise(() => {}))
  const view = renderIdentity()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  const signal = fetchMock.mock.calls[0]?.[1]?.signal
  session = null
  mockState()
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <ApiIdentity />
    </QueryClientProvider>,
  )
  expect(signal?.aborted).toBe(true)
})

it('rechecks the identity using a refreshed access token without a token cache key', async () => {
  const view = renderIdentity()
  await screen.findByText('Backend identity: verified')
  session = createTestSession('instructor-a', 'refreshed-token')
  mockState()
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <ApiIdentity />
    </QueryClientProvider>,
  )
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8000/api/me', {
      signal: expect.any(AbortSignal),
      headers: { Authorization: 'Bearer refreshed-token' },
    }),
  )
  await screen.findByText('Backend identity: verified')
  expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
})

it('requires valid JSON for authenticated identity responses', async () => {
  fetchMock.mockResolvedValue(new Response('not-json'))
  await expect(
    getApiIdentity(
      'synthetic-token',
      'instructor-a',
      new AbortController().signal,
    ),
  ).rejects.toThrow()
})

it('replaces an in-flight old-token check when the session refreshes', async () => {
  fetchMock.mockReturnValueOnce(new Promise(() => {}))
  const view = renderIdentity()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  const oldSignal = fetchMock.mock.calls[0]?.[1]?.signal
  session = createTestSession('instructor-a', 'refreshed-token')
  mockState()
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <ApiIdentity />
    </QueryClientProvider>,
  )
  await screen.findByText('Backend identity: verified')
  expect(oldSignal?.aborted).toBe(true)
  expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8000/api/me', {
    signal: expect.any(AbortSignal),
    headers: { Authorization: 'Bearer refreshed-token' },
  })
})
