# Phase A — Deployment Hardening Audit

**Document type:** A0 architecture audit (code-verified)  
**Created:** 2026-07-27  
**Source of truth:** Current codebase (not stale `PROJECT_STATUS.md` alone)  
**Scope:** Platform · Auth · Admin · MasterItem sales readiness · CRM Product → Item migration  
**Out of scope for Phase A:** Advanced MRP, FIFO, Auto Manufacturing GL, CMMS, Purchase redesign, Order profitability

---

## Executive verdict

| Track | Readiness | Blocking gaps |
|-------|-----------|---------------|
| **Authentication** | Ready (A1) | Prod email reset (**PASS WITH CONDITION**); auth event audit → A5 |
| **Admin / Org / RBAC** | Stronger after A2+A4 | Branch ACL; login activity; sessions UI; invitations; data scope **PASS WITH CONDITION**; live UAT |
| **MasterItem sales** | Not ready | Missing `salesAllowed`, sales UOM/rate/lead days, fulfilment method; CRM still picks MasterProduct |
| **CRM Product → Item** | Not ready | SO/Quote keyed on `productId`; dual-resolve via `fgItemId` only; large backfill + dual-read required |
| **API-mode gate** | Incomplete | Admin unverified; Product→Item unfinished; no Phase A regression pack |

**Do not start Phase B (Purchase→GRN→QC→Inventory) until this audit’s Definition of Done passes.**

---

## Delivery sequence (locked)

| Step | Workstream | Status after A0 |
|------|------------|-----------------|
| A0 | Architecture audit (this doc) | **In progress → complete when signed** |
| A1 | Authentication hardening | **Shipped 2026-07-27** (lockout + change-password FE + messages; reset email **PASS WITH CONDITION**) |
| A2 | Admin / Organization foundation | **Shipped 2026-07-27** (shell IA + Overview + Tenant Profile + Org LE/Branch links; Tenants Super-Admin-only; User↔branch → A3) |
| A3 | Users | Not started (partial UI exists) |
| A4 | Roles / Permissions / Data Scope | **Partial — shipped 2026-07-27** (RBAC + EffectiveAccess + safeguards; data scope **PASS WITH CONDITION**) |
| A5 | Login Activity / Sessions / Security | Not started |
| A6 | MasterItem sales readiness | Not started |
| A7 | CRM Product → Item migration | Not started — **blocked on A6 + productId inventory** |
| A8 | API-mode permission regression | Not started |
| A9 | Deployment readiness gate doc | Not started |

---

## Area matrix

Legend: ✅ present · ⚠️ partial · ❌ missing

### 1. Platform — Tenant / User / Roles / Permissions

| Field | Value |
|-------|-------|
| **Current implementation** | Prisma: `Tenant`, `User`, `Role`, `Permission`, `UserRole`, `RolePermission`. Catalog in `backend/src/constants/permissions.ts`. Seed in `backend/prisma/seed.ts`. Middleware: `auth`, `permission`, `tenant`. Modules: `tenants`, `users`, `roles`. |
| **API status** | ✅ Tenants (Super Admin), Users CRUD + role assign, Roles CRUD + permission catalog under `/api/v1/t/:tenantSlug/…` |
| **DB status** | ✅ Soft delete; User status `INVITED/ACTIVE/INACTIVE/BLOCKED/ARCHIVED`; Tenant status includes `SUSPENDED` |
| **FE status** | ✅ `/admin` Overview; Organization hub + Tenant Profile; Users/Roles dual-mode; Tenants Super Admin–gated |
| **Permission status** | ✅ Route + middleware; Super Admin = `tenant.manage`; Tenant Admin pack seeded; `/admin` → `canAccessAdminShell()` |
| **Known gaps** | No branch/LE user ACL; invitations email; ~~Desired Admin IA~~ ✅ A2 shell; ~~no EffectiveAccess API~~ ✅ A4; no data-scope model (**PASS WITH CONDITION**) |
| **Required work** | A3: Users drawer + invitations + UserBranch (or defer); A4 ✅ permission RBAC + EffectiveAccess + safeguards; scope enums deferred per A4.4 condition |
| **Risk** | **Medium–High** multi-branch tenants without ACL; **Medium** unverified admin UI |
| **Tests** | Indirect CRM/finance live tests; ✅ A4 unit helpers; ❌ dedicated users/roles live suite |

