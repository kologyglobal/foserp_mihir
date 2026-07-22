import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  createQualityInspection,
  getGRNById,
  PurchaseServiceError,
} from '@/services/purchase'
import { notify } from '@/store/toastStore'

/** Creates a QI from `?grnId=` then redirects to the detail page (API + demo). */
export function QualityInspectionCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const grnId = searchParams.get('grnId') ?? ''
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!grnId) {
      setError('Missing goods receipt id (?grnId=).')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const grn = await getGRNById(grnId)
        if (!grn) {
          if (!cancelled) setError('Goods receipt not found.')
          return
        }
        if (!grn.inspectionRequired) {
          if (!cancelled) setError('This GRN does not require quality inspection.')
          return
        }
        const qcLine =
          grn.lines.find((l) => l.inspectionStatus === 'pending' || l.pendingInspectionQty > 0)
          ?? grn.lines[0]
        if (!qcLine) {
          if (!cancelled) setError('GRN has no lines to inspect.')
          return
        }
        const qi = await createQualityInspection({
          goodsReceiptId: grn.id,
          goodsReceiptLineId: qcLine.id,
          sampleQty: Math.min(5, qcLine.receivedQty || qcLine.pendingInspectionQty || 1),
        })
        if (!cancelled) {
          notify.success(`Inspection ${qi.documentNumber} created`)
          navigate(`/purchase/quality-inspections/${qi.id}`, { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PurchaseServiceError ? err.message : 'Failed to create inspection')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [grnId, navigate])

  if (error) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Cannot create inspection"
        description={error}
        action={
          <ErpButton variant="secondary" onClick={() => navigate('/purchase/quality-inspections')}>
            Back to register
          </ErpButton>
        }
      />
    )
  }

  return <LoadingState variant="form" rows={6} />
}
