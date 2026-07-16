import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Checkbox } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { createItem, getInventoryAuditTrail, getItemById, updateItem, InventoryServiceError } from '@/services/inventory'
import type { InventoryAuditEntry, InventoryItemInput, InventoryItemType } from '@/types/inventoryDomain'
import { INVENTORY_ITEM_TYPE_LABELS } from '@/utils/inventoryItemLabels'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatDateTime } from '@/utils/dates/format'

const schema = z.object({
  itemCode: z.string().min(1, 'Item code required'),
  itemName: z.string().min(1, 'Item name required'),
  itemType: z.string().min(1),
  categoryId: z.string().min(1, 'Category required'),
  baseUomId: z.string().min(1, 'Base UOM required'),
  defaultWarehouseId: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'blocked']),
  isInventoryItem: z.boolean(),
  allowNegativeStock: z.boolean(),
  minimumStock: z.coerce.number().min(0),
  maximumStock: z.coerce.number().min(0),
  safetyStock: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  reorderQuantity: z.coerce.number().min(0),
  hsnCode: z.string(),
  gstRate: z.coerce.number().min(0),
  costingMethod: z.enum(['standard', 'average', 'fifo', 'specific']),
  standardCost: z.coerce.number().min(0),
  averageCost: z.coerce.number().min(0),
  lastPurchaseCost: z.coerce.number().min(0),
  batchTracking: z.boolean(),
  serialTracking: z.boolean(),
  expiryTracking: z.boolean(),
  shelfLifeDays: z.coerce.number().nullable(),
  qualityInspectionRequired: z.boolean(),
  automaticBatchSelection: z.boolean(),
  reorderPlanningEnabled: z.boolean(),
  leadTimeDays: z.coerce.number().min(0),
  preferredSource: z.enum(['purchase', 'production', 'subcontract', 'transfer']),
  minimumOrderQuantity: z.coerce.number().min(0),
  maximumOrderQuantity: z.coerce.number().min(0),
})

type FormData = z.infer<typeof schema>

const DEFAULTS: FormData = {
  itemCode: '',
  itemName: '',
  itemType: 'raw_material',
  categoryId: '',
  baseUomId: '',
  defaultWarehouseId: null,
  status: 'active',
  isInventoryItem: true,
  allowNegativeStock: false,
  minimumStock: 0,
  maximumStock: 0,
  safetyStock: 0,
  reorderLevel: 0,
  reorderQuantity: 0,
  hsnCode: '',
  gstRate: 18,
  costingMethod: 'standard',
  standardCost: 0,
  averageCost: 0,
  lastPurchaseCost: 0,
  batchTracking: false,
  serialTracking: false,
  expiryTracking: false,
  shelfLifeDays: null,
  qualityInspectionRequired: false,
  automaticBatchSelection: false,
  reorderPlanningEnabled: false,
  leadTimeDays: 7,
  preferredSource: 'purchase',
  minimumOrderQuantity: 1,
  maximumOrderQuantity: 0,
}

