import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { Button } from '../../components/ui/Button'
import { resetDemoData } from '../../demo/resetDemoData'
import { clearDemoData, validateDemoData } from '../../demo/loadDemoData'
import { isDemoLoaded } from '../../demo/demoStorage'

export function DemoDataPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<string | null>(null)
  const demoLoaded = isDemoLoaded()

  function handleReset() {
    const confirmed = window.confirm(
      'This will reset all demo data and reload a full connected factory dataset. Continue?',
    )
    if (!confirmed) return
    setLoading(true)
    setMessage(null)
    setError(null)
    setValidation(null)
    const result = resetDemoData()
    setLoading(false)
    if (result.ok) {
      setMessage('Full factory demo data loaded. Reloading…')
      window.setTimeout(() => window.location.reload(), 800)
    } else {
      setError(result.error ?? 'Failed to load demo data')
    }
  }

  function handleValidate() {
    setValidation(null)
    setError(null)
    const report = validateDemoData()
    const summary = report.ok
      ? `Validation passed — ${Object.keys(report.counts).length} entity counts OK`
      : `Issues: ${[...report.orphans, ...report.kpiMismatches, ...report.belowTarget].join('; ')}`
    setValidation(summary)
  }

  function handleClear() {
    const confirmed = window.confirm('Clear all local ERP data without reloading demo?')
    if (!confirmed) return
    clearDemoData()
    setMessage('Local demo data cleared.')
    setValidation(null)
    window.setTimeout(() => window.location.reload(), 600)
  }

  return (
    <OperationalPageShell
      title="Demo Data"
      description="Load realistic interconnected factory data — 20–30 records per major module."
      badge={demoLoaded ? 'Demo Active' : 'Fresh Install'}
    >
      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Reset loads a connected trailer-manufacturing dataset: 30 customers, 120 items, 25 products,
              30 sales orders, purchase and production documents, QC, dispatch, invoices, traceability, and
              engineering records — all wired through store APIs with no orphan links.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-erp-border bg-white p-6 shadow-erp space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-erp-text">Demo Data Actions</h3>
              <p className="text-sm text-erp-muted">Seed, validate, or clear the local factory dataset.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleReset} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Reset Demo Data'}
            </Button>
            <Button variant="secondary" onClick={handleValidate} disabled={loading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Validate Demo Data
            </Button>
            <Button variant="secondary" onClick={handleClear} disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Demo Data
            </Button>
          </div>

          {message && <p className="text-sm text-erp-success">{message}</p>}
          {error && <p className="text-sm text-erp-danger">{error}</p>}
          {validation && <p className="text-sm text-erp-text">{validation}</p>}
        </div>
      </div>
    </OperationalPageShell>
  )
}
