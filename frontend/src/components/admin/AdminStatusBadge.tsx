import { Badge } from '../ui/Badge'
import type { AdminTenantStatus, AdminUserStatus } from '../../types/admin'

const USER_COLOR: Record<AdminUserStatus, 'green' | 'gray' | 'yellow' | 'red' | 'blue'> = {
  ACTIVE: 'green',
  INVITED: 'yellow',
  INACTIVE: 'gray',
  BLOCKED: 'red',
  ARCHIVED: 'gray',
}

const TENANT_COLOR: Record<AdminTenantStatus, 'green' | 'gray' | 'yellow' | 'red' | 'blue'> = {
  ACTIVE: 'green',
  TRIAL: 'blue',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
  ARCHIVED: 'gray',
}

export function AdminUserStatusBadge({ status }: { status: AdminUserStatus }) {
  return <Badge color={USER_COLOR[status]}>{status.replace(/_/g, ' ')}</Badge>
}

export function AdminTenantStatusBadge({ status }: { status: AdminTenantStatus }) {
  return <Badge color={TENANT_COLOR[status]}>{status.replace(/_/g, ' ')}</Badge>
}

export function AdminRoleTypeBadge({ isSystem }: { isSystem: boolean }) {
  return <Badge color={isSystem ? 'blue' : 'gray'}>{isSystem ? 'System' : 'Custom'}</Badge>
}

export function AdminSensitivePermissionBadge() {
  return <Badge color="red">Sensitive</Badge>
}

export function AdminRoleAccessBadge({
  label,
  tone = 'blue',
}: {
  label: string
  tone?: 'blue' | 'green' | 'gray' | 'yellow' | 'red'
}) {
  return <Badge color={tone}>{label}</Badge>
}
