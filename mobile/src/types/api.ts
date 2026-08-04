export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta | null
  code?: string | null
  errors?: Array<{ field: string; message: string }> | null
  missingFields?: Array<{ field: string; label: string }> | null
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AuthUser {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  mobile: string | null
  designation: string | null
  department: string | null
  status: string
  emailVerified: boolean
  lastLoginAt: string | null
  roles: string[]
  permissions: string[]
}

export interface TenantCompanyProfile {
  legalName?: string | null
  tradeName?: string | null
  gstin?: string | null
  pan?: string | null
  logoUrl?: string | null
  [key: string]: unknown
}

export interface TenantSummary {
  id: string
  name: string
  slug: string
  businessType?: string
  displayTerminology?: Record<string, string>
  companyProfile?: TenantCompanyProfile | null
}

export interface AuthMe extends AuthUser {
  tenant: TenantSummary
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** Session persisted in SecureStore (tokens + tenant binding). */
export interface SecureSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  tenantId: string
  tenantSlug: string
  /** Remember tenant + email for next login UI (password never stored). */
  rememberLogin: boolean
  rememberedEmail?: string
}

export interface ModuleStatus {
  key: string
  name: string
  description?: string
  enabled: boolean
  alwaysOn?: boolean
  dependsOn?: string[]
}

export interface SessionUserProfile {
  user: AuthUser
  tenant: TenantSummary | null
  permissions: string[]
  roles: string[]
  modules: ModuleStatus[]
  /** LE/Branch not on /auth/me yet — reserved for scope APIs (M1 placeholders). */
  branchName: string | null
  legalEntityName: string | null
  department: string | null
  employeeCode: string | null
  photoUrl: string | null
}
