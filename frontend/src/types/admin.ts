export type AdminUserStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED'

export interface AdminUserRoleRef {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface AdminUser {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  mobile: string | null
  designation: string | null
  department: string | null
  departmentId: string | null
  status: AdminUserStatus
  emailVerified: boolean
  lastLoginAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  roles: AdminUserRoleRef[]
}

export interface AdminDepartment {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminRoleSummary {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
}

export interface AdminRoleDetail {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface AdminPermission {
  id: string
  name: string
  module: string
  description: string | null
}

export type AdminTenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED'

export interface AdminTenant {
  id: string
  name: string
  slug: string
  legalName: string | null
  email: string
  phone: string | null
  country: string | null
  state: string | null
  city: string | null
  timezone: string
  currency: string
  status: AdminTenantStatus
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
}
