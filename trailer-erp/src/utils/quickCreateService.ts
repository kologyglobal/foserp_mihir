import type { QuickCreateEntityType, QuickCreateResult } from '../types/quickCreate'
import { useMasterStore } from '../store/masterStore'
import { useCrmStore } from '../store/crmStore'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { useQualityStore } from '../store/qualityStore'
import { canQuickCreateEntity, quickCreateStartsPendingApproval } from './quickCreatePermissions'
import type { CustomerType, ItemType, SalesTerritory, VendorType } from '../types/master'
import { panFromGstin } from './customerUtils'
import { reserveCode, confirmCode } from '../services/codeSeriesService'
import { isApiMode } from '../config/apiConfig'
import { sanitizePhoneDigits } from './phoneValidation'
import { crmKindForCommercialTermType, getCommercialTermById } from './commercialTermsAdapter'

function phone(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = data[key]
    if (raw != null && String(raw).trim()) return sanitizePhoneDigits(String(raw))
  }
  return ''
}

function genCode(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`
}

function duplicateCustomer(data: { customerCode?: string; customerName?: string; gstin?: string }) {
  const customers = useMasterStore.getState().customers
  if (data.customerCode && customers.some((c) => c.customerCode.toLowerCase() === data.customerCode!.toLowerCase())) {
    return 'Customer code already exists'
  }
  if (data.gstin && customers.some((c) => c.gstin && c.gstin.toLowerCase() === data.gstin!.toLowerCase())) {
    return 'GST number already registered to another customer'
  }
  if (data.customerName && customers.some((c) => c.customerName.toLowerCase() === data.customerName!.toLowerCase())) {
    return 'Customer name already exists'
  }
  return null
}

function duplicateVendor(data: { vendorCode?: string; vendorName?: string; gstin?: string }) {
  const vendors = useMasterStore.getState().vendors
  if (data.vendorCode && vendors.some((v) => v.vendorCode.toLowerCase() === data.vendorCode!.toLowerCase())) {
    return 'Vendor code already exists'
  }
  if (data.gstin && vendors.some((v) => v.gstin && v.gstin.toLowerCase() === data.gstin!.toLowerCase())) {
    return 'GST number already registered to another vendor'
  }
  if (data.vendorName && vendors.some((v) => v.vendorName.toLowerCase() === data.vendorName!.toLowerCase())) {
    return 'Vendor name already exists'
  }
  return null
}

function duplicateItem(data: { itemCode?: string }) {
  if (!data.itemCode) return null
  const items = useMasterStore.getState().items
  if (items.some((i) => i.itemCode.toLowerCase() === data.itemCode!.toLowerCase())) {
    return 'Item code already exists'
  }
  return null
}

function duplicateProduct(data: { productCode?: string }) {
  if (!data.productCode) return null
  const products = useMasterStore.getState().products
  if (products.some((p) => p.productCode.toLowerCase() === data.productCode!.toLowerCase())) {
    return 'Product code already exists'
  }
  return null
}

function duplicateCrmCommercialTerm(kind: 'payment-terms' | 'delivery-terms', code: string, name: string) {
  const entries = useCrmMasterStore.getState().getByKind(kind, false)
  if (entries.some((t) => t.code.toLowerCase() === code.toLowerCase())) {
    return 'Term code already exists'
  }
  if (entries.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    return 'Term name already exists'
  }
  return null
}

function str(v: unknown, fallback = '') {
  return typeof v === 'string' ? v.trim() : fallback
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function bool(v: unknown, fallback = true) {
  if (typeof v === 'boolean') return v
  if (v === 'false' || v === '0') return false
  return fallback
}

export function saveQuickCreateEntity(
  entityType: QuickCreateEntityType,
  data: Record<string, unknown>,
  context?: Record<string, unknown>,
): { ok: true; result: QuickCreateResult } | { ok: false; error: string } {
  if (!canQuickCreateEntity(entityType)) {
    return { ok: false, error: 'You do not have permission to create this record' }
  }
  if (isApiMode()) {
    return { ok: false, error: 'Quick create is unavailable in API mode. Use the full CRM form.' }
  }

  const master = useMasterStore.getState()

  switch (entityType) {
    case 'customer': {
      const customerName = str(data.customerName)
      if (!customerName) return { ok: false, error: 'Customer name is required' }
      const customerCode = str(data.customerCode) || genCode('CUST')
      const gstin = str(data.gstin)
      const dup = duplicateCustomer({ customerCode, customerName, gstin })
      if (dup) return { ok: false, error: dup }
      const id = master.addCustomer({
        customerCode,
        customerName,
        customerType: (str(data.customerType) || 'corporate') as CustomerType,
        industry: str(data.industry) || undefined,
        addressLine1: str(data.billingAddress) || str(data.addressLine1) || '—',
        addressLine2: str(data.addressLine2) || undefined,
        shippingAddress: str(data.shippingAddress) || undefined,
        shippingAddressLine2: str(data.shippingAddressLine2) || undefined,
        shippingCity: str(data.shippingCity) || undefined,
        shippingState: str(data.shippingState) || undefined,
        shippingPincode: str(data.shippingPincode) || undefined,
        shippingCountry: str(data.shippingCountry) || undefined,
        city: str(data.city) || '—',
        state: str(data.state) || 'Maharashtra',
        pincode: str(data.pincode) || '000000',
        country: str(data.country) || undefined,
        gstin: gstin || '00AAAAA0000A1Z5',
        pan: str(data.pan) || panFromGstin(gstin) || undefined,
        contactPerson: str(data.contactPerson),
        contactPhone: phone(data, 'mobile', 'contactPhone'),
        contactEmail: str(data.email) || str(data.contactEmail),
        creditDays: num(data.creditDays, 30),
        creditLimit: num(data.creditLimit, 0),
        salesTerritory: (str(data.salesTerritory) || 'West') as SalesTerritory,
        isActive: bool(data.isActive, true),
      }) as string
      return { ok: true, result: { entityType, id, label: customerName, record: master.getCustomer(id) } }
    }
    case 'contact': {
      const customerId = str(data.customerId) || str(context?.customerId)
      if (!customerId) return { ok: false, error: 'Linked customer is required' }
      const contactName = str(data.contactName)
      if (!contactName) return { ok: false, error: 'Contact name is required' }
      let contactCode = ''
      try {
        contactCode = reserveCode('contact')
      } catch {
        return { ok: false, error: 'Code Series is not configured for contacts' }
      }
      const crmResult = useCrmStore.getState().createContact({
        contactCode,
        customerId,
        name: contactName,
        designation: str(data.designation),
        department: str(data.department),
        email: str(data.email),
        phone: phone(data, 'mobile', 'phone'),
        isPrimary: false,
        isActive: bool(data.isActive, true),
      }) as { ok: boolean; error?: string; contactId?: string }
      if (!crmResult.ok) return { ok: false, error: crmResult.error ?? 'Could not create contact' }
      confirmCode('contact', contactCode)
      const contact = useCrmStore.getState().getContact(crmResult.contactId!)
      return {
        ok: true,
        result: {
          entityType,
          id: crmResult.contactId!,
          label: contactName,
          record: contact,
        },
      }
    }
    case 'vendor': {
      const vendorName = str(data.vendorName)
      if (!vendorName) return { ok: false, error: 'Vendor name is required' }
      const vendorCode = str(data.vendorCode) || genCode('VEND')
      const gstin = str(data.gstin)
      const dup = duplicateVendor({ vendorCode, vendorName, gstin })
      if (dup) return { ok: false, error: dup }
      const pending = quickCreateStartsPendingApproval('vendor')
      const id = master.addVendor({
        vendorCode,
        vendorName,
        vendorType: (str(data.vendorType) || 'trader') as VendorType,
        city: str(data.city) || '—',
        state: str(data.state) || 'Maharashtra',
        gstin: gstin || '00BBBBB0000B1Z5',
        contactPerson: str(data.contactPerson),
        contactPhone: phone(data, 'mobile', 'contactPhone'),
        paymentTermsDays: num(data.paymentTermsDays, num(data.paymentTerms, 30)),
        defaultLeadTimeDays: num(data.defaultLeadTimeDays, num(data.leadTime, 14)),
        suppliedCategories: [],
        rating: 4,
        isActive: pending ? false : bool(data.isActive, true),
      }) as string
      return {
        ok: true,
        result: {
          entityType,
          id,
          label: vendorName,
          record: master.getVendor(id),
        },
      }
    }
    case 'item': {
      const itemCode = str(data.itemCode)
      const itemName = str(data.itemName)
      if (!itemCode) return { ok: false, error: 'Item code is required' }
      if (!itemName) return { ok: false, error: 'Item name is required' }
      const dup = duplicateItem({ itemCode })
      if (dup) return { ok: false, error: dup }
      const categories = master.categories.filter((c) => c.isActive)
      const uoms = master.uoms.filter((u) => u.isActive)
      const categoryId = str(data.categoryId) || categories[0]?.id
      const baseUomId = str(data.baseUomId) || uoms[0]?.id
      if (!categoryId || !baseUomId) return { ok: false, error: 'Category and UOM are required' }
      const pending = quickCreateStartsPendingApproval('item')
      const id = master.addItem({
        itemCode,
        itemName,
        itemDescription: str(data.itemDescription) || itemName,
        categoryId,
        baseUomId,
        itemType: (str(data.itemType) || 'bought_out') as ItemType,
        materialGrade: str(data.materialGrade),
        hsnCode: str(data.hsnCode) || '0000',
        reorderLevel: 0,
        reorderQty: 0,
        standardRate: num(data.standardCost, num(data.standardRate, 0)),
        isPurchasable: bool(data.isPurchasable, true),
        isStockable: bool(data.isStockable, true),
        isActive: pending ? false : bool(data.isActive, true),
        subAssemblyRule: null,
      }) as string
      const preferredVendorId = str(data.preferredVendorId)
      if (preferredVendorId) {
        master.addItemVendorMap({
          itemId: id,
          vendorId: preferredVendorId,
          isPreferred: true,
          leadTimeDays: 14,
          lastRate: num(data.standardCost, 0),
        })
      }
      return { ok: true, result: { entityType, id, label: `${itemCode} · ${itemName}`, record: master.getItem(id) } }
    }
    case 'product': {
      const productCode = str(data.productCode) || genCode('PROD')
      const productName = str(data.productName)
      if (!productName) return { ok: false, error: 'Product name is required' }
      const dup = duplicateProduct({ productCode })
      if (dup) return { ok: false, error: dup }
      const fgItemId = str(data.fgItemId)
      if (!fgItemId) return { ok: false, error: 'FG item link is required' }
      const uoms = master.uoms.filter((u) => u.isActive)
      const id = master.addProduct({
        productCode,
        productName,
        productFamily: (str(data.productFamily) || 'bulker_trailer') as import('../types/productMaster').ProductFamily,
        productType: 'bulker',
        fgItemId,
        capacity: str(data.capacity) || '—',
        axleConfig: '—',
        tareWeightKg: 0,
        gvwKg: 0,
        standardPrice: 0,
        standardLeadDays: 45,
        baseUomId: uoms[0]?.id ?? '',
        hsnCode: '8716',
        specifications: '',
        isActive: false,
        status: 'draft',
      })
      return { ok: true, result: { entityType, id, label: `${productCode} · ${productName}`, record: master.getProduct(id) } }
    }
    case 'paymentTerms':
    case 'deliveryTerms': {
      const termType = entityType === 'paymentTerms' ? 'payment' : 'delivery'
      const kind = crmKindForCommercialTermType(termType)
      if (!kind || (kind !== 'payment-terms' && kind !== 'delivery-terms')) {
        return { ok: false, error: 'Unsupported commercial term type' }
      }
      const name = str(data.name)
      const code = str(data.code) || genCode(termType === 'payment' ? 'PAY' : 'DEL')
      if (!name) return { ok: false, error: 'Name is required' }
      const dup = duplicateCrmCommercialTerm(kind, code, name)
      if (dup) return { ok: false, error: dup }
      const created = useCrmMasterStore.getState().addEntry({
        kind,
        code,
        name,
        description: str(data.description) || undefined,
        status: bool(data.isActive, true) ? 'active' : 'inactive',
      })
      if (!created.ok || !created.id) return { ok: false, error: created.error ?? 'Failed to create term' }
      return {
        ok: true,
        result: {
          entityType,
          id: created.id,
          label: name,
          record: getCommercialTermById(created.id),
        },
      }
    }
    case 'taxCategory':
      return {
        ok: false,
        error: 'Tax categories are managed under GST Rate / GST Group masters — open Tax masters to create one.',
      }
    case 'transporter': {
      const transporterName = str(data.transporterName)
      if (!transporterName) return { ok: false, error: 'Transporter name is required' }
      if (master.transporters.some((t) => t.transporterName.toLowerCase() === transporterName.toLowerCase())) {
        return { ok: false, error: 'Transporter name already exists' }
      }
      const id = master.addTransporter({
        transporterName,
        contactPerson: str(data.contactPerson),
        mobile: phone(data, 'mobile'),
        vehicleType: str(data.vehicleType) || 'Trailer',
        gstin: str(data.gstin),
        city: str(data.city) || '—',
        isActive: bool(data.isActive, true),
      })
      return { ok: true, result: { entityType, id, label: transporterName, record: master.getTransporter(id) } }
    }
    case 'inspectionPlan': {
      const planName = str(data.planName)
      const planCode = str(data.planCode) || genCode('PLAN')
      if (!planName) return { ok: false, error: 'Plan name is required' }
      const r = useQualityStore.getState().addInspectionPlan({
        planCode,
        planName,
        category: (str(data.category) || 'final') as import('../types/quality').QcInspectionCategory,
        productId: str(data.productId) || null,
        itemId: str(data.itemId) || null,
        itemCategoryId: null,
        operationName: str(data.operationName) || null,
        workCenterId: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        status: 'draft',
        revision: 'A',
        lines: [],
      })
      if (!r.ok) return { ok: false, error: r.error ?? 'Failed to create inspection plan' }
      return { ok: true, result: { entityType, id: r.id!, label: planName } }
    }
    default:
      return { ok: false, error: 'Unsupported entity type' }
  }
}
