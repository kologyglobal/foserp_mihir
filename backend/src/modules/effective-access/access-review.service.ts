import { prisma } from '../../config/database.js'
import { isSensitivePermission } from './sensitive-permissions.js'

export type AccessReviewSeverity = 'high' | 'medium' | 'low'

export type AccessReviewReason =
  | 'NO_ROLES'
  | 'SENSITIVE_UNRESTRICTED'
  | 'INVITED_STALE'
  | 'BLOCKED'
  | 'NEVER_LOGIN'
  | 'HIGH_PERMISSION_COUNT'

export interface AccessReviewItem {
  userId: string
  email: string
  name: string
  status: string
  reasons: AccessReviewReason[]
  severity: AccessReviewSeverity
  roleCount: number
  permissionCount: number
  sensitiveCount: number
  unrestrictedScope: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface AccessReviewReport {
  generatedAt: string
  totals: {
    usersScanned: number
    attentionCount: number
    high: number
    medium: number
    low: number
  }
  items: AccessReviewItem[]
}

const INVITE_STALE_DAYS = 7
const HIGH_PERM_THRESHOLD = 80

function severityFor(reasons: AccessReviewReason[]): AccessReviewSeverity {
  if (reasons.includes('BLOCKED') || reasons.includes('SENSITIVE_UNRESTRICTED') || reasons.includes('NO_ROLES')) {
    return 'high'
  }
  if (reasons.includes('INVITED_STALE') || reasons.includes('HIGH_PERMISSION_COUNT')) {
    return 'medium'
  }
  return 'low'
}

/**
 * Live access-review register (no campaign persistence in Phase 7).
 * Scans non-archived users and flags attention reasons.
 */
export async function buildAccessReview(tenantId: string): Promise<AccessReviewReport> {
  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null, status: { not: 'ARCHIVED' } },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const userIds = users.map((u) => u.id)
  const [leGrants, branchGrants, whGrants] = await Promise.all([
    prisma.userLegalEntityAccess.findMany({
      where: { tenantId, userId: { in: userIds }, deletedAt: null },
      select: { userId: true },
    }),
    prisma.userBranchAccess.findMany({
      where: { tenantId, userId: { in: userIds }, deletedAt: null },
      select: { userId: true },
    }),
    prisma.userWarehouseAccess.findMany({
      where: { tenantId, userId: { in: userIds }, deletedAt: null },
      select: { userId: true },
    }),
  ])

  const scopedUsers = new Set<string>()
  for (const row of [...leGrants, ...branchGrants, ...whGrants]) scopedUsers.add(row.userId)

  const staleBefore = Date.now() - INVITE_STALE_DAYS * 24 * 60 * 60 * 1000
  const items: AccessReviewItem[] = []

  for (const user of users) {
    const reasons: AccessReviewReason[] = []
    const permSet = new Set<string>()
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permSet.add(rp.permission.name)
      }
    }
    const permissionCount = permSet.size
    const sensitiveCount = [...permSet].filter(isSensitivePermission).length
    const roleCount = user.userRoles.length
    const unrestrictedScope = !scopedUsers.has(user.id)

    if (roleCount === 0) reasons.push('NO_ROLES')
    if (user.status === 'BLOCKED') reasons.push('BLOCKED')
    if (user.status === 'INVITED' && user.createdAt.getTime() < staleBefore) reasons.push('INVITED_STALE')
    if (user.status === 'ACTIVE' && !user.lastLoginAt) reasons.push('NEVER_LOGIN')
    if (sensitiveCount > 0 && unrestrictedScope) reasons.push('SENSITIVE_UNRESTRICTED')
    if (permissionCount >= HIGH_PERM_THRESHOLD) reasons.push('HIGH_PERMISSION_COUNT')

    if (reasons.length === 0) continue

    items.push({
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      status: user.status,
      reasons,
      severity: severityFor(reasons),
      roleCount,
      permissionCount,
      sensitiveCount,
      unrestrictedScope,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })
  }

  items.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    const d = rank[a.severity] - rank[b.severity]
    if (d !== 0) return d
    return a.email.localeCompare(b.email)
  })

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      usersScanned: users.length,
      attentionCount: items.length,
      high: items.filter((i) => i.severity === 'high').length,
      medium: items.filter((i) => i.severity === 'medium').length,
      low: items.filter((i) => i.severity === 'low').length,
    },
    items,
  }
}
