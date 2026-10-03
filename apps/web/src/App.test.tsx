import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import AppProviders from './AppProviders'

function renderRoute(path: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('placeholder routes', () => {
  it.each([
    ['/login', 'Login'],
    ['/students', 'Students'],
    ['/students/example-student', 'Student details'],
    ['/landing-slots', 'Landing slots'],
    ['/admin', 'Administration'],
    ['/student/example-token', 'Student portal'],
  ])('renders %s on direct navigation', (path, title) => {
    renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(screen.getByText(/This page is a placeholder/)).toBeInTheDocument()
  })

  it('uses the student list as the initial route', () => {
    renderRoute('/')

    expect(
      screen.getByRole('heading', { name: 'Students' }),
    ).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', () => {
    renderRoute('/unknown')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('supports navigation without reloading the page', async () => {
    const user = userEvent.setup()
    renderRoute('/students')

    await user.click(screen.getByRole('link', { name: 'Landing slots' }))

    expect(
      screen.getByRole('heading', { name: 'Landing slots' }),
    ).toBeInTheDocument()
  })

  it('does not display student tokens or instructor navigation in the portal', () => {
    renderRoute('/student/example-token')

    expect(screen.queryByText('example-token')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

it('provides a TanStack Query client to the application', () => {
  let client: QueryClient | undefined
  function QueryProbe() {
    client = useQueryClient()
    return null
  }

  render(
    <AppProviders>
      <QueryProbe />
    </AppProviders>,
  )

  expect(client).toBeInstanceOf(QueryClient)
})
