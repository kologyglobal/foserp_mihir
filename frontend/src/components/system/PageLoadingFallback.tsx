/** Suspense / lazy-route loading UI — distinct from error and 404 states. */
export function PageLoadingFallback({ label = 'Loading…' }: { label?: string } = {}) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center bg-erp-bg px-6 py-16 text-sm text-erp-muted"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-erp-primary border-t-transparent"
          aria-hidden
        />
        <span>{label}</span>
      </div>
    </div>
  )
}
