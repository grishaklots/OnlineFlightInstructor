import { apiUrl } from './client'

export type ApiIdentity = { id: string }

export const apiIdentityQueryKey = (id: string) => ['api-me', id] as const

export async function getApiIdentity(
  accessToken: string,
  expectedUserId: string,
  signal: AbortSignal,
): Promise<ApiIdentity> {
  const response = await fetch(apiUrl('/api/me'), {
    signal,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'The API rejected this session. Sign in again or check Auth configuration.'
        : `Authenticated API check failed with HTTP ${response.status}.`,
    )
  }
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !body.id ||
    body.id !== expectedUserId
  ) {
    throw new Error('The API returned an unexpected authenticated identity.')
  }
  return { id: body.id }
}
