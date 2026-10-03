export function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  return new URL(path, baseUrl).toString()
}
