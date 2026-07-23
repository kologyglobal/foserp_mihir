import { useMemo, useState, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  CircleDollarSign,
  Factory,
  Package,
  Percent,
  ShieldCheck,
} from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { MasterBatchImportDialog } from '../../../components/masters/MasterBatchImportDialog'
import { isApiMode } from '../../../config/apiConfig'
import { downloadMasterExport } from '../../../services/api/masterBatchApi'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { HsnMasterSelect, GstGroupSelect, UomMasterSelect } from '../../../components/masters/TaxMasterSelects'
import { ErpSmartSelect } from '../../../components/erp/ErpSmartSelect'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox, Textarea } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import { useBomStore } from '../../../store/bomStore'
import { useRoutingStore } from '../../../store/routingStore'
import { useLeafCategories, useActiveUoms, useEnrichedItems } from '../../../hooks/useMasterLists'
import { enrichItemWithDefaults } from '../../../utils/itemMasterDefaults'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatCurrency, formatNumber } from '../../../utils/formatters/currency'
import { formatDate } from '../../../utils/dates/format'
import {
  ENGINEERING_PRODUCT_TYPE_LABELS,
  INVENTORY_POSTING_TYPE_LABELS,
  QUALITY_TEST_GROUP_OPTIONS,
  type EngineeringProductType,
  type InventoryPostingType,
} from '../../../types/taxMaster'
import type { Item, ItemSalesFulfilmentMethod, ItemType, SubAssemblyRule } from '../../../types/master'
import { SUB_ASSEMBLY_RULE_LABELS } from '../../../types/bom'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const FULFILMENT_OPTIONS: { value: ItemSalesFulfilmentMethod; label: string }[] = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'SUBCONTRACT', label: 'Subcontract' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUAL', label: 'Manual' },
]

const schema = z.object({
  productType: z.enum(['boi', 'raw_material', 'sub_assembly', 'assembly_product', 'finish_product', 'scrap', 'service']),
  itemCode: z.string().min(1).max(30),
  itemName: z.string().min(1),
  itemName2: z.string().optional(),
  itemDescription: z.string(),
  categoryId: z.string().min(1),
  inventoryType: z.enum(['inventory', 'non_inventory', 'service']),
  itemType: z.enum(['raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good', 'scrap', 'service']),
  isBlocked: z.boolean(),
  baseUomId: z.string().min(1),
  quantityPerUom: z.coerce.number().min(0),
  purchaseUomId: z.string().nullable().optional(),
  purchaseQtyPerUom: z.coerce.number().min(0),
  hsnId: z.string().nullable().optional(),
  hsnCode: z.string(),
  gstGroupId: z.string().nullable().optional(),
  materialGrade: z.string(),
  reorderLevel: z.coerce.number().min(0),
  reorderQty: z.coerce.number().min(0),
  standardRate: z.coerce.number().min(0),
  salesDescription: z.string().optional(),
  salesUomId: z.string().nullable().optional(),
  defaultSalesRate: z.coerce.number().min(0),
  salesLeadDays: z.coerce.number().int().min(0),
  salesAllowed: z.boolean(),
  defaultFulfilmentMethod: z.enum(['STOCK', 'PURCHASE', 'PRODUCTION', 'SUBCONTRACT', 'SERVICE', 'MANUAL']),
  productionAllowed: z.boolean(),
  isPurchasable: z.boolean(),
  isStockable: z.boolean(),
  isActive: z.boolean(),
  qcRequired: z.boolean(),
  qualityTestGroupCode: z.string().nullable().optional(),
  productionBomId: z.string().nullable().optional(),
  routingNo: z.string().nullable().optional(),
  drawingNo: z.string().nullable().optional(),
  subAssemblyRule: z.enum(['phantom', 'manufactured', 'purchased', 'subcontracted']).nullable().optional(),
}).superRefine((data, ctx) => {
  const mappedType = mapProductTypeToItemType(data.productType)
  if (mappedType === 'sub_assembly' && !data.subAssemblyRule) {
    ctx.addIssue({ code: 'custom', message: 'Sub-assembly rule required', path: ['subAssemblyRule'] })
  }
})

type FormData = z.infer<typeof schema>

function mapProductTypeToItemType(pt: EngineeringProductType): ItemType {
  if (pt === 'raw_material' || pt === 'scrap') return 'raw'
  if (pt === 'boi') return 'bought_out'
  if (pt === 'sub_assembly' || pt === 'assembly_product') return 'sub_assembly'
  if (pt === 'finish_product') return 'finished_good'
  if (pt === 'service') return 'service'
  return 'bought_out'
}

