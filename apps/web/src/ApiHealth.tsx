import { useQuery } from '@tanstack/react-query'
import { apiHealthQueryKey, getApiHealth } from './api/health'

export default function ApiHealth() {
  const health = useQuery({
    queryKey: apiHealthQueryKey,
    queryFn: ({ signal }) => getApiHealth(signal),
    retry: false,
  })

  return (
    <section className="api-health" aria-labelledby="api-health-heading">
      <h2 id="api-health-heading">API connection</h2>
      <p role="status">
        API status:{' '}
        {health.isFetching || health.isPending
          ? 'checking...'
          : health.isSuccess
            ? 'online'
            : 'unavailable'}
      </p>
      {health.isSuccess && <p>Database status: connected</p>}
      {health.isError && (
        <p role="alert">Health check failed: {health.error.message}</p>
      )}
      <button
        type="button"
        disabled={health.isFetching}
        onClick={() => void health.refetch()}
      >
        Check API
      </button>
    </section>
  )
}
