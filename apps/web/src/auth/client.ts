import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type BrowserAuth = Pick<
  SupabaseClient['auth'],
  'getSession' | 'onAuthStateChange' | 'signInWithPassword' | 'signOut'
>

let auth: BrowserAuth | undefined

export function getAuthClient(): BrowserAuth {
  if (auth) return auth

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the frontend .env.local, then restart Vite.',
    )
  }

  auth = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }).auth
  return auth
}
