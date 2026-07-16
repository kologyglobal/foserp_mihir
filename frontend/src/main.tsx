import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './design-system'
import { AuthProvider } from './context/AuthProvider'
import { clearErpLocalStorage } from './demo/demoStorage'

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ERP] Root error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-lg">
            <h1 className="text-lg font-semibold text-slate-900">ERP failed to start</h1>
            <p className="mt-2 text-sm text-slate-600">{this.state.error.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  clearErpLocalStorage()
                  window.location.href = '/'
                }}
              >
                Clear local data &amp; restart
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Or open <code className="rounded bg-slate-100 px-1">/?reset=1</code> to reset saved data.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

if (new URLSearchParams(window.location.search).get('reset') === '1') {
  clearErpLocalStorage()
  window.location.replace(window.location.pathname || '/')
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
}
