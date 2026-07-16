import { useEffect, useMemo, useState } from 'react'
import {
  fetchOpportunityAmountHistoryApi,
  fetchOpportunityAssignmentHistoryApi,
  fetchOpportunityStageHistoryApi,
  fetchOpportunityStatusHistoryApi,
} from '../../../services/api/crmApi'
import { formatApiError } from '../../../services/api/apiErrors'
import { formatDateTime } from '../../../utils/dates/format'
import { isApiMode } from '../../../config/apiConfig'
import { useCrmStore } from '../../../store/crmStore'

type HistoryTab = 'stage' | 'assignment' | 'amount' | 'status'

interface OpportunityHistoryPanelProps {
  opportunityId: string
}

function HistoryList({
  rows,
  loading,
  error,
  renderRow,
}: {
  rows: Array<Record<string, unknown>>
  loading: boolean
  error: string | null
  renderRow: (row: Record<string, unknown>, index: number) => React.ReactNode
}) {
  if (loading) return <p className="text-[13px] text-erp-muted">Loading history…</p>
  if (error) return <p className="text-[13px] text-red-600">{error}</p>
  if (rows.length === 0) return <p className="text-[13px] text-erp-muted">No history recorded yet.</p>
  return <ul className="space-y-2">{rows.map((row, i) => <li key={String(row.id ?? i)} className="rounded border border-erp-border p-3 text-[13px]">{renderRow(row, i)}</li>)}</ul>
}

function parseStageSubject(subject: string): { from: string; to: string } {
  const match = subject.match(/Stage:\s*(.+?)\s*→\s*(.+)$/i)
    ?? subject.match(/:\s*(.+?)\s*→\s*(.+)$/)
  if (match) return { from: match[1]!.trim(), to: match[2]!.trim() }
  return { from: '—', to: subject }
}

export function OpportunityHistoryPanel({ opportunityId }: OpportunityHistoryPanelProps) {
  const [tab, setTab] = useState<HistoryTab>('stage')
  const [stageRows, setStageRows] = useState<Array<Record<string, unknown>>>([])
  const [assignmentRows, setAssignmentRows] = useState<Array<Record<string, unknown>>>([])
  const [amountRows, setAmountRows] = useState<Array<Record<string, unknown>>>([])
  const [statusRows, setStatusRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activities = useCrmStore((s) => s.activities)

  const demoStageRows = useMemo(() => {
    return activities
      .filter((a) => a.opportunityId === opportunityId && (a.type === 'stage_change' || a.type === 'deal_won' || a.type === 'deal_lost'))
      .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
      .map((a) => {
        const parsed = parseStageSubject(a.subject)
        return {
          id: a.id,
          fromStageName: parsed.from,
          toStageName: parsed.to,
          changedByName: a.ownerName,
          createdAt: a.activityDate,
          reason: a.description || a.outcome || null,
        }
      })
  }, [activities, opportunityId])

  useEffect(() => {
    if (!isApiMode() || !opportunityId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const fetcher =
      tab === 'stage'
        ? fetchOpportunityStageHistoryApi(opportunityId)
        : tab === 'assignment'
          ? fetchOpportunityAssignmentHistoryApi(opportunityId)
          : tab === 'amount'
            ? fetchOpportunityAmountHistoryApi(opportunityId)
            : fetchOpportunityStatusHistoryApi(opportunityId)

    void fetcher
      .then((res) => {
        if (cancelled) return
        const rows = res.data
        if (tab === 'stage') setStageRows(rows)
        else if (tab === 'assignment') setAssignmentRows(rows)
        else if (tab === 'amount') setAmountRows(rows)
        else setStatusRows(rows)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(formatApiError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [opportunityId, tab])

  const tabs: Array<{ id: HistoryTab; label: string }> = isApiMode()
    ? [
        { id: 'stage', label: 'Stage' },
        { id: 'assignment', label: 'Assignment' },
        { id: 'amount', label: 'Amount' },
        { id: 'status', label: 'Status' },
      ]
    : [{ id: 'stage', label: 'Stage' }]

  const activeRows = !isApiMode()
    ? demoStageRows
    : tab === 'stage'
      ? (stageRows.length > 0 ? stageRows : demoStageRows)
      : tab === 'assignment'
        ? assignmentRows
        : tab === 'amount'
          ? amountRows
          : statusRows

  return (
    <section aria-label="Opportunity history">
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-3 py-1 text-[12px] font-semibold ${tab === t.id ? 'bg-erp-primary text-white' : 'bg-erp-surface-alt text-erp-muted'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <HistoryList
        rows={activeRows}
        loading={isApiMode() ? loading : false}
        error={error}
        renderRow={(row) => {
          if (tab === 'stage') {
            return (
              <>
                <p className="font-medium text-erp-text">
                  {String(row.fromStageName ?? row.fromStageId ?? '—')} → {String(row.toStageName ?? row.toStageId ?? '—')}
                </p>
                <p className="text-erp-muted">{String(row.changedByName ?? row.changedBy ?? 'System')} · {formatDateTime(String(row.createdAt))}</p>
                {row.reason ? <p className="mt-1">{String(row.reason)}</p> : null}
              </>
            )
          }
          if (tab === 'assignment') {
            return (
              <>
                <p className="font-medium text-erp-text">
                  {String(row.fromOwnerName ?? row.fromOwnerId ?? 'Unassigned')} → {String(row.toOwnerName ?? row.toOwnerId ?? 'Unassigned')}
                </p>
                <p className="text-erp-muted">{String(row.changedByName ?? row.changedBy ?? 'System')} · {formatDateTime(String(row.createdAt))}</p>
                {row.notes ? <p className="mt-1">{String(row.notes)}</p> : null}
              </>
            )
          }
          if (tab === 'amount') {
            return (
              <>
                <p className="font-medium text-erp-text">
                  {String(row.oldAmount)} → {String(row.newAmount)}
                </p>
                <p className="text-erp-muted">{String(row.changedByName ?? row.changedBy ?? 'System')} · {formatDateTime(String(row.createdAt))}</p>
                {row.reason ? <p className="mt-1">{String(row.reason)}</p> : null}
              </>
            )
          }
          return (
            <>
              <p className="font-medium text-erp-text">
                {String(row.fromStatus ?? '—')} → {String(row.toStatus)}
              </p>
              <p className="text-erp-muted">{String(row.changedByName ?? row.changedBy ?? 'System')} · {formatDateTime(String(row.createdAt))}</p>
              {row.reason ? <p className="mt-1">{String(row.reason)}</p> : null}
            </>
          )
        }}
      />
    </section>
  )
}
