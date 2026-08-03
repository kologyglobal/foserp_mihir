import { useMemo, useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
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
  ShoppingCart,
  Paperclip,
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
import {
  ENGINEERING_PRODUCT_TYPE_LABELS,
  INVENTORY_POSTING_TYPE_LABELS,
  QUALITY_TEST_GROUP_OPTIONS,
  type EngineeringProductType,
  type InventoryPostingType,
} from '../../../types/taxMaster'
import type { Item, ItemCategory, ItemSalesFulfilmentMethod, ItemType, SubAssemblyRule, Uom } from '../../../types/master'
import { SUB_ASSEMBLY_RULE_LABELS } from '../../../types/bom'
import { EnterpriseMasterWorkspace, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import { MasterItemImageField } from '../../../components/masters/MasterItemImageField'
import { ItemPurchaseMultiUnitFields } from '../../../components/masters/ItemPurchaseMultiUnitFields'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import { handleInvalidSubmit, rhfErrorsToFieldMap, fieldErrorsToMessages } from '../../../utils/formValidation'

const FULFILMENT_OPTIONS: { value: ItemSalesFulfilmentMethod; label: string }[] = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'SUBCONTRACT', label: 'Subcontract' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUAL', label: 'Manual' },
]

function emptyStringToNull(value: unknown) {
  return value === '' ? null : value
}

function emptyToPositiveNumber(fallback: number) {
  return (value: unknown) => {
    if (value === '' || value === undefined || value === null) return fallback
    return value
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Drop stale demo/non-UUID FK values so Zod does not show generic "Invalid input". */
function optionalUuidFormValue(value: string | null | undefined): string {
  if (!value) return ''
  return isUuid(value) ? value : ''
}

function preprocessOptionalUuid(value: unknown): string | null {
  if (value === '' || value == null) return null
  const s = String(value)
  return isUuid(s) ? s : null
}

const optionalUuidField = z.preprocess(
  preprocessOptionalUuid,
  z.string().uuid().nullable().optional(),
)

function resolveItemTaxFields(
  existing: Pick<Item, 'hsnId' | 'gstGroupId' | 'hsnCode'>,
  lookup: {
    getHsn: (id: string) => { id: string; code: string; gstGroupId: string } | undefined
    getHsnByCode: (code: string) => { id: string; code: string; gstGroupId: string } | undefined
  },
): { hsnId: string; gstGroupId: string; hsnCode: string } {
  let hsnId = optionalUuidFormValue(existing.hsnId)
  let gstGroupId = optionalUuidFormValue(existing.gstGroupId)
  let hsnCode = (existing.hsnCode ?? '').trim()

  if (hsnId) {
    const hsn = lookup.getHsn(hsnId)
    if (hsn) {
      hsnCode = hsn.code
      if (!gstGroupId && isUuid(hsn.gstGroupId)) gstGroupId = hsn.gstGroupId
    } else {
      hsnId = ''
    }
  }

  if (!hsnId && hsnCode) {
    const normalized = hsnCode.replace(/\D/g, '')
    const hsn =
      lookup.getHsnByCode(hsnCode)
      ?? (normalized ? lookup.getHsnByCode(normalized) : undefined)
    if (hsn) {
      hsnId = hsn.id
      hsnCode = hsn.code
      if (!gstGroupId && isUuid(hsn.gstGroupId)) gstGroupId = hsn.gstGroupId
    }
  }

  return { hsnId, gstGroupId, hsnCode }
}

const schema = z.object({
  productType: z.enum(['boi', 'raw_material', 'sub_assembly', 'assembly_product', 'finish_product', 'scrap', 'service']),
  itemCode: z.string().min(1).max(30),
  itemName: z.string().min(1),
  itemName2: z.string().optional(),
  itemDescription: z.string().default(''),
  categoryId: z.string().min(1),
  inventoryType: z.enum(['inventory', 'non_inventory', 'service']),
  isBlocked: z.boolean(),
  baseUomId: z.string().min(1),
  quantityPerUom: z.coerce.number().min(0),
  purchaseUomId: optionalUuidField,
  purchaseQtyPerUom: z.preprocess(emptyToPositiveNumber(1), z.coerce.number().positive()),
  uomConversionFactor: z.preprocess(emptyToPositiveNumber(1), z.coerce.number().positive()),
  receivingToleranceId: optionalUuidField,
  receivingTolerancePercentage: z.coerce.number().min(0).max(100).optional(),
  receiptEntryMode: z.enum(['UNIT_ONLY', 'WEIGHT_ONLY', 'UNIT_AND_WEIGHT']).optional(),
  standardWeightPerBaseUnit: z.coerce.number().min(0).optional(),
  weightUomId: optionalUuidField,
  requireWeightAtReceipt: z.boolean().optional(),
  hsnId: optionalUuidField,
  hsnCode: z.string().default(''),
  gstGroupId: optionalUuidField,
  materialGrade: z.string().default(''),
  reorderLevel: z.coerce.number().min(0),
  reorderQty: z.coerce.number().min(0),
  standardRate: z.coerce.number().min(0),
  salesDescription: z.string().optional(),
  salesUomId: optionalUuidField,
  defaultSalesRate: z.coerce.number().min(0),
  salesLeadDays: z.coerce.number().int().min(0),
  salesAllowed: z.boolean(),
  defaultFulfilmentMethod: z.preprocess(
    (value) => (value === '' || value == null ? 'MANUAL' : value),
    z.enum(['STOCK', 'PURCHASE', 'PRODUCTION', 'SUBCONTRACT', 'SERVICE', 'MANUAL']),
  ),
  productionAllowed: z.boolean(),
  isPurchasable: z.boolean(),
  isStockable: z.boolean(),
  isActive: z.boolean(),
  qcRequired: z.boolean(),
  qualityTestGroupCode: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  productionBomId: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  routingNo: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  drawingNo: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  subAssemblyRule: z.preprocess(
    emptyStringToNull,
    z.enum(['phantom', 'manufactured', 'purchased', 'subcontracted']).nullable().optional(),
  ),
}).superRefine((data, ctx) => {
  const mappedType = mapProductTypeToItemType(data.productType)
  if (mappedType === 'sub_assembly' && !data.subAssemblyRule) {
    ctx.addIssue({ code: 'custom', message: 'Sub-assembly rule required', path: ['subAssemblyRule'] })
  }
  if (!data.gstGroupId) {
    ctx.addIssue({ code: 'custom', message: 'GST group is required', path: ['gstGroupId'] })
  }
  if (!data.hsnId) {
    ctx.addIssue({ code: 'custom', message: 'HSN code is required', path: ['hsnId'] })
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

function buildItemFormDefaults(
  existing: Item | undefined,
  leafCategories: ItemCategory[],
  uoms: Uom[],
  taxLookup?: {
    getHsn: (id: string) => { id: string; code: string; gstGroupId: string } | undefined
    getHsnByCode: (code: string) => { id: string; code: string; gstGroupId: string } | undefined
  },
): FormData {
  if (existing) {
    const productType = existing.productType ?? 'raw_material'
    const tax = taxLookup
      ? resolveItemTaxFields(existing, taxLookup)
      : {
          hsnCode: existing.hsnCode ?? '',
          hsnId: optionalUuidFormValue(existing.hsnId),
          gstGroupId: optionalUuidFormValue(existing.gstGroupId),
        }
    return {
      ...existing,
      productType,
      inventoryType: existing.inventoryType ?? 'inventory',
      itemName2: existing.itemName2 ?? '',
      itemDescription: existing.itemDescription ?? '',
      materialGrade: existing.materialGrade ?? '',
      hsnCode: tax.hsnCode,
      hsnId: tax.hsnId,
      gstGroupId: tax.gstGroupId,
      purchaseUomId: optionalUuidFormValue(existing.purchaseUomId) || existing.baseUomId,
      qualityTestGroupCode: existing.qualityTestGroupCode ?? '',
      productionBomId: existing.productionBomId ?? '',
      routingNo: existing.routingNo ?? '',
      drawingNo: existing.drawingNo ?? '',
      subAssemblyRule: existing.subAssemblyRule ?? null,
      isBlocked: existing.isBlocked ?? false,
      qcRequired: existing.qcRequired ?? false,
      quantityPerUom: existing.quantityPerUom ?? 1,
      purchaseQtyPerUom: existing.uomConversionFactor ?? existing.purchaseQtyPerUom ?? 1,
      uomConversionFactor: existing.uomConversionFactor ?? existing.purchaseQtyPerUom ?? 1,
      receivingToleranceId: optionalUuidFormValue(existing.receivingToleranceId),
      receivingTolerancePercentage: existing.receivingTolerancePercentage ?? 0,
      receiptEntryMode: existing.receiptEntryMode ?? 'UNIT_ONLY',
      standardWeightPerBaseUnit: existing.standardWeightPerBaseUnit ?? 0,
      weightUomId: optionalUuidFormValue(existing.weightUomId),
      requireWeightAtReceipt: existing.requireWeightAtReceipt ?? false,
      salesDescription: existing.salesDescription ?? '',
      salesUomId: optionalUuidFormValue(existing.salesUomId) || existing.baseUomId,
      defaultSalesRate: existing.defaultSalesRate ?? 0,
      salesLeadDays: existing.salesLeadDays ?? 0,
      salesAllowed: existing.salesAllowed ?? defaultSalesAllowedForProductType(productType),
      defaultFulfilmentMethod:
        existing.defaultFulfilmentMethod ?? defaultFulfilmentForProductType(productType),
      productionAllowed:
        existing.productionAllowed ?? defaultProductionAllowedForProductType(productType),
    }
  }
  return {
    productType: 'raw_material' as EngineeringProductType,
    itemCode: '',
    itemName: '',
    itemDescription: '',
    materialGrade: '',
    hsnCode: '',
    inventoryType: 'inventory' as InventoryPostingType,
    isBlocked: false,
    isPurchasable: true,
    isStockable: true,
    isActive: true,
    qcRequired: false,
    qualityTestGroupCode: '',
    quantityPerUom: 1,
    purchaseQtyPerUom: 1,
    uomConversionFactor: 1,
    receivingToleranceId: '',
    receivingTolerancePercentage: 0,
    receiptEntryMode: 'UNIT_ONLY',
    standardWeightPerBaseUnit: 0,
    weightUomId: '',
    requireWeightAtReceipt: false,
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
    hsnId: '',
    gstGroupId: '',
    productionBomId: '',
    routingNo: '',
    drawingNo: '',
  }
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
  const { hash } = useLocation()
  const rawExisting = useMasterStore((s) => (id ? s.items.find((i) => i.id === id) : undefined))
  const existing = rawExisting ? enrichItemWithDefaults(rawExisting) : undefined
  const items = useMasterStore((s) => s.items)
  const leafCategories = useLeafCategories()
  const uoms = useActiveUoms()
  const getHsn = useMasterStore((s) => s.getHsn)
  const getHsnByCode = useMasterStore((s) => s.getHsnByCode)
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const receivingToleranceRows = useMasterStore((s) => s.receivingTolerances)
  const receivingTolerances = useMemo(
    () => receivingToleranceRows.filter((r) => r.isActive),
    [receivingToleranceRows],
  )
  const addItem = useMasterStore((s) => s.addItem)
  const updateItem = useMasterStore((s) => s.updateItem)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [attachmentsOpen, setAttachmentsOpen] = useState(
    () => hash === '#attachments' || hash === '#item-section-attachments',
  )
  const [sectionForceOpen, setSectionForceOpen] = useState<Record<string, number>>({})
  const formRootRef = useRef<HTMLDivElement>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  useEffect(() => {
    if (hash === '#attachments' || hash === '#item-section-attachments') {
      setAttachmentsOpen(true)
    }
  }, [hash])

  useEffect(() => {
    if (!isApiMode()) return
    void import('../../../services/bridges/masterBatchApiBridge').then((m) => m.syncBatchMastersFromApi())
  }, [])

  const taxLookup = useMemo(
    () => ({ getHsn, getHsnByCode }),
    [getHsn, getHsnByCode],
  )

  const formDefaults = useMemo(
    () => buildItemFormDefaults(existing, leafCategories, uoms, taxLookup),
    [existing, leafCategories, uoms, taxLookup, hsnMasters.length, gstGroups.length],
  )

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: formDefaults,
  })

  useEffect(() => {
    if (!existing) return
    reset(buildItemFormDefaults(existing, leafCategories, uoms, taxLookup))
  }, [existing?.id, existing?.updatedAt, leafCategories, uoms, taxLookup, hsnMasters.length, gstGroups.length, reset])

  const watched = useWatch({ control })
  const productType = watch('productType')
  const hsnId = watch('hsnId') ?? ''
  const gstGroupId = watch('gstGroupId') ?? ''
  const baseUomId = watch('baseUomId')
  const purchaseUomId = watch('purchaseUomId') ?? ''
  const uomConversionFactor = watch('uomConversionFactor') ?? 1

  const baseUomCode = uoms.find((u) => u.id === baseUomId)?.uomCode ?? '—'
  const purchaseUomCode = uoms.find((u) => u.id === (purchaseUomId || baseUomId))?.uomCode ?? baseUomCode

  function onPurchaseUomChange(uomId: string) {
    setValue('purchaseUomId', uomId || null, { shouldValidate: true })
    if (!uomId || uomId === baseUomId) {
      setValue('uomConversionFactor', 1, { shouldValidate: true })
      setValue('purchaseQtyPerUom', 1, { shouldValidate: true })
    }
  }

  function onConversionFactorChange(value: number) {
    const next = Number.isFinite(value) && value > 0 ? value : 1
    setValue('uomConversionFactor', next, { shouldValidate: true })
    setValue('purchaseQtyPerUom', next, { shouldValidate: true })
  }

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

  function onGstGroupChange(gstGroupMasterId: string) {
    const nextGroupId = gstGroupMasterId || null
    setValue('gstGroupId', nextGroupId, { shouldValidate: true })
    const currentHsn = hsnId ? getHsn(hsnId) : null
    if (currentHsn && nextGroupId && currentHsn.gstGroupId !== nextGroupId) {
      setValue('hsnId', null)
      setValue('hsnCode', '', { shouldValidate: true })
    }
  }

  function onHsnChange(hsnMasterId: string) {
    setValue('hsnId', hsnMasterId || null)
    const hsn = hsnMasterId ? getHsn(hsnMasterId) : null
    if (hsn) {
      setValue('hsnCode', hsn.code, { shouldValidate: true })
      if (!gstGroupId) {
        setValue('gstGroupId', hsn.gstGroupId, { shouldValidate: true })
      }
    } else {
      setValue('hsnCode', '', { shouldValidate: true })
    }
  }

  function bumpSection(sectionId: string) {
    setSectionForceOpen((prev) => ({ ...prev, [sectionId]: (prev[sectionId] ?? 0) + 1 }))
  }

  const openSectionForErrors = useCallback((errs: Partial<Record<keyof FormData, unknown>>) => {
    if (
      errs.itemCode || errs.itemName || errs.categoryId || errs.baseUomId || errs.productType || errs.subAssemblyRule
    ) {
      bumpSection('item-section-general')
      return
    }
    if (
      errs.isPurchasable || errs.uomConversionFactor || errs.purchaseQtyPerUom || errs.receivingToleranceId
      || errs.receivingTolerancePercentage || errs.standardRate
    ) {
      bumpSection('item-section-purchase')
      return
    }
    if (errs.defaultFulfilmentMethod || errs.defaultSalesRate || errs.salesLeadDays || errs.salesUomId) {
      bumpSection('item-section-sales')
      return
    }
    if (errs.gstGroupId || errs.hsnId || errs.hsnCode) {
      bumpSection('item-section-tax')
      return
    }
    if (errs.reorderLevel || errs.reorderQty) {
      bumpSection('item-section-inventory')
      return
    }
    if (errs.qcRequired || errs.qualityTestGroupCode) {
      bumpSection('item-section-quality')
      return
    }
    if (errs.productionBomId || errs.routingNo || errs.drawingNo) {
      bumpSection('item-section-manufacturing')
    }
  }, [])

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
    }, (errs) => {
      openSectionForErrors(errs)
      handleInvalidSubmit({
        errors: rhfErrorsToFieldMap(errs),
        fieldLabels: {
          productType: 'Product type',
          categoryId: 'Item category',
          baseUomId: 'Unit of measure',
          gstGroupId: 'GST group',
          hsnId: 'HSN code',
          subAssemblyRule: 'Sub-assembly rule',
        },
        root: formRootRef.current,
      })
    })()
  }

  const validationErrors = useMemo(
    () => [
      ...fieldErrorsToMessages(rhfErrorsToFieldMap(errors)),
      ...(saveError ? [saveError] : []),
    ],
    [errors, saveError],
  )

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/items')
  }

  if (id && !existing && items.length > 0) {
    return <MasterNotFound message="Item not found." />
  }

  return (
    <EnterpriseMasterWorkspace
      minimalChrome
      title={isEdit ? 'Edit Item' : 'New Item'}
      subtitle={
        isEdit && existing
          ? `${existing.itemCode} — ${existing.itemName}`
          : 'Engineering & inventory item setup'
      }
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit Item' : 'New Item')}
      validationErrors={validationErrors}
      formId="item-master-form"
      onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}
      onSaveShortcut={() => save('default')}
      commandBar={undefined}
      factBoxTitle="Item insight"
      factBoxSummary={[
        { label: 'Used in', value: 'BOM, Purchase, Inventory, Production, Sales' },
        { label: 'Category', value: leafCategories.find((c) => c.id === watched.categoryId)?.categoryName ?? '—' },
        { label: 'UOM', value: uoms.find((u) => u.id === baseUomId)?.uomCode ?? '—' },
        { label: 'Modified', value: existing ? existing.updatedAt.slice(0, 10) : 'New' },
      ]}
      stickyFooter={
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onCancel={cancelForm}
        />
      }
    >
      <div ref={formRootRef} className="space-y-3">
        <ErpCardSection
          id="item-section-general"
          title="General"
          subtitle="Product type, identification, category, and units."
          icon={Package}
          accent="blue"
          columns={3}
          collapsible
          defaultOpen
          forceOpenKey={sectionForceOpen['item-section-general']}
        >
          <FormField label="Product Type" required>
            <Select
              {...register('productType')}
              onChange={(e) => {
                register('productType').onChange(e)
                const nextType = e.target.value as EngineeringProductType
                if (nextType !== 'sub_assembly' && nextType !== 'assembly_product') {
                  setValue('subAssemblyRule', null)
                }
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
          <FormField label="Material Grade">
            <Input {...register('materialGrade')} />
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
          <FormField label="Active">
            <Checkbox {...register('isActive')} label="Active" />
          </FormField>
          <FormField label="Description" className="col-span-full md:col-span-2 xl:col-span-3">
            <Textarea rows={2} {...register('itemDescription')} />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="item-section-purchase"
          title="Purchase"
          subtitle="Vendor units, GRN tolerance, and receipt rules for procurement."
          icon={ShoppingCart}
          accent="amber"
          columns={3}
          collapsible
          defaultOpen
          forceOpenKey={sectionForceOpen['item-section-purchase']}
        >
          <FormField label="Purchasable" className="md:col-span-3">
            <Checkbox {...register('isPurchasable')} label="Allow purchase on PO, GRN, and vendor documents" />
          </FormField>
          <ItemPurchaseMultiUnitFields
            baseUomCode={baseUomCode}
            purchaseUomId={purchaseUomId || baseUomId}
            purchaseUomCode={purchaseUomCode}
            uomConversionFactor={uomConversionFactor}
            onPurchaseUomChange={onPurchaseUomChange}
            onConversionFactorChange={onConversionFactorChange}
            conversionError={errors.uomConversionFactor?.message ?? errors.purchaseQtyPerUom?.message}
          />
          <FormField label="Standard Rate">
            <Input type="number" step="0.01" {...register('standardRate')} />
          </FormField>
          <FormField label="Receiving tolerance" error={errors.receivingToleranceId?.message}>
            <Select
              value={watch('receivingToleranceId') ?? ''}
              onChange={(e) => {
                const tolId = e.target.value || null
                setValue('receivingToleranceId', tolId, { shouldValidate: true })
                const tol = receivingTolerances.find((r) => r.id === tolId)
                if (tol) setValue('receivingTolerancePercentage', tol.percentage)
              }}
            >
              <option value="">— Select —</option>
              {receivingTolerances.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name} ({r.percentage}%)
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-erp-muted">
              Excess-only band vs open PO qty on GRN. Leave empty to use Purchase Setup fallback.
            </p>
          </FormField>
          <FormField label="Receipt entry mode">
            <Select {...register('receiptEntryMode')}>
              <option value="UNIT_ONLY">Unit only</option>
              <option value="WEIGHT_ONLY">Weight only</option>
              <option value="UNIT_AND_WEIGHT">Unit and weight</option>
            </Select>
          </FormField>
          <FormField label="Standard weight per base unit">
            <Input type="number" step="0.0001" min={0} {...register('standardWeightPerBaseUnit')} />
          </FormField>
          <FormField label="Weight UOM">
            <UomMasterSelect value={watch('weightUomId') ?? ''} onChange={(v) => setValue('weightUomId', v || null)} />
          </FormField>
          <FormField label="Require weight at receipt">
            <Checkbox {...register('requireWeightAtReceipt')} label="Weight mandatory on GRN" />
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
          defaultOpen={false}
          forceOpenKey={sectionForceOpen['item-section-sales']}
        >
          <FormField label="Sales allowed">
            <Checkbox {...register('salesAllowed')} label="Allow on CRM / sales documents" />
          </FormField>
          <FormField label="Production allowed">
            <Checkbox {...register('productionAllowed')} label="Allow manufacturing use" />
          </FormField>
          <FormField label="Default fulfilment">
            <Select {...register('defaultFulfilmentMethod')}>
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
          defaultOpen={false}
          forceOpenKey={sectionForceOpen['item-section-tax']}
        >
          <FormField label="GST Group Code" required error={errors.gstGroupId?.message}>
            <GstGroupSelect value={gstGroupId ?? ''} onChange={onGstGroupChange} allowEmpty />
          </FormField>
          <FormField label="HSN Code" required error={errors.hsnId?.message}>
            <HsnMasterSelect
              value={hsnId ?? ''}
              onChange={onHsnChange}
              allowEmpty
              gstGroupId={gstGroupId}
              disabled={!gstGroupId}
            />
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
          defaultOpen={false}
          forceOpenKey={sectionForceOpen['item-section-inventory']}
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
          defaultOpen={false}
          forceOpenKey={sectionForceOpen['item-section-quality']}
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
          defaultOpen={false}
          forceOpenKey={sectionForceOpen['item-section-manufacturing']}
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

        <ErpCardSection
          id="item-section-attachments"
          title="Attachments"
          subtitle="Product image for catalog, purchase, and shop-floor reference."
          icon={Paperclip}
          accent="slate"
          columns={1}
          collapsible
          open={attachmentsOpen}
          onOpenChange={setAttachmentsOpen}
        >
          <FormField label="Product image" className="md:col-span-3">
            <MasterItemImageField
              itemId={id}
              imageUrl={existing?.imageUrl}
              updatedAt={existing?.updatedAt}
            />
          </FormField>
        </ErpCardSection>
      </div>
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
      <DetailSection title="Attachments">
        <div className="max-w-lg">
          <MasterItemImageField
            itemId={item.id}
            imageUrl={item.imageUrl}
            updatedAt={item.updatedAt}
            disabled
            layout="gallery"
          />
        </div>
      </DetailSection>
    </DetailLayout>
  )
}
