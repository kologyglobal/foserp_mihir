import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { PageLoadingFallback } from './PageLoadingFallback'
import { isChunkLoadError } from './routeErrorUtils'

export class ChunkLoadError extends Error {
  readonly name = 'ChunkLoadError'
  constructor(message = 'Failed to load application module', options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * Lazy-load a route component with Suspense + PageLoadingFallback.
 * Import failures are wrapped as ChunkLoadError so RouteErrorBoundary shows the reload CTA.
 */
export function lazyRoute(
  factory: () => Promise<{ default: ComponentType }>,
  loadingLabel?: string,
): ComponentType {
  const LazyComponent: LazyExoticComponent<ComponentType> = lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      if (isChunkLoadError(error)) throw error
      throw new ChunkLoadError(
        error instanceof Error ? error.message : 'Failed to load application module',
        { cause: error },
      )
    }
  })

  function LazyRouteWrapper() {
    return (
      <Suspense fallback={<PageLoadingFallback label={loadingLabel} />}>
        <LazyComponent />
      </Suspense>
    )
  }

  LazyRouteWrapper.displayName = 'LazyRouteWrapper'
  return LazyRouteWrapper
}
