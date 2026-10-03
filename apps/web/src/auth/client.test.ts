import { createClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  vi.mocked(createClient).mockReset()
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
})

it('requires public frontend configuration without creating a client', async () => {
  const { getAuthClient } = await import('./client')

  expect(() => getAuthClient()).toThrow('Set VITE_SUPABASE_URL')
  expect(createClient).not.toHaveBeenCalled()
})

it.each(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'])(
  'configures persisted sessions and automatic refresh using %s',
  async (keyName) => {
    const { getAuthClient } = await import('./client')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.example.invalid')
    vi.stubEnv(keyName, 'synthetic-public-key')
    vi.mocked(createClient).mockImplementationOnce(() => {
      throw new Error('Client construction probe')
    })

    expect(() => getAuthClient()).toThrow('Client construction probe')
    expect(createClient).toHaveBeenCalledWith(
      'https://project.example.invalid',
      'synthetic-public-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      },
    )
  },
)

it('prefers a nonempty publishable key when both aliases are supplied', async () => {
  const { getAuthClient } = await import('./client')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.example.invalid')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'synthetic-legacy-key')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'synthetic-modern-key')
  vi.mocked(createClient).mockImplementationOnce(() => {
    throw new Error('Client construction probe')
  })

  expect(() => getAuthClient()).toThrow('Client construction probe')
  expect(createClient).toHaveBeenCalledWith(
    'https://project.example.invalid',
    'synthetic-modern-key',
    expect.any(Object),
  )
})
