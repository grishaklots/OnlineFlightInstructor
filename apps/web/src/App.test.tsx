import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AppProviders from './AppProviders'
import { getAuthClient } from './auth/client'
import { createAuthMock, createTestSession } from './test/auth'

vi.mock('./auth/client', () => ({ getAuthClient: vi.fn() }))

let auth = createAuthMock()

beforeEach(() => {
  auth = createAuthMock(createTestSession())
  vi.mocked(getAuthClient).mockReturnValue(auth.client)
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (input) =>
          new Response(
            JSON.stringify(
              String(input).endsWith('/api/me')
                ? { id: 'instructor-a' }
                : { status: 'ok', database: 'ok' },
            ),
          ),
      ),
  )
})

async function renderRoute(path: string) {
  if (path.startsWith('/student/')) {
    auth.client.getSession.mockReturnValue(new Promise(() => {}))
  }
  const result = render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProviders>,
  )
  if (!path.startsWith('/student/')) {
    await screen.findByText('API status: online')
  }
  return result
}

describe('placeholder routes', () => {
  it.each([
    ['/students', 'Students'],
    ['/students/example-student', 'Student details'],
    ['/landing-slots', 'Landing slots'],
    ['/admin', 'Administration'],
    ['/student/example-token', 'Student portal'],
  ])('renders %s on direct navigation', async (path, title) => {
    await renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(screen.getByText(/This page is a placeholder/)).toBeInTheDocument()
  })

  it('uses the student list as the initial route', async () => {
    await renderRoute('/')

    expect(
      screen.getByRole('heading', { name: 'Students' }),
    ).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', async () => {
    await renderRoute('/unknown')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('supports navigation without reloading the page', async () => {
    const user = userEvent.setup()
    await renderRoute('/students')

    await user.click(screen.getByRole('link', { name: 'Landing slots' }))

    expect(
      screen.getByRole('heading', { name: 'Landing slots' }),
    ).toBeInTheDocument()
  })

  it('does not display student tokens or instructor navigation in the portal', async () => {
    await renderRoute('/student/example-token')

    expect(screen.queryByText('example-token')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

it('provides a TanStack Query client to the application', async () => {
  let client: QueryClient | undefined
  function QueryProbe() {
    client = useQueryClient()
    return null
  }

  await act(async () => {
    render(
      <AppProviders>
        <QueryProbe />
      </AppProviders>,
    )
  })

  expect(client).toBeInstanceOf(QueryClient)
})
