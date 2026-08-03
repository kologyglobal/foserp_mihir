import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { hrStatusLabel, hrStatusTone, type HrStatusDomain } from './hrStatusLabels'

interface HrStatusChipProps {
  status: string | null | undefined
  domain?: HrStatusDomain
  className?: string
}

/** HR-flavoured wrapper around DynamicsStatusChip — resolves label + tone from the status code. */
export function HrStatusChip({ status, domain = 'employee' }: HrStatusChipProps) {
  return <DynamicsStatusChip label={hrStatusLabel(status, domain)} tone={hrStatusTone(status, domain)} />
}
