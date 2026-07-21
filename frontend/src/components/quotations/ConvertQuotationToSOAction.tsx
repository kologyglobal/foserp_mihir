import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, ExternalLink } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import { ErpButton } from '../erp/ErpButton'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../utils/opportunitySalesOrderDraft'
import { isCrmPath, resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'

interface ConvertQuotationToSOActionProps {
  documentId: string
  className?: string
  variant?: 'button' | 'inline' | 'card-action'
  showHandoverNote?: boolean
  /** Prefer opening shared conversion confirmation modal. */
  onConvert?: (documentId: string) => void
}

/** Quotation → sales order — opens shared conversion dialog when onConvert provided. */
export function ConvertQuotationToSOAction({
  documentId,
  className,
  variant = 'button',
  showHandoverNote = false,
  onConvert,
}: ConvertQuotationToSOActionProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const fromCrm = isCrmPath(pathname)
  const doc = useCrmStore((s) => s.getQuotationDocument(documentId))

  const gate = useMemo(
    () => resolveCreateSalesOrderGateForQuotationDocument(documentId),
    [documentId, doc?.status, doc?.salesOrderId],
  )

  if (!doc) return null

  const size = variant === 'card-action' ? 'sm' : 'md'
  const salesOrderId = gate.salesOrderId ?? doc.salesOrderId ?? null

  if (salesOrderId) {
    return (
      <ErpButton
        variant="primary"
        size={size}
        icon={ExternalLink}
        className={className}
        onClick={() => navigate(resolveSalesOrderDetailPath(salesOrderId, fromCrm))}
      >
        View Sales Order
      </ErpButton>
    )
  }

  if (variant === 'inline' && !doc.opportunityId) {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ''}`}>
        {gate.disabledReason ?? 'Link this quotation to an opportunity to create a sales order.'}
      </p>
    )
  }

  if (!gate.showCreate && !doc.opportunityId) return null

  return (
    <>
      {showHandoverNote ? (
        <p className={gate.enabled ? 'mb-2 text-[12px] text-emerald-700' : 'mb-2 text-[12px] text-erp-muted'}>
          {gate.enabled
            ? 'Customer-approved quotation ready — convert to an Open sales order.'
            : (gate.disabledReason ?? 'Complete Send → Customer Approve before converting.')}
        </p>
      ) : null}
      <ErpButton
        variant={gate.enabled ? 'primary' : 'secondary'}
        size={size}
        icon={ShoppingCart}
        className={className}
        disabled={!gate.enabled}
        disabledReason={gate.disabledReason ?? undefined}
        onClick={() => {
          if (!gate.enabled) return
          if (onConvert) {
            onConvert(documentId)
            return
          }
        }}
      >
        Convert to Sales Order
      </ErpButton>
    </>
  )
}

/** @deprecated Prefer useQuotationConversion + QuotationConversionDialog */
export function ConvertQuotationToSOModal({
  documentId,
  open,
  onClose,
  onConvert,
}: {
  documentId: string
  open: boolean
  onClose: () => void
  onConvert?: (documentId: string) => void
}) {
  if (!open) return null
  onConvert?.(documentId)
  onClose()
  return null
}
