import { Link } from 'react-router-dom'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { Button } from '../ui/Button'

interface QcPlanMissingBlockerProps {
  operationName?: string
  productId?: string
  itemId?: string
  className?: string
}

export function QcPlanMissingBlocker({
  operationName,
  productId,
  itemId,
  className,
}: QcPlanMissingBlockerProps) {
  const { createInspectionPlan, canCreate, getDenialReason } = useQuickCreate()
  const allowed = canCreate('inspectionPlan')

  return (
    <div className={`rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ${className ?? ''}`}>
      <p className="font-medium">No inspection plan found for this operation.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() =>
            createInspectionPlan({
              defaultValues: { operationName, productId, itemId, category: 'final' },
              onCreated: () => {},
            })
          }
          disabled={!allowed}
          title={!allowed ? getDenialReason('inspectionPlan') : undefined}
        >
          Create Inspection Plan
        </Button>
        <Link to="/quality/masters/inspection-plans">
          <Button type="button" size="sm" variant="secondary">Open QC Plan Master</Button>
        </Link>
        <Link to="/quality/masters/inspection-plans">
          <Button type="button" size="sm" variant="secondary">Select Existing Plan</Button>
        </Link>
      </div>
      {!allowed && (
        <p className="mt-2 text-xs text-amber-800">{getDenialReason('inspectionPlan')}</p>
      )}
    </div>
  )
}
