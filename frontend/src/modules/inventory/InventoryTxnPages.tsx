import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { LocationEntryField } from '@/components/masters/LocationEntryField'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useInventoryStore } from '@/store/inventoryStore'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { useMasterStore } from '@/store/masterStore'
import { useActiveLocations } from '../../hooks/useMasterLists'
import { getDefaultLocationId, resolveLocationWarehouseId } from '@/utils/locationUtils'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
const txnSchema = z.object({
  itemId: z.string().min(1, 'Select item from Item Master'),
  locationId: z.string().min(1, 'Select location code'),
  qty: z.coerce.number().positive('Quantity must be positive'),
  rate: z.coerce.number().min(0).optional(),
  referenceNo: z.string().min(1, 'Reference number required'),
  remarks: z.string(),
  txnDate: z.string().min(1),
})

type TxnFormData = z.infer<typeof txnSchema>

interface TxnPageConfig {
  title: string
  description: string
  backTo: string
  submitLabel: string
  showRate?: boolean
  showAdjustmentType?: boolean
  locationUsage?: 'all' | 'sales' | 'purchase' | 'production'
  onSubmit: (data: TxnFormData & { warehouseId: string; isPositive?: boolean }) => { ok: boolean; error?: string; txnNo?: string }
}

function StockTxnForm({ config }: { config: TxnPageConfig }) {
  const locations = useActiveLocations()
  const getItem = useMasterStore((s) => s.getItem)
  const defaultLocationId = getDefaultLocationId(locations, config.locationUsage ?? 'all')
  const getOnHand = useInventoryStore((s) => s.getOnHand)
  const getFreeQty = useInventoryStore((s) => s.getFreeQty)

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [adjType, setAdjType] = useState<'positive' | 'negative'>('positive')
  const [locationId, setLocationId] = useState(defaultLocationId)
  const [warehouseId, setWarehouseId] = useState(() => resolveLocationWarehouseId(defaultLocationId, locations) ?? '')

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting }, reset } = useForm<TxnFormData>({
    resolver: zodResolver(txnSchema) as Resolver<TxnFormData>,
    defaultValues: {
      txnDate: new Date().toISOString().slice(0, 10),
      remarks: '',
      referenceNo: '',
      locationId: defaultLocationId,
    },
  })

  const itemId = watch('itemId')
  const selectedItem = itemId ? getItem(itemId) : undefined
  const onHand = itemId && warehouseId ? getOnHand(itemId, warehouseId) : null
  const free = itemId && warehouseId ? getFreeQty(itemId, warehouseId) : null

  const onSubmit = handleSubmit((data) => {
    const whId = resolveLocationWarehouseId(data.locationId, locations)
    if (!whId) {
      setToast({ type: 'err', msg: 'Selected location has no warehouse posting — choose a stock location.' })
      return
    }
    const result = config.onSubmit({ ...data, warehouseId: whId, isPositive: adjType === 'positive' })
    if (result.ok) {
      setToast({ type: 'ok', msg: `Posted successfully — ${result.txnNo}` })
      setLocationId(defaultLocationId)
      setWarehouseId(resolveLocationWarehouseId(defaultLocationId, locations) ?? '')
      reset({ txnDate: new Date().toISOString().slice(0, 10), remarks: '', referenceNo: '', itemId: '', locationId: defaultLocationId, qty: undefined })
    } else {
      setToast({ type: 'err', msg: result.error ?? 'Transaction failed' })
    }
  })

  return (
    <div>
      <Link to={config.backTo} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={config.title} description={config.description} />

      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Item (Item Master)" required error={errors.itemId?.message}>
                <Controller
                  name="itemId"
                  control={control}
                  render={({ field }) => (
                    <ItemLookupSelect
                      value={field.value ?? ''}
                      onChange={(sel) => field.onChange(sel?.itemId ?? '')}
                      error={Boolean(errors.itemId)}
                    />
                  )}
                />
              </FormField>
              <input type="hidden" {...register('locationId')} />
              <LocationEntryField
                label="Location Code"
                required
                usage={config.locationUsage ?? 'all'}
                value={locationId}
                error={errors.locationId?.message}
                onChange={(locId, whId) => {
                  setLocationId(locId)
                  setWarehouseId(whId)
                  setValue('locationId', locId, { shouldValidate: true })
                }}
              />
              <FormField label="Quantity" required error={errors.qty?.message}>
                <Input type="number" step="any" min={0.001} {...register('qty')} />
              </FormField>
              <FormField label="Transaction Date" required error={errors.txnDate?.message}>
                <Input type="date" {...register('txnDate')} />
              </FormField>
              {config.showRate && (
                <FormField label="Rate (₹)" error={errors.rate?.message}>
                  <Input type="number" step="any" placeholder={selectedItem ? String(selectedItem.standardRate) : ''} {...register('rate')} />
                </FormField>
              )}
              <FormField label="Reference No" required error={errors.referenceNo?.message} className="md:col-span-2">
                <Input placeholder="GRN / MI / OPN / ADJ number" {...register('referenceNo')} />
              </FormField>
              <FormField label="Remarks" className="md:col-span-2">
                <Textarea rows={2} {...register('remarks')} />
              </FormField>
            </div>

            {config.showAdjustmentType && (
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={adjType === 'positive'} onChange={() => setAdjType('positive')} />
                  Positive Adjustment (+)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={adjType === 'negative'} onChange={() => setAdjType('negative')} />
                  Negative Adjustment (−)
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-erp-border pt-4">
              <Link to={config.backTo}><Button type="button" variant="secondary">Cancel</Button></Link>
              <Button type="submit" disabled={isSubmitting}><Save className="h-4 w-4" /> {config.submitLabel}</Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Stock Position</h3>
          {selectedItem ? (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Item</dt><dd className="font-medium">{selectedItem.itemName}</dd></div>
              <div><dt className="text-xs text-slate-500">Std Rate</dt><dd>{formatCurrency(selectedItem.standardRate)}</dd></div>
              <div><dt className="text-xs text-slate-500">Reorder Level</dt><dd>{formatNumber(selectedItem.reorderLevel)}</dd></div>
              {onHand !== null && (
                <>
                  <div><dt className="text-xs text-slate-500">On Hand</dt><dd className="text-lg font-bold text-slate-900">{formatNumber(onHand)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Free Stock</dt><dd className="font-semibold text-emerald-600">{formatNumber(free ?? 0)}</dd></div>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Select item and warehouse to view stock.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

export function OpeningStockPage() {
  const postOpeningStock = useInventoryStore((s) => s.postOpeningStock)
  return (
    <StockTxnForm
      config={{
        title: 'Opening Stock Entry',
        description: 'Post FY opening balances — one-time per item/warehouse combination',
        backTo: '/inventory',
        submitLabel: 'Post Opening Stock',
        onSubmit: (data) => postOpeningStock(data),
      }}
    />
  )
}

export function MaterialInwardPage() {
  const postInward = useInventoryStore((s) => s.postInward)
  return (
    <StockTxnForm
      config={{
        title: 'Material Inward',
        description: 'GRN-based stock receipt — increases warehouse stock',
        backTo: '/inventory',
        submitLabel: 'Post Inward',
        showRate: true,
        locationUsage: 'purchase',
        onSubmit: (data) => postInward(data),
      }}
    />
  )
}

export function MaterialIssuePage() {
  const postIssue = useInventoryStore((s) => s.postIssue)
  return (
    <StockTxnForm
      config={{
        title: 'Material Issue',
        description: 'Issue to production/WIP — cannot exceed free stock',
        backTo: '/inventory',
        submitLabel: 'Post Issue',
        locationUsage: 'production',
        onSubmit: (data) => postIssue(data),
      }}
    />
  )
}

export function StockAdjustmentPage() {
  const postAdjustment = useInventoryStore((s) => s.postAdjustment)
  return (
    <StockTxnForm
      config={{
        title: 'Stock Adjustment',
        description: 'Physical count variance — positive or negative adjustment',
        backTo: '/inventory',
        submitLabel: 'Post Adjustment',
        showAdjustmentType: true,
        onSubmit: (data) => postAdjustment({ ...data, isPositive: data.isPositive ?? true }),
      }}
    />
  )
}
