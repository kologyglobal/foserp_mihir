import { useEffect, useState } from 'react'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { useLeafCategories, useFgItems, useActiveCustomers, useActiveUoms, useActiveVendors, useCommercialTerms } from '../../hooks/useMasterLists'
import { useDesignationOptions, useDepartmentOptions } from '../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import { StateSelect, CitySelect, MasterEnumSelect } from '../masters/GeographySelects'
import { INDUSTRY_OPTIONS, VEHICLE_TYPE_OPTIONS } from '../../data/masters/geographySeed'
import { FormField } from '../forms/FormField'
import { Input, Select, Checkbox, Textarea, MobileInput } from '../forms/Inputs'
import { Toast } from '../ui/Toast'
import { ErpDrawerFormShell } from '../erp/ErpFormShell'
import { PRODUCT_FAMILY_LABELS } from '../../types/productMaster'
import type { ProductFamily } from '../../types/productMaster'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import type { QuickCreateEntityType } from '../../types/quickCreate'

const MASTER_LINKS: Partial<Record<QuickCreateEntityType, string>> = {
  customer: '/masters/companies/new',
  vendor: '/masters/vendors/new',
  item: '/masters/items/new',
  product: '/masters/products/new',
  inspectionPlan: '/quality/masters/inspection-plans/new',
}

function emptyForm(entityType: QuickCreateEntityType, defaults?: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(defaults ?? {}), isActive: true }
  switch (entityType) {
    case 'customer':
      return { ...base, customerType: 'corporate', salesTerritory: 'West', creditDays: 30 }
    case 'vendor':
      return { ...base, vendorType: 'trader', paymentTermsDays: 30, defaultLeadTimeDays: 14 }
    case 'item':
      return { ...base, itemType: 'bought_out', isPurchasable: true, isStockable: true }
    case 'product':
      return { ...base, productFamily: 'bulker_trailer', status: 'draft' }
    default:
      return base
  }
}