export function InventoryItemFormPage() {
  const { id, itemId } = useParams()
  const recordId = id ?? itemId
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const isEdit = Boolean(recordId)
  const categories = useMasterStore((s) => s.categories.filter((c) => c.isActive))
  const uoms = useMasterStore((s) => s.uoms.filter((u) => u.isActive))
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [audit, setAudit] = useState<InventoryAuditEntry[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: DEFAULTS,
  })

  const expiryTracking = useWatch({ control: form.control, name: 'expiryTracking' })
  const batchTracking = useWatch({ control: form.control, name: 'batchTracking' })
  const serialTracking = useWatch({ control: form.control, name: 'serialTracking' })
  const reorderPlanningEnabled = useWatch({ control: form.control, name: 'reorderPlanningEnabled' })

  useEffect(() => {
    if (!recordId) return
    Promise.all([getItemById(recordId), getInventoryAuditTrail(recordId)]).then(([item, trail]) => {
      if (!item) {
        navigate('/inventory/items')
        return
      }
      form.reset({
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemType: item.itemType,
        categoryId: item.categoryId,
        baseUomId: item.baseUomId,
        defaultWarehouseId: item.defaultWarehouseId,
        status: item.status,
        isInventoryItem: item.isInventoryItem,
        allowNegativeStock: item.allowNegativeStock,
        minimumStock: item.minimumStock,
        maximumStock: item.maximumStock,
        safetyStock: item.safetyStock,
        reorderLevel: item.reorderLevel,
        reorderQuantity: item.reorderQuantity,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        costingMethod: item.costingMethod,
        standardCost: item.standardCost,
        averageCost: item.averageCost,
        lastPurchaseCost: item.lastPurchaseCost,
        batchTracking: item.batchTracking,
        serialTracking: item.serialTracking,
        expiryTracking: item.expiryTracking,
        shelfLifeDays: item.shelfLifeDays,
        qualityInspectionRequired: item.qualityInspectionRequired,
        automaticBatchSelection: item.automaticBatchSelection,
        reorderPlanningEnabled: item.reorderPlanningEnabled,
        leadTimeDays: item.leadTimeDays,
        preferredSource: item.preferredSource,
        minimumOrderQuantity: item.minimumOrderQuantity,
        maximumOrderQuantity: item.maximumOrderQuantity,
      })
      setAudit(trail)
      setLoading(false)
    })
  }, [recordId, form, navigate])

  const onSubmit = form.handleSubmit(async (data) => {
    setSaving(true)
    try {
      const input = {
        ...data,
        itemType: data.itemType as InventoryItemType,
        defaultWarehouseId: data.defaultWarehouseId || null,
        shelfLifeDays: data.expiryTracking ? data.shelfLifeDays : null,
        automaticBatchSelection: data.batchTracking ? data.automaticBatchSelection : false,
      } as InventoryItemInput
      if (isEdit && recordId) {
        await updateItem(recordId, input)
        notify.success('Item updated')
        navigate(`/inventory/items/${recordId}`)
      } else {
        const created = await createItem(input)
        notify.success('Item created')
        navigate(`/inventory/items/${created.id}`)
      }
    } catch (err) {
      notify.error(err instanceof InventoryServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  })

  if (!perms.canCreateItem && !isEdit) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="New Item"
        breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Items', to: '/inventory/items' }, { label: 'New' }]}
        autoBreadcrumbs={false}
      >
        <p className="text-sm text-red-600">Access denied</p>
      </OperationalPageShell>
    )
  }

  if (loading) return <LoadingState variant="form" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={isEdit ? 'Edit Item' : 'New Item'}
      description="Business Central–style item card. Expand sections as needed."
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Items', to: '/inventory/items' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'save', label: saving ? 'Saving…' : 'Save', onClick: () => void onSubmit() }}
          secondaryActions={[{
            id: 'cancel',
            label: 'Cancel',
            onClick: () => navigate(isEdit && recordId ? `/inventory/items/${recordId}` : '/inventory/items'),
          }]}
        />
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); void onSubmit() }} className="space-y-3">
        <ErpCardSection title="General" collapsible defaultOpen accent="blue">
          <FormField label="Item Code" error={form.formState.errors.itemCode?.message} required>
            <Input {...form.register('itemCode')} disabled={isEdit} />
          </FormField>
          <FormField label="Item Name" error={form.formState.errors.itemName?.message} required>
            <Input {...form.register('itemName')} />
          </FormField>
          <FormField label="Item Type">
            <Select {...form.register('itemType')}>
              {Object.entries(INVENTORY_ITEM_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Category" error={form.formState.errors.categoryId?.message} required>
            <Select {...form.register('categoryId')}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
            </Select>
          </FormField>
          <FormField label="Base UOM" error={form.formState.errors.baseUomId?.message} required>
            <Select {...form.register('baseUomId')}>
              <option value="">Select…</option>
              {uoms.map((u) => <option key={u.id} value={u.id}>{u.uomCode}</option>)}
            </Select>
          </FormField>
          <FormField label="Default Warehouse">
            <Select {...form.register('defaultWarehouseId', { setValueAs: (v) => (v === '' ? null : v) })}>
              <option value="">—</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select {...form.register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </Select>
          </FormField>
        </ErpCardSection>

        <ErpCardSection title="Inventory Controls" collapsible defaultOpen={false} accent="teal">
          <FormField label="Inventory Item">
            <Checkbox label="Track inventory quantity" {...form.register('isInventoryItem')} />
          </FormField>
          <FormField label="Allow Negative Stock">
            <Checkbox label="Allow negative on-hand" {...form.register('allowNegativeStock')} />
          </FormField>
          <FormField label="Minimum Stock"><Input type="number" {...form.register('minimumStock')} /></FormField>
          <FormField label="Maximum Stock"><Input type="number" {...form.register('maximumStock')} /></FormField>
          <FormField label="Safety Stock"><Input type="number" {...form.register('safetyStock')} /></FormField>
          <FormField label="Reorder Level"><Input type="number" {...form.register('reorderLevel')} /></FormField>
          <FormField label="Reorder Quantity"><Input type="number" {...form.register('reorderQuantity')} /></FormField>
        </ErpCardSection>

        {perms.canViewCost ? (
          <ErpCardSection title="Cost and Tax" collapsible defaultOpen={false} accent="amber">
            <FormField label="HSN Code"><Input {...form.register('hsnCode')} /></FormField>
            <FormField label="GST Rate (%)"><Input type="number" {...form.register('gstRate')} /></FormField>
            <FormField label="Costing Method">
              <Select {...form.register('costingMethod')}>
                <option value="standard">Standard</option>
                <option value="average">Average</option>
                <option value="fifo">FIFO</option>
                <option value="specific">Specific</option>
              </Select>
            </FormField>
            <FormField label="Standard Cost"><Input type="number" step="0.01" {...form.register('standardCost')} /></FormField>
            <FormField label="Average Cost"><Input type="number" step="0.01" {...form.register('averageCost')} /></FormField>
            <FormField label="Last Purchase Cost"><Input type="number" step="0.01" {...form.register('lastPurchaseCost')} /></FormField>
          </ErpCardSection>
        ) : (
          <ErpCardSection title="Cost and Tax" collapsible defaultOpen={false} accent="amber">
            <p className="col-span-full text-[12px] text-erp-muted">Cost fields hidden — requires inventory.view_cost.</p>
          </ErpCardSection>
        )}

        <ErpCardSection title="Tracking and Quality" collapsible defaultOpen={false} accent="violet">
          <FormField label="Batch Tracking">
            <Checkbox label="Enable batch tracking" {...form.register('batchTracking')} />
          </FormField>
          <FormField label="Serial Tracking">
            <Checkbox label="Enable serial tracking" {...form.register('serialTracking')} />
          </FormField>
          <FormField label="Expiry Tracking">
            <Checkbox label="Enable expiry tracking" {...form.register('expiryTracking')} />
          </FormField>
          {expiryTracking ? (
            <FormField label="Shelf Life (days)">
              <Input type="number" {...form.register('shelfLifeDays', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })} />
            </FormField>
          ) : null}
          <FormField label="Quality Inspection Required">
            <Checkbox label="Inspection required on receipt" {...form.register('qualityInspectionRequired')} />
          </FormField>
          {batchTracking ? (
            <FormField label="Automatic Batch Selection">
              <Checkbox label="Auto-select batch on issue" {...form.register('automaticBatchSelection')} />
            </FormField>
          ) : null}
          {serialTracking ? (
            <p className="col-span-full text-[12px] text-erp-muted">Serial assignment occurs during receipt / production posting (later phase).</p>
          ) : null}
        </ErpCardSection>

        <ErpCardSection title="Planning" collapsible defaultOpen={false} accent="green">
          <FormField label="Reorder Planning Enabled">
            <Checkbox label="Enable reorder planning" {...form.register('reorderPlanningEnabled')} />
          </FormField>
          {reorderPlanningEnabled ? (
            <>
              <FormField label="Lead Time (days)"><Input type="number" {...form.register('leadTimeDays')} /></FormField>
              <FormField label="Preferred Source">
                <Select {...form.register('preferredSource')}>
                  <option value="purchase">Purchase</option>
                  <option value="production">Production</option>
                  <option value="subcontract">Subcontract</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </FormField>
              <FormField label="Minimum Order Quantity"><Input type="number" {...form.register('minimumOrderQuantity')} /></FormField>
              <FormField label="Maximum Order Quantity"><Input type="number" {...form.register('maximumOrderQuantity')} /></FormField>
            </>
          ) : null}
        </ErpCardSection>

        <ErpCardSection title="Audit" collapsible defaultOpen={false} accent="slate">
          {isEdit && audit.length > 0 && perms.canViewAudit ? (
            <table className="erp-table col-span-full w-full text-[12px]">
              <thead><tr><th>When</th><th>Action</th><th>User</th></tr></thead>
              <tbody>
                {audit.slice(0, 8).map((a) => (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.timestamp)}</td>
                    <td>{a.action}</td>
                    <td>{a.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="col-span-full text-[12px] text-erp-muted">
              {isEdit ? (perms.canViewAudit ? 'No audit entries yet.' : 'Audit requires inventory.view_audit.') : 'Audit trail available after save.'}
            </p>
          )}
        </ErpCardSection>
      </form>
    </OperationalPageShell>
  )
}
