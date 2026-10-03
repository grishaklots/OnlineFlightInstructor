type HealthResponse = { status: 'ok' }

export async function getApiHealth(
  signal: AbortSignal,
): Promise<HealthResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  const url = new URL('/health', baseUrl)
  const response = await fetch(url.toString(), { signal })

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    body.status !== 'ok'
  ) {
    throw new Error('The API returned an unexpected health response.')
  }

  return { status: 'ok' }
}
