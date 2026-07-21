import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Save, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Checkbox, Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { TabStrip } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  useBuyerOptions,
  useDeliveryTermOptions,
  usePaymentTermOptions,
} from '@/hooks/usePurchaseMasters'
import { useMasterStore } from '@/store/masterStore'
import { fetchMasterLocations, fetchMasterPlants } from '@/services/api/masterApi'
import { fetchAdminUsersApi } from '@/services/api/adminApi'
import { ApiError, formatApiError } from '@/services/api/apiErrors'
import {
  getPurchaseSetup,
  getPurchaseWarehouses,
  PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS,
  PURCHASE_APPROVAL_ROLE_LABELS,
  PURCHASE_APPROVAL_ROLES,
  PURCHASE_ITEM_CATEGORIES,
  PURCHASE_ITEM_CATEGORY_LABELS,
  PURCHASE_SETUP_TAB_LABELS,
  PurchaseServiceError,
  updatePurchaseSetup,
} from '@/services/purchase'
import type {
  PurchaseApprovalMatrixTier,
  PurchaseApprovalRole,
  PurchaseGstRoundOffRule,
  PurchaseGstScheme,
  PurchaseItemCategory,
  PurchaseNotificationEventKey,
  PurchaseNumberSeriesConfig,
  PurchasePrintOrientation,
  PurchasePrintPaperSize,
  PurchaseSetup,
  PurchaseSetupNumberSeries,
  PurchaseSetupTabId,
} from '@/types/purchaseDomain'
import { PURCHASE_DELIVERY_TERMS, withCurrentTermOption } from '@/data/purchase/purchaseCommercialTerms'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

const SETUP_TABS: PurchaseSetupTabId[] = [
  'general',
  'requisition',
  'number_series',
  'approval',
  'tax',
  'invoice_matching',
  'receiving',
  'quality',
  'print',
  'notifications',
]

const DUPLICATE_CHALLAN_POLICY_OPTIONS: Array<{
  value: PurchaseSetup['receiving']['duplicateChallanPolicy']
  label: string
}> = [
  { value: 'BLOCK', label: 'Block duplicate challan' },
  { value: 'WARN', label: 'Warn on duplicate challan' },
  { value: 'ALLOW', label: 'Allow duplicate challan' },
]

