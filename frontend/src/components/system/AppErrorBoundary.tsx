import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { ERP_STORAGE_KEYS } from '../../store/persistConfig'
import { getSessionUser, getSessionUserRoleLabel } from '../../utils/permissions'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
  routePath: string
  caughtAt: string
}

function logBoundaryError(error: Error, info: ErrorInfo, routePath: string) {
  const user = getSessionUser()
  console.error('[ERP] AppErrorBoundary caught:', {
    route: routePath,
    message: error.message,
    role: user.role,
    user: user.name,
    timestamp: new Date().toISOString(),
    componentStack: info.componentStack,
  })
}

/** Catches render errors in the React tree below the router outlet. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
    routePath: window.location.pathname,
    caughtAt: '',
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return {
      error,
      routePath: window.location.pathname,
      caughtAt: new Date().toISOString(),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logBoundaryError(error, info, this.state.routePath)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          routePath={this.state.routePath}
          message={this.state.error.message}
          caughtAt={this.state.caughtAt}
          onReload={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

function ErrorFallback({
  routePath,
  message,
  caughtAt,
  onReload,
}: {
  routePath: string
  message: string
  caughtAt?: string
  onReload: () => void
}) {
  const navigate = useNavigate()
  const user = getSessionUser()

  function clearLocalData() {
    if (!window.confirm('Clear all locally saved ERP data? You will need to reload the app.')) return
    for (const key of Object.values(ERP_STORAGE_KEYS)) {
      localStorage.removeItem(key)
    }
    localStorage.removeItem('vasant-erp-ui')
    window.location.href = '/'
  }

  const isMaxDepth = message.includes('Maximum update depth exceeded')

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50/50 p-6 shadow-erp">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-lg font-semibold text-erp-text">Something went wrong</h1>
            <p className="text-sm text-erp-muted">
              {isMaxDepth
                ? 'A page entered an infinite update loop. This is usually a Zustand selector returning a new array each render.'
                : 'The page hit an unexpected error.'}
            </p>
          </div>
        </div>
        <dl className="mb-5 space-y-2 rounded-lg border border-red-100 bg-white p-4 text-sm">
          <div>
            <dt className="font-medium text-erp-muted">Route</dt>
            <dd className="font-mono text-erp-text">{routePath}</dd>
          </div>
          <div>
            <dt className="font-medium text-erp-muted">User / Role</dt>
            <dd className="text-erp-text">{user.name} · {getSessionUserRoleLabel()}</dd>
          </div>
          {caughtAt ? (
            <div>
              <dt className="font-medium text-erp-muted">Timestamp</dt>
              <dd className="text-erp-text">{caughtAt}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-erp-muted">Error</dt>
            <dd className="break-words text-red-800">{message || 'Unknown error'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onReload}>
            <RefreshCw className="h-4 w-4" /> Reload Page
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" /> Go to Dashboard
          </Button>
          <Button type="button" variant="ghost" onClick={clearLocalData}>
            <Trash2 className="h-4 w-4" /> Clear Local Data
          </Button>
        </div>
      </div>
    </div>
  )
}

/** React Router errorElement — route loader / render failures. */
export function RouteErrorPage() {
  const error = useRouteError()
  const routePath = window.location.pathname
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}${error.data ? `: ${String(error.data)}` : ''}`
    : error instanceof Error
      ? error.message
      : String(error)

  return (
    <ErrorFallback
      routePath={routePath}
      message={message}
      caughtAt={new Date().toISOString()}
      onReload={() => window.location.reload()}
    />
  )
}
