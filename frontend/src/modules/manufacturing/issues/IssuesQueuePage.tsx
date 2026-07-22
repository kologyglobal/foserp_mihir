import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LayoutGrid, RefreshCw, Wrench } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Select, Textarea } from '@/components/forms/Inputs'
import { ErpButton } from '@/components/erp/ErpButton'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  acknowledgeIssue,
  cancelIssue,
  listIssues,
  markIssueInProgress,
  resolveIssue,
} from '@/services/api/manufacturingApi'
import type { IssueStatus, ProductionIssue } from '@/types/manufacturingPhase2b'
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_VALUES, ISSUE_TYPE_LABELS } from '@/types/manufacturingPhase2b'
import { useManufacturingPhase2bPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { t } from '../i18n/operatorStrings'
import { IssueStatusBadge } from './IssueStatusBadge'
import { IssueSeverityBadge, ProductionEmptyState, ProductionPageHeader } from '../ui'

const OPEN_STATUSES: IssueStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']

/** Supervisor issue queue — acknowledge, progress, resolve, cancel. */
export function IssuesQueuePage() {
  const navigate = useNavigate()
  const perms = useManufacturingPhase2bPermissions()
  const [issues, setIssues] = useState<ProductionIssue[]>([])
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<ProductionIssue | null>(null)
  const [resolution, setResolution] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listIssues({
        limit: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setIssues(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load issues')
      setIssues([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      setBusy(true)
      try {
        await fn()
        notify.success(okMsg)
        await load()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const open = issues.filter((i) => i.status === 'OPEN').length
    const inProgress = issues.filter((i) => i.status === 'ACKNOWLEDGED' || i.status === 'IN_PROGRESS').length
    const critical = issues.filter((i) => OPEN_STATUSES.includes(i.status) && i.severity === 'CRITICAL').length
    const blocked = issues.filter((i) => OPEN_STATUSES.includes(i.status) && i.productionBlocked).length
    return [
      { id: 'open', label: 'Open', value: open, accent: 'blue' },
      { id: 'in-progress', label: 'In Progress', value: inProgress, accent: 'amber' },
      { id: 'critical', label: 'Critical', value: critical, accent: 'red' },
      { id: 'blocked', label: 'Blocking Production', value: blocked, accent: 'red' },
    ]
  }, [issues])

  if (!isApiMode()) {
    return (
      <ProductionPageHeader
        title={t('issues.title')}
        description="Open production issues — material, machine, quality, and safety blockers."
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: t('issues.title') },
        ]}
        favoritePath="/manufacturing/issues"
      >
        <ProductionEmptyState
          icon={AlertTriangle}
          title="Issues require API mode"
          description="The issues queue is live against the manufacturing API. In demo mode, use Control Room or Work Orders for attention items — demo seed is never mixed into this list."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ErpButton variant="secondary" onClick={() => navigate('/manufacturing/control-room')}>
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Control Room
              </ErpButton>
              <ErpButton variant="primary" onClick={() => navigate('/manufacturing/work-orders')}>
                <Wrench className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Work Orders
              </ErpButton>
            </div>
          }
        />
      </ProductionPageHeader>
    )
  }

  if (!perms.canViewIssues) {
    return (
      <ProductionPageHeader title={t('issues.title')} favoritePath="/manufacturing/issues">
        <ProductionEmptyState icon={AlertTriangle} title="Access denied" description="Missing issue view permission." />
      </ProductionPageHeader>
    )
  }

  const visible = statusFilter ? issues : issues.filter((i) => OPEN_STATUSES.includes(i.status))

  return (
    <ProductionPageHeader
      title={t('issues.title')}
      description="Open production issues — material, machine, quality, and safety blockers."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: t('issues.title') },
      ]}
      favoritePath="/manufacturing/issues"
      kpiStrip={kpiStrip}
      secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      filterBar={
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IssueStatus | '')}
              className="min-w-[12rem]"
            >
              <option value="">Open queue</option>
              {ISSUE_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      }
    >
      {loading ? <LoadingState variant="card" rows={4} /> : null}
      {!loading && visible.length === 0 ? (
        <ProductionEmptyState icon={AlertTriangle} title={t('issues.title')} description={t('issues.empty')} />
      ) : null}

      {!loading && visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map((issue) => (
            <section
              key={issue.id}
              className={cn(
                'rounded-lg border bg-white p-3.5',
                issue.severity === 'CRITICAL'
                  ? 'border-rose-300'
                  : issue.severity === 'HIGH'
                    ? 'border-amber-300'
                    : 'border-erp-border',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] text-erp-muted">{issue.issueNumber}</p>
                  <h3 className="text-[15px] font-semibold text-erp-text">{issue.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-erp-muted">
                    <span>{ISSUE_TYPE_LABELS[issue.issueType]}</span>
                    <span aria-hidden>·</span>
                    <IssueSeverityBadge severity={issue.severity} />
                    <span aria-hidden>·</span>
                    <span>{formatDateTime(issue.startedAt)}</span>
                  </p>
                </div>
                <IssueStatusBadge status={issue.status} />
              </div>
              {issue.description ? <p className="mt-2 text-[13px] text-erp-text">{issue.description}</p> : null}
              {issue.productionBlocked ? (
                <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[12px] font-medium text-rose-900">
                  Production blocked
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/manufacturing/work-orders/${issue.productionOrderId}`)}
                >
                  View WO
                </Button>
                {issue.status === 'OPEN' && perms.canAcknowledgeIssue ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const note = await appPromptNote({ title: t('issues.acknowledge'), confirmLabel: 'Acknowledge' })
                        if (note === null) return
                        await acknowledgeIssue(issue.id, { remarks: note || undefined })
                      }, 'Issue acknowledged')
                    }
                  >
                    {t('issues.acknowledge')}
                  </Button>
                ) : null}
                {issue.status === 'ACKNOWLEDGED' && perms.canAcknowledgeIssue ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => markIssueInProgress(issue.id), 'Marked in progress')}
                  >
                    {t('issues.inProgress')}
                  </Button>
                ) : null}
                {['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(issue.status) && perms.canResolveIssue ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setResolveTarget(issue)
                      setResolution('')
                    }}
                  >
                    {t('issues.resolve')}
                  </Button>
                ) : null}
                {['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(issue.status) && perms.canResolveIssue ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        const ok = await appConfirm({
                          title: t('issues.cancel'),
                          description: 'Cancel this issue?',
                          confirmLabel: 'Cancel issue',
                        })
                        if (!ok) return
                        const reason = await appPromptNote({ title: 'Cancellation reason', confirmLabel: 'Confirm' })
                        if (reason === null) return
                        await run(() => cancelIssue(issue.id, { reason: reason || undefined }), 'Issue cancelled')
                      })()
                    }
                  >
                    {t('issues.cancel')}
                  </Button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title={t('issues.resolve')}
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResolveTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button
              disabled={busy || !resolution.trim()}
              onClick={() => {
                if (!resolveTarget) return
                void run(
                  () => resolveIssue(resolveTarget.id, { resolution: resolution.trim(), endDowntime: true }),
                  'Issue resolved',
                ).then(() => setResolveTarget(null))
              }}
            >
              Resolve
            </Button>
          </div>
        }
      >
        <FormField label="Resolution" required>
          <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} />
        </FormField>
      </Modal>
    </ProductionPageHeader>
  )
}