function defaultSalesAllowedForProductType(pt: EngineeringProductType): boolean {
  return pt === 'finish_product' || pt === 'service' || pt === 'boi'
}

function defaultFulfilmentForProductType(pt: EngineeringProductType): ItemSalesFulfilmentMethod {
  if (pt === 'finish_product' || pt === 'sub_assembly' || pt === 'assembly_product') return 'PRODUCTION'
  if (pt === 'service') return 'SERVICE'
  if (pt === 'boi' || pt === 'raw_material') return 'PURCHASE'
  return 'MANUAL'
}

function defaultProductionAllowedForProductType(pt: EngineeringProductType): boolean {
  return pt === 'finish_product' || pt === 'sub_assembly' || pt === 'assembly_product'
}

export function ItemListPage() {
  const items = useEnrichedItems()
  const deleteItem = useMasterStore((s) => s.deleteItem)
  const activateItem = useMasterStore((s) => s.activateItem)
  const deactivateItem = useMasterStore((s) => s.deactivateItem)
  const getCategoryName = useMasterStore((s) => s.getCategoryName)
  const getUomName = useMasterStore((s) => s.getUomName)
  const getHsn = useMasterStore((s) => s.getHsn)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchSearch = i.itemCode.toLowerCase().includes(search.toLowerCase()) || i.itemName.toLowerCase().includes(search.toLowerCase())
        const matchStatus = matchesStatusFilter(i.isActive, status)
        const matchType = typeFilter === 'all' || i.productType === typeFilter
        return matchSearch && matchStatus && matchType
      }),
    [items, search, status, typeFilter],
  )

  const columns: ColumnDef<Item, unknown>[] = [
    { accessorKey: 'itemCode', header: 'Item Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.itemCode}</span> },
    { accessorKey: 'itemName', header: 'Name' },
    { id: 'productType', header: 'Product Type', cell: ({ row }) => row.original.productType ? ENGINEERING_PRODUCT_TYPE_LABELS[row.original.productType] : '—' },
    { id: 'category', header: 'Category', cell: ({ row }) => getCategoryName(row.original.categoryId) },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => (row.original.hsnId ? getHsn(row.original.hsnId)?.code : row.original.hsnCode) ?? '—' },
    { id: 'uom', header: 'UOM', cell: ({ row }) => getUomName(row.original.baseUomId).split(' ')[0] },
    { accessorKey: 'standardRate', header: 'Std Rate', cell: ({ row }) => formatCurrency(row.original.standardRate) },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/items/${row.original.id}`}
        editTo={`/masters/items/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={`${row.original.itemCode} — ${row.original.itemName}`}
        isActive={row.original.isActive}
        deleteRecord={deleteItem}
        activateRecord={activateItem}
        deactivateRecord={deactivateItem}
      />
    ) },
  ]

  async function handleExport() {
    if (!isApiMode()) {
      notify.info('Export downloads the current register from the tenant database in API mode.')
      return
    }
    try {
      await downloadMasterExport('items', {
        search: search || undefined,
        status: status === 'all' ? undefined : status === 'active' ? 'ACTIVE' : 'INACTIVE',
      })
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  return (
    <>
    <MasterListShell
      title="Item Master"
      description="Engineering items — raw materials, bought-out, sub-assemblies, and finished products"
      masterGroupId="inventory"
      createLabel="New Item"
      createTo="/masters/items/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      onImport={() => setImportOpen(true)}
      onExport={() => void handleExport()}
      extraFilters={(
        <Select wrapClassName="w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Product Types</option>
          {Object.entries(ENGINEERING_PRODUCT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      )}
      stats={[
        { label: 'Items', value: items.length },
        { label: 'Finished', value: items.filter((i) => i.productType === 'finish_product').length },
        { label: 'Active', value: items.filter((i) => i.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
    <MasterBatchImportDialog open={importOpen} onClose={() => setImportOpen(false)} resource="items" />
    </>
  )
}

export function ItemFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const rawExisting = useMasterStore((s) => (id ? s.items.find((i) => i.id === id) : undefined))
  const existing = rawExisting ? enrichItemWithDefaults(rawExisting) : undefined
  const items = useMasterStore((s) => s.items)
  const leafCategories = useLeafCategories()
  const uoms = useActiveUoms()
  const getHsn = useMasterStore((s) => s.getHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  const addItem = useMasterStore((s) => s.addItem)
  const updateItem = useMasterStore((s) => s.updateItem)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          ...existing,
          productType: existing.productType ?? 'raw_material',
          inventoryType: existing.inventoryType ?? 'inventory',
          itemName2: existing.itemName2 ?? '',
          hsnId: existing.hsnId ?? '',
          gstGroupId: existing.gstGroupId ?? '',
          purchaseUomId: existing.purchaseUomId ?? existing.baseUomId,
          qualityTestGroupCode: existing.qualityTestGroupCode ?? '',
          productionBomId: existing.productionBomId ?? '',
          routingNo: existing.routingNo ?? '',
          drawingNo: existing.drawingNo ?? '',
          isBlocked: existing.isBlocked ?? false,
          qcRequired: existing.qcRequired ?? false,
          quantityPerUom: existing.quantityPerUom ?? 1,
          purchaseQtyPerUom: existing.purchaseQtyPerUom ?? 1,
          salesDescription: existing.salesDescription ?? '',
          salesUomId: existing.salesUomId ?? existing.baseUomId,
          defaultSalesRate: existing.defaultSalesRate ?? 0,
          salesLeadDays: existing.salesLeadDays ?? 0,
          salesAllowed: existing.salesAllowed ?? defaultSalesAllowedForProductType(existing.productType ?? 'raw_material'),
          defaultFulfilmentMethod:
            existing.defaultFulfilmentMethod ??
            defaultFulfilmentForProductType(existing.productType ?? 'raw_material'),
          productionAllowed:
            existing.productionAllowed ??
            defaultProductionAllowedForProductType(existing.productType ?? 'raw_material'),
        }
      : {
          productType: 'raw_material' as EngineeringProductType,
          itemCode: '',
          inventoryType: 'inventory' as InventoryPostingType,
          itemType: 'bought_out' as ItemType,
          isBlocked: false,
          isPurchasable: true,
          isStockable: true,
          isActive: true,
          qcRequired: false,
          qualityTestGroupCode: '',
          quantityPerUom: 1,
          purchaseQtyPerUom: 1,
          reorderLevel: 0,
          reorderQty: 0,
          standardRate: 0,
          salesDescription: '',
          defaultSalesRate: 0,
          salesLeadDays: 0,
          salesAllowed: false,
          defaultFulfilmentMethod: 'PURCHASE' as ItemSalesFulfilmentMethod,
          productionAllowed: false,
          subAssemblyRule: null,
          baseUomId: uoms[0]?.id ?? '',
          purchaseUomId: uoms[0]?.id ?? '',
          salesUomId: uoms[0]?.id ?? '',
          categoryId: leafCategories[0]?.id ?? '',
        },
  })

  const watched = useWatch({ control })
  const productType = watch('productType')
  const hsnId = watch('hsnId') ?? ''
  const gstGroupId = watch('gstGroupId') ?? ''
  const baseUomId = watch('baseUomId')
  const inventoryType = watch('inventoryType')

  const categoryOptions = useMemo(
    () => leafCategories.map((c) => ({ value: c.id, label: `${c.categoryCode} — ${c.categoryName}`, searchText: c.categoryName.toLowerCase() })),
    [leafCategories],
  )

  const bomOptions = useMemo(
    () => bomHeaders.map((b) => ({ value: b.id, label: `${b.bomNo} Rev ${b.revision}`, searchText: b.bomNo.toLowerCase() })),
    [bomHeaders],
  )

  const routingOptions = useMemo(
    () => routingHeaders.map((r) => ({ value: r.routingNo, label: `${r.routingNo} Rev ${r.revision}`, searchText: r.routingNo.toLowerCase() })),
    [routingHeaders],
  )

  function onHsnChange(hsnMasterId: string) {
    setValue('hsnId', hsnMasterId || null)
    const hsn = hsnMasterId ? getHsn(hsnMasterId) : null
    if (hsn) {
      setValue('hsnCode', hsn.code, { shouldValidate: true })
      setValue('gstGroupId', hsn.gstGroupId, { shouldValidate: true })
    }
  }

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.itemCode, {
        checkDuplicate: (c) => items.some((i) => i.itemCode === c && i.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid item code')
        return
      }
      setSaveError(null)
      const payload = {
        ...data,
        codeSeriesMode: 'auto' as const,
        itemType: mapProductTypeToItemType(data.productType),
        subAssemblyRule: data.productType === 'sub_assembly' || data.productType === 'assembly_product'
          ? (data.subAssemblyRule as SubAssemblyRule)
          : null,
        hsnId: data.hsnId || null,
        gstGroupId: data.gstGroupId || null,
        purchaseUomId: data.purchaseUomId || data.baseUomId,
        qualityTestGroupCode: data.qualityTestGroupCode || null,
        productionBomId: data.productionBomId || null,
        routingNo: data.routingNo || null,
        drawingNo: data.drawingNo || null,
        isStockable: data.inventoryType === 'inventory',
      }
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateItem(id, payload))
        else recordId = await resolveMaybeId(addItem(payload))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.itemCode)
        notifyMasterSaved('Item', !isEdit)
        if (mode === 'new') { navigate('/masters/items/new'); return }
        if (mode === 'close') { navigate('/masters/items'); return }
        if (!isEdit && recordId) navigate(`/masters/items/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const invQty = existing?.inventoryQty ?? 0
  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/items')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.itemCode : 'New Item'}
      subtitle={existing?.itemName ?? 'Engineering & inventory item setup'}
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit Item' : 'New Item')}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Item Code', value: watched.itemCode?.trim() || '—', highlight: Boolean(watched.itemCode?.trim()) },
        { label: 'Product Type', value: productType ? ENGINEERING_PRODUCT_TYPE_LABELS[productType] : '—' },
        { label: 'HSN', value: hsnId ? getHsn(hsnId)?.code ?? '—' : watched.hsnCode ?? '—' },
        { label: 'Status', value: watched.isBlocked ? 'Blocked' : watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={<MasterForm listPath="/masters/items" isEdit={isEdit} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: Package, done: Boolean(watched.itemCode?.trim() && watched.itemName?.trim()) },
        { id: 'tax', label: 'Tax', icon: Percent, done: Boolean(hsnId || watched.hsnCode) },
        { id: 'inventory', label: 'Inventory', icon: Box, done: inventoryType === 'inventory' },
        { id: 'quality', label: 'Quality', icon: ShieldCheck, done: !watched.qcRequired || Boolean(watched.qualityTestGroupCode) },
        { id: 'manufacturing', label: 'Manufacturing', icon: Factory, done: Boolean(watched.productionBomId || watched.routingNo) },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'On Hand', value: formatNumber(invQty), accent: 'blue' as const },
        { label: 'Std Rate', value: formatCurrency(watched.standardRate ?? 0), accent: 'violet' as const },
        { label: 'GST Group', value: gstGroupId ? getGstGroup(gstGroupId)?.code ?? '—' : '—', accent: 'amber' as const },
      ]}
      factBoxTitle="Item insight"
      factBoxSummary={[
        { label: 'Used in', value: 'BOM, Purchase, Inventory, Production, Sales' },
        { label: 'Category', value: leafCategories.find((c) => c.id === watched.categoryId)?.categoryName ?? '—' },
        { label: 'UOM', value: uoms.find((u) => u.id === baseUomId)?.uomCode ?? '—' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={<MasterStickyFooter isEdit={isEdit} isSubmitting={isSubmitting} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
    >
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}>
        <ErpCardSection
          id="item-section-general"
          title="General"
          subtitle="Product type, identification, category, and units."
          icon={Package}
          accent="blue"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="Product Type" required>
            <Select
              {...register('productType')}
              onChange={(e) => {
                register('productType').onChange(e)
                setValue('itemType', mapProductTypeToItemType(e.target.value as EngineeringProductType))
              }}
            >
              {Object.entries(ENGINEERING_PRODUCT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          <MasterCodeField
            entityType="item"
            label="Item Code"
            isEdit={isEdit}
            existingCode={existing?.itemCode}
            value={watched.itemCode ?? ''}
            onChange={(v) => setValue('itemCode', v, { shouldValidate: true })}
            onSeriesReady={(h) => { codeSeriesRef.current = h }}
            error={errors.itemCode?.message}
            required
          />
          <FormField label="Type" required>
            <Select {...register('inventoryType')}>
              {Object.entries(INVENTORY_POSTING_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Item Name" required error={errors.itemName?.message}>
            <Input {...register('itemName')} />
          </FormField>
          <FormField label="Item Name 2">
            <Input {...register('itemName2')} placeholder="Secondary description" />
          </FormField>
          <FormField label="Item Category Code" required error={errors.categoryId?.message}>
            <ErpSmartSelect
              options={categoryOptions}
              value={watch('categoryId')}
              onChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
              placeholder="Select category"
            />
          </FormField>
          <FormField label="Unit of Measure" required error={errors.baseUomId?.message}>
            <UomMasterSelect value={baseUomId} onChange={(v) => setValue('baseUomId', v, { shouldValidate: true })} />
          </FormField>
          <FormField label="Quantity" error={errors.quantityPerUom?.message}>
            <Input type="number" step="0.001" {...register('quantityPerUom')} />
          </FormField>
          <FormField label="Purchase Unit of Measure">
            <UomMasterSelect value={watch('purchaseUomId') ?? ''} onChange={(v) => setValue('purchaseUomId', v)} />
          </FormField>
          <FormField label="Purchase Qty per UOM">
            <Input type="number" step="0.001" {...register('purchaseQtyPerUom')} />
          </FormField>
          <FormField label="Material Grade">
            <Input {...register('materialGrade')} />
          </FormField>
          <FormField label="Standard Rate">
            <Input type="number" step="0.01" {...register('standardRate')} />
          </FormField>
          {(productType === 'sub_assembly' || productType === 'assembly_product') ? (
            <FormField label="Sub-Assembly Rule" required error={errors.subAssemblyRule?.message}>
              <Select {...register('subAssemblyRule')}>
                <option value="">Select rule</option>
                {Object.entries(SUB_ASSEMBLY_RULE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField label="Blocked">
            <Checkbox {...register('isBlocked')} label="Block item on documents" />
          </FormField>
          <FormField label="Purchasable">
            <Checkbox {...register('isPurchasable')} label="Allow purchase" />
          </FormField>
          <FormField label="Active">
            <Checkbox {...register('isActive')} label="Active" />
          </FormField>
          <FormField label="Description" className="col-span-full md:col-span-2 xl:col-span-3">
            <Textarea rows={2} {...register('itemDescription')} />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-sales"
          title="Sales"
          subtitle="CRM commercial fields. Default sales rate is the interim sales price (not inventory standard rate)."
          icon={CircleDollarSign}
          accent="blue"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="Sales allowed">
            <Checkbox {...register('salesAllowed')} label="Allow on CRM / sales documents" />
          </FormField>
          <FormField label="Production allowed">
            <Checkbox {...register('productionAllowed')} label="Allow manufacturing use" />
          </FormField>
          <FormField label="Default fulfilment">
            <Select {...register('defaultFulfilmentMethod')}>
              <option value="">— Select —</option>
              {FULFILMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Default sales rate">
            <Input type="number" step="0.01" {...register('defaultSalesRate')} />
          </FormField>
          <FormField label="Sales lead days">
            <Input type="number" step="1" {...register('salesLeadDays')} />
          </FormField>
          <FormField label="Sales UOM">
            <UomMasterSelect
              value={watch('salesUomId') ?? ''}
              onChange={(v) => setValue('salesUomId', v || null)}
            />
          </FormField>
          <FormField label="Sales description" className="col-span-full md:col-span-2 xl:col-span-3">
            <Textarea rows={2} {...register('salesDescription')} />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-tax"
          title="Tax"
          subtitle="HSN and GST group for statutory reporting."
          icon={Percent}
          accent="green"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="HSN Code" required error={errors.hsnId?.message}>
            <HsnMasterSelect value={hsnId} onChange={onHsnChange} allowEmpty />
          </FormField>
          <FormField label="GST Group Code">
            <GstGroupSelect value={gstGroupId} onChange={(v) => setValue('gstGroupId', v || null)} allowEmpty />
          </FormField>
          <FormField label="Legacy HSN (text)">
            <Input {...register('hsnCode')} readOnly={Boolean(hsnId)} />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-inventory"
          title="Inventory"
          subtitle="Read-only quantities from inventory ledger."
          icon={Box}
          accent="violet"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="Inventory">
            <Input readOnly value={formatNumber(existing?.inventoryQty ?? 0)} />
          </FormField>
          <FormField label="Qty. on Purchase Order">
            <Input readOnly value={formatNumber(existing?.qtyOnPurchaseOrder ?? 0)} />
          </FormField>
          <FormField label="Qty. on Production Order">
            <Input readOnly value={formatNumber(existing?.qtyOnProductionOrder ?? 0)} />
          </FormField>
          <FormField label="Qty. on Sales Order">
            <Input readOnly value={formatNumber(existing?.qtyOnSalesOrder ?? 0)} />
          </FormField>
          <FormField label="Reorder Level">
            <Input type="number" {...register('reorderLevel')} />
          </FormField>
          <FormField label="Reorder Qty">
            <Input type="number" {...register('reorderQty')} />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-quality"
          title="Quality"
          subtitle="QC requirements and test group."
          icon={ShieldCheck}
          accent="amber"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="QC Required">
            <Checkbox {...register('qcRequired')} label="Inspection required before use" />
          </FormField>
          <FormField label="Quality Test Group Code">
            <Select
              value={watch('qualityTestGroupCode') ?? ''}
              onChange={(e) => setValue('qualityTestGroupCode', e.target.value || null, { shouldDirty: true })}
            >
              <option value="">None</option>
              {QUALITY_TEST_GROUP_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </Select>
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-manufacturing"
          title="Manufacturing"
          subtitle="BOM, routing, and drawing references."
          icon={Factory}
          accent="teal"
          columns={3}
          collapsible
          defaultOpen
        >
          <FormField label="Production BOM">
            <ErpSmartSelect
              options={bomOptions}
              value={watch('productionBomId') ?? ''}
              onChange={(v) => setValue('productionBomId', v || null)}
              placeholder="Select BOM"
              allowEmpty
            />
          </FormField>
          <FormField label="Routing No">
            <ErpSmartSelect
              options={routingOptions}
              value={watch('routingNo') ?? ''}
              onChange={(v) => setValue('routingNo', v || null)}
              placeholder="Select routing"
              allowEmpty
            />
          </FormField>
          <FormField label="Drawing No">
            <Input {...register('drawingNo')} placeholder="DWG-ISO-26KL-001" />
          </FormField>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function ItemDetailPage() {
  const { id } = useParams()
  const raw = useMasterStore((s) => (id ? s.items.find((i) => i.id === id) : undefined))
  const item = raw ? enrichItemWithDefaults(raw) : undefined
  const getCategoryName = useMasterStore((s) => s.getCategoryName)
  const getUomName = useMasterStore((s) => s.getUomName)
  const getHsn = useMasterStore((s) => s.getHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  if (!item) return <MasterNotFound message="Item not found." />

  return (
    <DetailLayout backTo="/masters/items" backLabel="Item Master" title={`${item.itemCode} — ${item.itemName}`} editTo={`/masters/items/${item.id}/edit`}>
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Product Type" value={item.productType ? ENGINEERING_PRODUCT_TYPE_LABELS[item.productType] : '—'} />
          <DetailField label="Type" value={item.inventoryType ? INVENTORY_POSTING_TYPE_LABELS[item.inventoryType] : '—'} />
          <DetailField label="Category" value={getCategoryName(item.categoryId)} />
          <DetailField label="UOM" value={getUomName(item.baseUomId)} />
          <DetailField label="Blocked" value={item.isBlocked ? 'Yes' : 'No'} />
          <DetailField label="Std Rate" value={formatCurrency(item.standardRate)} />
          <DetailField label="Sales allowed" value={item.salesAllowed ? 'Yes' : 'No'} />
          <DetailField label="Default sales rate" value={formatCurrency(item.defaultSalesRate ?? 0)} />
          <DetailField label="Fulfilment" value={item.defaultFulfilmentMethod ?? '—'} />
          <DetailField label="Sales lead days" value={String(item.salesLeadDays ?? 0)} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Tax">
        <DetailGrid>
          <DetailField label="HSN" value={item.hsnId ? getHsn(item.hsnId)?.code ?? item.hsnCode : item.hsnCode} />
          <DetailField label="GST Group" value={item.gstGroupId ? getGstGroup(item.gstGroupId)?.code ?? '—' : '—'} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Inventory Snapshot">
        <DetailGrid>
          <DetailField label="Inventory" value={formatNumber(item.inventoryQty ?? 0)} />
          <DetailField label="On PO" value={formatNumber(item.qtyOnPurchaseOrder ?? 0)} />
          <DetailField label="On Production" value={formatNumber(item.qtyOnProductionOrder ?? 0)} />
          <DetailField label="On SO" value={formatNumber(item.qtyOnSalesOrder ?? 0)} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Quality & Manufacturing">
        <DetailGrid>
          <DetailField label="QC Required" value={item.qcRequired ? 'Yes' : 'No'} />
          <DetailField label="Test Group" value={item.qualityTestGroupCode ?? '—'} />
          <DetailField label="Routing No" value={item.routingNo ?? '—'} />
          <DetailField label="Drawing No" value={item.drawingNo ?? '—'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
