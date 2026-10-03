import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import ApiHealth from './ApiHealth'
import AppProviders from './AppProviders'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function renderHealth() {
  render(
    <AppProviders>
      <ApiHealth />
    </AppProviders>,
  )
}

it('shows checking while the request is pending', () => {
  fetchMock.mockReturnValue(new Promise(() => {}))
  renderHealth()

  expect(screen.getByRole('status')).toHaveTextContent(
    'API status: checking...',
  )
  expect(screen.getByRole('button', { name: 'Check API' })).toBeDisabled()
})

it('calls the local API directly and shows online for a valid response', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })))
  renderHealth()

  await screen.findByText('API status: online')
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health', {
    signal: expect.any(AbortSignal),
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check API' })).toBeEnabled()
})

it('uses an explicitly configured API base URL', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8017/')
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })))
  renderHealth()

  await screen.findByText('API status: online')
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:8017/health', {
    signal: expect.any(AbortSignal),
  })
})

it('shows network errors and lets the user retry after starting the API', async () => {
  const user = userEvent.setup()
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ status: 'ok' })),
  )
  renderHealth()

  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
  expect(screen.getByRole('status')).toHaveTextContent(
    'API status: unavailable',
  )

  await user.click(screen.getByRole('button', { name: 'Check API' }))

  await screen.findByText('API status: online')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('does not treat an HTTP failure as healthy', async () => {
  fetchMock.mockResolvedValue(new Response('Unavailable', { status: 503 }))
  renderHealth()

  expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503')
  expect(screen.getByRole('status')).toHaveTextContent(
    'API status: unavailable',
  )
})

it.each([null, {}, { status: 'error' }, { status: 200 }])(
  'rejects an unexpected successful-response body: %j',
  async (body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)))
    renderHealth()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'unexpected health response',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'API status: unavailable',
    )
  },
)

it('does not treat a non-JSON response as healthy', async () => {
  fetchMock.mockResolvedValue(new Response('<html>not the API</html>'))
  renderHealth()

  await screen.findByRole('alert')
  expect(screen.getByRole('status')).toHaveTextContent(
    'API status: unavailable',
  )
})
