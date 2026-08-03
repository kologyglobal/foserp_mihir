/**
 * Admin IAM structure smoke — routes, pages, bridges for tenants/users/roles.
 * Run: npm run test:admin-iam
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

let failed = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed += 1
}

console.log('\nAdmin IAM — tenants / users / roles structure\n')

const adminRoutes = read('src/routes/adminRoutes.tsx')
const platformRoutes = read('src/routes/platformRoutes.tsx')
const nav = read('src/config/navigation.ts')
const bridge = read('src/services/bridges/adminApiBridge.ts')
const adminApi = read('src/services/api/adminApi.ts')
const store = read('src/store/adminStore.ts')
const userPages = read('src/modules/systemAdmin/UserAdminPages.tsx')
const rolePages = read('src/modules/systemAdmin/RoleAdminPages.tsx')
const tenantPages = read('src/modules/systemAdmin/TenantAdminPages.tsx')
const profile = read('src/modules/settings/ProfileSettingsPage.tsx')
const changePw = read('src/modules/auth/ChangePasswordPage.tsx')
const userMenu = read('src/components/layout/UserMenuDropdown.tsx')
const authRoutes = read('src/routes/authRoutes.tsx')

check('Users routes registered', adminRoutes.includes("path: 'admin/users'") && adminRoutes.includes('UserAdminListPage'))
check('Roles routes registered', adminRoutes.includes("path: 'admin/roles'") && adminRoutes.includes('RoleAdminListPage'))
check('Platform tenants routes registered', platformRoutes.includes("path: 'platform/tenants'") && platformRoutes.includes('TenantAdminListPage'))
check('/admin/tenants redirects to platform', platformRoutes.includes('AdminTenantsToPlatformRedirect'))
check('No duplicate tenant CRUD in adminRoutes', !adminRoutes.includes('TenantAdminListPage'))
check('Nav links Users + Roles + Tenants', nav.includes('/admin/users') && nav.includes('/admin/roles') && (nav.includes('/admin/tenants') || nav.includes('/platform/tenants')))
check('Admin bridge sync users/roles/tenants', bridge.includes('syncAdminUsersFromApi') && bridge.includes('syncAdminRolesFromApi') && bridge.includes('syncAdminTenantsFromApi'))
check('Admin API create user/role/tenant helpers', adminApi.includes('createAdminUser') || adminApi.includes('invite') || bridge.includes('apiCreateAdminUser'))
check('adminStore API-mode createUser/createRole/createTenant', store.includes('apiCreateAdminUser') && store.includes('createRole') && store.includes('createTenant'))
check('User admin list + form + detail pages', userPages.includes('UserAdminListPage') && userPages.includes('UserAdminFormPage') && userPages.includes('UserAdminDetailPage'))
check('Role admin list + form + detail pages', rolePages.includes('RoleAdminListPage') && rolePages.includes('RoleAdminFormPage'))
check('Tenant admin Super Admin gate', tenantPages.includes('isSuperAdminUser') && tenantPages.includes('SuperAdminOnlyNotice'))
check('Profile settings self-service', profile.includes('updateProfile') && profile.includes('changePassword'))
check('Change password page', changePw.includes('changePassword') && authRoutes.includes('account/change-password'))
check('User menu links profile + change password', userMenu.includes('/settings/profile') && userMenu.includes('/account/change-password'))

console.log(`\nAdmin IAM structure: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failed)\n`)
process.exit(failed ? 1 : 0)
