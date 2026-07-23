# FOS ERP Admin Panel — Phase 1 Platform Audit & Gap Analysis

**Status:** Phase 1–10 complete (Admin Panel close-out)  
**Date:** 2026-07-23  
**Rule:** Reuse existing Tenant, User, Role, Permission, LegalEntity, Branch, AuditLog, RefreshToken, Organisation APIs. Do **not** create a second Company / User / Role / Permission system.

---

## 1. Executive verdict

FOS already has a **working identity + org + finance-setup core**:

| Layer | State |
|-------|--------|
| Auth (JWT + refresh tokens + password reset) | **Exists** |
| Tenant / User / Role / Permission | **Exists** (shared-schema multi-tenant) |
| Legal Entity + Branch + FY + registrations | **Exists** (accounting SoT + Organisation Setup UI) |
| Admin UI Users / Roles / Tenants | **Partial** (`/admin/users|roles|tenants`) |
| Tenant-scoped Organisation Setup | **Exists** (`/settings/organisation/*`) |
| Fine-grained backend permissions | **Exists** (`backend/src/constants/permissions.ts`) |
| Module enablement, invitations lifecycle, responsibilities, data scope, effective-access service, login activity register, access review | **Missing or incomplete** |

The Admin Panel program is an **orchestration and UX layer** over these foundations — not a greenfield IAM rewrite.

---

## 2. Existing Prisma foundations (reuse)

### 2.1 Present — authoritative models

| Model | Table | Role for Admin Panel |
|-------|-------|----------------------|
| `Tenant` | `tenants` | Workspace; status `TRIAL\|ACTIVE\|INACTIVE\|SUSPENDED\|ARCHIVED`; slug, timezone, currency, subscription fields |
| `User` | `users` | Tenant-scoped user; status `INVITED\|ACTIVE\|INACTIVE\|BLOCKED\|ARCHIVED`; soft `department` **string** (not FK); `lastLoginAt` |
| `Role` | `roles` | Tenant or global (`tenantId` null = system); `isSystem` |
| `Permission` | `permissions` | Global catalog (`name` unique, `module`) |
| `UserRole` | `user_roles` | User↔Role within `tenantId` |
| `RolePermission` | `role_permissions` | Role↔Permission |
| `RefreshToken` | `refresh_tokens` | Session proxy (hash, expiry, revoke, UA, IP) |
| `PasswordResetToken` | `password_reset_tokens` | Reset flow |
| `AuditLog` | `audit_logs` | Generic audit |
| `LegalEntity` | `legal_entities` | **Main company / statutory + books owner** |
| `OrganisationRegistration` | `organisation_registrations` | GST/PAN/etc. rows per LE |
| `Branch` | `branches` | Under LegalEntity; types HO/FACTORY/WAREHOUSE/… |
| `FinancialYear` / `AccountingPeriod` | | Finance calendar |
| `FinanceFeatureControl` | | Per-LE feature flags (finance modules) |
| `FinanceApprovalRule` / requests / steps | | Finance approvals (module-owned) |
| `MasterWarehouse` / Plant / Location | | Ops locations — link from Branch, do not duplicate |
| `CostCentre` | | Cost dimension |

### 2.2 Absent vs target Admin architecture

| Target concept | Gap |
|----------------|-----|
| `TenantProfile` (branding, locale formats, primary admin) | Fields partially on `Tenant`; no dedicated profile / branding / setup-readiness entity |
| `Department` master | **Shipped Phase 5** — IAM `Department` + `User.departmentId` (not CRM masters) |
| `UserInvitation` (token, expiry, resend) | **Missing** — only `UserStatus.INVITED` |
| `UserSession` distinct from refresh token | Use/extend `RefreshToken` as session SoT |
| `LoginActivity` | **Missing** (login success/fail audit stream) |
| `Responsibility` / `UserResponsibility` | **Missing** |
| `ApprovalAuthority` (admin-managed limits by module/scope) | Partial: finance approval rules only; not cross-module admin authority |
| `UserCompanyAccess` / `UserBranchAccess` / warehouse scope | **Missing** — no row-level org scope tables |
| `AccessOverride` (expiring grants) | **Missing** |
| `AccessReview` | **Missing** |
| `ModuleEnablement` / `ModuleAdministrator` | **Missing** (finance has feature controls only) |
| `AdminAuditEvent` specialized | Prefer filter/extend `AuditLog` before new table |
| Platform Super Admin membership | Roles with `tenantId=null` + platform perms; no separate Platform User model |

