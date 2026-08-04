import { prisma } from '../../config/prisma.js'
import { isSensitivePermission } from './sensitive-permissions.js'
import { SOD_SELF_APPROVAL_HINTS } from './access-review-sod.js'

export type AccessReviewSeverity = 'high' | 'medium' | 'low'

export type AccessReviewReason =
  | 'NO_ROLES'
  | 'SENSITIVE_UNRESTRICTED'
  | 'SENSITIVE_ACCESS'
  | 'INVITED_STALE'
  | 'BLOCKED'
  | 'NEVER_LOGIN'
  | 'INACTIVE_WITH_SESSIONS'
  | 'HIGH_PERMISSION_COUNT'
  | 'MANY_OVERRIDES'
  | 'SELF_APPROVAL_RISK'

export type AccessReviewBucket =
  | 'no_roles'
  | 'excessive_perms'
  | 'sensitive_access'
  | 'inactive_sessions'
  | 'unused_roles'
  | 'many_overrides'
  | 'self_approval'

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
  overrideCount: number
  activeSessionCount: number
  unrestrictedScope: boolean
  lastLoginAt: string | null
  createdAt: string
  buckets: AccessReviewBucket[]
  sodWarnings: string[]
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
  buckets: Record<AccessReviewBucket, number>
  unusedRoles: Array<{ roleId: string; name: string; userCount: number; permissionCount: number }>
  items: AccessReviewItem[]
}

const INVITE_STALE_DAYS = 7
const HIGH_PERM_THRESHOLD = 80
const MANY_OVERRIDES_THRESHOLD = 5

function severityFor(reasons: AccessReviewReason[]): AccessReviewSeverity {
  if (
    reasons.includes('BLOCKED') ||
    reasons.includes('SENSITIVE_UNRESTRICTED') ||
    reasons.includes('NO_ROLES') ||
    reasons.includes('SELF_APPROVAL_RISK')
  ) {
    return 'high'
  }
  if (
    reasons.includes('INVITED_STALE') ||
    reasons.includes('HIGH_PERMISSION_COUNT') ||
    reasons.includes('INACTIVE_WITH_SESSIONS') ||
    reasons.includes('MANY_OVERRIDES') ||
    reasons.includes('SENSITIVE_ACCESS')
  ) {
    return 'medium'
  }
  return 'low'
}

function bucketsFor(reasons: AccessReviewReason[]): AccessReviewBucket[] {
  const buckets = new Set<AccessReviewBucket>()
  if (reasons.includes('NO_ROLES')) buckets.add('no_roles')
  if (reasons.includes('HIGH_PERMISSION_COUNT')) buckets.add('excessive_perms')
  if (reasons.includes('SENSITIVE_UNRESTRICTED') || reasons.includes('SENSITIVE_ACCESS')) {
    buckets.add('sensitive_access')
  }
  if (reasons.includes('INACTIVE_WITH_SESSIONS') || reasons.includes('NEVER_LOGIN')) {
    buckets.add('inactive_sessions')
  }
  if (reasons.includes('MANY_OVERRIDES')) buckets.add('many_overrides')
  if (reasons.includes('SELF_APPROVAL_RISK')) buckets.add('self_approval')
  return [...buckets]
}

