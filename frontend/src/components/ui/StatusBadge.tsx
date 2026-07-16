import { Badge, formatStatus, statusColor } from './Badge'

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge color={isActive ? 'green' : 'gray'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  )
}

export function TypeBadge({
  value,
  color = 'blue',
}: {
  value: string
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'gray'
}) {
  return (
    <Badge color={color}>{formatStatus(value.replace(/_/g, '-'))}</Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge color={statusColor(status.replace(/_/g, '-'))}>
      {formatStatus(status.replace(/_/g, '-'))}
    </Badge>
  )
}