**Do not invent a second Legal Entity or Branch.** Admin “Companies / Branches” must wrap existing accounting/organisation APIs.

---

## 3. API route architecture (current)

### 3.1 Auth (platform)

Mounted at `/api/v1/auth` (see `auth.routes.ts`):

- `POST /login`, `/refresh-token`, `/forgot-password`, `/reset-password`
- `POST /logout`, `/change-password` (authenticated)
- `GET /me`, `/login-directory`
- Rate limiting on auth attempts

### 3.2 Tenants / Users / Roles

| Mount | Module |
|-------|--------|
| `/api/v1/tenants` | `tenants` (platform tenant CRUD) |
| `/api/v1/tenants/:tenantId/users` **and** `/api/v1/t/:tenantSlug/users` | `users` |
| `/api/v1/tenants/:tenantId/roles` **and** `/api/v1/t/:tenantSlug/roles` | `roles` |

**Note:** There is **no** `/admin/users` backend prefix today. Spec’s `/admin/*` APIs should be **aliases or a thin façade** over these modules — not a parallel user store.

### 3.3 Organisation / Company (reuse for Admin Companies)

| Mount | Capability |
|-------|------------|
| `/api/v1/t/:tenantSlug/organisation/*` | Legal entities, registrations, CoA, mappings, FY, periods |

Permissions: `organisation.view|create|update` (+ finance LE aliases).

Accounting also exposes Branch APIs under finance setup (FE: `BranchesPage`).

### 3.4 Missing Admin API areas (Phase 3+)

- `/admin/overview`, tenant-profile façade, invitations, responsibilities  
- Effective access, access reviews, login activity, security settings  
- Module enablement / module admins  

Prefer mounting new Admin façade under:

`/api/v1/t/:tenantSlug/admin/...`

while calling existing services (users, roles, organisation, finance).

---

## 4. Frontend Admin surface (current)

### 4.1 Routes that exist

| Route | Page | Notes |
|-------|------|-------|
| `/admin` | Redirect → `/admin/users` | No Overview hub |
| `/admin/users`, `/new`, `/:id`, `/:id/edit` | `UserAdminPages` | Invite/create/edit |
| `/admin/roles`, … | `RoleAdminPages` | Role CRUD + permissions (basic) |
| `/admin/tenants`, … | `TenantAdminPages` | Platform-style tenant CRUD under `/admin` |
| `/settings/organisation/*` | Organisation setup shell | LE / registrations / CoA / FY — **canonical company setup** |
| Accounting settings Branches | `BranchesPage` | Branch CRUD for current LE |
| `/masters/roles`, `/masters/permissions`, `/settings/roles` | Permission matrix / role master aliases | Coarse FE matrix |
| Platform routes | `platformRoutes` | Separate family — audit before expanding |

### 4.2 Nav today

Admin sidebar (`navigation.ts`): **Users, Roles, Tenants** only.  
Route gate: `/admin` → `settings.view` (`permissionMatrix.ts`) — coarse; pages add `user.*` / `role.*` checks.

### 4.3 Architecture split (FE audit)

Admin is **three parallel tracks** today — unify under one Admin shell in later phases:

1. **System admin** — `/admin/users|roles|tenants` + `adminApiBridge`  
2. **Masters RBAC / CRM** — `/masters/users|roles|permissions|companies|departments` (often demo/read-only matrix; CRM owners ≠ system users)  
3. **Organisation / finance setup** — `/settings/organisation/*` + `/accounting/settings` (LE, branches)