### 2. Branch / Legal Entity / Org hierarchy

| Field | Value |
|-------|-------|
| **Current implementation** | `LegalEntity`, `Branch` under Accounting (`finance.legal_entity.*`, `finance.branch.*`). Hierarchy intended: Tenant → LE → Branch → Department → User. |
| **API status** | ✅ Accounting LE/Branch APIs |
| **DB status** | ✅ LE + Branch; ❌ `UserBranch` / department-user assignment models |
| **FE status** | ✅ Admin Organization hub links to Accounting LE/Branch; Company = Legal Entity (documented) |
| **Permission status** | Finance-scoped masters; Admin shell links only |
| **Known gaps** | No enforceable branch scope on CRM/SO queries; User↔branch assignment → A3 |
| **Required work** | A3: user↔company/branch assignment; A4.4: scope enforcement or document **PASS WITH CONDITION** if deferred |
| **Risk** | **High** if multi-plant client goes live without branch scope |
| **Tests** | Finance LE/branch tests only |

### 3. Sessions / Refresh tokens

| Field | Value |
|-------|-------|
| **Current implementation** | `RefreshToken` (hashed, expiry, revoke, UA/IP). Auth service rotates refresh on refresh. FE `client.ts` single-flight refresh + 401 retry. |
| **API status** | ✅ login, refresh-token, logout (one/all) |
| **DB status** | ✅ `refresh_tokens`; ❌ dedicated Session entity (refresh row = session) |
| **FE status** | ✅ Auto refresh; ❌ Active Sessions admin UI; ❌ profile session list |
| **Permission status** | N/A for own session; admin revoke needs new perms |
| **Known gaps** | No admin session browser; logout-all from Admin; revoked-session UX messaging standardization |
| **Required work** | A1.1 verify no refresh loops; A5.2 Active Sessions UI + revoke; profile `/profile/security` |
| **Risk** | **Low** for rotation mechanics; **Medium** ops without revoke UI |
| **Tests** | ❌ Dedicated refresh/logout/revocation suite |

### 4. Audit events

| Field | Value |
|-------|-------|
| **Current implementation** | `AuditLog` + `audit.service.ts` — append-only; used for admin CRUD + some denials |
| **API status** | Write ✅ · Read/list/export ❌ |
| **DB status** | ✅ `audit_logs` |
| **FE status** | ❌ Admin Audit browser |
| **Permission status** | No `audit.view` platform permission surfaced |
| **Known gaps** | Auth lifecycle not audited (LOGIN_SUCCESS/FAIL, LOGOUT, PASSWORD_*); no Admin Audit nav |
| **Required work** | A5 LoginActivity (may be separate table); A2 Audit list API + UI; auth event writes |
| **Risk** | **Medium** compliance |
| **Tests** | ❌ |

### 5. Authentication flows

| Field | Value |
|-------|-------|
| **Current implementation** | `backend/src/modules/auth/*`; FE `LoginPage`, `ChangePasswordPage`, `AuthProvider`, `ApiAuthGate`, `ProtectedOutlet` / `PermissionGate` / `RequirePermission` |
| **API status** | ✅ login, refresh, logout, me, forgot/reset, change-password; lockout counters; suspended/inactive tenant rejection |
| **DB status** | ✅ users (+ `failedLoginAttempts`, `lockedUntil`), refresh_tokens, password_reset_tokens |
| **FE status** | ✅ Login + forgot/reset; business-friendly error map; `/account/change-password` + user-menu entry; session-expired notice on login |
| **Permission status** | Loaded at login/`me`; inactive users blocked; unauthenticated → login; no-permission → Access Denied (not 404) |
| **Known gaps** | No SMTP for reset in prod (**PASS WITH CONDITION** — dev returns reset token); weak password policy (≥8); demo credentials still shown on login; auth event audit deferred to A5 |
| **Required work** | A5 LoginActivity / sessions UI; prod SMTP or out-of-band reset delivery |
| **Risk** | **Medium** forgot-password without email in prod; **Low** lockout/refresh after A1 |
| **Tests** | ✅ `tests/auth-hardening.test.ts`; FE `scripts/test-auth-refresh-singleflight.ts`; UAT-01 auth |

### 6. Route guards

