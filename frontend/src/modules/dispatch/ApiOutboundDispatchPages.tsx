/**
 * Phase 7C0 thin API-mode surface for OutboundDispatch (list / detail / confirm).
 * Demo dispatchStore pages remain when VITE_USE_API=false.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ErpCardSection } from '@/components/erp/card-form'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { DispatchReservationDrawer } from '@/modules/dispatch/DispatchReservationDrawer'
import { SalesOrderDispatchFulfilmentPanel } from '@/modules/dispatch/SalesOrderDispatchFulfilmentPanel'
import { formatApiError } from '@/services/api/apiErrors'
import {
  cancelOutboundDispatch,
  confirmOutboundDispatch,
  createDispatchPackingSessions,
  getOutboundDispatch,
  listOutboundDispatches,
  postOutboundDispatch,
  reverseOutboundDispatch,
  type OutboundDispatch,
} from '@/services/api/dispatchApi'

function errMsg(e: unknown): string {
  return formatApiError(e) || (e instanceof Error ? e.message : 'Request failed')
}

export function ApiOutboundDispatchRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OutboundDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { items } = await listOutboundDispatches({ page: 1, limit: 50 })
      setRows(items)
    } catch (e) {
      setError(errMsg(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Outbound Dispatch Register"
        description="API outbound dispatches (Phase 7C workbench)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" variant="primary" onClick={() => navigate('/dispatch/workbench')}>
              Open workbench
            </Button>
          </div>
        }
      />
      {error ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {!loading && !error ? (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Dispatch #</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sales order</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No outbound dispatches yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link className="font-medium text-blue-700 hover:underline" to={`/dispatch/${row.id}`}>
                        {row.dispatchNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.salesOrderNo ?? row.salesOrderId?.slice(0, 8) ?? '—'}</td>
                    <td className="px-3 py-2">{row.lines?.length ?? 0}</td>
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export function ApiOutboundDispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<OutboundDispatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)

  async function reload() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setDetail(await getOutboundDispatch(id))
    } catch (e) {
      setError(errMsg(e))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (searchParams.get('reserve') === '1' && detail?.status === 'DRAFT') {
      setReserveOpen(true)
    }
  }, [searchParams, detail?.status])

  async function onBasicConfirm() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Basic Confirm (7C0)',
      description: `Confirm stock-out for ${detail.dispatchNo}? This posts inventory issue.`,
      confirmLabel: 'Confirm stock-out',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await confirmOutboundDispatch(id)
      notify.success(`Confirmed ${detail.dispatchNo}`)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCancelDraft() {
    if (!id || !detail) return
    const note = await appPromptNote({
      title: 'Cancel draft',
      description: `Cancel draft dispatch ${detail.dispatchNo}?`,
      confirmLabel: 'Cancel draft',
      tone: 'danger',
      note: { required: false, label: 'Reason', placeholder: 'Optional reason' },
    })
    if (note == null) return
    setBusy(true)
    try {
      await cancelOutboundDispatch(id, note || undefined)
      notify.success(`Cancelled ${detail.dispatchNo}`)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onStartPacking() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Start Packing',
      description: `Create packing session(s) for ${detail.dispatchNo}?`,
      confirmLabel: 'Start Packing',
    })
    if (!ok) return
    setBusy(true)
    try {
      const sessions = await createDispatchPackingSessions(id, {
        idempotencyKey: `packing-${id}-${Date.now()}`,
      })
      const sessionId = sessions[0]?.id
      if (sessionId) navigate(`/dispatch/packing-sessions/${sessionId}`)
      else await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onPostDispatch() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Post Dispatch (7C5)',
      description: `Post ${detail.dispatchNo} as confirmed stock-out?`,
      confirmLabel: 'Post Dispatch (7C5)',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await postOutboundDispatch(id)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onReverse() {
    if (!id || !detail) return
    const note = await appPromptNote({
      title: 'Reverse (7C5)',
      description: `Reverse posted dispatch ${detail.dispatchNo}?`,
      confirmLabel: 'Reverse (7C5)',
      tone: 'danger',
      note: { required: true, label: 'Reason', placeholder: 'Why reverse this dispatch?' },
    })
    if (note == null) return
    setBusy(true)
    try {
      await reverseOutboundDispatch(id, { reason: note })
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!id) {
    return <p className="text-sm text-rose-700">Missing dispatch id.</p>
  }

  const status = detail?.status ?? ''
  const isDraft = status === 'DRAFT'
  const canBasicConfirm = isDraft
  const canStartPacking = isDraft
  const canPost = status === 'CONFIRMED'
  const canReverse = status === 'CONFIRMED'

  return (
    <div className="space-y-4">
      <PageBackLink to="/dispatch/register" label="Back to register" />
      <PageHeader
        title={detail?.dispatchNo ?? 'Outbound Dispatch'}
        description="Outbound dispatch detail — reserve, pack, confirm stock-out, post / reverse."
        actions={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              {isDraft ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setReserveOpen(true)}>
                  Reserve Stock
                </Button>
              ) : null}
              {canStartPacking ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void onStartPacking()}>
                  Start Packing
                </Button>
              ) : null}
              {canBasicConfirm ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void onBasicConfirm()}>
                  Basic Confirm (7C0)
                </Button>
              ) : null}
              {isDraft ? (
                <Button type="button" variant="danger" disabled={busy} onClick={() => void onCancelDraft()}>
                  Cancel draft
                </Button>
              ) : null}
              {canPost ? (
                <Button type="button" variant="primary" disabled={busy} onClick={() => void onPostDispatch()}>
                  Post Dispatch (7C5)
                </Button>
              ) : null}
              {canReverse ? (
                <Button type="button" variant="danger" disabled={busy} onClick={() => void onReverse()}>
                  Reverse (7C5)
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {id ? (
        <DispatchReservationDrawer
          open={reserveOpen}
          onClose={() => setReserveOpen(false)}
          dispatchId={id}
          onReserved={() => void reload()}
        />
      ) : null}

      {error ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      {detail ? (
        <>
          <ErpCardSection title="Header">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd>
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Sales order</dt>
                <dd>
                  {detail.salesOrderId ? (
                    <Link className="text-blue-700 hover:underline" to={`/crm/sales-orders/${detail.salesOrderId}`}>
                      {detail.salesOrderNo ?? detail.salesOrderId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Preferred warehouse</dt>
                <dd className="font-mono text-xs">{detail.preferredWarehouseId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Planned date</dt>
                <dd>{detail.plannedDispatchDate?.slice(0, 10) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Confirmed at</dt>
                <dd>{detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Packing</dt>
                <dd>
                  <Link className="text-blue-700 hover:underline" to="/dispatch/packing-sessions">
                    packing-sessions
                  </Link>
                </dd>
              </div>
            </dl>
            {detail.remarks ? <p className="mt-3 text-sm text-gray-600">{detail.remarks}</p> : null}
          </ErpCardSection>

          <ErpCardSection title="Lines">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Warehouse</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{line.lineNo}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.itemId}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.warehouseId}</td>
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.inventoryMovementNo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ErpCardSection>

          {detail.salesOrderId ? (
            <ErpCardSection title="SO fulfilment">
              <SalesOrderDispatchFulfilmentPanel salesOrderId={detail.salesOrderId} />
            </ErpCardSection>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