Also: **no desktop `/profile`**, **no `/platform/*` tree** (`platformRoutes` currently mounts settings/UAT). User menu → `/settings` only.

### 4.4 Missing FE (target nav)

Admin Overview · Tenant Profile · Companies (Admin wrap of LE) · Branches & Plants (unified) · Departments · Organization Structure · Invitations · Responsibilities · Access Review · Module Access · Module Admins · Login Activity · Active Sessions · Locked Accounts · Password/Security Settings · Admin Audit · Admin Settings · Platform Admin tree (Super Admin only).

Shared Admin DS components (header, summary cards, Role Builder, Permission Matrix UX, Effective Access drawer) — **not built** as a coherent kit yet (pieces exist in systemAdmin + accounting registers).

---

## 5. Authorization model

### 5.1 Backend (authoritative)

- Middleware: `authenticate`, `resolveTenant` / `requireTenantAccess`, `requirePermission` / `requireAnyPermission`
- Catalog: `backend/src/constants/permissions.ts` — fine-grained keys (`crm.lead.view`, `purchase.po.approve`, `organisation.update`, `tenant.manage`, …)
- Platform-only set includes `tenant.manage` (must not be granted to normal tenant admin packs)
- JWT carries permission names from RolePermission join at login/`/me`

### 5.2 Frontend (UX only)

- `permissionMatrix.ts` uses **coarse** `module.action` keys and `ErpRole` packs — **not 1:1** with backend permission strings
- Hiding buttons ≠ security; all Admin mutations must hit permissioned APIs

### 5.3 Gaps vs target

| Capability | Gap |
|------------|-----|
| Permission dependencies (approve ⇒ view) | Not centralized |
| Sensitive-permission UX / confirm | Not standardized |
| Data scope enforcement (own/team/branch/company) | **Not in IAM layer** — module services may filter by ownership ad hoc |
| EffectiveAccessService + explain | **Missing** |
| Last-admin safeguards | Partially implied; not explicit product rules |
| Cannot-grant-what-you-lack | Not systematically enforced |
| Module Administrator role level | Missing as first-class concept |

---

## 6. Sessions & security controls

| Need | Current | Gap |
|------|---------|-----|
| Active sessions list | `RefreshToken` rows | No Admin UI; no “revoke all for user” productized endpoint (logout revokes current) |
| Login activity | — | Need `LoginActivity` or structured `AuditLog` events |
| Lock account | `UserStatus.BLOCKED` | Need Admin lock/unlock + failed-attempt lockout policy UI |
| Password policy | Env / code defaults | No Admin security settings page |
| Invitation tokens | — | Need hashed single-use invites |
| MFA | — | Feature-flag only if/when implemented |

---

## 7. Approvals & responsibilities

| Area | Reuse | Gap |
|------|-------|-----|
| Finance approvals | `FinanceApprovalRule` / requests | Keep as domain engine |
| Purchase / MFG approvals | Module-specific | Keep engines; Admin maps **authority** + responsibility owners |
| Cross-module Responsibility | — | New model in Phase 6 |
| Approval value limits in Admin | — | Map onto existing rules or thin `ApprovalAuthority` linking User/Role to existing engines |

**Do not** rebuild PO/Journal approval workflows inside Admin.

---

## 8. Dual-mode / demo

- `frontend/src/store/adminStore.ts` + `data/admin/seed.ts` — demo Admin catalog  
- API mode must use user/role/tenant/organisation bridges only  
- Definition of Done: **no demo data in API mode** for Admin registers  

---

## 9. Implementation gap matrix (priority)

