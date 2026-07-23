import type { Prisma, User, UserStatus } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { NotFoundError } from '../../utils/errors.js'
import type { PaginationInput } from '../../utils/pagination.js'
import { getPagination } from '../../utils/pagination.js'
import type { CreateUserInput, UpdateUserInput } from './user.validation.js'

const userInclude = {
  userRoles: {
    include: {
      role: {
        select: { id: true, name: true, description: true, isSystem: true },
      },
    },
  },
} satisfies Prisma.UserInclude

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>

export async function findUsers(
  tenantId: string,
  query: PaginationInput & { status?: UserStatus },
): Promise<{ items: UserWithRoles[]; total: number }> {
  const { skip, take } = getPagination(query)

  const where: Prisma.UserWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take,
      include: userInclude,
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
    }),
    prisma.user.count({ where }),
  ])

  return { items, total }
}

export async function findUserById(tenantId: string, userId: string): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    include: userInclude,
  })
}

export async function findUserByEmail(tenantId: string, email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { tenantId, email, deletedAt: null },
  })
}

export async function createUser(
  tenantId: string,
  input: CreateUserInput,
  passwordHash: string,
  createdBy?: string,
): Promise<UserWithRoles> {
  let departmentName = input.department ?? null
  if (input.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: input.departmentId, tenantId, deletedAt: null, isActive: true },
    })
    if (!dept) throw new NotFoundError('Department not found')
    departmentName = dept.name
  }

  return prisma.user.create({
    data: {
      tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      mobile: input.mobile,
      designation: input.designation,
      department: departmentName,
      departmentId: input.departmentId ?? null,
      status: input.status,
      passwordHash,
      createdBy,
      ...(input.roleIds?.length
        ? {
            userRoles: {
              create: input.roleIds.map((roleId) => ({
                roleId,
                tenantId,
                createdBy,
              })),
            },
          }
        : {}),
    },
    include: userInclude,
  })
}

export async function updateUser(
  tenantId: string,
  userId: string,
  input: UpdateUserInput,
  updatedBy?: string,
): Promise<UserWithRoles> {
  const data: Prisma.UserUpdateInput = { updatedBy }

  if (input.firstName !== undefined) data.firstName = input.firstName
  if (input.lastName !== undefined) data.lastName = input.lastName
  if (input.email !== undefined) data.email = input.email
  if (input.mobile !== undefined) data.mobile = input.mobile
  if (input.designation !== undefined) data.designation = input.designation
  if (input.status !== undefined) data.status = input.status

  if (input.departmentId !== undefined) {
    if (input.departmentId === null) {
      data.departmentId = null
      if (input.department !== undefined) data.department = input.department
      else data.department = null
    } else {
      const dept = await prisma.department.findFirst({
        where: { id: input.departmentId, tenantId, deletedAt: null },
      })
      if (!dept) throw new NotFoundError('Department not found')
      data.departmentId = input.departmentId
      data.department = dept.name
    }
  } else if (input.department !== undefined) {
    data.department = input.department
  }

  return prisma.user.update({
    where: { id: userId, tenantId },
    data,
    include: userInclude,
  })
}

export async function softDeleteUser(tenantId: string, userId: string, updatedBy?: string): Promise<UserWithRoles> {
  return prisma.user.update({
    where: { id: userId, tenantId },
    data: { deletedAt: new Date(), status: 'ARCHIVED', updatedBy },
    include: userInclude,
  })
}

export async function assignRole(
  tenantId: string,
  userId: string,
  roleId: string,
  createdBy?: string,
): Promise<UserWithRoles> {
  await prisma.userRole.create({
    data: { userId, roleId, tenantId, createdBy },
  })

  const user = await findUserById(tenantId, userId)
  if (!user) {
    throw new Error('User not found after role assignment')
  }
  return user
}

export async function removeRole(tenantId: string, userId: string, roleId: string): Promise<UserWithRoles> {
  await prisma.userRole.deleteMany({
    where: { userId, roleId, tenantId },
  })

  const user = await findUserById(tenantId, userId)
  if (!user) {
    throw new Error('User not found after role removal')
  }
  return user
}

export async function findRoleInTenant(tenantId: string, roleId: string) {
  return prisma.role.findFirst({
    where: {
      id: roleId,
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
  })
}

export async function findUserRole(userId: string, roleId: string) {
  return prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId } },
  })
}