| Field | Value |
|-------|-------|
| **Current implementation** | `ProtectedOutlet`, `PermissionGate`, `ActionGuard`, `RequirePermission`, `canRoute` / permission matrix; `ApiAuthGate` when `VITE_USE_API=true` |
| **API status** | Backend `requirePermission` / `requireSuperAdmin` |
| **DB status** | N/A |
| **FE status** | ✅ Unauthenticated → `/login`; no-permission → `PermissionDeniedPage` (403); unknown path → `PageNotFoundPage` (404); `RouteErrorBoundary` maps 401/403/404 distinctly |
| **Permission status** | Matrix-driven; `/admin` → `canAccessAdminShell()` (Tenants → Super Admin) |
| **Known gaps** | Admin gate vs Super Admin for Tenants tracked under A2 — ✅ Tenants nav/route Super Admin–only |
| **Required work** | ~~Align `/admin` with `canAccessAdminShell()`~~ ✅ A2 |
| **Risk** | **Low** after A1 guard pass |
| **Tests** | FE route integrity + A1.3 single-flight/guard script |

### 7. Admin workspace

| Field | Value |
|-------|-------|
| **Current implementation** | Nav: Overview, Organization (Tenant Profile + LE/Branch hub), People & Access (Users, Roles), Platform Tenants (Super Admin). Pages: `systemAdmin/*AdminPages.tsx` + `AdminOverviewPage` / `AdminOrganizationPages`. Bridge: `adminApiBridge` (+ `syncCurrentTenantProfile`). |
| **API status** | Users/Roles/Tenants ✅; current-tenant GET via `/tenants/:id`; Overview/Security/Audit/Invitations/Module Access ❌ as dedicated APIs |
| **DB status** | Platform models only; no UserBranch |
| **FE status** | Dual-mode; `/admin` → Overview; Tenant Profile editable when `tenant.update`; invite = status not email |
| **Permission status** | Shell: `canAccessAdminShell()`; page-level `user.*` / `role.*` / `tenant.*`; Tenants: `tenant.manage` |
| **Known gaps** | Modules / Security / Audit stubs not built (A5); invitations email; module administrators UI; User↔branch (A3) |
| **Required work** | A3 Users + invitations; A5 Security; reuse Legal Entity (no duplicate Company model) ✅ linked from Org hub |
| **Risk** | **Medium** — shell shipped; live UAT still pending |
| **Tests** | ❌ FE admin tests; docs mark P1-1/P1-2 verification pending |

### A2 delivery status (2026-07-27)

| Item | Status | Notes |
|------|--------|-------|
| A2.1 Admin shell IA | ✅ Shipped | Overview landing; Organization + People & Access groups; Tenants hidden without Super Admin |
| A2.2 Overview | ✅ Shipped | `/admin` KPIs + quick links; demo store / API bridge |
| A2.3 Tenant Profile | ✅ Shipped (condition) | Current tenant; edit name/contact/locale if `tenant.update`; status/subscription read-only |
| A2.4 Organization LE/Branch | ✅ Shipped | Hub links to Accounting Legal Entities & Branches; Company = LE documented; User↔branch → A3 |
| A2.5 Permission gates | ✅ Shipped | `canRoute` + `canViewAdminNavItem`; A4 Users/Roles/Effective Access untouched |

---

### 8. Data scope

| Field | Value |
|-------|-------|
| **Current implementation** | Tenant isolation via `tenantId` on queries + JWT/middleware. No OWN/TEAM/BRANCH scopes. |
| **API status** | ❌ Scope-aware list filters |
| **DB status** | ❌ Scope fields on UserRole / membership; ❌ `UserBranch` |
| **FE status** | ❌ Scope picker intentionally **not** exposed (would be unenforceable) |
| **Permission status** | Permission-only RBAC within tenant (A4.1–A4.3 shipped) |
| **Known gaps** | Entire OWN / BRANCH / COMPANY enforcement surface |
| **Required work** | **PASS WITH CONDITION (A4.4):** Phase A ships permission-only RBAC + EffectiveAccess. Scope enums (`ALL` / `OWN` / `BRANCH` / `COMPANY`) and enforcement deferred until UserBranch (or equivalent) + list filters across CRM/SO — post-A4 / A3 Users work. Do not add a fake scope UI. |
| **Risk** | **High** for multi-user / multi-plant sales orgs until branch ACL lands |
| **Tests** | Tenant isolation tests exist for some modules; ❌ scope tests |

