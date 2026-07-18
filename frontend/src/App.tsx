import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { bootstrapErpStartup, type IntegrityReport } from './bootstrap/erpStartup'
import { IntegrityBanner } from './components/system/IntegrityBanner'
import { SystemConfirmDialogHost } from './components/system/SystemConfirmDialogHost'
import { ToastHost } from './components/ui/ToastHost'
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost'
import { clearErpLocalStorage } from './demo/demoStorage'

function App() {
  const [ready, setReady] = useState(false)
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    bootstrapErpStartup()
      .then((report) => {
        setIntegrity(report)
        setReady(true)
      })
      .catch((e) => {
        console.error('[ERP] Bootstrap failed', e)
        setBootError(e instanceof Error ? e.message : String(e))
        setReady(true)
      })
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-erp-bg text-[13px] text-erp-muted">
        Loading FOS ERP…
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-erp-bg p-6">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-white p-6 shadow-erp">
          <h1 className="text-lg font-semibold text-erp-text">Startup issue</h1>
          <p className="mt-2 text-sm text-erp-muted">{bootError}</p>
          <p className="mt-2 text-sm text-erp-muted">
            Saved browser data may be corrupted or too large after demo seed. Try clearing local data.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-sm text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-md border border-erp-border px-3 py-2 text-sm"
              onClick={() => {
                clearErpLocalStorage()
                window.location.href = '/'
              }}
            >
              Clear local data
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {integrity && !integrity.ok && <IntegrityBanner report={integrity} />}
      <RouterProvider router={router} />
      <ToastHost />
      <ConfirmDialogHost />
      <SystemConfirmDialogHost />
    </>
  )
}

export default App
