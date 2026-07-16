import { useMemo } from 'react'
import { usePurchaseMasterStore } from '../store/purchaseMasterStore'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { buildCommercialTermText } from '../utils/quotationTermUtils'
import type { PurchaseCommercialTermKind, PurchaseMasterKind } from '../types/purchaseMasters'
import type { QuotationCommercialTermKind } from '../utils/quotationTermUtils'

export function usePurchaseMasterOptions(kind: PurchaseMasterKind) {
  const entries = usePurchaseMasterStore((s) => s.getByKind(kind, true))
  return useMemo(
    () => entries.map((e) => ({
      value: e.code,
      label: e.name,
      text: e.name,
      attributes: e.attributes,
    })),
    [entries],
  )
}

function useCrmCommercialTermOptions(kind: QuotationCommercialTermKind) {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => {
    return useCrmMasterStore.getState()
      .getByKind(kind, true)
      .map((e) => ({
        value: e.code,
        label: e.name,
        text: buildCommercialTermText(kind, e.code),
        attributes: e.attributes,
      }))
  }, [entries, kind])
}

export function usePurchaseCommercialTermOptions(kind: PurchaseCommercialTermKind) {
  const freightOptions = usePurchaseMasterOptions('freight-terms')
  const paymentOptions = useCrmCommercialTermOptions('payment-terms')
  const deliveryOptions = useCrmCommercialTermOptions('delivery-terms')

  if (kind === 'payment-terms') return paymentOptions
  if (kind === 'delivery-terms') return deliveryOptions
  return freightOptions
}

export function usePaymentTermOptions() {
  return useCrmCommercialTermOptions('payment-terms')
}

export function useDeliveryTermOptions() {
  return useCrmCommercialTermOptions('delivery-terms')
}

export function useFreightTermOptions() {
  return usePurchaseMasterOptions('freight-terms')
}

export function useBuyerOptions() {
  return usePurchaseMasterOptions('buyers')
}

export function useReturnReasonOptions() {
  return usePurchaseMasterOptions('return-reasons')
}

export function resolvePurchaseMasterLabel(kind: PurchaseMasterKind, code: string): string {
  return usePurchaseMasterStore.getState().getLabel(kind, code)
}

export function resolvePaymentTermText(code: string): string {
  return buildCommercialTermText('payment-terms', code)
}

export function resolveDeliveryTermText(code: string): string {
  return buildCommercialTermText('delivery-terms', code)
}
