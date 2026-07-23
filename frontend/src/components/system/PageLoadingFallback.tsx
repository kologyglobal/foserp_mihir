import { Loader } from '../ui/Loader'

/** Suspense / lazy-route loading UI — distinct from error and 404 states. */
export function PageLoadingFallback({ label = 'Loading' }: { label?: string } = {}) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center bg-erp-bg px-6 py-16"
      role="presentation"
    >
      <Loader size="md" label={label} />
    </div>
  )
}
