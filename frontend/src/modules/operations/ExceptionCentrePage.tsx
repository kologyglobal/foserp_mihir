import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, ShieldAlert } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  acknowledgeException,
  getExceptionsSummary,
  listExceptions,
  type ExceptionsSummary,
  type OperationsException,
} from '@/services/api/opsReportsApi'
import { canAcknowledgeException, canViewExceptions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/dates/format'
import { ProductionEmptyState, ProductionPageHeader } from '@/modules/manufacturing/ui'

const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
]

function severityTone(severity: string): string {
  const map: Record<string, string> = {
    critical: 'bg-rose-100 text-rose-800 ring-rose-200',
    high: 'bg-orange-100 text-orange-900 ring-orange-200',
    medium: 'bg-amber-100 text-amber-900 ring-amber-200',
    low: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return map[severity.toLowerCase()] ?? map.low
}

/** Phase 7D — cross-module operations exception centre (manufacturing, dispatch, quality, etc.). */
export function ExceptionCentrePage() {
  const navigate = useNavigate()
  const canView = canViewExceptions()
  const canAck = canAcknowledgeException()

  const [summary, setSummary] = useState<ExceptionsSummary | null>(null)
  const [rows, setRows] = useState<OperationsException[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const filters = {
        search: search.trim() || undefined,
        severity: severity || undefined,
        status: status || undefined,
      }
      const [summaryRes, listRes] = await Promise.all([
        getExceptionsSummary(filters),
        listExceptions(filters),
      ])
      setSummary(summaryRes.data)
      setRows(listRes.data)
    } catch (error) {
      setSummary(null)
      setRows([])
      notify.error(error instanceof Error ? error.message : 'Failed to load exceptions')
    } finally {
      setLoading(false)
    }
  }, [search, severity, status])

  useEffect(() => {
    void load()
  }, [load])

  const onAcknowledge = async (id: string) => {
    if (!canAck) {
      notify.error('Missing permission to acknowledge exceptions')
      return
    }
    setBusyId(id)
    try {
      await acknowledgeException(id)
      notify.success('Exception acknowledged')
      void load()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to acknowledge')
    } finally {
      setBusyId(null)
    }
  }

  const kpiStrip = useMemo<EnterpriseKpiItem[] | undefined>(() => {
    if (!summary) return undefined
    return [
      { id: 'total', label: 'Total', value: summary.total, accent: 'slate' },
      { id: 'open', label: 'Open', value: summary.open, accent: 'amber' },
      { id: 'acknowledged', label: 'Acknowledged', value: summary.acknowledged, accent: 'green' },
    ]
  }, [summary])

  if (!canView) {
    return (
      <ProductionPageHeader title="Exception Centre" favoritePath="/operations/exceptions">
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You do not have permission to view operations exceptions."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Exception Centre"
      badge="Operations"
      description="Cross-module exceptions raised by manufacturing, dispatch, quality, and inventory."
      breadcrumbs={[{ label: 'Operations' }, { label: 'Exceptions' }]}
      favoritePath="/operations/exceptions"
      secondaryActions={isApiMode() ? [{ id: 'refresh', label: 'Refresh', icon: RotateCcw, onClick: () => void load() }] : undefined}
      kpiStrip={isApiMode() && !loading ? kpiStrip : undefined}
      filterBar={
        isApiMode() ? (
          <div className="flex flex-wrap items-end gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search exceptions…"
              className="min-w-[220px] max-w-md flex-1"
              aria-label="Search exceptions"
            />
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity filter">
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
        ) : undefined
      }
    >
      {!isApiMode() ? (
        <>
          <ManufacturingDemoBanner message="Exception Centre requires API mode — enable VITE_USE_API to load live cross-module exceptions." />
          <ProductionEmptyState
            icon={AlertTriangle}
            title="Exception Centre requires API mode"
            description="Turn on VITE_USE_API to load operations exceptions from the backend."
          />
        </>
      ) : loading ? (
        <LoadingState variant="table" rows={6} />
      ) : rows.length === 0 ? (
        <ProductionEmptyState
          icon={CheckCircle2}
          title="No exceptions"
          description="No open exceptions match this view."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-erp-border bg-white">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-erp-border bg-slate-50 text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Exception</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Raised</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((exc) => (
                <tr key={exc.id} className="border-b border-erp-border/70 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-erp-text">{exc.title}</p>
                    {exc.description ? <p className="text-[11px] text-erp-muted">{exc.description}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-erp-muted">{exc.sourceModule ?? exc.type}</td>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', severityTone(exc.severity))}>
                      {exc.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-erp-muted">{exc.status}</td>
                  <td className="px-3 py-2 text-erp-muted">{formatDateTime(exc.raisedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {exc.sourceLink ? (
                        <Button size="sm" variant="ghost" onClick={() => navigate(exc.sourceLink!)}>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open source
                        </Button>
                      ) : null}
                      {exc.status === 'open' && canAck ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === exc.id}
                          onClick={() => void onAcknowledge(exc.id)}
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProductionPageHeader>
  )
}
