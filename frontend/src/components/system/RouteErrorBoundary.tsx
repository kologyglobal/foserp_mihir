import { Link, Navigate, useLocation, useNavigate, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Home, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '../ui/Button'
import { PageNotFoundPage } from './PageNotFoundPage'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import {
  classifyRouteError,
  formatRouteErrorMessage,
  type RouteErrorKind,
} from './routeErrorUtils'

/**
 * React Router `errorElement` — classifies route/loader/render failures into
 * distinct UIs (404, permission, chunk load, API, crash). Unauthenticated → /login.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const location = useLocation()
  const kind = classifyRouteError(error)
  const message = formatRouteErrorMessage(error)
  const from = `${location.pathname}${location.search}${location.hash}`

  if (kind === 'unauthenticated') {
    return <Navigate to="/login" state={{ from }} replace />
  }

  if (kind === 'not-found') {
    return <PageNotFoundPage />
  }

  if (kind === 'permission-denied') {
    return <PermissionDeniedPage />
  }

  if (kind === 'chunk-load') {
    return <ChunkLoadFailurePanel message={message} />
  }

  if (kind === 'api') {
    return <ApiErrorPanel message={message} />
  }

  return <CrashErrorPanel kind={kind} message={message} routePath={location.pathname} />
}

/** Alias used by existing route trees (`errorElement: <RouteErrorPage />`). */
export const RouteErrorPage = RouteErrorBoundary

function ChunkLoadFailurePanel({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <RefreshCw className="h-14 w-14 text-amber-600" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">Update available</p>
      <h1 className="text-xl font-semibold text-erp-text">Couldn’t load this page</h1>
      <p className="text-sm text-erp-muted">
        A newer version of the app may have been deployed, or the network interrupted the download.
        Reload to fetch the latest modules.
      </p>
      {import.meta.env.DEV ? (
        <p className="w-full break-words rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-left font-mono text-xs text-amber-900">
          {message}
        </p>
      ) : null}
      <Button type="button" onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" /> Reload page
      </Button>
    </div>
  )
}

function ApiErrorPanel({ message }: { message: string }) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <WifiOff className="h-14 w-14 text-orange-500" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">Data error</p>
      <h1 className="text-xl font-semibold text-erp-text">Couldn’t load data</h1>
      <p className="text-sm text-erp-muted">
        Something went wrong talking to the server. You can retry or go back — this is not a page
        crash.
      </p>
      <p className="w-full break-words rounded-lg border border-orange-100 bg-orange-50/50 p-3 text-left text-sm text-orange-900">
        {message}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Go back
        </Button>
        <Link to="/home">
          <Button type="button" variant="ghost">
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

function CrashErrorPanel({
  kind,
  message,
  routePath,
}: {
  kind: RouteErrorKind
  message: string
  routePath: string
}) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50/50 p-6 shadow-erp">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 shrink-0 text-red-600" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-erp-text">Something went wrong</h1>
            <p className="text-sm text-erp-muted">
              The page hit an unexpected error{kind === 'crash' ? '' : ` (${kind})`}.
            </p>
          </div>
        </div>
        <dl className="mb-5 space-y-2 rounded-lg border border-red-100 bg-white p-4 text-sm">
          <div>
            <dt className="font-medium text-erp-muted">Route</dt>
            <dd className="font-mono text-erp-text">{routePath}</dd>
          </div>
          <div>
            <dt className="font-medium text-erp-muted">Error</dt>
            <dd className="break-words text-red-800">{message || 'Unknown error'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Reload page
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
