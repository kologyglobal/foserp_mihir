import { useCallback } from 'react'
import { useUIStore, isQuickCreateDrawer } from '../store/uiStore'
import type { QuickCreateContext, QuickCreateEntityType, QuickCreateResult } from '../types/quickCreate'
import { QUICK_CREATE_TITLES } from '../types/quickCreate'
import {
  canQuickCreateEntity,
  getQuickCreateDenialReason,
} from '../utils/quickCreatePermissions'
import { saveQuickCreateEntity } from '../utils/quickCreateService'

let pendingOnCreated: ((result: QuickCreateResult) => void) | null = null

export function useQuickCreate() {
  const rawDrawer = useUIStore((s) => s.drawer)
  const drawer = rawDrawer && isQuickCreateDrawer(rawDrawer) ? rawDrawer : null
  const openDrawerStore = useUIStore((s) => s.openDrawer)
  const closeDrawerStore = useUIStore((s) => s.closeDrawer)

  const openDrawer = useCallback(
    (
      entityType: QuickCreateEntityType,
      context?: Omit<QuickCreateContext, 'entityType' | 'title'> & {
        title?: string
        onCreated?: (result: QuickCreateResult) => void
      },
    ) => {
      const { onCreated, title, ...rest } = context ?? {}
      pendingOnCreated = onCreated ?? null
      openDrawerStore(entityType, title ?? QUICK_CREATE_TITLES[entityType], rest)
    },
    [openDrawerStore],
  )

  const autoSelectCreatedRecord = useCallback((result: QuickCreateResult) => {
    pendingOnCreated?.(result)
    pendingOnCreated = null
    closeDrawerStore()
  }, [closeDrawerStore])

  const saveEntity = useCallback(
    (data: Record<string, unknown>) => {
      if (!drawer) {
        return { ok: false as const, error: 'No quick-create drawer open' }
      }
      const result = saveQuickCreateEntity(drawer.entityType, data, {
        ...drawer.defaultValues,
        customerId: drawer.defaultValues?.customerId,
      })
      if (result.ok) {
        autoSelectCreatedRecord(result.result)
      }
      return result
    },
    [drawer, autoSelectCreatedRecord],
  )

  const closeDrawer = useCallback(() => {
    pendingOnCreated = null
    closeDrawerStore()
  }, [closeDrawerStore])

  const canCreate = useCallback(
    (entityType: QuickCreateEntityType) => canQuickCreateEntity(entityType),
    [],
  )

  const getDenialReason = useCallback(
    (entityType: QuickCreateEntityType) => getQuickCreateDenialReason(entityType),
    [],
  )

  return {
    drawer,
    isOpen: Boolean(drawer),
    openDrawer,
    closeDrawer,
    saveEntity,
    autoSelectCreatedRecord,
    canCreate,
    getDenialReason,
    createCustomer: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('customer', ctx),
    createContact: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('contact', ctx),
    createVendor: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('vendor', ctx),
    createItem: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('item', ctx),
    createProduct: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('product', ctx),
    createTransporter: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('transporter', ctx),
    createPaymentTerms: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('paymentTerms', ctx),
    createTaxCategory: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('taxCategory', ctx),
    createDeliveryTerms: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('deliveryTerms', ctx),
    createInspectionPlan: (ctx?: Parameters<typeof openDrawer>[1]) => openDrawer('inspectionPlan', ctx),
    createPo: () => openDrawerStore('po', 'Create Purchase Order'),
    createWo: () => openDrawerStore('wo', 'Create Work Order'),
  }
}