| Spec area | Reuse | Build | Phase |
|-----------|-------|-------|-------|
| Admin Overview | Metrics from User/Role/RefreshToken/Audit | New page + `/admin/overview` API | 2–3 |
| Tenant Profile | `Tenant` fields | Profile UI + optional branding columns | 3 |
| Companies | `LegalEntity` + organisation APIs | Admin register/wizard wrapping SoT | 3 |
| Branches & Plants | `Branch` + MasterPlant/Warehouse links | Unified Admin UI (don’t fork accounting Branch) | 3 |
| Departments | — | New `Department` model + CRUD | 3 |
| Org structure viz | LE/Branch/User | Read model + tree UI | 3 |
| Users | `User` + user APIs | Enhance register/detail/tabs | 4 |
| Invitations | INVITED status | `UserInvitation` + flows | 4 |
| Roles / matrix UX | Role + Permission | Role Builder + module presets | 5 |
| Permission deps / sensitive | Catalog | Central dependency map + warnings | 5 |
| Data scope | — | Scope tables + middleware helpers | 6 |
| Responsibilities | — | New models + UI | 6 |
| Effective access | JWT perms today | `EffectiveAccessService` | 7 |
| Access review | — | New | 7 |
| Login activity / sessions UI | RefreshToken | Activity table + Admin security pages | 8 |
| Module enablement | FinanceFeatureControl pattern | Tenant module flags + deps | 9 |
| Platform Admin | Tenants API + Super Admin role | Separate `/platform` tree, hide from tenant admin | 3/9 |

---

## 10. Explicit non-goals (Phase 1)

- Creating duplicate `CompanyMaster`, `AdminUser`, or second permission catalog  
- Replacing JWT / refresh-token auth  
- Moving Legal Entity ownership out of Accounting/Organisation  
- Replacing finance/purchase approval engines  
- Building full Admin UI before Phase 2 design kit  

---

## 11. Recommended next steps (locked order)

1. **Phase 2** — Shared Admin design-system shells (header, summary cards, registers) over existing Users/Roles pages  
2. **Phase 3** — Tenant Profile + Companies/Branches Admin UX **wired to organisation + Branch APIs**; introduce Department only after LE/Branch UX exists  
3. **Phase 4** — User invitations + deactivation/session revoke product flows  
4. **Phase 5+** — Role Builder, scopes, responsibilities, effective access, security  

Before Phase 3 schema work: confirm product decision —

- Keep company setup primarily under `/settings/organisation` with Admin deep-links, **or**  
- Surface `/admin/companies` as the primary entry that embeds the same organisation services.

**Recommendation:** `/admin/companies` as entry; implementation calls existing organisation/finance services; no second SoT.

---

## 12. Key code anchors

| Concern | Path |
|---------|------|
| Schema IAM | `backend/prisma/schema.prisma` — Tenant, User, Role, Permission, RefreshToken |
| Schema org | LegalEntity, Branch, OrganisationRegistration |
| Permissions catalog | `backend/src/constants/permissions.ts` |
| Auth | `backend/src/modules/auth/*` |
| Users / Roles / Tenants | `backend/src/modules/users|roles|tenants/*` |
| Organisation API | `backend/src/modules/organisation/*` |
| App mounts | `backend/src/app.ts` |
| FE Admin routes | `frontend/src/routes/adminRoutes.tsx` |
| FE Admin pages | `frontend/src/modules/systemAdmin/*` |
| Org setup FE | `frontend/src/modules/organisation/*`, `routes/organisationRoutes.tsx` |
| Branch FE | `frontend/src/modules/accounting/settings/BranchesPage.tsx` |
| Route permission gate | `frontend/src/config/permissionMatrix.ts` |

---

## 13. Definition of ready for Phase 2

- [x] Existing IAM/org models inventoried  
- [x] Route mounts documented (auth, users, roles, tenants, organisation)  
- [x] Gaps vs full Admin Panel listed  
- [x] Reuse rules for LegalEntity / Branch confirmed  
- [ ] Product sign-off: Admin Companies entry vs Settings Organisation primary  
- [ ] Product sign-off: Department required for MVP or Phase 3 optional  

**Phase 1 complete.** Phase 2 UI kit shipped (see §14). Await go-ahead before Phase 3 schema/org Admin surfaces or any new Prisma IAM models.

---

## 14. Phase 2 delivery (2026-07-23)