---

### A4 delivery status (2026-07-27)

| Item | Status | Notes |
|------|--------|-------|
| A4.1 Role builder UX | ✅ Shipped | Module labels for full catalog prefixes; CRM User / Sales Viewer / Admin presets; `.view` auto-include on mutate |
| A4.2 Effective Access | ✅ Shipped | `EffectiveAccessService` + `GET …/users/:userId/effective-access` (user.view or self); User detail FE section |
| A4.3 / A4.6 Safeguards | ✅ Shipped | System roles → 403; last Tenant Admin protection; actor may only assign owned permissions unless Tenant/Super Admin |
| A4.4 Data scope | **PASS WITH CONDITION** | No schema/UI for OWN/BRANCH; document only — enforce later with UserBranch |
| A4.5 Tests | ✅ Unit | `backend/tests/a4-roles-effective-access.test.ts` (helpers + 403 contract); live last-admin integration not in this pack |

### 9. MasterItem (sales readiness)

| Field | Value |
|-------|-------|
| **Current implementation** | `MasterItem`: code, name, category, base/purchase UOM, HSN, GST, stockable, purchasable, production/QC flags, `standardRate`, blocked/status. APIs `/items`, `/lookups/items`. FE purchase `ItemLookupSelect`. |
| **API status** | ✅ Item CRUD + lookup; ❌ sales filters (`salesAllowed`) |
| **DB status** | ❌ `salesAllowed`, `salesDescription`, `salesUomId`, `defaultSalesRate`, `salesLeadDays`, `defaultFulfilmentMethod` |
| **FE status** | Item master UI for inventory/purchase; CRM does **not** use item picker for sales |
| **Permission status** | `master.item.*`, `master.lookup.view`; CRM sales roles oriented to `master.product.view` |
| **Known gaps** | All Phase A sales fields; sales Item picker; role packs for CRM→item view |
| **Required work** | **A6 before A7** — additive migration + Zod + lookup filters + `<ItemMasterPicker mode="sales" />` |
| **Risk** | **Medium** schema; **High** if CRM cut over without fields |
| **Tests** | Item CRUD/import; ❌ sales-item tests |

### 10. MasterProduct / CRM commercial identity

| Field | Value |
|-------|-------|
| **Current implementation** | `master_products` + `/masters/products`; FE `productMasterStore`, `useProductMasterOptionMap`, `canUseProductInSales` (released + active). Bridge to FG via `fgItemId`. |
| **API status** | ✅ Product CRUD |
| **DB status** | ✅ Table retained (must **not** drop in Phase A) |
| **FE status** | Primary CRM/SO picker |
| **Permission status** | `master.product.*` on sales roles |
| **Known gaps** | Parallel catalog; sellability on Product not Item |
| **Required work** | A7 dual-read/dual-write; then remove CRM nav dependency; keep table |
| **Risk** | **High** O2C spine during cutover |
| **Tests** | `test-product-master.ts`; CRM UAT scripts product-centric |

### 11. CRM / SO `productId` inventory (migration inputs)

| Location | Field | Notes |
|----------|-------|-------|
| `crm_opportunity_lines` | `productId`, `itemId` | Soft refs; item often = `fgItemId` |
| `crm_leads` | (none) | Product lines encoded in `productRequirement` TEXT |
| `crm_quotations` | `productId` | Header |
| `crm_quotation_documents` | `priceLines[].productId` | JSON |
| `crm_sales_orders` | `productId` | Header |
| `crm_sales_orders` | `lines[].productId` | JSON — **no line `itemId`** |
| `crm_tax_invoice_lines` | `productId` | Soft |
| `dispatch_requirements` | `productId` + `itemId` | Dual |
| `production_demands` | `productItemId` | **Already MasterItem FK** |
| Quotation templates | `productFamily` string | Not an id — keep as metadata |

**Resolver today:** `resolveManufacturedProductItem` accepts SO `productId` as Item **or** Product→`fgItemId`.

### 12. Dual-mode (demo vs API)

