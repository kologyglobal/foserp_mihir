import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Plus, Trash2, UserPlus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpSegmentedControl } from '@/components/erp/ErpSegmentedControl'
import { ErpSmartSelect, type ErpSmartSelectOption } from '@/components/erp/ErpSmartSelect'
import { VendorMasterSelect } from '@/components/masters/VendorMasterSelect'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  ensureLegalEntity,
  listAccounts,
  resolveLegalEntityId,
  updateLegalEntity,
} from '@/services/bridges/financeApiBridge'
import {
  createVendorInvoiceDraft,
  getVendorInvoice,
  updateVendorInvoiceDraft,
} from '@/services/bridges/payablesApiBridge'
import {
  listGrnLookups,
  listPurchaseOrderLookups,
  type AccountingGrnLookup,
  type AccountingPurchaseOrderLookup,
} from '@/services/api/accountingLookupsApi'
import { useActiveVendors } from '@/hooks/useMasterLists'
import { useMasterStore } from '@/store/masterStore'
import { useTenantProfileStore } from '@/store/tenantProfileStore'
import { notify } from '@/store/toastStore'
import {
  partyMasterCreateRoute,
  partyMasterRoute,
} from '@/modules/accounting/shared/invoices'
import type {
  CreateVendorInvoiceInput,
  VendorInvoiceLineType,
  VendorInvoiceSourceLinkInput,
  VendorInvoiceType,
} from '@/types/moneyOut'
import type { LegalEntity } from '@/types/financeSetup'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { canQuickCreateEntity } from '@/utils/quickCreatePermissions'
import {
  formatPlaceOfSupplyLabel,
  listGstStateSelectOptions,
  resolveGstStateCode,
  validateStateCode,
} from '@/utils/gstStateCode'
import { gstStateCodeFromGstin } from '@/utils/customerUtils'
import { cn } from '@/utils/cn'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import { addDaysIso, todayIsoDate } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const GST_STATE_OPTIONS = listGstStateSelectOptions()

const lineSchema = z.object({
  lineType: z.enum(['ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE']),
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  hsnSacCode: z.string().optional(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid quantity'),
  unitPrice: z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid rate'),
  gstRate: z.string().optional(),
  debitAccountId: z.string().optional(),
  costCentreId: z.string().optional(),
  projectReference: z.string().optional(),
})

const formSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  invoiceType: z.enum(['GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED']),
  supplierInvoiceNumber: z.string().min(1, 'Supplier invoice number required'),
  supplierInvoiceDate: z.string().min(1),
  documentDate: z.string().min(1),
  postingDate: z.string().optional(),
  dueDate: z.string().optional(),
  currencyCode: z.string().min(3).max(8),
  exchangeRate: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid exchange rate'),
  taxTreatment: z.enum([
    'REGULAR',
    'REVERSE_CHARGE',
    'IMPORT_GOODS',
    'IMPORT_SERVICE',
    'SEZ',
    'NON_GST',
    'EXEMPT',
    'NIL_RATED',
  ]),
  itcEligibility: z.enum(['PENDING_REVIEW', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'INELIGIBLE']),
  itcEligiblePercent: z.string().optional(),
  tdsRecognitionMode: z.enum(['NOT_APPLICABLE', 'AT_INVOICE', 'AT_PAYMENT']),
  tdsSectionCode: z.string().optional(),
  tdsRate: z.string().optional(),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  placeOfSupply: z
    .string()
    .min(1, 'Place of supply is required')
    .refine((v) => Boolean(validateStateCode(v)), 'Select a valid GST state code'),
  freightAmount: z.string().optional(),
  otherChargeAmount: z.string().optional(),
  paymentTermsDays: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line required'),
})

type FormValues = z.infer<typeof formSchema>

function defaultLineType(invoiceType: VendorInvoiceType): VendorInvoiceLineType {
  switch (invoiceType) {
    case 'SERVICE':
      return 'SERVICE'
    case 'EXPENSE':
      return 'EXPENSE'
    case 'ASSET':
      return 'ASSET'
    case 'GOODS':
    case 'MIXED':
    default:
      return 'ITEM'
  }
}

function emptyLine(invoiceType: VendorInvoiceType): FormValues['lines'][number] {
  return {
    lineType: defaultLineType(invoiceType),
    itemId: '',
    description: invoiceType === 'EXPENSE' ? 'Expense' : '',
    hsnSacCode: '',
    quantity: '1',
    unitPrice: '0',
    gstRate: '18',
    debitAccountId: '',
    costCentreId: '',
    projectReference: '',
  }
}

const VENDOR_INVOICE_TYPES: readonly VendorInvoiceType[] = ['GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED']

function isVendorInvoiceType(value: string | null): value is VendorInvoiceType {
  return Boolean(value) && (VENDOR_INVOICE_TYPES as readonly string[]).includes(value as VendorInvoiceType)
}

const INVOICE_TYPE_LABELS: Record<VendorInvoiceType, string> = {
  GOODS: 'Goods',
  SERVICE: 'Service',
  EXPENSE: 'Expense',
  ASSET: 'Asset',
  MIXED: 'Mixed',
}

const INVOICE_TYPE_BADGE_COLOR: Record<VendorInvoiceType, 'blue' | 'green' | 'orange' | 'purple' | 'gray'> = {
  EXPENSE: 'orange',
  SERVICE: 'blue',
  GOODS: 'green',
  ASSET: 'purple',
  MIXED: 'gray',
}

/** VI create source mode (Wave 3) — Direct entry, or sourced from a real PO / GRN. */
type VendorInvoiceCreateSource = 'DIRECT' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT'