**Scope:** Shared Admin design-system shells + Overview; light wiring of Users / Roles / Tenants. **No new Prisma models.**

| Deliverable | Location |
|-------------|----------|
| Admin nav IA (available vs Soon) | `frontend/src/components/admin/adminNav.ts` |
| Status badges, summary cards, needs-attention, empty/error/skeleton | `frontend/src/components/admin/*` |
| Permission matrix + Role Builder shell + Effective Access placeholder | `AdminPermissionMatrix.tsx`, `AdminRoleBuilder.tsx` |
| Admin Overview | `frontend/src/modules/systemAdmin/AdminOverviewPage.tsx` — route `/admin` |
| Nav / routes | Overview first in `navigation.ts`; `adminRoutes.tsx` serves Overview (no redirect to users) |
| Users / Roles / Tenants | Shared badges; Roles use matrix + View Only / No Access presets; User detail Effective Access placeholder |

**Explicit hold:** invitations, departments, data scope, EffectiveAccessService, login activity, module enablement — Phase 4+ (org hubs shipped in Phase 3).

**Definition of done (Phase 2):**
- [x] Shared Admin DS components exported from `components/admin`
- [x] `/admin` Overview with summary + attention + planned IA
- [x] Users/Roles/Tenants consume shared badges / matrix
- [x] No duplicate IAM models

---

## 15. Phase 3 delivery (2026-07-23)

**Product decision:** `/admin/companies` and `/admin/branches` are Admin entry hubs; Organisation Setup and Accounting Branches remain the full editors. Same SoT (LegalEntity / Branch APIs). **Department master deferred** (still free-text on User).

| Deliverable | Path / notes |
|-------------|--------------|
| Tenant Profile | `/admin/tenant-profile` — current workspace Tenant via GET/PATCH `/tenants/:id`; no subscription/status edits |
| Companies hub | `/admin/companies` — lists LegalEntity via organisation API; deep-links to `/settings/organisation/*` |
| Branches hub | `/admin/branches` — lists Branch via finance bridge; deep-links to `/accounting/settings/branches` |
| Nav / routes | Administration nav + `adminRoutes.tsx` + `adminNav.ts` mark org items available |

**Explicit hold:** Department FK master, invitations, scopes, EffectiveAccessService — Phase 4+.

**Definition of done (Phase 3):**
- [x] Tenant Profile over existing Tenant fields (no TenantProfile table)
- [x] Companies / Branches Admin UX without duplicate company models
- [x] Deep-links to Organisation Setup / Accounting Branches
- [x] Department not introduced

---

## 16. Phase 4 delivery (2026-07-23)

**Scope:** User invitations + deactivation with session revoke. Reuses `RefreshToken` as session SoT. Adds `UserInvitation` (hashed single-use tokens).

| Deliverable | Notes |
|-------------|--------|
| `UserInvitation` model + migration | `20260723194500_admin_user_invitations` |
| Invite / list / resend | `POST /users/invite`, `GET /users/invitations`, `POST /users/:id/resend-invitation` |
| Accept invitation | `POST /auth/accept-invitation` → ACTIVE + emailVerified |
| Activate / deactivate | Explicit lifecycle endpoints; deactivate revokes refresh tokens |
| Sessions | `GET /users/:id/sessions`, `POST /users/:id/revoke-sessions` |
| Admin UI | `/admin/invitations`; user detail resend + revoke sessions; login `?invite=` accept flow |

**Hold:** Password policy Admin settings / MFA — later (login activity + sessions + lockout shipped in Phase 8).

---

## 17. Phase 5 delivery (2026-07-23)

**Scope:** Guided Role Builder wizard + Department master (IAM people org units — not CRM `/masters/departments`).

