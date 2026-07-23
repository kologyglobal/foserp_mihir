import { createAuditLog } from '../../services/audit.service.js'
import { prisma } from '../../config/database.js'
import { ConflictError, NotFoundError } from '../../utils/errors.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { hashPassword } from '../../utils/password.js'
import * as invitationService from './user-invitation.service.js'
import * as userRepository from './user.repository.js'
import type { UserWithRoles } from './user.repository.js'
import type {
  AssignRoleInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from './user.validation.js'

export interface SafeUser {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  mobile: string | null
  designation: string | null
  department: string | null
  departmentId: string | null
  status: string
  emailVerified: boolean
  lastLoginAt: Date | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
  roles: Array<{ id: string; name: string; description: string | null; isSystem: boolean }>
}

export function sanitizeUser(user: UserWithRoles): SafeUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    designation: user.designation,
    department: user.department,
    departmentId: user.departmentId,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdBy: user.createdBy,
    updatedBy: user.updatedBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      isSystem: ur.role.isSystem,
    })),
  }
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function listUsers(tenantId: string, query: ListUsersQuery) {
  const { items, total } = await userRepository.findUsers(tenantId, query)
  return {
    items: items.map(sanitizeUser),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function getUserById(tenantId: string, userId: string): Promise<SafeUser> {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }
  return sanitizeUser(user)
}

export async function createUser(
  tenantId: string,
  input: CreateUserInput,
  audit?: AuditMeta,
) {
  const existing = await userRepository.findUserByEmail(tenantId, input.email)
  if (existing) {
    throw new ConflictError('User with this email already exists')
  }

  if (input.roleIds?.length) {
    for (const roleId of input.roleIds) {
      const role = await userRepository.findRoleInTenant(tenantId, roleId)
      if (!role) {
        throw new NotFoundError(`Role not found: ${roleId}`)
      }
    }
  }

  const passwordHash = await hashPassword(input.password)
  const user = await userRepository.createUser(tenantId, input, passwordHash, audit?.userId)
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'User',
    entityId: user.id,
    action: 'CREATE',
    newValues: safeUser,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}

export async function updateUser(
  tenantId: string,
  userId: string,
  input: UpdateUserInput,
  audit?: AuditMeta,
) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) {
    throw new NotFoundError('User not found')
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await userRepository.findUserByEmail(tenantId, input.email)
    if (duplicate && duplicate.id !== userId) {
      throw new ConflictError('User with this email already exists')
    }
  }

  const user = await userRepository.updateUser(tenantId, userId, input, audit?.userId)
  const safeUser = sanitizeUser(user)

  if (input.status && input.status !== 'ACTIVE' && input.status !== existing.status) {
    await invitationService.revokeUserSessions(userId, tenantId)
  }

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'User',
    entityId: userId,
    action: 'UPDATE',
    oldValues: sanitizeUser(existing),
    newValues: safeUser,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}

export async function deleteUser(tenantId: string, userId: string, audit?: AuditMeta) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) {
    throw new NotFoundError('User not found')
  }

  const user = await userRepository.softDeleteUser(tenantId, userId, audit?.userId)
  await invitationService.revokeUserSessions(userId, tenantId)
  await prisma.userInvitation.updateMany({
    where: { userId, tenantId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'User',
    entityId: userId,
    action: 'DELETE',
    oldValues: sanitizeUser(existing),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}

export async function assignRole(
  tenantId: string,
  userId: string,
  input: AssignRoleInput,
  audit?: AuditMeta,
) {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }

  const role = await userRepository.findRoleInTenant(tenantId, input.roleId)
  if (!role || (role.tenantId && role.tenantId !== tenantId)) {
    throw new NotFoundError('Role not found')
  }

  const existingAssignment = await userRepository.findUserRole(userId, input.roleId)
  if (existingAssignment) {
    throw new ConflictError('User already has this role')
  }

  const updated = await userRepository.assignRole(tenantId, userId, input.roleId, audit?.userId)
  const safeUser = sanitizeUser(updated)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'UserRole',
    entityId: userId,
    action: 'ASSIGN_ROLE',
    newValues: { userId, roleId: input.roleId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}

export async function removeRole(
  tenantId: string,
  userId: string,
  roleId: string,
  audit?: AuditMeta,
) {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }

  const existingAssignment = await userRepository.findUserRole(userId, roleId)
  if (!existingAssignment) {
    throw new NotFoundError('Role assignment not found')
  }

  const updated = await userRepository.removeRole(tenantId, userId, roleId)
  const safeUser = sanitizeUser(updated)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'UserRole',
    entityId: userId,
    action: 'REMOVE_ROLE',
    oldValues: { userId, roleId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}
