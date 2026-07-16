import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Select } from '../../components/forms/Inputs'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { useBomStore } from '../../store/bomStore'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
export function RunMRPPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultSoId = searchParams.get('so') ?? ''

  const salesOrders = useMrpStore((s) => s.salesOrders)
  const runMrpForOrder = useMrpStore((s) => s.runMrpForOrder)
  const computeOrderDemand = useMrpStore((s) => s.computeOrderDemand)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getProduct = useMasterStore((s) => s.getProduct)
  const getReleasedBom = useBomStore((s) => s.getReleasedBomForProduct)

  const defaultSo = salesOrders.find((s) => s.id === defaultSoId || s.salesOrderNo === defaultSoId)
  const [salesOrderId, setSalesOrderId] = useState(defaultSo?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const selectedSo = salesOrders.find((s) => s.id === salesOrderId)
  const selectedProduct = selectedSo ? getProduct(selectedSo.productId) : undefined
  const releasedBom = selectedSo ? getReleasedBom(selectedSo.productId) : undefined

  const demandPreview = useMemo(() => {
    if (!selectedSo) return null
    return computeOrderDemand({
      salesOrderId: selectedSo.id,
      productId: selectedSo.productId,
      qty: selectedSo.qty,
      requiredDate: selectedSo.requiredDate,
    })
  }, [selectedSo, computeOrderDemand])

  const previewLines = demandPreview?.ok ? demandPreview.materials : []
  const shortageCount = previewLines.filter((m) => m.shortageQty > 0).length

  function handleRun() {
    if (!salesOrderId) {
      setError('Select a sales order')
      return
    }
    setError(null)
    setRunning(true)
    const result = runMrpForOrder(salesOrderId, undefined, { autoReserve: true })
    setRunning(false)
    if (result.ok && result.runId) {
      navigate(`/mrp/runs/${result.runId}`)
    } else {
      setError(result.error ?? 'Planning run failed')
    }
  }

  return (
    <DynamicsModuleDashboard
      title="Run Planning"
      subtitle="Select a sales order. Available stock is reserved and purchase needs are calculated automatically."
      badge="Planning"
      favoritePath="/mrp/run"
      heroMetrics={[
        { id: 'so', label: 'Open Orders', value: salesOrders.length, helper: 'Available to plan' },
        { id: 'items', label: 'Materials', value: previewLines.length || '—', helper: selectedSo ? 'In BOM preview' : 'Select an order' },
        { id: 'short', label: 'Shortages', value: selectedSo ? shortageCount : '—', accent: shortageCount ? 'red' : 'green', helper: 'Before planning' },
      ]}
      quickActions={
        <Link to="/mrp">
          <DynamicsCommandButton icon={<ArrowLeft className="h-4 w-4" />}>Back to Planning</DynamicsCommandButton>
        </Link>
      }
    >
      <DynamicsDashboardPanel title="Select sales order">
        <div className="max-w-xl space-y-4">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

          <FormField label="Sales order" required>
            <Select value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)}>
              <option value="">— Choose an order —</option>
              {salesOrders.map((so) => {
                const cust = getCustomer(so.customerId)
                const prod = getProduct(so.productId)
                return (
                  <option key={so.id} value={so.id}>
                    {so.salesOrderNo} — {cust?.customerName} · {prod?.productName} ({so.qty} units, due {formatDate(so.requiredDate)})
                  </option>
                )
              })}
            </Select>
          </FormField>

          {selectedSo && (
            <div className="space-y-1 rounded-md border border-erp-border bg-erp-surface-alt p-3 text-sm">
              <p><span className="text-erp-muted">Product:</span> {selectedProduct?.productName ?? '—'}</p>
              <p>
                <span className="text-erp-muted">Quantity:</span> {selectedSo.qty}
                {' · '}
                <span className="text-erp-muted">Due:</span> {formatDate(selectedSo.requiredDate)}
              </p>
              <p>
                <span className="text-erp-muted">BOM:</span>{' '}
                {releasedBom
                  ? <Badge color="green">{releasedBom.bomNo} {releasedBom.revision}</Badge>
                  : <span className="text-erp-danger">No released BOM — fix in Engineering first</span>}
              </p>
            </div>
          )}

          <Button onClick={handleRun} disabled={!salesOrderId || !releasedBom || running}>
            <Play className="h-4 w-4" /> Run Planning
          </Button>
          <p className="text-xs text-erp-muted">
            Stock is reserved automatically. Purchase requisitions are created for any shortages.
          </p>
        </div>
      </DynamicsDashboardPanel>

      {selectedSo && previewLines.length > 0 && (
        <DynamicsDashboardPanel title="Material preview" noPadding>
          <DataGrid
            data={previewLines}
            columns={[
              { accessorKey: 'itemCode', header: 'Item' },
              { accessorKey: 'requiredQty', header: 'Needed', cell: ({ row }) => formatNumber(row.original.requiredQty) },
              { accessorKey: 'freeStock', header: 'In stock', cell: ({ row }) => formatNumber(row.original.freeStock) },
              {
                accessorKey: 'shortageQty',
                header: 'Short',
                cell: ({ row }) => (
                  <span className={row.original.shortageQty > 0 ? 'font-semibold text-erp-danger' : 'text-erp-success'}>
                    {formatNumber(row.original.shortageQty)}
                  </span>
                ),
              },
            ]}
            compact
          />
        </DynamicsDashboardPanel>
      )}
    </DynamicsModuleDashboard>
  )
}
