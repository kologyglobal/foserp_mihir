import { useCallback, useMemo, useState } from 'react'
import { useCrmStore } from '../../../store/crmStore'
import { useMasterStore } from '../../../store/masterStore'
import { useSalesStore } from '../../../store/salesStore'
import {
  buildSoConversionPreview,
  validateQuotationForSoConversion,
  type QuotationSoValidationIssue,
} from '../../../utils/crmQuotationSoConversion'
import { convertQuotationToSalesOrder } from '../../../utils/convertQuotationToSalesOrder'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../../utils/opportunitySalesOrderDraft'
import { canConvertQuotationToSalesOrderPermission } from '../../../utils/permissions/crm'

export type QuotationConversionSuccess = {
  salesOrderId: string
  salesOrderNo: string
  alreadyConverted?: boolean
}

export function useQuotationConversion() {
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<QuotationConversionSuccess | null>(null)

  const doc = useCrmStore((s) => (documentId ? s.getQuotationDocument(documentId) : undefined))
  const latestDoc = useCrmStore((s) =>
    doc ? s.getLatestQuotationDocument(doc.quotationId) : undefined,
  )
  const salesQuotation = useSalesStore((s) =>
    doc ? s.getQuotation(doc.quotationId) : undefined,
  )
  const customer = useMasterStore((s) =>
    salesQuotation ? s.getCustomer(salesQuotation.customerId) : undefined,
  )
  const contact = useCrmStore((s) => (doc?.contactId ? s.getContact(doc.contactId) : undefined))
  const opportunity = useCrmStore((s) =>
    doc?.opportunityId ? s.getOpportunity(doc.opportunityId) : undefined,
  )
  const product = useMasterStore((s) =>
    salesQuotation?.productId ? s.getProduct(salesQuotation.productId) : undefined,
  )

  const gate = useMemo(
    () => (documentId ? resolveCreateSalesOrderGateForQuotationDocument(documentId) : null),
    [documentId, doc?.status, doc?.salesOrderId, opportunity?.status],
  )

  const validation = useMemo(() => {
    if (!doc) return null
    return validateQuotationForSoConversion({
      document: doc,
      latestDocument: latestDoc,
      salesQuotation,
      customer,
      contactName: contact?.name,
      opportunityName: opportunity?.opportunityName,
      productName: product?.productName,
    })
  }, [doc, latestDoc, salesQuotation, customer, contact, opportunity, product])

  const preview = useMemo(() => {
    if (!doc) return null
    return buildSoConversionPreview({
      document: doc,
      latestDocument: latestDoc,
      salesQuotation,
      customer,
      contactName: contact?.name,
      opportunityName: opportunity?.opportunityName,
      productName: product?.productName,
    })
  }, [doc, latestDoc, salesQuotation, customer, contact, opportunity, product])

  const warnings: QuotationSoValidationIssue[] = useMemo(
    () => (validation?.issues.filter((i) => !i.blocking) ?? []),
    [validation],
  )

  const openConversionModal = useCallback((docId: string) => {
    setDocumentId(docId)
    setConversionError(null)
    setSuccess(null)
    setIsConverting(false)
  }, [])

  const closeConversionModal = useCallback(() => {
    if (isConverting) return
    setDocumentId(null)
    setConversionError(null)
  }, [isConverting])

  const dismissConversion = useCallback(() => {
    if (isConverting) return
    setDocumentId(null)
    setConversionError(null)
    setSuccess(null)
  }, [isConverting])

  const confirmConversion = useCallback(async () => {
    if (!documentId || isConverting) return null
    if (!canConvertQuotationToSalesOrderPermission()) {
      setConversionError('You do not have permission to convert quotations to sales orders.')
      return null
    }
    setIsConverting(true)
    setConversionError(null)
    try {
      const result = await convertQuotationToSalesOrder(documentId)
      if (!result.ok) {
        if (result.alreadyConverted && result.salesOrderId) {
          setSuccess({
            salesOrderId: result.salesOrderId,
            salesOrderNo: result.salesOrderNo ?? 'SO',
            alreadyConverted: true,
          })
          return result
        }
        setConversionError(result.error ?? 'Conversion failed')
        return result
      }
      if (result.salesOrderId) {
        setSuccess({
          salesOrderId: result.salesOrderId,
          salesOrderNo: result.salesOrderNo ?? 'SO',
          alreadyConverted: result.alreadyConverted,
        })
      }
      return result
    } catch (err) {
      setConversionError(err instanceof Error ? err.message : 'Conversion failed')
      return { ok: false as const, error: 'Conversion failed' }
    } finally {
      setIsConverting(false)
    }
  }, [documentId, isConverting])

  return {
    openConversionModal,
    closeConversionModal,
    dismissConversion,
    confirmConversion,
    isConverting,
    conversionError,
    isOpen: Boolean(documentId),
    documentId,
    preview,
    warnings,
    validation,
    gate,
    success,
    clearSuccess: () => setSuccess(null),
    canConvert: Boolean(gate?.enabled && canConvertQuotationToSalesOrderPermission()),
  }
}
