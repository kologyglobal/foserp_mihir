import { Badge } from '../ui/Badge'
import type { DocumentHealth } from './types'

const LABELS: Record<DocumentHealth, string> = {
  healthy: 'Healthy',
  at_risk: 'At Risk',
  blocked: 'Blocked',
  critical: 'Critical',
}

const COLORS: Record<DocumentHealth, 'green' | 'yellow' | 'orange' | 'red'> = {
  healthy: 'green',
  at_risk: 'yellow',
  blocked: 'orange',
  critical: 'red',
}

export function DocumentHealthBadge({ health, title }: { health: DocumentHealth; title?: string }) {
  return (
    <span title={title}>
      <Badge color={COLORS[health]}>{LABELS[health]}</Badge>
    </span>
  )
}