| Field | Value |
|-------|-------|
| **Current implementation** | `VITE_USE_API` gates `ApiAuthGate`, bridges, hydration. Rule: never mix demo and API records. |
| **API status** | Bridges for CRM/admin/masters |
| **Known gaps** | Some Sales surfaces (e.g. Order Status) still demo-store for WO metrics; commercial Proforma partially demo |
| **Required work** | A8: assert no demo contamination in API mode for Admin/Auth/CRM Item paths |
| **Risk** | **High** if mixed in production build |

---

## Module touch map (A7 blast radius)

| Module | Product usage | Item-ready? | Phase A action |
|--------|---------------|-------------|----------------|
| Lead | Encoded product lines | No | Optional Items; rename Interested Items |
| Opportunity | Lines productId+itemId | Partial | Prefer itemId; picker swap |
| Quotation | Header + JSON productId | No | itemId + snapshots |
| Quotation templates | productFamily | N/A | Keep family; optional default item |
| Sales Order | Header + JSON productId | No | itemId on lines; convert preserve |
| Manufacturing demand | productItemId | Yes | Prefer SO.itemId; keep fallback |
| Dispatch | dual ids | Partial | Prefer itemId |
| CRM Tax Invoice | productId | No | Align itemId |
| Purchase / Inventory / AR invoice | Often itemId already | Varies | No new product bridges |
| Forecast / Guided Deal / Mobile CRM | Little/no productId | — | Minimal |

**Estimated A6+A7 effort:** ~3–6 engineer-weeks with dual-read window. Highest risk: SO JSON lines + quotation convert + orphans without `fgItemId`.

---

## Security safeguards (A4.6) — current vs required

| Safeguard | Current | Required |
|-----------|---------|----------|
| Last Tenant Administrator protection | ✅ Enforced on deactivate / delete / remove-role / strip admin grants from role | Must prevent delete/deactivate/self-lockout |
| Assign only permissions admin owns | ✅ Intersect with actor effective permissions unless Tenant/Super Admin | Enforce |
| System roles immutable | ✅ BE rejects PATCH/DELETE with **403** AuthorizationError | Harden |
| Cross-tenant role assign | ✅ Tenant middleware | Keep + test |
| Cross-tenant ID attacks | ✅ Pattern on modules; extend matrix in A8 | Explicit regression pack |

---

## Test & verification debt (A8 inputs)

| Area | Exists | Gap |
|------|--------|-----|
| Auth | Invalid login only | Refresh, logout, revoke, reset, lockout, me, expired session |
| Admin | None dedicated | Users/Roles/Tenants CRUD live + FE |
| Permissions | Module-level in CRM/Purchase | No-access / view / approve / 403 API matrix |
| Tenant isolation | Partial across CRM/finance | Cross-tenant IDs for User/Role/Item/Quote/SO/PO/WO |
| Item migration | None | Dual-read, backfill, no new productId-only lines |
| Demo/API mix | Hydration patterns | Explicit A8 checklist |

---

## Recommended implementation order (post-A0)

1. **A1** — Auth UX messages, refresh concurrency proof, change-password FE, lockout foundation, Access Denied guards, reset delivery strategy.  
2. **A2–A3** — Admin shell IA; Overview; Tenant Profile; Users drawer; invitation model (email or documented condition).  
3. **A4** — Role builder UX; permission dependencies; **data scope design decision** (implement OWN/BRANCH or PASS WITH CONDITION); Effective Access API.  
4. **A5** — LoginActivity table + UI; Sessions revoke; lockout UI.  
5. **A6** — MasterItem sales columns + sales lookup + ItemMasterPicker.  
6. **A7** — Dual-write `itemId`, backfill, migration exceptions page, flip pickers/gates, remove CRM Product nav (keep `master_products` table).  
7. **A8–A9** — Regression pack + `docs/PHASE_A_DEPLOYMENT_READINESS.md`.

---

## Explicit non-goals (do not start in Phase A)

- Advanced MRP / FIFO / weighted average / Auto Manufacturing GL  
- CMMS / Maintenance  
- Purchase architecture rewrite  
- New CRM workflow redesign  
- Destructive delete of `master_products`  
- Parallel security stack outside existing JWT + middleware  

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering | | | A0 complete — proceed A1 |
| Product / Client readiness | | | |

**Next action:** Proceed **A2–A3** Admin / Organization / Users (A1 auth hardening shipped 2026-07-27). Do **not** start A7 until A6 sales fields land and this productId inventory is used for dual-write design.