export function QuickCreateDrawerForm() {
  const { drawer, closeDrawer, saveEntity } = useQuickCreate()
  const categories = useLeafCategories()
  const uoms = useActiveUoms()
  const vendors = useActiveVendors()
  const customers = useActiveCustomers()
  const fgItems = useFgItems()
  const paymentTerms = useCommercialTerms('payment')
  const designationOptions = useDesignationOptions()
  const departmentOptions = useDepartmentOptions()

  const [form, setForm] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!drawer) return
    setForm(emptyForm(drawer.entityType, drawer.defaultValues))
    setError(null)
  }, [drawer])

  if (!drawer) return null

  const entityType = drawer.entityType
  const link = MASTER_LINKS[entityType]
  const drawerDefaults = drawer.defaultValues

  function setField(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = saveEntity(form)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setToast(`${drawer!.title} saved`)
    setTimeout(() => setToast(null), 2500)
  }

  function renderFields() {
    switch (entityType) {
      case 'customer':
        return (
          <>
            <FormField label={`${COMPANY_TERMINOLOGY.name} *`}>
              <Input value={String(form.customerName ?? '')} onChange={(e) => setField('customerName', e.target.value)} />
            </FormField>
            <FormField label="Industry">
              <MasterEnumSelect
                value={String(form.industry ?? '')}
                onChange={(v) => setField('industry', v)}
                options={INDUSTRY_OPTIONS}
                placeholder="— Select industry —"
              />
            </FormField>
            <FormField label="Contact Person">
              <Input value={String(form.contactPerson ?? '')} onChange={(e) => setField('contactPerson', e.target.value)} />
            </FormField>
            <FormField label="Mobile">
              <MobileInput value={String(form.mobile ?? form.contactPhone ?? '')} onChange={(e) => setField('mobile', e.target.value)} placeholder="10-digit mobile" />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={String(form.email ?? form.contactEmail ?? '')} onChange={(e) => setField('email', e.target.value)} />
            </FormField>
            <FormField label="State *">
              <StateSelect
                value={String(form.state ?? '')}
                onChange={(v) => {
                  setField('state', v)
                  setField('city', '')
                }}
                required
              />
            </FormField>
            <FormField label="City *">
              <CitySelect
                stateName={String(form.state ?? '')}
                value={String(form.city ?? '')}
                onChange={(v) => setField('city', v)}
                required
              />
            </FormField>
            <FormField label="GST No">
              <Input value={String(form.gstin ?? '')} onChange={(e) => setField('gstin', e.target.value)} maxLength={15} placeholder="27AAAAA0000A1Z5" />
            </FormField>
            <FormField label="Billing Address" className="md:col-span-2">
              <Textarea value={String(form.billingAddress ?? form.addressLine1 ?? '')} onChange={(e) => setField('billingAddress', e.target.value)} rows={2} />
            </FormField>
            <FormField label="Shipping Address" className="md:col-span-2">
              <Textarea value={String(form.shippingAddress ?? '')} onChange={(e) => setField('shippingAddress', e.target.value)} rows={2} />
            </FormField>
            <FormField label="Credit Limit (₹)">
              <Input type="number" value={String(form.creditLimit ?? 5000000)} onChange={(e) => setField('creditLimit', Number(e.target.value))} min={0} step={100000} />
            </FormField>
            <FormField label="Status">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={Boolean(form.isActive ?? true)} onChange={(e) => setField('isActive', e.target.checked)} />
                Active
              </label>
            </FormField>
          </>
        )
      case 'contact':
        return (
          <>
            <FormField label="Linked Customer *">
              <Select
                value={String(form.customerId ?? drawerDefaults?.customerId ?? '')}
                onChange={(e) => setField('customerId', e.target.value)}
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customerName}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Contact Name *">
              <Input value={String(form.contactName ?? '')} onChange={(e) => setField('contactName', e.target.value)} />
            </FormField>
            <FormField label="Designation">
              <Select value={String(form.designation ?? '')} onChange={(e) => setField('designation', e.target.value)}>
                <option value="">— Select —</option>
                {designationOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Mobile">
              <MobileInput value={String(form.mobile ?? '')} onChange={(e) => setField('mobile', e.target.value)} placeholder="10-digit mobile" />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={String(form.email ?? '')} onChange={(e) => setField('email', e.target.value)} />
            </FormField>
            <FormField label="Department">
              <Select value={String(form.department ?? '')} onChange={(e) => setField('department', e.target.value)}>
                <option value="">— Select —</option>
                {departmentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
          </>
        )
      case 'vendor':
        return (
          <>
            <FormField label="Vendor Name *">
              <Input value={String(form.vendorName ?? '')} onChange={(e) => setField('vendorName', e.target.value)} />
            </FormField>
            <FormField label="Vendor Type">
              <Select value={String(form.vendorType ?? 'trader')} onChange={(e) => setField('vendorType', e.target.value)}>
                <option value="manufacturer">Manufacturer</option>
                <option value="trader">Trader</option>
                <option value="service">Service</option>
              </Select>
            </FormField>
            <FormField label="Contact Person">
              <Input value={String(form.contactPerson ?? '')} onChange={(e) => setField('contactPerson', e.target.value)} />
            </FormField>
            <FormField label="Mobile">
              <MobileInput value={String(form.mobile ?? '')} onChange={(e) => setField('mobile', e.target.value)} placeholder="10-digit mobile" />
            </FormField>
            <FormField label="Email">
              <Input value={String(form.email ?? '')} onChange={(e) => setField('email', e.target.value)} />
            </FormField>
            <FormField label="GST No">
              <Input value={String(form.gstin ?? '')} onChange={(e) => setField('gstin', e.target.value)} maxLength={15} />
            </FormField>
            <FormField label="State">
              <StateSelect
                value={String(form.state ?? '')}
                onChange={(v) => {
                  setField('state', v)
                  setField('city', '')
                }}
              />
            </FormField>
            <FormField label="City">
              <CitySelect
                stateName={String(form.state ?? '')}
                value={String(form.city ?? '')}
                onChange={(v) => setField('city', v)}
              />
            </FormField>
            <FormField label="Payment Terms">
              <Select
                value={String(form.paymentTermName ?? '')}
                onChange={(e) => {
                  const term = paymentTerms.find((t) => t.name === e.target.value)
                  setField('paymentTermName', e.target.value)
                  const daysAttr = term
                    ? Number(useCrmMasterStore.getState().getEntry(term.id)?.attributes?.creditDays)
                    : NaN
                  if (Number.isFinite(daysAttr) && daysAttr >= 0) setField('paymentTermsDays', daysAttr)
                  else if (term?.code === 'NET30' || /30/.test(term?.code ?? '')) setField('paymentTermsDays', 30)
                  else if (term?.code === 'NET45' || /45/.test(term?.code ?? '')) setField('paymentTermsDays', 45)
                }}
              >
                <option value="">— Select payment term —</option>
                {paymentTerms.map((t) => (
                  <option key={t.id} value={t.name}>{t.code} — {t.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Lead Time (days)">
              <Input type="number" value={String(form.defaultLeadTimeDays ?? 14)} onChange={(e) => setField('defaultLeadTimeDays', e.target.value)} />
            </FormField>
            <FormField label="Status">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={Boolean(form.isActive ?? true)} onChange={(e) => setField('isActive', e.target.checked)} />
                Active
              </label>
            </FormField>
          </>
        )
      case 'item':
        return (
          <>
            <FormField label="Item Code *">
              <Input value={String(form.itemCode ?? '')} onChange={(e) => setField('itemCode', e.target.value)} />
            </FormField>
            <FormField label="Item Name *">
              <Input value={String(form.itemName ?? '')} onChange={(e) => setField('itemName', e.target.value)} />
            </FormField>
            <FormField label="Category *">
              <Select value={String(form.categoryId ?? categories[0]?.id ?? '')} onChange={(e) => setField('categoryId', e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
              </Select>
            </FormField>
            <FormField label="UOM *">
              <Select value={String(form.baseUomId ?? uoms[0]?.id ?? '')} onChange={(e) => setField('baseUomId', e.target.value)}>
                {uoms.map((u) => <option key={u.id} value={u.id}>{u.uomCode}</option>)}
              </Select>
            </FormField>
            <FormField label="Item Type">
              <Select value={String(form.itemType ?? 'bought_out')} onChange={(e) => setField('itemType', e.target.value)}>
                <option value="raw">Raw</option>
                <option value="bought_out">Bought Out</option>
                <option value="consumable">Consumable</option>
                <option value="sub_assembly">Sub Assembly</option>
              </Select>
            </FormField>
            <FormField label="Preferred Vendor">
              <Select value={String(form.preferredVendorId ?? '')} onChange={(e) => setField('preferredVendorId', e.target.value)}>
                <option value="">— None —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
              </Select>
            </FormField>
            <FormField label="Standard Cost">
              <Input type="number" value={String(form.standardCost ?? 0)} onChange={(e) => setField('standardCost', e.target.value)} />
            </FormField>
            <div className="col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(form.isStockable ?? true)} onChange={(e) => setField('isStockable', e.target.checked)} /> Stockable</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(form.isPurchasable ?? true)} onChange={(e) => setField('isPurchasable', e.target.checked)} /> Purchase Item</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(form.isActive ?? true)} onChange={(e) => setField('isActive', e.target.checked)} /> Active</label>
            </div>
          </>
        )
      case 'product':
        return (
          <>
            <FormField label="Product Code">
              <Input value={String(form.productCode ?? '')} onChange={(e) => setField('productCode', e.target.value)} placeholder="Auto-generated if blank" />
            </FormField>
            <FormField label="Product Name *">
              <Input value={String(form.productName ?? '')} onChange={(e) => setField('productName', e.target.value)} />
            </FormField>
            <FormField label="Product Family">
              <Select value={String(form.productFamily ?? 'bulker_trailer')} onChange={(e) => setField('productFamily', e.target.value)}>
                {(Object.keys(PRODUCT_FAMILY_LABELS) as ProductFamily[]).map((f) => (
                  <option key={f} value={f}>{PRODUCT_FAMILY_LABELS[f]}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Capacity">
              <Input value={String(form.capacity ?? '')} onChange={(e) => setField('capacity', e.target.value)} placeholder="45 m³" />
            </FormField>
            <FormField label="FG Item Link *">
              <Select value={String(form.fgItemId ?? '')} onChange={(e) => setField('fgItemId', e.target.value)}>
                <option value="">— Select FG item —</option>
                {fgItems.map((i) => <option key={i.id} value={i.id}>{i.itemCode} · {i.itemName}</option>)}
              </Select>
            </FormField>
            <p className="col-span-2 text-xs text-amber-800">
              Product created from sales starts as Draft. Engineering release required before MRP/Production.
            </p>
          </>
        )
      case 'paymentTerms':
      case 'taxCategory':
      case 'deliveryTerms':
        return (
          <>
            <FormField label="Code">
              <Input value={String(form.code ?? '')} onChange={(e) => setField('code', e.target.value)} placeholder="Auto if blank" />
            </FormField>
            <FormField label="Name *">
              <Input value={String(form.name ?? '')} onChange={(e) => setField('name', e.target.value)} />
            </FormField>
            <FormField label="Description" className="md:col-span-2">
              <Textarea value={String(form.description ?? '')} onChange={(e) => setField('description', e.target.value)} rows={2} />
            </FormField>
          </>
        )
      case 'transporter':
        return (
          <>
            <FormField label="Transporter Name *">
              <Input value={String(form.transporterName ?? '')} onChange={(e) => setField('transporterName', e.target.value)} />
            </FormField>
            <FormField label="Contact Person">
              <Input value={String(form.contactPerson ?? '')} onChange={(e) => setField('contactPerson', e.target.value)} />
            </FormField>
            <FormField label="Mobile">
              <MobileInput value={String(form.mobile ?? '')} onChange={(e) => setField('mobile', e.target.value)} placeholder="10-digit mobile" />
            </FormField>
            <FormField label="Vehicle Type">
              <MasterEnumSelect
                value={String(form.vehicleType ?? '')}
                onChange={(v) => setField('vehicleType', v)}
                options={VEHICLE_TYPE_OPTIONS}
                placeholder="— Select vehicle type —"
              />
            </FormField>
            <FormField label="GST No">
              <Input value={String(form.gstin ?? '')} onChange={(e) => setField('gstin', e.target.value)} />
            </FormField>
            <FormField label="State">
              <StateSelect
                value={String(form.state ?? '')}
                onChange={(v) => {
                  setField('state', v)
                  setField('city', '')
                }}
              />
            </FormField>
            <FormField label="City">
              <CitySelect
                stateName={String(form.state ?? '')}
                value={String(form.city ?? '')}
                onChange={(v) => setField('city', v)}
              />
            </FormField>
          </>
        )
      case 'inspectionPlan':
        return (
          <>
            <FormField label="Plan Code">
              <Input value={String(form.planCode ?? '')} onChange={(e) => setField('planCode', e.target.value)} placeholder="Auto if blank" />
            </FormField>
            <FormField label="Plan Name *">
              <Input value={String(form.planName ?? '')} onChange={(e) => setField('planName', e.target.value)} />
            </FormField>
            <FormField label="Category">
              <Select value={String(form.category ?? drawerDefaults?.category ?? 'final')} onChange={(e) => setField('category', e.target.value)}>
                <option value="incoming">Incoming</option>
                <option value="in_process">In Process</option>
                <option value="final">Final</option>
                <option value="subcontract_return">Subcontract Return</option>
              </Select>
            </FormField>
            <FormField label="Operation Name">
              <Input value={String(form.operationName ?? drawerDefaults?.operationName ?? '')} onChange={(e) => setField('operationName', e.target.value)} />
            </FormField>
          </>
        )
      default:
        return null
    }
  }

  return (
    <>
      <Toast message={toast} />
      <ErpDrawerFormShell
        onSubmit={handleSubmit}
        isSubmitting={submitting}
        onCancel={closeDrawer}
        validationErrors={error ? [error] : undefined}
        footerLink={
          link
            ? {
                href: link,
                label: 'Open full master form →',
                onClick: () => closeDrawer(),
              }
            : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">{renderFields()}</div>
      </ErpDrawerFormShell>
    </>
  )
}