/**
 * Live access-review register (no campaign persistence).
 * Scans non-archived users and flags attention reasons / buckets.
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
              _count: { select: { userRoles: true } },
            },
          },
        },
      },
      approvalAuthorityRules: {
        where: { deletedAt: null, isActive: true },
        select: { documentType: true, amountFrom: true, amountTo: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const userIds = users.map((u) => u.id)
  const [leGrants, branchGrants, whGrants, overrideGroups, sessionGroups, allRoles, authRules] =
    await Promise.all([
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
      prisma.userPermissionOverride.groupBy({
        by: ['userId'],
        where: { tenantId, userId: { in: userIds }, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.refreshToken.groupBy({
        by: ['userId'],
        where: {
          tenantId,
          userId: { in: userIds },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        _count: { _all: true },
      }),
      prisma.role.findMany({
        where: {
          deletedAt: null,
          OR: [{ tenantId }, { tenantId: null }],
        },
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
        },
        take: 200,
      }),
      prisma.approvalAuthorityRule.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        select: { userId: true, roleId: true, documentType: true },
      }),
    ])

  const scopedUsers = new Set<string>()
  for (const row of [...leGrants, ...branchGrants, ...whGrants]) scopedUsers.add(row.userId)

  const overrideCountByUser = new Map(overrideGroups.map((g) => [g.userId, g._count._all]))
  const sessionCountByUser = new Map(sessionGroups.map((g) => [g.userId, g._count._all]))

  const unusedRoles = allRoles
    .filter((r) => !r.isSystem && r._count.userRoles === 0)
    .map((r) => ({
      roleId: r.id,
      name: r.name,
      userCount: 0,
      permissionCount: r._count.rolePermissions,
    }))

  const roleHasApprovalAuth = new Set(
    authRules.filter((r) => r.roleId).map((r) => r.roleId as string),
  )

  const staleBefore = Date.now() - INVITE_STALE_DAYS * 24 * 60 * 60 * 1000
  const items: AccessReviewItem[] = []

  for (const user of users) {
    const reasons: AccessReviewReason[] = []
    const sodWarnings: string[] = []
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
    const overrideCount = overrideCountByUser.get(user.id) ?? 0
    const activeSessionCount = sessionCountByUser.get(user.id) ?? 0

    if (roleCount === 0) reasons.push('NO_ROLES')
    if (user.status === 'BLOCKED') reasons.push('BLOCKED')
    if (user.status === 'INVITED' && user.createdAt.getTime() < staleBefore) reasons.push('INVITED_STALE')
    if (user.status === 'ACTIVE' && !user.lastLoginAt) reasons.push('NEVER_LOGIN')
    if (
      (user.status === 'INACTIVE' || user.status === 'BLOCKED') &&
      activeSessionCount > 0
    ) {
      reasons.push('INACTIVE_WITH_SESSIONS')
    }
    if (sensitiveCount > 0 && unrestrictedScope) reasons.push('SENSITIVE_UNRESTRICTED')
    else if (sensitiveCount > 0) reasons.push('SENSITIVE_ACCESS')
    if (permissionCount >= HIGH_PERM_THRESHOLD) reasons.push('HIGH_PERMISSION_COUNT')
    if (overrideCount >= MANY_OVERRIDES_THRESHOLD) reasons.push('MANY_OVERRIDES')

    // Soft SoD / self-approval: user-targeted approval rule + create/post rights
    const userAuthRules = user.approvalAuthorityRules.length
    const roleAuth =
      user.userRoles.some((ur) => roleHasApprovalAuth.has(ur.roleId)) || userAuthRules > 0
    if (roleAuth) {
      for (const hint of SOD_SELF_APPROVAL_HINTS) {
        const creates = hint.create.some((p) => [...permSet].some((n) => n.includes(p)))
        const posts = hint.approve.some((p) => [...permSet].some((n) => n.includes(p)))
        if (creates && posts) {
          sodWarnings.push(hint.label)
        }
      }
      if (sodWarnings.length) reasons.push('SELF_APPROVAL_RISK')
    }

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
      overrideCount,
      activeSessionCount,
      unrestrictedScope,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      buckets: bucketsFor(reasons),
      sodWarnings,
    })
  }

  items.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    const d = rank[a.severity] - rank[b.severity]
    if (d !== 0) return d
    return a.email.localeCompare(b.email)
  })

  const bucketTotals: Record<AccessReviewBucket, number> = {
    no_roles: 0,
    excessive_perms: 0,
    sensitive_access: 0,
    inactive_sessions: 0,
    unused_roles: unusedRoles.length,
    many_overrides: 0,
    self_approval: 0,
  }
  for (const item of items) {
    for (const b of item.buckets) {
      if (b !== 'unused_roles') bucketTotals[b] += 1
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      usersScanned: users.length,
      attentionCount: items.length,
      high: items.filter((i) => i.severity === 'high').length,
      medium: items.filter((i) => i.severity === 'medium').length,
      low: items.filter((i) => i.severity === 'low').length,
    },
    buckets: bucketTotals,
    unusedRoles,
    items,
  }
}