/** Zoho-flat document card — dense header + tight body (mirrors Money In invoice create). */
function FormSection({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'sales-invoice-zoho-form__section mi-create-section rounded-md border border-erp-border bg-white',
        className,
      )}
    >
      <header className="sales-invoice-zoho-form__section-header mi-create-section__header flex flex-wrap items-center justify-between gap-2 border-b border-erp-border">
        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">{title}</h3>
          {subtitle ? <p className="text-[11px] text-erp-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <div className="mi-create-section__body">{children}</div>
    </section>
  )
}

function vendorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const LINE_GRID_QUICK =
  'md:grid-cols-[minmax(0,2.6fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,2fr)_minmax(0,0.4fr)]'
const LINE_GRID_FULL =
  'md:grid-cols-[minmax(0,0.95fr)_minmax(0,2.2fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,0.4fr)]'

export function VendorInvoiceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const vendors = useActiveVendors()
  const isServicesTenant = useTenantProfileStore((s) => s.isServices())
  // Expense hub (Accounting → Expenses) links here with ?invoiceType=EXPENSE — honor it,
  // otherwise fall back to the long-standing EXPENSE default for this route.
  const initialInvoiceType: VendorInvoiceType = isVendorInvoiceType(searchParams.get('invoiceType'))
    ? (searchParams.get('invoiceType') as VendorInvoiceType)
    : 'EXPENSE'
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [draftReference, setDraftReference] = useState<string>()
  const [serverTotals, setServerTotals] = useState<{
    taxable: string
    cgst: string
    sgst: string
    igst: string
    cess: string
    nonRecoverable: string
    freight: string
    other: string
    roundOff: string
    grandTotal: string
    tds: string
    vendorPayable: string
  } | null>(null)
  const [expenseAccounts, setExpenseAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [quickMode, setQuickMode] = useState(mode === 'create')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [createSource, setCreateSource] = useState<VendorInvoiceCreateSource>('DIRECT')
  const [selectedPoId, setSelectedPoId] = useState('')
  const [selectedGrnId, setSelectedGrnId] = useState('')
  const [purchaseOrders, setPurchaseOrders] = useState<AccountingPurchaseOrderLookup[]>([])
  const [goodsReceipts, setGoodsReceipts] = useState<AccountingGrnLookup[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  /** Existing source links loaded on edit — resent unchanged (never re-fabricated). */
  const [existingSourceLinks, setExistingSourceLinks] = useState<VendorInvoiceSourceLinkInput[]>([])
  const [legalEntity, setLegalEntity] = useState<LegalEntity | null>(null)
  const [companyStateCode, setCompanyStateCode] = useState('')
  const items = useMasterStore((s) => s.items)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: '',
      invoiceType: initialInvoiceType,
      supplierInvoiceNumber: '',
      supplierInvoiceDate: todayIsoDate(),
      documentDate: todayIsoDate(),
      postingDate: todayIsoDate(),
      dueDate: '',
      currencyCode: 'INR',
      exchangeRate: '1',
      taxTreatment: 'REGULAR',
      itcEligibility: 'PENDING_REVIEW',
      itcEligiblePercent: '100',
      tdsRecognitionMode: 'NOT_APPLICABLE',
      tdsSectionCode: '',
      tdsRate: '0',
      supplyType: 'INTRA_STATE',
      placeOfSupply: '',
      freightAmount: '0',
      otherChargeAmount: '0',
      paymentTermsDays: '',
      lines: [emptyLine(initialInvoiceType)],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()
  const isDirty = form.formState.isDirty

  useEffect(() => {
    let cancelled = false
    void ensureLegalEntity()
      .then((le) => {
        if (cancelled) return
        setLegalEntity(le)
        const code =
          validateStateCode(le.stateCode) ||
          (le.gstin ? validateStateCode(gstStateCodeFromGstin(le.gstin)) : null) ||
          ''
        setCompanyStateCode(code)
      })
      .catch(() => {
        if (!cancelled) {
          setLegalEntity(null)
          setCompanyStateCode('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const le = validateStateCode(companyStateCode)
    const pos = validateStateCode(watched.placeOfSupply)
    if (le && pos) {
      const next = le === pos ? 'INTRA_STATE' : 'INTER_STATE'
      if (next !== watched.supplyType) form.setValue('supplyType', next, { shouldDirty: true })
    }
  }, [companyStateCode, watched.placeOfSupply, watched.supplyType, form])
  // Services-only tenants never receive freight — hide it for the Expense path only
  // (Goods/Service/Asset invoices still show freight regardless of tenant packaging).
  const hideFreightField = watched.invoiceType === 'EXPENSE' && isServicesTenant

  const blocker = useBlocker(isDirty && !saving)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const ok = window.confirm('You have unsaved changes. Leave this page?')
    if (ok) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !saving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, saving])

  useEffect(() => {
    if (!isApiMode()) return
    listAccounts(resolveLegalEntityId())
      .then((accounts) => {
        const filtered = accounts
          .filter((a) => a.isActive && !a.isGroup)
          .map((a) => ({ id: a.id, code: a.accountCode, name: a.accountName }))
        setExpenseAccounts(filtered)
      })
      .catch(() => {
        /* account picker optional for draft if mappings resolve server-side */
      })
  }, [])

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === watched.vendorId),
    [vendors, watched.vendorId],
  )

  const resolveVendorPlaceOfSupply = useCallback(
    (vendorId: string): string | null => {
      const v = vendors.find((x) => x.id === vendorId)
      if (!v) return null
      return (
        (v.gstin ? validateStateCode(gstStateCodeFromGstin(v.gstin)) : null) ||
        resolveGstStateCode(v.state) ||
        null
      )
    },
    [vendors],
  )

  useEffect(() => {
    if (!watched.vendorId || mode !== 'create') return
    const pos = resolveVendorPlaceOfSupply(watched.vendorId)
    if (!pos) return
    // Prefill (or refresh after vendor change) when master has a state.
    form.setValue('placeOfSupply', pos, { shouldDirty: true, shouldValidate: true })
  }, [watched.vendorId, mode, resolveVendorPlaceOfSupply, form])

  // Invoice-eligible PO / GRN candidates from the accounting lookup endpoints
  // (server-side eligibility whitelist + tenant scope — no frontend status filter).
  useEffect(() => {
    if (mode !== 'create' || !isApiMode() || createSource === 'DIRECT') return
    let cancelled = false
    setSourcesLoading(true)
    const load = async () => {
      try {
        if (createSource === 'PURCHASE_ORDER') {
          const res = await listPurchaseOrderLookups({ eligibleOnly: true, limit: 100 })
          if (!cancelled) setPurchaseOrders(res.data ?? [])
        } else {
          const res = await listGrnLookups({ eligibleOnly: true, limit: 100 })
          if (!cancelled) setGoodsReceipts(res.data ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          notify.error(e instanceof Error ? e.message : 'Failed to load purchase documents')
        }
      } finally {
        if (!cancelled) setSourcesLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [createSource, mode])

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vendors) map.set(v.id, v.vendorName)
    return map
  }, [vendors])

  const poOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      purchaseOrders.map((po) => {
        const vendorName = vendorNameById.get(po.vendorId)
        return {
          value: po.id,
          label: po.orderNumber,
          subtitle: [vendorName, String(po.status).replace(/_/g, ' ')].filter(Boolean).join(' · ') || undefined,
          searchText: `${po.orderNumber} ${vendorName ?? ''}`.toLowerCase(),
        }
      }),
    [purchaseOrders, vendorNameById],
  )

  const grnOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      goodsReceipts.map((g) => {
        const vendorName = vendorNameById.get(g.vendorId)
        return {
          value: g.id,
          label: g.grnNumber,
          subtitle: [vendorName, g.purchaseOrderNumber].filter(Boolean).join(' · ') || undefined,
          searchText: `${g.grnNumber} ${vendorName ?? ''} ${g.purchaseOrderNumber ?? ''}`.toLowerCase(),
        }
      }),
    [goodsReceipts, vendorNameById],
  )

  const itemOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      items
        .filter((i) => i.isActive && i.isPurchasable)
        .map((i) => ({
          value: i.id,
          label: `${i.itemCode} — ${i.itemName}`,
          searchText: `${i.itemCode} ${i.itemName} ${i.hsnCode ?? ''}`.toLowerCase(),
        })),
    [items],
  )

  const onPickPurchaseOrder = (poId: string) => {
    setSelectedPoId(poId)
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po) return
    form.setValue('vendorId', po.vendorId, { shouldDirty: true, shouldValidate: true })
    form.setValue('invoiceType', 'GOODS', { shouldDirty: true })
    if (po.currencyCode) form.setValue('currencyCode', po.currencyCode, { shouldDirty: true })
    setQuickMode(false)
  }

  const onPickGoodsReceipt = (grnId: string) => {
    setSelectedGrnId(grnId)
    const grn = goodsReceipts.find((g) => g.id === grnId)
    if (!grn) return
    form.setValue('vendorId', grn.vendorId, { shouldDirty: true, shouldValidate: true })
    form.setValue('invoiceType', 'GOODS', { shouldDirty: true })
    setQuickMode(false)
  }

  const onPickLineItem = (index: number, itemId: string) => {
    form.setValue(`lines.${index}.itemId`, itemId, { shouldDirty: true })
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    form.setValue(`lines.${index}.description`, item.itemName, { shouldDirty: true })
    if (item.hsnCode) form.setValue(`lines.${index}.hsnSacCode`, item.hsnCode, { shouldDirty: true })
  }

  useEffect(() => {
    if (!selectedVendor || mode !== 'create') return
    const days = selectedVendor.paymentTermsDays ?? 0
    const base = watched.supplierInvoiceDate || todayIsoDate()
    if (!form.getValues('dueDate')) {
      form.setValue('dueDate', addDaysIso(base, days))
    }
    form.setValue('paymentTermsDays', String(days))
  }, [selectedVendor, form, mode, watched.supplierInvoiceDate])

  useEffect(() => {
    const invType = watched.invoiceType
    if (mode !== 'create' || !quickMode) return
    const lines = form.getValues('lines')
    if (lines.length === 1) {
      form.setValue('lines.0.lineType', defaultLineType(invType))
    }
  }, [watched.invoiceType, form, mode, quickMode])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await getVendorInvoice(id)
      if (!inv.allowedActions.edit) {
        notify.error('This invoice cannot be edited')
        navigate(`/accounting/money-out/vendor-invoices/${id}`)
        return
      }
      setUpdatedAt(inv.updatedAt)
      setDraftReference(inv.draftReference)
      setQuickMode(false)
      setServerTotals({
        taxable: inv.taxableAmount,
        cgst: inv.inputCgstAmount,
        sgst: inv.inputSgstAmount,
        igst: inv.inputIgstAmount,
        cess: inv.inputCessAmount,
        nonRecoverable: inv.nonRecoverableTaxAmount,
        freight: inv.freightAmount,
        other: inv.otherChargeAmount,
        roundOff: inv.roundOffAmount,
        grandTotal: inv.invoiceGrandTotal,
        tds: inv.tdsAmount,
        vendorPayable: inv.vendorPayableAmount,
      })
      setExistingSourceLinks(
        (inv.sourceLinks ?? []).map((s) => ({
          sourceType: s.sourceType,
          sourceDocumentId: s.sourceDocumentId,
          sourceDocumentNumberSnapshot: s.sourceDocumentNumberSnapshot ?? null,
          sourceDocumentDateSnapshot: s.sourceDocumentDateSnapshot ?? null,
        })),
      )
      const loadedCompanyState =
        validateStateCode(inv.companyStateCodeSnapshot) ||
        resolveGstStateCode(inv.companyStateCodeSnapshot) ||
        ''
      if (loadedCompanyState) setCompanyStateCode(loadedCompanyState)
      const loadedPos =
        validateStateCode(inv.placeOfSupplyStateCode) ||
        resolveGstStateCode(inv.placeOfSupplyStateCode) ||
        validateStateCode(inv.vendorStateCodeSnapshot) ||
        resolveGstStateCode(inv.vendorStateCodeSnapshot) ||
        ''
      form.reset({
        vendorId: inv.vendorId,
        invoiceType: inv.invoiceType,
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        supplierInvoiceDate: inv.supplierInvoiceDate,
        documentDate: inv.documentDate,
        postingDate: inv.postingDate ?? inv.documentDate,
        dueDate: inv.dueDate ?? '',
        currencyCode: inv.currencyCode,
        exchangeRate: inv.exchangeRate,
        taxTreatment: inv.taxTreatment,
        itcEligibility: inv.itcEligibility,
        itcEligiblePercent: '100',
        tdsRecognitionMode: inv.tdsRecognitionMode,
        tdsSectionCode: inv.tdsSectionCode ?? '',
        tdsRate: inv.tdsRate,
        supplyType: (() => {
          const company = validateStateCode(inv.companyStateCodeSnapshot)
          const pos =
            validateStateCode(inv.placeOfSupplyStateCode) ||
            validateStateCode(inv.vendorStateCodeSnapshot)
          if (company && pos) return company === pos ? 'INTRA_STATE' : 'INTER_STATE'
          return 'INTRA_STATE'
        })(),
        placeOfSupply: loadedPos,
        freightAmount: inv.freightAmount,
        otherChargeAmount: inv.otherChargeAmount,
        paymentTermsDays: '',
        lines: (inv.lines ?? []).map((l) => ({
          lineType: l.lineType,
          itemId: l.itemId ?? '',
          description: l.description,
          hsnSacCode: l.hsnSacCode ?? '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstRate: l.igstRate !== '0' ? l.igstRate : String(Number(l.cgstRate) + Number(l.sgstRate) || 18),
          debitAccountId: l.debitAccountId ?? '',
          costCentreId: l.costCentreId ?? '',
          projectReference: l.projectReference ?? '',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [form, id, navigate])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues): CreateVendorInvoiceInput => {
    // Real source documents only — fabricated UUIDs are gone (Wave 3).
    // Backend Wave 2 validates PO/GRN existence + vendor match on these ids.
    let sourceLinks: VendorInvoiceSourceLinkInput[] = []
    if (mode === 'edit') {
      sourceLinks = existingSourceLinks
    } else if (createSource === 'PURCHASE_ORDER' && selectedPoId) {
      const po = purchaseOrders.find((p) => p.id === selectedPoId)
      sourceLinks = [
        {
          sourceType: 'PURCHASE_ORDER',
          sourceDocumentId: selectedPoId,
          sourceDocumentNumberSnapshot: po?.orderNumber ?? null,
          sourceDocumentDateSnapshot: po?.orderDate ?? null,
        },
      ]
    } else if (createSource === 'GOODS_RECEIPT' && selectedGrnId) {
      const grn = goodsReceipts.find((g) => g.id === selectedGrnId)
      sourceLinks = [
        {
          sourceType: 'GOODS_RECEIPT',
          sourceDocumentId: selectedGrnId,
          sourceDocumentNumberSnapshot: grn?.grnNumber ?? null,
          sourceDocumentDateSnapshot: grn?.receiptDate ?? null,
        },
      ]
      if (grn?.purchaseOrderId) {
        sourceLinks.push({
          sourceType: 'PURCHASE_ORDER',
          sourceDocumentId: grn.purchaseOrderId,
          sourceDocumentNumberSnapshot: grn.purchaseOrderNumber ?? null,
          sourceDocumentDateSnapshot: null,
        })
      }
    }

    const linkedItem = (itemId?: string) => (itemId ? items.find((i) => i.id === itemId) : undefined)
    const placeOfSupply =
      validateStateCode(values.placeOfSupply) ||
      resolveVendorPlaceOfSupply(values.vendorId)
    const vendorStateCode = resolveVendorPlaceOfSupply(values.vendorId)
    const companyState = validateStateCode(companyStateCode)

    return {
      legalEntityId: resolveLegalEntityId(),
      vendorId: values.vendorId,
      invoiceType: values.invoiceType,
      supplierInvoiceNumber: values.supplierInvoiceNumber,
      supplierInvoiceDate: values.supplierInvoiceDate,
      documentDate: values.documentDate,
      dueDate: values.dueDate || null,
      postingDate: values.postingDate || values.documentDate,
      currencyCode: values.currencyCode,
      exchangeRate: values.exchangeRate,
      taxTreatment: values.taxTreatment,
      itcEligibility: values.itcEligibility,
      itcEligiblePercent:
        values.itcEligibility === 'PARTIALLY_ELIGIBLE' ? values.itcEligiblePercent || '0' : undefined,
      tdsRecognitionMode: values.tdsRecognitionMode,
      tdsSectionCode: values.tdsSectionCode || null,
      tdsRate: values.tdsRate || '0',
      supplyType: values.supplyType,
      placeOfSupply: placeOfSupply || null,
      companyStateCode: companyState || null,
      vendorStateCode: vendorStateCode || null,
      freightAmount: values.freightAmount || '0',
      otherChargeAmount: values.otherChargeAmount || '0',
      paymentTermsDays: values.paymentTermsDays ? Number(values.paymentTermsDays) : null,
      lines: values.lines.map((l, idx) => {
        const item = linkedItem(l.itemId)
        return {
          lineNumber: idx + 1,
          lineType: l.lineType,
          itemId: l.itemId || null,
          itemCodeSnapshot: item?.itemCode ?? null,
          itemNameSnapshot: item?.itemName ?? null,
          description: l.description,
          hsnSacCode: l.hsnSacCode || null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstRate: l.gstRate || '0',
          debitAccountId: l.debitAccountId || null,
          costCentreId: l.costCentreId || null,
          projectReference: l.projectReference || null,
        }
      }),
      sourceLinks,
    }
  }

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const leState = validateStateCode(companyStateCode)
      if (!leState) {
        notify.error(
          'Company state code is required. Select company state under Charges & Tax (or Accounting → Setup → Legal Entities).',
        )
        setSaving(false)
        return
      }
      if (!validateStateCode(values.placeOfSupply) && !resolveVendorPlaceOfSupply(values.vendorId)) {
        notify.error('Place of supply is required to determine CGST/SGST vs IGST.')
        setSaving(false)
        return
      }
      if (legalEntity && validateStateCode(legalEntity.stateCode) !== leState) {
        try {
          const updatedLe = await updateLegalEntity(legalEntity.id, {
            stateCode: leState,
            gstin: legalEntity.gstin ?? undefined,
          })
          setLegalEntity(updatedLe)
          setCompanyStateCode(validateStateCode(updatedLe.stateCode) || leState)
        } catch {
          // Vendor invoice payload includes companyStateCode even if LE master update fails.
        }
      }

      if (mode === 'create') {
        const created = await createVendorInvoiceDraft(buildPayload(values))
        form.reset(values)
        notify.success(`Draft saved — ${created.draftReference}`)
        navigate(`/accounting/money-out/vendor-invoices/${created.id}`)
      } else if (id && updatedAt) {
        const updated = await updateVendorInvoiceDraft(id, {
          ...buildPayload(values),
          expectedUpdatedAt: updatedAt,
        })
        setUpdatedAt(updated.updatedAt)
        setServerTotals({
          taxable: updated.taxableAmount,
          cgst: updated.inputCgstAmount,
          sgst: updated.inputSgstAmount,
          igst: updated.inputIgstAmount,
          cess: updated.inputCessAmount,
          nonRecoverable: updated.nonRecoverableTaxAmount,
          freight: updated.freightAmount,
          other: updated.otherChargeAmount,
          roundOff: updated.roundOffAmount,
          grandTotal: updated.invoiceGrandTotal,
          tds: updated.tdsAmount,
          vendorPayable: updated.vendorPayableAmount,
        })
        form.reset(values)
        notify.success('Draft updated — totals refreshed from server')
        navigate(`/accounting/money-out/vendor-invoices/${id}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreateInvoice : perms.canEditInvoice

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoice">
        <p className="text-[13px] text-erp-muted">Vendor invoices require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!canEdit) {
    return (
      <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Invoice' : 'Edit Vendor Invoice'}>
        <p className="text-[13px] text-erp-muted">
          You do not have permission to {mode === 'create' ? 'create' : 'edit'} vendor invoices.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyOutWorkspaceShell title="Edit Vendor Invoice">
        <LoadingState variant="form" />
      </MoneyOutWorkspaceShell>
    )
  }

  const invoiceTypeLabel = INVOICE_TYPE_LABELS[watched.invoiceType] ?? watched.invoiceType
  const invoiceTypeBadgeColor = INVOICE_TYPE_BADGE_COLOR[watched.invoiceType] ?? 'gray'
  const lineCount = fields.length
  const vendorLocked = mode === 'create' && createSource !== 'DIRECT' && Boolean(selectedPoId || selectedGrnId)
  const canQuickCreateVendor = canQuickCreateEntity('vendor')
  const vendorDisplayName = selectedVendor?.vendorName || 'Vendor'
  const lineGrid = quickMode ? LINE_GRID_QUICK : LINE_GRID_FULL
  const selectedPo = purchaseOrders.find((p) => p.id === selectedPoId)
  const selectedGrn = goodsReceipts.find((g) => g.id === selectedGrnId)

  return (
    <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Invoice' : 'Edit Vendor Invoice'}>
      {mode === 'create' && (
        <div className="mi-create-toolbar mb-2">
          <div className="mi-create-toolbar__group">
            <span className="mi-create-toolbar__label">Source</span>
            <ErpSegmentedControl<VendorInvoiceCreateSource>
              variant="pills"
              name="Vendor invoice source"
              value={createSource}
              onChange={(next) => {
                if (next === 'DIRECT') {
                  setCreateSource('DIRECT')
                  setSelectedPoId('')
                  setSelectedGrnId('')
                } else if (next === 'PURCHASE_ORDER') {
                  setCreateSource('PURCHASE_ORDER')
                  setSelectedGrnId('')
                } else {
                  setCreateSource('GOODS_RECEIPT')
                  setSelectedPoId('')
                }
              }}
              options={[
                { value: 'DIRECT', label: 'Direct' },
                { value: 'PURCHASE_ORDER', label: 'From PO' },
                { value: 'GOODS_RECEIPT', label: 'From GRN' },
              ]}
            />
          </div>
          <div className="mi-create-toolbar__group">
            <span className="mi-create-toolbar__label">Entry mode</span>
            <ErpSegmentedControl<'quick' | 'full'>
              variant="pills"
              name="Vendor invoice entry mode"
              value={quickMode ? 'quick' : 'full'}
              onChange={(next) => setQuickMode(next === 'quick')}
              options={[
                { value: 'quick', label: 'Quick expense' },
                { value: 'full', label: 'Full invoice' },
              ]}
            />
          </div>
        </div>
      )}

      {draftReference ? (
        <p className="mi-create-banner mi-create-banner--info mb-2">
          Editing draft <strong>{draftReference}</strong>
          <span className="ml-2 inline-flex align-middle">
            <Badge color={invoiceTypeBadgeColor} dot>
              {invoiceTypeLabel}
            </Badge>
          </span>
        </p>
      ) : null}

      <form onSubmit={onSave} className="sales-invoice-zoho-form mi-create-form vendor-invoice-zoho-form">
        <FormSection
          title="Vendor & Invoice Details"
          subtitle="Party, supplier reference, type, and key dates."
          actions={
            mode === 'create' ? (
              <Badge color={invoiceTypeBadgeColor} dot>
                {invoiceTypeLabel}
              </Badge>
            ) : undefined
          }
        >
          <div className="mi-create-commercial__body">
            {mode === 'create' && createSource !== 'DIRECT' && (
              <div className="mi-create-source-row">
                <FormField
                  label={createSource === 'PURCHASE_ORDER' ? 'Purchase order' : 'Goods receipt (GRN)'}
                  hint="Locks vendor and records a real Purchase source link."
                >
                  <ErpSmartSelect
                    options={createSource === 'PURCHASE_ORDER' ? poOptions : grnOptions}
                    value={createSource === 'PURCHASE_ORDER' ? selectedPoId : selectedGrnId}
                    onChange={createSource === 'PURCHASE_ORDER' ? onPickPurchaseOrder : onPickGoodsReceipt}
                    placeholder={
                      createSource === 'PURCHASE_ORDER' ? 'Select purchase order…' : 'Select GRN…'
                    }
                    emptyMessage={
                      sourcesLoading
                        ? 'Loading…'
                        : createSource === 'PURCHASE_ORDER'
                          ? 'No invoiceable purchase orders found'
                          : 'No invoiceable goods receipts found'
                    }
                    allowEmpty
                  />
                </FormField>
                {createSource === 'PURCHASE_ORDER' && selectedPo ? (
                  <>
                    <FormField label="PO status">
                      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
                        {String(selectedPo.status).replace(/_/g, ' ')}
                      </div>
                    </FormField>
                    <FormField label="Currency">
                      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
                        {selectedPo.currencyCode || '—'}
                      </div>
                    </FormField>
                  </>
                ) : null}
                {createSource === 'GOODS_RECEIPT' && selectedGrn ? (
                  <>
                    <FormField label="GRN date">
                      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
                        {selectedGrn.receiptDate || '—'}
                      </div>
                    </FormField>
                    <FormField label="PO">
                      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
                        {selectedGrn.purchaseOrderNumber || '—'}
                      </div>
                    </FormField>
                  </>
                ) : null}
              </div>
            )}

            {createSource !== 'DIRECT' && (selectedPoId || selectedGrnId) ? (
              <div className="mi-create-source-chips">
                {selectedPo ? (
                  <span className="mi-create-source-chip">
                    <span className="mi-create-source-chip__label">PO</span>
                    {selectedPo.orderNumber}
                  </span>
                ) : null}
                {selectedGrn ? (
                  <span className="mi-create-source-chip">
                    <span className="mi-create-source-chip__label">GRN</span>
                    {selectedGrn.grnNumber}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="mi-create-customer-row">
              <FormField label="Vendor" required error={form.formState.errors.vendorId?.message}>
                <VendorMasterSelect
                  value={watched.vendorId}
                  onChange={(vendorId) =>
                    form.setValue('vendorId', vendorId, { shouldDirty: true, shouldValidate: true })
                  }
                  disabled={vendorLocked}
                  source="accounting"
                  allowEmpty
                />
                {vendorLocked ? (
                  <p className="mt-0.5 text-[11px] text-erp-muted">Vendor locked from source document.</p>
                ) : null}
              </FormField>
              {mode === 'create' && !vendorLocked && canQuickCreateVendor ? (
                <Link
                  to={partyMasterCreateRoute('purchase')}
                  className="inline-flex h-[34px] items-center gap-1 self-end rounded-md border border-erp-border bg-white px-2.5 text-[12px] font-semibold text-erp-primary hover:bg-erp-surface-alt"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  New
                </Link>
              ) : null}
            </div>

            {watched.vendorId && selectedVendor ? (
              <aside className="mi-create-party" aria-label="Selected vendor">
                <div className="mi-create-party__avatar" aria-hidden>
                  {vendorInitials(vendorDisplayName)}
                </div>
                <div className="mi-create-party__main">
                  <div className="mi-create-party__title-row">
                    <h3 className="mi-create-party__name">
                      {selectedVendor.vendorCode ? `${selectedVendor.vendorCode} — ` : ''}
                      {vendorDisplayName}
                    </h3>
                    <Link
                      to={partyMasterRoute('purchase', watched.vendorId)}
                      className="mi-create-party__360"
                    >
                      Vendor 360
                    </Link>
                  </div>
                  <div className="mi-create-party__chips">
                    <span className="mi-create-party__chip">
                      <span className="mi-create-party__chip-label">GSTIN</span>
                      {selectedVendor.gstin || '—'}
                    </span>
                    <span className="mi-create-party__chip">
                      <span className="mi-create-party__chip-label">Place of supply</span>
                      {watched.placeOfSupply
                        ? formatPlaceOfSupplyLabel(watched.placeOfSupply)
                        : '—'}
                    </span>
                    {selectedVendor.paymentTermsDays != null ? (
                      <span className="mi-create-party__chip">
                        <span className="mi-create-party__chip-label">Terms</span>
                        {selectedVendor.paymentTermsDays} days
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>
            ) : null}

            <div className="mi-create-commercial__grid">
              <FormField
                label="Supplier invoice no."
                required
                error={form.formState.errors.supplierInvoiceNumber?.message}
              >
                <Input {...form.register('supplierInvoiceNumber')} autoComplete="off" />
              </FormField>
              <FormField label="Invoice type">
                <Select {...form.register('invoiceType')}>
                  <option value="EXPENSE">Expense</option>
                  <option value="SERVICE">Service</option>
                  <option value="GOODS">Goods</option>
                  <option value="ASSET">Asset</option>
                  <option value="MIXED">Mixed</option>
                </Select>
              </FormField>
              <FormField label="Supplier inv. date" required>
                <Input type="date" {...form.register('supplierInvoiceDate')} />
              </FormField>
              <FormField label="Document date" required>
                <Input type="date" {...form.register('documentDate')} />
              </FormField>
              <FormField label="Posting date">
                <Input type="date" {...form.register('postingDate')} />
              </FormField>
              <FormField label="Due date">
                <Input type="date" {...form.register('dueDate')} />
              </FormField>
              {!quickMode ? (
                <>
                  <FormField label="Currency">
                    <Input {...form.register('currencyCode')} />
                  </FormField>
                  <FormField label="Exchange rate">
                    <Input {...form.register('exchangeRate')} />
                  </FormField>
                </>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Invoice Lines"
          subtitle="Qty × rate preview on client; GST, TDS and payable totals calculated by the server on save."
          actions={
            <span className="text-[11px] font-semibold tabular-nums text-erp-muted">
              {lineCount} line{lineCount === 1 ? '' : 's'}
            </span>
          }
        >
          {/* Column headers (md+) */}
          <div
            className={cn(
              'sales-invoice-zoho-form__lines-head mb-1 hidden gap-2 border-b border-erp-border px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted md:grid',
              lineGrid,
            )}
          >
            {!quickMode ? <span>Type</span> : null}
            <span>Description *</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span className="text-right">GST %</span>
            {!quickMode ? <span>HSN/SAC</span> : null}
            <span>Account</span>
            <span />
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded border border-erp-border bg-erp-surface-alt/30 p-2.5">
                <FormField label="Description">
                  <Input {...form.register(`lines.${index}.description`)} />
                </FormField>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <FormField label="Qty">
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      {...form.register(`lines.${index}.quantity`)}
                    />
                  </FormField>
                  <FormField label="Rate">
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      {...form.register(`lines.${index}.unitPrice`)}
                    />
                  </FormField>
                  <FormField label="GST %">
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      {...form.register(`lines.${index}.gstRate`)}
                    />
                  </FormField>
                  <FormField label="Account">
                    <Select {...form.register(`lines.${index}.debitAccountId`)}>
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {expenseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                {fields.length > 1 ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-erp-muted hover:text-rose-600"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Desktop dense rows */}
          <div className="hidden md:block">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={cn(
                  'sales-invoice-zoho-form__line-row grid items-start gap-2 rounded border border-erp-border bg-erp-surface-alt/30 p-2 md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-1 md:py-2',
                  lineGrid,
                )}
              >
                {!quickMode ? (
                  <Select
                    {...form.register(`lines.${index}.lineType`)}
                    aria-label={`Line ${index + 1} type`}
                  >
                    <option value="ITEM">Item</option>
                    <option value="SERVICE">Service</option>
                    <option value="EXPENSE">Expense</option>
                    <option value="ASSET">Asset</option>
                    <option value="FREIGHT">Freight</option>
                    <option value="OTHER_CHARGE">Other charge</option>
                  </Select>
                ) : null}
                <div className="min-w-0 space-y-1">
                  {!quickMode && watched.lines?.[index]?.lineType === 'ITEM' ? (
                    <ErpSmartSelect
                      options={itemOptions}
                      value={watched.lines?.[index]?.itemId ?? ''}
                      onChange={(itemId) => onPickLineItem(index, itemId)}
                      placeholder="Item master (optional)…"
                      allowEmpty
                    />
                  ) : null}
                  <Input
                    placeholder="Description"
                    {...form.register(`lines.${index}.description`)}
                  />
                </div>
                <Input
                  placeholder="0"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={`Line ${index + 1} quantity`}
                  {...form.register(`lines.${index}.quantity`)}
                />
                <Input
                  placeholder="0.00"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={`Line ${index + 1} rate`}
                  {...form.register(`lines.${index}.unitPrice`)}
                />
                <Input
                  placeholder="0"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={`Line ${index + 1} GST %`}
                  {...form.register(`lines.${index}.gstRate`)}
                />
                {!quickMode ? (
                  <Input
                    placeholder="HSN/SAC"
                    aria-label={`Line ${index + 1} HSN/SAC`}
                    {...form.register(`lines.${index}.hsnSacCode`)}
                  />
                ) : null}
                <Select
                  {...form.register(`lines.${index}.debitAccountId`)}
                  aria-label={`Line ${index + 1} account`}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </Select>
                <div className="flex min-h-[34px] items-center justify-end">
                  {!quickMode && fields.length > 1 ? (
                    <button
                      type="button"
                      className="rounded p-1.5 text-erp-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title="Remove line"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {!quickMode ? (
            <button
              type="button"
              className="sales-invoice-zoho-form__add-line mt-2 inline-flex items-center gap-1"
              onClick={() => append(emptyLine(watched.invoiceType))}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add another line
            </button>
          ) : null}
        </FormSection>

        <div className="sales-invoice-zoho-form__footer-grid grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2.5">
            <section className="sales-invoice-zoho-form__section mi-create-section rounded-md border border-erp-border bg-white">
              <button
                type="button"
                className="mi-create-section__header flex w-full flex-wrap items-center justify-between gap-2 border-b border-erp-border text-left"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
              >
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">
                    Charges &amp; Tax
                  </h3>
                  <p className="text-[11px] text-erp-muted">
                    Tax treatment, place of supply, ITC, TDS, freight and other charges.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-erp-muted transition-transform',
                    advancedOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {advancedOpen ? (
                <div className="mi-create-section__body">
                  <div className="mi-create-commercial__grid">
                    <FormField label="Tax treatment">
                      <Select {...form.register('taxTreatment')}>
                        <option value="REGULAR">Regular</option>
                        <option value="REVERSE_CHARGE">Reverse charge</option>
                        <option value="NON_GST">Non-GST</option>
                        <option value="EXEMPT">Exempt</option>
                        <option value="NIL_RATED">Nil rated</option>
                        <option value="IMPORT_GOODS">Import goods</option>
                        <option value="IMPORT_SERVICE">Import service</option>
                        <option value="SEZ">SEZ</option>
                      </Select>
                    </FormField>
                    <FormField
                      label="Company state"
                      required
                      error={!validateStateCode(companyStateCode) ? 'Required for supply type' : undefined}
                      hint={
                        legalEntity
                          ? `Legal entity: ${legalEntity.displayName}`
                          : 'From Accounting → Setup → Legal Entities'
                      }
                    >
                      <Select
                        value={companyStateCode}
                        onChange={(e) => setCompanyStateCode(e.target.value)}
                      >
                        <option value="">{SELECT_PLACEHOLDER}</option>
                        {GST_STATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      label="Place of supply"
                      required
                      error={form.formState.errors.placeOfSupply?.message}
                      hint={
                        selectedVendor
                          ? 'Suggested from vendor state / GSTIN when available'
                          : 'Vendor state when registered — or enter manually'
                      }
                    >
                      <Select {...form.register('placeOfSupply')}>
                        <option value="">{SELECT_PLACEHOLDER}</option>
                        {GST_STATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      label="Supply type"
                      hint="Auto from company state vs place of supply"
                    >
                      <Select {...form.register('supplyType')}>
                        <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
                        <option value="INTER_STATE">Inter-state (IGST)</option>
                      </Select>
                    </FormField>
                    <FormField label="ITC eligibility">
                      <Select {...form.register('itcEligibility')}>
                        <option value="PENDING_REVIEW">Pending review</option>
                        <option value="ELIGIBLE">Eligible</option>
                        <option value="PARTIALLY_ELIGIBLE">Partially eligible</option>
                        <option value="INELIGIBLE">Ineligible</option>
                      </Select>
                    </FormField>
                    {watched.itcEligibility === 'PARTIALLY_ELIGIBLE' ? (
                      <FormField label="Eligible ITC %">
                        <Input {...form.register('itcEligiblePercent')} />
                      </FormField>
                    ) : null}
                    <FormField label="TDS recognition">
                      <Select {...form.register('tdsRecognitionMode')}>
                        <option value="NOT_APPLICABLE">Not applicable</option>
                        <option value="AT_INVOICE">At invoice</option>
                        <option value="AT_PAYMENT">At payment</option>
                      </Select>
                    </FormField>
                    <FormField label="TDS section">
                      <Input {...form.register('tdsSectionCode')} placeholder="e.g. 194C" />
                    </FormField>
                    <FormField label="TDS rate %">
                      <Input {...form.register('tdsRate')} />
                    </FormField>
                    {!hideFreightField ? (
                      <FormField label="Freight amount">
                        <Input {...form.register('freightAmount')} />
                      </FormField>
                    ) : null}
                    <FormField label="Other charges">
                      <Input {...form.register('otherChargeAmount')} />
                    </FormField>
                  </div>
                  {watched.tdsRecognitionMode === 'AT_INVOICE' ? (
                    <p className="mt-2 text-[11px] text-erp-muted">
                      TDS liability is recognised when the vendor invoice is posted.
                    </p>
                  ) : null}
                  {watched.tdsRecognitionMode === 'AT_PAYMENT' ? (
                    <p className="mt-2 text-[11px] text-erp-muted">
                      TDS is handled during vendor payment. The invoice posts the full vendor liability.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <details className="rounded-md border border-erp-border bg-white px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Purchase references
              </summary>
              <div className="mt-2 text-[11px] text-erp-muted">
                {mode === 'edit' && existingSourceLinks.length > 0 ? (
                  <ul className="space-y-1">
                    {existingSourceLinks.map((s, i) => (
                      <li key={`${s.sourceType}-${i}`}>
                        {s.sourceType.replace(/_/g, ' ')} —{' '}
                        {s.sourceDocumentNumberSnapshot ?? s.sourceDocumentId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {mode === 'create'
                      ? 'Source documents are linked from From PO / From GRN create modes above.'
                      : 'This invoice was entered directly without a Purchase reference.'}
                  </p>
                )}
                <p className="mt-1.5">
                  Direct invoices require no Purchase link. ITC classification controls accounting treatment — it does
                  not file GST returns.
                </p>
              </div>
            </details>
          </div>

          <div className="space-y-2">
            <div className="mi-create-totals">
              {serverTotals ? (
                <VendorInvoiceTotalsPanel
                  taxable={serverTotals.taxable}
                  cgst={serverTotals.cgst}
                  sgst={serverTotals.sgst}
                  igst={serverTotals.igst}
                  cess={serverTotals.cess}
                  nonRecoverable={serverTotals.nonRecoverable}
                  freight={serverTotals.freight}
                  other={serverTotals.other}
                  roundOff={serverTotals.roundOff}
                  grandTotal={serverTotals.grandTotal}
                  tds={serverTotals.tds}
                  vendorPayable={serverTotals.vendorPayable}
                />
              ) : (
                <div className="rounded-md border border-erp-border bg-white px-3 py-3 text-[12px] text-erp-muted">
                  Totals appear after the first save — taxable, GST, TDS and rounding are calculated by the server.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sales-invoice-zoho-form__sticky-footer vendor-invoice-zoho-form__sticky-footer flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border">
          <span className="text-[12px] text-erp-muted">
            {lineCount} line{lineCount === 1 ? '' : 's'}
            {' · '}
            {mode === 'create'
              ? 'Saving opens the invoice detail page.'
              : 'Saving recalculates totals from the server.'}
          </span>
          <div className="flex items-center gap-2">
            <ErpButton type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </ErpButton>
            <ErpButton type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </ErpButton>
          </div>
        </div>
      </form>
    </MoneyOutWorkspaceShell>
  )
}

export function VendorInvoiceNewPage() {
  return <VendorInvoiceFormPage mode="create" />
}

export function VendorInvoiceEditPage() {
  return <VendorInvoiceFormPage mode="edit" />
}
