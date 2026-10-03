import { apiUrl } from './client'

type HealthResponse = { status: 'ok'; database: 'ok' }

export const apiHealthQueryKey = ['api-health'] as const

export async function getApiHealth(
  signal: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(apiUrl('/health'), { signal })

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    body.status !== 'ok' ||
    !('database' in body) ||
    body.database !== 'ok'
  ) {
    throw new Error('The API returned an unexpected health response.')
  }

  return { status: 'ok', database: 'ok' }
}