| Deliverable | Notes |
|-------------|--------|
| `Department` model + `User.departmentId` | Migration `20260723200000_admin_departments`; legacy `User.department` string kept in sync |
| Department CRUD API | `/tenants/:id/departments` + slug mount; perms `department.view\|create\|update\|delete` |
| Admin UI | `/admin/departments`; nav + page tip; demo localStorage when `VITE_USE_API=false` |
| User forms | Department Select from master (FK); detail shows department name |
| Role Builder wizard | `AdminRoleBuilderWizard` — Identity → Module access → Sensitive review → Summary on `/admin/roles/new\|edit` |
| Matrix label | `department` module → “Departments” |
| Test | `backend/tests/admin-departments-phase5.test.ts` |

**Explicit hold:** LE/branch/warehouse data scopes, responsibilities, EffectiveAccessService, login activity register, email invite delivery — Phase 6+.

**Definition of done (Phase 5):**
- [x] Department master CRUD with tenant isolation + soft delete
- [x] User assign via `departmentId` (string sync on assign/rename)
- [x] Guided Role Builder over permission matrix
- [x] Admin nav/routes/page guides wired
- [x] Live service test for department + user FK

---

## 18. Phase 6 delivery (2026-07-23)

**Scope:** Data scopes (LE / branch / warehouse) + Responsibilities catalog/assignments. **Does not** rebuild finance/purchase approval engines. **Does not** ship EffectiveAccessService (Phase 7).

| Deliverable | Notes |
|-------------|--------|
| Scope tables | `UserLegalEntityAccess`, `UserBranchAccess`, `UserWarehouseAccess` — migration `20260723220000_admin_scopes_responsibilities` |
| Policy | Empty grants = **unrestricted (fail-open)** within tenant; `loadUserDataScope` + `scopeAllows` helpers for modules to opt in |
| Scope API | `GET/PUT /users/:userId/scopes` — perms `scope.view`, `scope.manage` |
| Responsibilities | System catalog + tenant CRUD; `UserResponsibility` assignments with optional dims / `externalRef*` |
| Responsibility API | `/responsibilities` + `/users/:userId/responsibilities` |
| Admin UI | `/admin/responsibilities`; user detail **Data scopes & responsibilities** panel |
| Test | `backend/tests/admin-scopes-responsibilities-phase6.test.ts` |

**Explicit hold:** Password policy Admin settings / MFA (later); module enablement + platform admin tree (Phase 9).

**Definition of done (Phase 6):**
- [x] Scope tables + replace API + fail-open helper
- [x] Responsibility catalog + user assignment APIs
- [x] Admin UI for catalog + user panels
- [x] Live service test

---

## 19. Phase 7 delivery (2026-07-23)

**Scope:** Effective Access explain + live Access Review register. **No** AccessOverride table and **no** review campaign persistence in this phase.

| Deliverable | Notes |
|-------------|--------|
| `EffectiveAccessService` | Union of role permissions with sources; scopes; responsibilities; explain notes |
| API | `GET /users/:userId/effective-access` (`access.view`); `GET /access-review` (`access.review`) |
| Sensitive heuristics | Shared with Role Builder (tenant/user/role delete, finance/accounting, `.post`/`.reverse`) |
| Access Review | Computed attention queue: NO_ROLES, SENSITIVE_UNRESTRICTED, INVITED_STALE, BLOCKED, NEVER_LOGIN, HIGH_PERMISSION_COUNT |
| Admin UI | User detail Effective Access panel; `/admin/access-review` |
| Perms migration | `20260723230000_admin_effective_access_perms` |
| Test | `backend/tests/admin-effective-access-phase7.test.ts` |

**Explicit hold:** Access overrides; persisted review campaigns/attestations; login activity / sessions / lockout UI (Phase 8); module enablement (Phase 9).

**Definition of done (Phase 7):**
- [x] Effective access explain API + UI on user detail
- [x] Access Review live register + Admin page
- [x] Permissions granted to Tenant Admin pack
- [x] Live service test

---

## 20. Phase 8 delivery (2026-07-23)

**Scope:** Login activity register, tenant-wide sessions, locked accounts + auto lockout. **Password policy Admin settings** remain deferred (env/code defaults).