const INDIAN_STATES: { name: string; code: string }[] = [
  { name: 'Maharashtra', code: '27' },
  { name: 'Gujarat', code: '24' },
  { name: 'Karnataka', code: '29' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Delhi', code: '07' },
  { name: 'Haryana', code: '06' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Uttar Pradesh', code: '09' },
]

const NUMBER_SERIES_ROWS: { key: keyof PurchaseSetupNumberSeries; label: string }[] = [
  { key: 'purchaseRequisition', label: 'Purchase Requisition' },
  { key: 'rfq', label: 'RFQ' },
  { key: 'vendorQuotation', label: 'Vendor Quotation' },
  { key: 'purchaseOrder', label: 'Purchase Order' },
  { key: 'grn', label: 'GRN' },
  { key: 'qualityInspection', label: 'Quality Inspection' },
  { key: 'purchaseInvoice', label: 'Purchase Invoice' },
  { key: 'purchaseReturn', label: 'Purchase Return' },
]

const NOTIFICATION_ROWS: {
  key: PurchaseNotificationEventKey
  label: string
  hint: string
}[] = [
  { key: 'prPendingApproval', label: 'PR pending approval', hint: 'Notify approvers when a requisition awaits action.' },
  { key: 'rfqResponseDue', label: 'RFQ response due', hint: 'Remind buyers when vendor quotes are overdue.' },
  { key: 'poDeliveryApproaching', label: 'PO delivery approaching', hint: 'Alert before promised delivery date.' },
  { key: 'poOverdue', label: 'PO overdue', hint: 'Escalate past delivery / follow-up dates.' },
  { key: 'grnPendingInspection', label: 'GRN pending inspection', hint: 'Notify QC when goods await inspection.' },
  { key: 'invoiceMismatch', label: 'Invoice mismatch', hint: 'Alert when 3-way match exceeds tolerance.' },
  { key: 'invoicePendingApproval', label: 'Invoice pending approval', hint: 'Notify finance when an invoice awaits approval.' },
]

type MasterOption = { id: string; label: string }

function emptyTier(sortOrder: number): PurchaseApprovalMatrixTier {
  return {
    id: crypto.randomUUID(),
    minAmount: 0,
    maxAmount: 50_000,
    requiredRoles: ['department_head'],
    sortOrder,
    isActive: true,
    label: 'New tier',
    documentType: 'all',
  }
}

function toggleRole(roles: PurchaseApprovalRole[], role: PurchaseApprovalRole) {
  return roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
}

function tabFromHash(hash: string): PurchaseSetupTabId {
  if (hash === '#approval-matrix' || hash === '#approval') return 'approval'
  const id = hash.replace(/^#/, '') as PurchaseSetupTabId
  return SETUP_TABS.includes(id) ? id : 'general'
}

function masterLocationLabel(code: string | undefined, name: string): string {
  return code ? `${name} (${code})` : name
}

function SectionCard({
  title,
  description,
  children,
  id,
}: {
  title: string
  description?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} className="rounded-md border border-erp-border p-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-erp-text">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-erp-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
}

export function PurchaseSetupPage() {
  const location = useLocation()
  const perms = usePurchasePermissions()
  const paymentTermOptions = usePaymentTermOptions()
  const deliveryTermOptions = useDeliveryTermOptions()
  const buyerOptions = useBuyerOptions()
  const storeLocations = useMasterStore((s) => s.locations)

  const [setup, setSetup] = useState<PurchaseSetup | null>(null)
  const [warehouseOptions, setWarehouseOptions] = useState<MasterOption[]>([])
  const [plantOptions, setPlantOptions] = useState<MasterOption[]>([])
  const [buyerUserOptions, setBuyerUserOptions] = useState<MasterOption[]>([])
  const [warehouseLocationOptions, setWarehouseLocationOptions] = useState<MasterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<PurchaseSetupTabId>(() => tabFromHash(location.hash))

  const canEdit = perms.canManageSetup && !loading && setup !== null
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(canEdit)

  const resolveFieldError = useCallback(
    (...fields: string[]) => fields.map((f) => fieldErrors[f]).find(Boolean),
    [fieldErrors],
  )

  const loadWarehouseLocations = useCallback(
    async (warehouseId: string) => {
      if (!warehouseId) {
        setWarehouseLocationOptions([])
        return
      }

      const fromStore = storeLocations.filter(
        (l) => l.isActive && l.warehouseId === warehouseId,
      )
      if (fromStore.length > 0 || !isApiMode()) {
        setWarehouseLocationOptions(
          fromStore.map((l) => ({
            id: l.id,
            label: masterLocationLabel(l.locationCode, l.locationName),
          })),
        )
        return
      }

      try {
        const rows = await fetchMasterLocations()
        setWarehouseLocationOptions(
          rows
            .filter((r) => r.status === 'ACTIVE' && r.warehouseId === warehouseId)
            .map((r) => ({
              id: r.id,
              label: masterLocationLabel(r.code, r.name),
            })),
        )
      } catch {
        setWarehouseLocationOptions([])
      }
    },
    [storeLocations],
  )

  const load = async () => {
    setLoading(true)
    setFieldErrors({})
    try {
      const [nextSetup, warehouses] = await Promise.all([
        getPurchaseSetup(),
        getPurchaseWarehouses(),
      ])
      setSetup(nextSetup)
      setWarehouseOptions(
        warehouses.map((w) => ({
          id: w.id,
          label: w.code ? `${w.name} (${w.code})` : w.name,
        })),
      )

      if (isApiMode()) {
        try {
          const plants = await fetchMasterPlants()
          setPlantOptions(
            plants
              .filter((p) => p.status === 'ACTIVE')
              .map((p) => ({
                id: p.id,
                label: p.code ? `${p.name} (${p.code})` : p.name,
              })),
          )
        } catch {
          setPlantOptions([])
        }

        // Backend validates defaultBuyerId as an active tenant user UUID — offer
        // real users, not demo buyer-master codes. Requires `user.view`; swallow 403.
        try {
          const users = await fetchAdminUsersApi({ status: 'ACTIVE' })
          setBuyerUserOptions(
            users.map((u) => ({
              id: u.id,
              label: `${u.firstName} ${u.lastName}`.trim() || u.email,
            })),
          )
        } catch {
          setBuyerUserOptions([])
        }
      } else {
        setPlantOptions([])
        setBuyerUserOptions([])
      }

      await loadWarehouseLocations(nextSetup.general.defaultWarehouseId)
      resetDirty()
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (location.hash) setTab(tabFromHash(location.hash))
  }, [location.hash])

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    void loadWarehouseLocations(setup?.general.defaultWarehouseId ?? '')
  }, [setup?.general.defaultWarehouseId, loadWarehouseLocations])

  const save = async () => {
    if (!setup || saving) return
    setSaving(true)
    setFieldErrors({})
    try {
      const {
        updatedAt: _a,
        updatedBy: _b,
        ...patch
      } = setup
      const updated = await updatePurchaseSetup(patch)
      setSetup(updated)
      resetDirty()
      notify.success('Purchase Setup saved')
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.length) {
        const next: Record<string, string> = {}
        for (const fe of err.fieldErrors) next[fe.field] = fe.message
        setFieldErrors(next)
      }
      notify.error(err instanceof PurchaseServiceError ? err.message : formatApiError(err))
      // Version conflict — someone else saved; reload the latest server copy.
      if (
        err instanceof ApiError &&
        (err.statusCode === 409 || err.code === 'SETUP_VERSION_CONFLICT')
      ) {
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const touch = useCallback(() => {
    markDirty()
    setFieldErrors({})
  }, [markDirty])

  const patchGeneral = <K extends keyof PurchaseSetup['general']>(
    key: K,
    value: PurchaseSetup['general'][K],
  ) => {
    touch()
    setSetup((prev) => (prev ? { ...prev, general: { ...prev.general, [key]: value } } : prev))
  }

  const patchRequisition = <K extends keyof PurchaseSetup['requisition']>(
    key: K,
    value: PurchaseSetup['requisition'][K],
  ) => {
    touch()
    setSetup((prev) =>
      prev ? { ...prev, requisition: { ...prev.requisition, [key]: value } } : prev,
    )
  }

  const patchNumberSeries = (key: keyof PurchaseSetupNumberSeries, entry: Partial<PurchaseNumberSeriesConfig>) => {
    touch()
    setSetup((prev) =>
      prev
        ? {
            ...prev,
            numberSeries: {
              ...prev.numberSeries,
              [key]: { ...prev.numberSeries[key], ...entry },
            },
          }
        : prev,
    )
  }

  const patchTax = <K extends keyof PurchaseSetup['tax']>(key: K, value: PurchaseSetup['tax'][K]) => {
    touch()
    setSetup((prev) => (prev ? { ...prev, tax: { ...prev.tax, [key]: value } } : prev))
  }

  const patchMatch = <K extends keyof PurchaseSetup['invoiceMatchTolerances']>(
    key: K,
    value: PurchaseSetup['invoiceMatchTolerances'][K],
  ) => {
    touch()
    setSetup((prev) =>
      prev
        ? {
            ...prev,
            invoiceMatchTolerances: { ...prev.invoiceMatchTolerances, [key]: value },
          }
        : prev,
    )
  }

  const patchReceiving = <K extends keyof PurchaseSetup['receiving']>(
    key: K,
    value: PurchaseSetup['receiving'][K],
  ) => {
    touch()
    setSetup((prev) => (prev ? { ...prev, receiving: { ...prev.receiving, [key]: value } } : prev))
  }

  const patchQuality = <K extends keyof PurchaseSetup['quality']>(
    key: K,
    value: PurchaseSetup['quality'][K],
  ) => {
    touch()
    setSetup((prev) => (prev ? { ...prev, quality: { ...prev.quality, [key]: value } } : prev))
  }

  const patchPrint = <K extends keyof PurchaseSetup['print']>(key: K, value: PurchaseSetup['print'][K]) => {
    touch()
    setSetup((prev) => (prev ? { ...prev, print: { ...prev.print, [key]: value } } : prev))
  }

  const patchTier = (id: string, patch: Partial<PurchaseApprovalMatrixTier>) => {
    touch()
    setSetup((prev) =>
      prev
        ? {
            ...prev,
            approvalMatrix: prev.approvalMatrix.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          }
        : prev,
    )
  }

  const toggleCategory = (category: PurchaseItemCategory) => {
    touch()
    setSetup((prev) => {
      if (!prev) return prev
      const list = prev.quality.inspectionRequiredCategories
      const next = list.includes(category) ? list.filter((c) => c !== category) : [...list, category]
      return { ...prev, quality: { ...prev.quality, inspectionRequiredCategories: next } }
    })
  }

  const onDefaultWarehouseChange = (warehouseId: string) => {
    touch()
    setSetup((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        general: { ...prev.general, defaultWarehouseId: warehouseId },
        receiving: {
          ...prev.receiving,
          defaultReceivingLocationId: '',
        },
        quality: {
          ...prev.quality,
          defaultQualityHoldLocationId: '',
          defaultRejectedLocationId: '',
          defaultVendorReturnLocationId: '',
        },
      }
    })
  }

  const paymentTermSelectOptions = useMemo(() => {
    const rows = [...paymentTermOptions]
    const currentCode = setup?.general.defaultPaymentTermCode
    if (currentCode && !rows.some((o) => o.value === currentCode)) {
      rows.unshift({
        value: currentCode,
        label: setup?.general.defaultPaymentTerms || currentCode,
        text: setup?.general.defaultPaymentTerms || currentCode,
        attributes: {},
      })
    }
    return rows
  }, [paymentTermOptions, setup?.general.defaultPaymentTermCode, setup?.general.defaultPaymentTerms])

  const deliveryTermSelectOptions = useMemo(() => {
    const current = setup?.general.defaultDeliveryTerms ?? ''
    const fromMasters = deliveryTermOptions.map((o) => o.text || o.label)
    if (fromMasters.length > 0) return fromMasters
    return [...withCurrentTermOption(PURCHASE_DELIVERY_TERMS, current)]
  }, [deliveryTermOptions, setup?.general.defaultDeliveryTerms])

  const buyerSelectOptions = useMemo(() => {
    // API mode: buyer must be a tenant user UUID (backend validates it).
    // Demo mode: buyer-master codes from the demo store.
    const rows = isApiMode()
      ? buyerUserOptions.map((o) => ({ id: o.id, label: o.label }))
      : buyerOptions.map((o) => ({ id: o.value, label: o.label }))
    const currentId = setup?.general.defaultBuyerId
    if (currentId && !rows.some((o) => o.id === currentId)) {
      rows.unshift({ id: currentId, label: currentId })
    }
    return rows
  }, [buyerOptions, buyerUserOptions, setup?.general.defaultBuyerId])

  const tabItems = useMemo(
    () => SETUP_TABS.map((id) => ({ id, label: PURCHASE_SETUP_TAB_LABELS[id] })),
    [],
  )

  return (
    <OperationalPageShell
      title="Purchase Setup"
      description="Company-wide purchase configuration — general defaults, numbering, approvals, tax, matching, receiving, quality, print, and notifications"
      badge="Purchase"
      variant="dynamics"
      showDescription
      favoritePath="/purchase/setup"
      layout="enterprise"
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Masters', to: '/purchase/masters' },
        { label: 'Setup' },
      ]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageSetup
              ? {
                  id: 'save',
                  label: saving ? 'Saving…' : dirty ? 'Save Setup' : 'Save Setup',
                  icon: Save,
                  onClick: () => void save(),
                  disabled: saving || loading,
                }
              : undefined
          }
        />
      }
    >
      {!isApiMode() ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Demo mode — Purchase Setup is saved in browser memory only until the purchase API is wired.
        </p>
      ) : setup && !setup.isConfigured ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Using server defaults — not yet configured.
        </p>
      ) : null}

      <TabStrip tabs={tabItems} active={tab} onChange={setTab} className="mb-4" />

      {loading || !setup ? (
        <LoadingState variant="form" rows={8} />
      ) : (
        <div className="space-y-4">
          {tab === 'general' && (
            <SectionCard
              title="General Setup"
              description="Default masters and document policy flags used when creating purchase documents."
            >
              <FieldGrid>
                <FormField
                  label="Default plant"
                  hint="Optional — used when plant-scoped defaults apply."
                  error={resolveFieldError('defaultPlantId')}
                >
                  <Select
                    value={setup.general.defaultPlantId}
                    onChange={(e) => patchGeneral('defaultPlantId', e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {plantOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Default warehouse"
                  error={resolveFieldError('defaultWarehouseId')}
                >
                  <Select
                    value={setup.general.defaultWarehouseId}
                    onChange={(e) => onDefaultWarehouseChange(e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default buyer" error={resolveFieldError('defaultBuyerId')}>
                  <Select
                    value={setup.general.defaultBuyerId}
                    onChange={(e) => patchGeneral('defaultBuyerId', e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {buyerSelectOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default currency" hint="Tenancy is INR-only in Phase 1.">
                  <Select
                    value={setup.general.defaultCurrency}
                    onChange={(e) => patchGeneral('defaultCurrency', e.target.value as 'INR')}
                  >
                    <option value="INR">INR — Indian Rupee</option>
                  </Select>
                </FormField>
                <FormField
                  label="Default payment terms"
                  error={resolveFieldError('defaultPaymentTermCode')}
                >
                  <Select
                    value={setup.general.defaultPaymentTermCode}
                    onChange={(e) => {
                      const code = e.target.value
                      const opt = paymentTermSelectOptions.find((o) => o.value === code)
                      touch()
                      setSetup((prev) =>
                        prev
                          ? {
                              ...prev,
                              general: {
                                ...prev.general,
                                defaultPaymentTermCode: code,
                                defaultPaymentTerms: opt?.text ?? opt?.label ?? '',
                              },
                            }
                          : prev,
                      )
                    }}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {paymentTermSelectOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.value} — {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default delivery terms">
                  <Select
                    value={setup.general.defaultDeliveryTerms}
                    onChange={(e) => patchGeneral('defaultDeliveryTerms', e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {deliveryTermSelectOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Require RFQ above amount (INR)"
                  hint="0 disables the threshold. Documents at or above this value should go through RFQ."
                >
                  <Input
                    type="number"
                    min={0}
                    value={setup.general.requireRfqAboveAmountInr}
                    onChange={(e) =>
                      patchGeneral('requireRfqAboveAmountInr', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Minimum RFQ vendor count">
                  <Input
                    type="number"
                    min={1}
                    value={setup.general.minimumRfqVendorCount}
                    onChange={(e) =>
                      patchGeneral('minimumRfqVendorCount', Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </FormField>
                <FormField
                  label="Over-receipt tolerance (%)"
                  hint="Allowed % above ordered qty when over-receipt is enabled."
                  error={resolveFieldError('overReceiptTolerancePct')}
                >
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={setup.general.overReceiptTolerancePct}
                    onChange={(e) =>
                      patchGeneral('overReceiptTolerancePct', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
              </FieldGrid>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  label="Allow direct PO"
                  checked={setup.general.allowDirectPo}
                  onChange={(e) => patchGeneral('allowDirectPo', e.target.checked)}
                />
                <Checkbox
                  label="Require PR before PO"
                  checked={setup.general.requirePrBeforePo}
                  onChange={(e) => patchGeneral('requirePrBeforePo', e.target.checked)}
                />
                <Checkbox
                  label="Allow over receipt"
                  checked={setup.general.allowOverReceipt}
                  onChange={(e) => patchGeneral('allowOverReceipt', e.target.checked)}
                />
                <Checkbox
                  label="Require warehouse on PO"
                  checked={setup.general.requirePoWarehouse}
                  onChange={(e) => patchGeneral('requirePoWarehouse', e.target.checked)}
                />
                <Checkbox
                  label="Require expected delivery date on PO"
                  checked={setup.general.requireExpectedDeliveryDate}
                  onChange={(e) => patchGeneral('requireExpectedDeliveryDate', e.target.checked)}
                />
                <Checkbox
                  label="Require payment terms on PO"
                  checked={setup.general.requirePaymentTerms}
                  onChange={(e) => patchGeneral('requirePaymentTerms', e.target.checked)}
                />
              </div>
            </SectionCard>
          )}

          {tab === 'requisition' && (
            <SectionCard
              title="Requisition Setup"
              description="Defaults applied when creating a new Purchase Requisition."
            >
              <FieldGrid>
                <FormField
                  label="Default warehouse (new PRs)"
                  hint="Pre-selected on new requisitions. Leave empty to use General Setup → default warehouse."
                  error={resolveFieldError('defaultRequisitionWarehouseId')}
                >
                  <Select
                    value={setup.requisition.defaultWarehouseId}
                    onChange={(e) => patchRequisition('defaultWarehouseId', e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="RFQ Required? (default for new PRs)"
                  hint="Yes = RFQ path. No = Direct purchase planning (Planning Sheet after approval)."
                >
                  <Select
                    value={setup.requisition.skipRfq ? 'no' : 'yes'}
                    onChange={(e) => patchRequisition('skipRfq', e.target.value === 'no')}
                  >
                    <option value="yes">Yes, Vendor quotations required</option>
                    <option value="no">No, Direct purchase planning</option>
                  </Select>
                </FormField>
                <FormField
                  label="Auto-complete REF"
                  hint="Pending — will auto-fill Reference Number from linked source docs."
                >
                  <Select
                    value={setup.requisition.autoCompleteRef ? 'yes' : 'no'}
                    disabled
                    onChange={(e) => patchRequisition('autoCompleteRef', e.target.value === 'yes')}
                  >
                    <option value="no">No (pending)</option>
                    <option value="yes">Yes (pending)</option>
                  </Select>
                </FormField>
              </FieldGrid>
            </SectionCard>
          )}

          {tab === 'number_series' && (
            <SectionCard
              title="Number Series"
              description="Prefix and zero-padding per document type. Next number is allocated by the server and shown read-only."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="py-2 pr-3 font-medium">Document</th>
                      <th className="py-2 pr-3 font-medium">Prefix</th>
                      <th className="py-2 pr-3 font-medium">Next number</th>
                      <th className="py-2 pr-3 font-medium">Pad</th>
                      <th className="py-2 font-medium">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NUMBER_SERIES_ROWS.map(({ key, label }) => {
                      const row = setup.numberSeries[key]
                      const preview = `${row.prefix}-${String(row.nextNumber).padStart(row.padLength, '0')}`
                      return (
                        <tr key={key} className="border-b border-erp-border/70">
                          <td className="py-2 pr-3 font-medium text-erp-text">{label}</td>
                          <td className="py-2 pr-3">
                            <Input
                              className="max-w-[7rem]"
                              value={row.prefix}
                              onChange={(e) => patchNumberSeries(key, { prefix: e.target.value })}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className="inline-block min-w-[4rem] font-mono text-[13px] text-erp-text"
                              title="Allocated by the server — read-only"
                            >
                              {row.nextNumber}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              className="max-w-[5rem]"
                              min={1}
                              max={8}
                              value={row.padLength}
                              onChange={(e) =>
                                patchNumberSeries(key, {
                                  padLength: Math.min(8, Math.max(1, Number(e.target.value) || 1)),
                                })
                              }
                            />
                          </td>
                          <td className="py-2 font-mono text-[12px] text-erp-muted">{preview}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {tab === 'approval' && (
            <div className="space-y-4">
              <SectionCard
                id="self-approval-policy"
                title="Self-approval policy"
                description="Maker-checker control: whether the person who created / requested a PR or PO may approve it themselves. Self-approvals are always recorded in the audit log."
              >
                <div className="max-w-xl">
                  <FormField
                    label="Who may approve their own documents?"
                    hint="Permission-based: only users granted purchase.approvals.self_approve (e.g. CEO / admin roles) bypass the restriction."
                  >
                    <Select
                      value={setup.selfApprovalPolicy}
                      onChange={(e) => {
                        touch()
                        const value = e.target.value as PurchaseSetup['selfApprovalPolicy']
                        setSetup((prev) => (prev ? { ...prev, selfApprovalPolicy: value } : prev))
                      }}
                    >
                      <option value="NEVER">Never allow</option>
                      <option value="PERMISSION_ONLY">
                        Allow only users with self-approval permission (default)
                      </option>
                      <option value="EVERYONE">Allow everyone (not recommended)</option>
                    </Select>
                  </FormField>
                </div>
              </SectionCard>
              <SectionCard
                id="approval-matrix"
                title="Approval matrix"
                description="Amount thresholds (INR document total) determine which roles must approve, in order. Masters Approval Matrix redirects here."
              >
                <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => {
                      touch()
                      setSetup((prev) =>
                        prev
                          ? {
                              ...prev,
                              approvalMatrix: [
                                ...prev.approvalMatrix,
                                emptyTier(prev.approvalMatrix.length + 1),
                              ],
                            }
                          : prev,
                      )
                    }}
                  >
                    Add tier
                  </ErpButton>
                </div>

                <div className="mb-2 hidden gap-2 text-[11px] font-medium uppercase tracking-wide text-erp-muted lg:grid lg:grid-cols-[7rem_1fr_7rem_7rem_1fr_5rem_4rem_auto]">
                  <span>Document</span>
                  <span>Label</span>
                  <span>Min amount</span>
                  <span>Max amount</span>
                  <span>Approver roles (level order)</span>
                  <span>Sequence</span>
                  <span>Active</span>
                  <span />
                </div>

                <div className="space-y-3">
                  {setup.approvalMatrix
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((tier, index) => (
                      <div
                        key={tier.id}
                        className="grid gap-3 rounded-md border border-erp-border bg-erp-surface-alt/30 p-3 lg:grid-cols-[7rem_1fr_7rem_7rem_1fr_5rem_4rem_auto]"
                      >
                        <Select
                          value={tier.documentType ?? 'all'}
                          onChange={(e) =>
                            patchTier(tier.id, {
                              documentType: e.target.value as PurchaseApprovalMatrixTier['documentType'],
                            })
                          }
                          title="Document type"
                        >
                          <option value="all">All</option>
                          <option value="purchase_requisition">
                            {PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS.purchase_requisition}
                          </option>
                          <option value="purchase_order">
                            {PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS.purchase_order}
                          </option>
                        </Select>
                        <Input
                          value={tier.label}
                          onChange={(e) => patchTier(tier.id, { label: e.target.value })}
                          placeholder="Tier label"
                        />
                        <Input
                          type="number"
                          value={tier.minAmount}
                          onChange={(e) =>
                            patchTier(tier.id, { minAmount: Number(e.target.value) || 0 })
                          }
                          title="Min amount"
                        />
                        <Input
                          type="number"
                          value={tier.maxAmount ?? ''}
                          onChange={(e) =>
                            patchTier(tier.id, {
                              maxAmount: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          placeholder="Max (blank = ∞)"
                          title="Max amount"
                        />
                        <div className="flex flex-wrap gap-2">
                          {PURCHASE_APPROVAL_ROLES.map((role) => {
                            const active = tier.requiredRoles.includes(role)
                            return (
                              <button
                                key={role}
                                type="button"
                                className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                                  active
                                    ? 'border-erp-primary bg-erp-primary text-white'
                                    : 'border-erp-border bg-white text-erp-muted'
                                }`}
                                onClick={() =>
                                  patchTier(tier.id, {
                                    requiredRoles: toggleRole(tier.requiredRoles, role),
                                  })
                                }
                              >
                                {PURCHASE_APPROVAL_ROLE_LABELS[role]}
                              </button>
                            )
                          })}
                        </div>
                        <Input
                          type="number"
                          value={tier.sortOrder}
                          onChange={(e) =>
                            patchTier(tier.id, { sortOrder: Number(e.target.value) || index + 1 })
                          }
                          title="Sequence"
                        />
                        <Select
                          value={tier.isActive ? '1' : '0'}
                          onChange={(e) => patchTier(tier.id, { isActive: e.target.value === '1' })}
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </Select>
                        <button
                          type="button"
                          className="rounded p-1 text-erp-danger-fg hover:bg-red-50"
                          title="Remove tier"
                          onClick={() => {
                            touch()
                            setSetup((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    approvalMatrix: prev.approvalMatrix.filter((t) => t.id !== tier.id),
                                  }
                                : prev,
                            )
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <p className="text-[11px] text-erp-muted lg:col-span-8">
                          Level {index + 1}:{' '}
                          {tier.requiredRoles.map((r) => PURCHASE_APPROVAL_ROLE_LABELS[r]).join(' → ') ||
                            '—'}
                          {' · '}
                          {formatCurrency(tier.minAmount)}
                          {' – '}
                          {tier.maxAmount == null ? '∞' : formatCurrency(tier.maxAmount)}
                        </p>
                      </div>
                    ))}
                </div>
              </SectionCard>
            </div>
          )}

          {tab === 'tax' && (
            <SectionCard
              title="Tax Setup"
              description="GST defaults applied to Indian purchase documents for this tenant."
            >
              <FieldGrid>
                <FormField
                  label="Default GST scheme"
                  hint="Used when the vendor is intra-state; interstate documents still compute IGST."
                >
                  <Select
                    value={setup.tax.defaultGstScheme}
                    onChange={(e) => patchTax('defaultGstScheme', e.target.value as PurchaseGstScheme)}
                  >
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                  </Select>
                </FormField>
                <FormField label="Place of supply (state)" hint="Company GST registration state for POS.">
                  <Select
                    value={setup.tax.placeOfSupplyStateCode}
                    onChange={(e) => {
                      const found = INDIAN_STATES.find((s) => s.code === e.target.value)
                      if (!found) return
                      touch()
                      setSetup((prev) =>
                        prev
                          ? {
                              ...prev,
                              tax: {
                                ...prev.tax,
                                placeOfSupplyState: found.name,
                                placeOfSupplyStateCode: found.code,
                              },
                            }
                          : prev,
                      )
                    }}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Round-off rule" hint="How invoice totals are rounded for GST invoices.">
                  <Select
                    value={setup.tax.roundOffRule}
                    onChange={(e) => patchTax('roundOffRule', e.target.value as PurchaseGstRoundOffRule)}
                  >
                    <option value="none">None</option>
                    <option value="nearest_rupee">Nearest rupee</option>
                    <option value="nearest_paisa">Nearest paisa (0.01)</option>
                  </Select>
                </FormField>
              </FieldGrid>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  label="Reverse charge default"
                  checked={setup.tax.reverseChargeDefault}
                  onChange={(e) => patchTax('reverseChargeDefault', e.target.checked)}
                />
                <Checkbox
                  label="Enable TCS"
                  checked={setup.tax.tcsEnabled}
                  onChange={(e) => patchTax('tcsEnabled', e.target.checked)}
                />
                <Checkbox
                  label="Enable TDS"
                  checked={setup.tax.tdsEnabled}
                  onChange={(e) => patchTax('tdsEnabled', e.target.checked)}
                />
              </div>
            </SectionCard>
          )}

          {tab === 'invoice_matching' && (
            <SectionCard
              title="Invoice Matching"
              description="Three-way match flags and tolerances consumed by the purchase invoice module."
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  label="Require PO match"
                  checked={setup.invoiceMatchTolerances.requirePoMatch}
                  onChange={(e) => patchMatch('requirePoMatch', e.target.checked)}
                />
                <Checkbox
                  label="Require GRN match"
                  checked={setup.invoiceMatchTolerances.requireGrnMatch}
                  onChange={(e) => patchMatch('requireGrnMatch', e.target.checked)}
                />
                <Checkbox
                  label="Allow authorized override"
                  checked={setup.invoiceMatchTolerances.allowAuthorizedOverride}
                  onChange={(e) => patchMatch('allowAuthorizedOverride', e.target.checked)}
                />
              </div>
              <FieldGrid>
                <FormField label="Quantity tolerance (%)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={setup.invoiceMatchTolerances.quantityTolerancePct}
                    onChange={(e) =>
                      patchMatch('quantityTolerancePct', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Rate tolerance (%)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={setup.invoiceMatchTolerances.rateTolerancePct}
                    onChange={(e) =>
                      patchMatch('rateTolerancePct', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Amount tolerance (%)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={setup.invoiceMatchTolerances.amountTolerancePct}
                    onChange={(e) =>
                      patchMatch('amountTolerancePct', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Amount tolerance (INR)" hint="Absolute INR band alongside %.">
                  <Input
                    type="number"
                    min={0}
                    value={setup.invoiceMatchTolerances.amountToleranceInr}
                    onChange={(e) =>
                      patchMatch('amountToleranceInr', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Tax tolerance (%)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={setup.invoiceMatchTolerances.taxTolerancePct}
                    onChange={(e) =>
                      patchMatch('taxTolerancePct', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
                <FormField label="Tax tolerance (INR)">
                  <Input
                    type="number"
                    min={0}
                    value={setup.invoiceMatchTolerances.taxToleranceInr}
                    onChange={(e) =>
                      patchMatch('taxToleranceInr', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
              </FieldGrid>
            </SectionCard>
          )}

          {tab === 'receiving' && (
            <SectionCard
              title="Receiving Setup"
              description="Gate-in and GRN capture rules under the default warehouse."
            >
              <FieldGrid>
                <FormField
                  label="Default receiving location"
                  hint="Master location under the default warehouse."
                  error={resolveFieldError('defaultReceivingLocationId')}
                >
                  <Select
                    value={setup.receiving.defaultReceivingLocationId}
                    onChange={(e) => patchReceiving('defaultReceivingLocationId', e.target.value)}
                    disabled={!setup.general.defaultWarehouseId}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseLocationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Duplicate challan policy">
                  <Select
                    value={setup.receiving.duplicateChallanPolicy}
                    onChange={(e) =>
                      patchReceiving(
                        'duplicateChallanPolicy',
                        e.target.value as PurchaseSetup['receiving']['duplicateChallanPolicy'],
                      )
                    }
                  >
                    {DUPLICATE_CHALLAN_POLICY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FieldGrid>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  label="Require gate entry"
                  checked={setup.receiving.requireGateEntry}
                  onChange={(e) => patchReceiving('requireGateEntry', e.target.checked)}
                />
                <Checkbox
                  label="Require vendor challan"
                  checked={setup.receiving.requireVendorChallan}
                  onChange={(e) => patchReceiving('requireVendorChallan', e.target.checked)}
                />
                <Checkbox
                  label="Require vehicle number"
                  checked={setup.receiving.requireVehicleNumber}
                  onChange={(e) => patchReceiving('requireVehicleNumber', e.target.checked)}
                />
                <Checkbox
                  label="Require batch"
                  checked={setup.receiving.requireBatch}
                  onChange={(e) => patchReceiving('requireBatch', e.target.checked)}
                />
                <Checkbox
                  label="Require serial"
                  checked={setup.receiving.requireSerial}
                  onChange={(e) => patchReceiving('requireSerial', e.target.checked)}
                />
                <Checkbox
                  label="Require expiry"
                  checked={setup.receiving.requireExpiry}
                  onChange={(e) => patchReceiving('requireExpiry', e.target.checked)}
                />
                <Checkbox
                  label="Auto-create inspection"
                  checked={setup.receiving.autoCreateInspection}
                  onChange={(e) => patchReceiving('autoCreateInspection', e.target.checked)}
                />
              </div>
            </SectionCard>
          )}

          {tab === 'quality' && (
            <SectionCard
              title="Quality Setup"
              description="Inspection requirements by item category and location defaults under the default warehouse."
            >
              <FormField
                label="Quality inspection required by item category"
                hint="Checked categories force QI on receipt (when QC is relevant)."
                className="mb-4"
              >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {PURCHASE_ITEM_CATEGORIES.map((cat) => (
                    <Checkbox
                      key={cat}
                      label={PURCHASE_ITEM_CATEGORY_LABELS[cat]}
                      checked={setup.quality.inspectionRequiredCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                  ))}
                </div>
              </FormField>
              <FieldGrid>
                <FormField
                  label="Default quality hold location"
                  error={resolveFieldError('defaultQualityHoldLocationId')}
                >
                  <Select
                    value={setup.quality.defaultQualityHoldLocationId}
                    onChange={(e) => patchQuality('defaultQualityHoldLocationId', e.target.value)}
                    disabled={!setup.general.defaultWarehouseId}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseLocationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Default rejected location"
                  error={resolveFieldError('defaultRejectedLocationId')}
                >
                  <Select
                    value={setup.quality.defaultRejectedLocationId}
                    onChange={(e) => patchQuality('defaultRejectedLocationId', e.target.value)}
                    disabled={!setup.general.defaultWarehouseId}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseLocationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Default vendor return location"
                  error={resolveFieldError('defaultVendorReturnLocationId')}
                >
                  <Select
                    value={setup.quality.defaultVendorReturnLocationId}
                    onChange={(e) => patchQuality('defaultVendorReturnLocationId', e.target.value)}
                    disabled={!setup.general.defaultWarehouseId}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {warehouseLocationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Deviation approver role">
                  <Select
                    value={setup.quality.deviationApproverRole}
                    onChange={(e) =>
                      patchQuality('deviationApproverRole', e.target.value as PurchaseApprovalRole)
                    }
                  >
                    {PURCHASE_APPROVAL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {PURCHASE_APPROVAL_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FieldGrid>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Checkbox
                  label="Allow acceptance under deviation"
                  checked={setup.quality.allowAcceptanceUnderDeviation}
                  onChange={(e) => patchQuality('allowAcceptanceUnderDeviation', e.target.checked)}
                />
                <Checkbox
                  label="Allow rejected stock in quarantine"
                  checked={setup.quality.allowRejectedStockInQuarantine}
                  onChange={(e) => patchQuality('allowRejectedStockInQuarantine', e.target.checked)}
                />
              </div>
            </SectionCard>
          )}

          {tab === 'print' && (
            <SectionCard
              title="Print Setup"
              description="Print defaults for PO / GRN / invoice layouts. Logo is referenced by URL — no upload here."
            >
              <FieldGrid>
                <FormField label="Company name">
                  <Input
                    value={setup.print.companyName}
                    onChange={(e) => patchPrint('companyName', e.target.value)}
                  />
                </FormField>
                <FormField label="Logo URL">
                  <Input
                    value={setup.print.logoUrl}
                    onChange={(e) => patchPrint('logoUrl', e.target.value)}
                  />
                </FormField>
                <FormField label="Default copies">
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={setup.print.defaultCopies}
                    onChange={(e) =>
                      patchPrint('defaultCopies', Math.min(9, Math.max(1, Number(e.target.value) || 1)))
                    }
                  />
                </FormField>
                <FormField label="Paper size">
                  <Select
                    value={setup.print.paperSize}
                    onChange={(e) => patchPrint('paperSize', e.target.value as PurchasePrintPaperSize)}
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </Select>
                </FormField>
                <FormField label="Orientation">
                  <Select
                    value={setup.print.orientation}
                    onChange={(e) =>
                      patchPrint('orientation', e.target.value as PurchasePrintOrientation)
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </Select>
                </FormField>
              </FieldGrid>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Checkbox
                  label="Show terms on PO print"
                  checked={setup.print.showTermsOnPo}
                  onChange={(e) => patchPrint('showTermsOnPo', e.target.checked)}
                />
                <Checkbox
                  label="Show terms on GRN print"
                  checked={setup.print.showTermsOnGrn}
                  onChange={(e) => patchPrint('showTermsOnGrn', e.target.checked)}
                />
                <Checkbox
                  label="Show terms on invoice print"
                  checked={setup.print.showTermsOnInvoice}
                  onChange={(e) => patchPrint('showTermsOnInvoice', e.target.checked)}
                />
              </div>
            </SectionCard>
          )}

          {tab === 'notifications' && (
            <SectionCard
              title="Notifications"
              description="In-app and email toggles per event — visible for planning only."
            >
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {setup.notifications.message ||
                  'Purchase notifications are on hold — this tab is read-only and is not saved.'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="py-2 pr-3 font-medium">Event</th>
                      <th className="py-2 pr-3 font-medium">In-app</th>
                      <th className="py-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIFICATION_ROWS.map(({ key, label, hint }) => (
                      <tr key={key} className="border-b border-erp-border/70">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-erp-text">{label}</div>
                          <div className="text-[11px] text-erp-muted">{hint}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <Checkbox
                            checked={setup.notifications[key].inApp}
                            disabled
                            readOnly
                            aria-label={`${label} in-app (on hold)`}
                          />
                        </td>
                        <td className="py-3">
                          <Checkbox
                            checked={setup.notifications[key].email}
                            disabled
                            readOnly
                            aria-label={`${label} email (on hold)`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </OperationalPageShell>
  )
}
