/**
 * Statutory e-Way Bill panel for Dispatch / Delivery Challan.
 * EWB number is never editable — generate / cancel / update vehicle go through NIC adapter APIs.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import {
  cancelEWayBillApi,
  fetchEWayPanel,
  generateEWayBillApi,
  updateEWayVehicleApi,
  type EWayPanelDto,
} from '@/services/api/taxComplianceApi'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'

type Props = {
  deliveryChallanId: string
  outboundDispatchId?: string | null
  fromPlaceDefault?: string
  onChanged?: () => void
}

export function DispatchEWayBillPanel({
  deliveryChallanId,
  outboundDispatchId,
  fromPlaceDefault = 'Factory',
  onChanged,
}: Props) {
  const perms = useTaxCompliancePermissions()
  const canManage = perms.canEWay
  const canView = perms.canView || canManage
  const [panel, setPanel] = useState<EWayPanelDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isApiMode() || !canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetchEWayPanel({
        deliveryChallanId,
        outboundDispatchId: outboundDispatchId ?? undefined,
      })
      setPanel(res.data)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load e-Way panel')
    } finally {
      setLoading(false)
    }
  }, [canView, deliveryChallanId, outboundDispatchId])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode() || !canView) return null

  const ewb = panel?.ewayBill
  const status = ewb?.status ?? (panel?.required ? 'REQUIRED' : 'NOT_REQUIRED')

  const onGenerate = async () => {
    if (!canManage || !panel?.deliveryChallanId) return
    setBusy(true)
    try {
      const res = await generateEWayBillApi({
        sourceType: 'DELIVERY_CHALLAN',
        deliveryChallanId: panel.deliveryChallanId,
        fromPlace: fromPlaceDefault,
        toPlace: panel.destination || 'Customer',
        distanceKm: 100,
        vehicleNumber: panel.vehicleNumber,
        transporterName: panel.transporterName,
        force: !panel.required,
      })
      notify.success(
        res.data.item.ewbNumber
          ? `EWB ${res.data.item.ewbNumber} (${res.data.item.providerMode})`
          : `e-Way status: ${res.data.item.status}`,
      )
      await load()
      onChanged?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Generate e-Way failed')
    } finally {
      setBusy(false)
    }
  }

  const onCancel = async () => {
    if (!canManage || !ewb?.id || ewb.status !== 'GENERATED') return
    const reason = await appPromptNote({
      title: 'Cancel e-Way Bill',
      description: `Cancel EWB ${ewb.ewbNumber ?? ''} via NIC adapter?`,
      confirmLabel: 'Cancel EWB',
      tone: 'danger',
      note: { required: true, label: 'Cancellation reason', placeholder: 'Reason…' },
    })
    if (!reason?.trim()) return
    setBusy(true)
    try {
      await cancelEWayBillApi(ewb.id, reason.trim())
      notify.success('e-Way bill cancelled')
      await load()
      onChanged?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const onUpdateVehicle = async () => {
    if (!canManage || !ewb?.id || ewb.status !== 'GENERATED') return
    const vehicle = await appPromptNote({
      title: 'Update vehicle number',
      description: 'Updates via NIC adapter — not a local-only edit.',
      confirmLabel: 'Update vehicle',
      note: {
        required: true,
        label: 'Vehicle number',
        placeholder: ewb.vehicleNumber ?? 'GJ01AB1234',
      },
    })
    if (!vehicle?.trim()) return
    setBusy(true)
    try {
      await updateEWayVehicleApi(ewb.id, { vehicleNumber: vehicle.trim().toUpperCase() })
      notify.success('Vehicle updated on e-Way bill')
      await load()
      onChanged?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Vehicle update failed')
    } finally {
      setBusy(false)
    }
  }

  const onPrint = () => {
    if (!ewb?.id) return
    window.open(`/accounting/tax-compliance/gst/e-way-bills?highlight=${ewb.id}`, '_blank', 'noopener')
  }

  return (
    <section className="rounded border border-erp-border bg-white p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-erp-text">e-Way Bill</h3>
        <Link
          className="text-[11px] font-medium text-erp-primary underline"
          to="/accounting/tax-compliance/gst/e-way-bills"
        >
          Open register
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading e-Way status…</p>
      ) : (
        <>
          <div className="grid gap-1 md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">e-Way Bill Required:</span>{' '}
              <strong>{panel?.required ? 'Yes' : 'No'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> <strong>{status}</strong>
            </div>
            <div className="md:col-span-2">
              <span className="text-muted-foreground">Reason:</span>{' '}
              {panel?.reason ?? '—'}
            </div>
            {ewb?.ewbNumber ? (
              <>
                <div>
                  <span className="text-muted-foreground">EWB No:</span>{' '}
                  <strong className="font-mono">{ewb.ewbNumber}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Valid upto:</span>{' '}
                  {ewb.validUpto ? new Date(ewb.validUpto).toLocaleString() : '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Generated:</span>{' '}
                  {ewb.generatedAt ? new Date(ewb.generatedAt).toLocaleString() : '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Vehicle:</span> {ewb.vehicleNumber ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Transporter:</span>{' '}
                  {ewb.transporterName ?? '—'}
                  {ewb.transporterId ? ` (${ewb.transporterId})` : ''}
                </div>
                <div>
                  <span className="text-muted-foreground">API ref:</span>{' '}
                  <span className="font-mono text-[11px]">{ewb.providerRef ?? '—'}</span>
                </div>
              </>
            ) : null}
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Statutory NIC integration ({ewb?.providerMode ?? 'SIMULATED'}). EWB number is not editable.
          </p>

          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || panel?.challanStatus !== 'ISSUED'}
                className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold text-erp-primary disabled:opacity-50"
                onClick={() => void onGenerate()}
              >
                Generate e-Way Bill
              </button>
              <button
                type="button"
                disabled={busy || ewb?.status !== 'GENERATED'}
                className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold text-rose-700 disabled:opacity-50"
                onClick={() => void onCancel()}
              >
                Cancel e-Way Bill
              </button>
              <button
                type="button"
                disabled={busy || ewb?.status !== 'GENERATED'}
                className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold disabled:opacity-50"
                onClick={() => void onUpdateVehicle()}
              >
                Update Vehicle Number
              </button>
              <button
                type="button"
                disabled={!ewb?.id}
                className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold disabled:opacity-50"
                onClick={() => void load()}
              >
                View e-Way Bill
              </button>
              <button
                type="button"
                disabled={!ewb?.id}
                className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold disabled:opacity-50"
                onClick={onPrint}
              >
                Print
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