| Deliverable | Notes |
|-------------|--------|
| `LoginActivity` + `User.failedLoginCount` / `lockedAt` | Migration `20260723240000_admin_security_phase8` |
| Auth | Login records success/failure; auto `BLOCKED` after `MAX_FAILED_LOGINS` (5); clears counter on success/unlock |
| APIs | `GET /security/login-activity`, `GET /security/sessions`, `POST /security/sessions/:id/revoke`, `GET /security/locked-accounts`, `POST /users/:id/lock\|unlock` |
| Perms | `security.view`, `security.manage` |
| Admin UI | `/admin/security/login-activity`, `/sessions`, `/locked-accounts`; user detail Lock/Unlock |
| Test | `backend/tests/admin-security-phase8.test.ts` |

**Explicit hold:** Editable password policy / MFA admin settings (later); module enablement (Phase 9); platform admin tree polish (Phase 9).

**Definition of done (Phase 8):**
- [x] Login activity persisted and Admin register
- [x] Tenant sessions list + revoke
- [x] Lock/unlock + failed-login auto-lockout
- [x] Live service test

---

## 21. Phase 9 delivery (2026-07-23)

**Scope:** Tenant module enablement (FinanceFeatureControl-style flags) + Platform Admin tree (`/platform/*`). **Does not** hard-block every domain API by module flag (helper exists for opt-in). **Does not** ship Module Admins as a first-class concept.

| Deliverable | Notes |
|-------------|--------|
| `TenantModuleFlag` | Migration `20260723250000_admin_module_enablement`; missing row = **enabled (fail-open)** |
| Catalog + deps | `module-catalog.ts` — masters, crm, purchase, inventory, manufacturing, quality, dispatch, accounting, logistics, gate, reports |
| APIs | `GET/PUT /modules` (+ slug mounts); GET open to authenticated tenant users (nav hydrate); PUT needs `module.manage` |
| Perms | `module.view`, `module.manage` granted to Tenant Admin pack |
| Admin UI | `/admin/modules` Module Access; sidebar soft-gates by enabled keys |
| Platform tree | `/platform`, `/platform/tenants/*` (Super Admin / `tenant.manage`); redirects from `/admin/tenants*` |
| Test | `backend/tests/admin-modules-phase9.test.ts` |

**Explicit hold:** Hard API module middleware everywhere; Module Admins; password-policy/MFA Admin settings; org-structure viz polish (Phase 10).

**Definition of done (Phase 9):**
- [x] Tenant module flags + dependency enable/disable rules
- [x] Admin Module Access page + soft nav gating + hydrate
- [x] Platform Admin overview + tenants under `/platform`
- [x] Live service test

---

## 22. Phase 10 delivery (2026-07-23)

**Scope:** Admin polish close-out — org-structure viz, Admin Audit over `AuditLog`, read-only security policy, chrome consistency, thin `requireModule` proof. **No** ModuleAdmin tables, editable password/MFA, or blanket API gating.

| Deliverable | Notes |
|-------------|--------|
| Org structure | `/admin/org-structure` — read-only LE → Branch; Departments/Warehouses as sibling links |
| Admin Audit | `GET /security/audit-logs` (`security.view`); UI `/admin/security/audit` |
| Security policy | `GET /security/policy` — `maxFailedLogins`, `passwordMinLength`, `mfa: not_configured` (read-only) |
| Module Access polish | Organization workspace tab; Roles deep-link; `requireModule` on purchase + manufacturing routers |
| Chrome | Overview quick cards; security/org tabs; tenants workspace removed (Platform nav) |
| Test | `backend/tests/admin-polish-phase10.test.ts` |

**Explicit hold:** Editable password policy / MFA Admin settings; first-class Module Administrators; Warehouse under LE; hard-gating every domain API.

**Definition of done (Phase 10):**
- [x] Org structure + Admin Audit + read-only policy
- [x] Modules/Overview chrome + requireModule proof
- [x] Live service test
- [x] P0-ADMIN program closed with holds documented
