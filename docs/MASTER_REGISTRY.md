# Master Data Registry

Canonical master registers for FOS ERP: one business entity → one route → one primary data source.  
Multiple module hub shortcuts are allowed; duplicate implementations are not.

**Code is source of truth.** When this doc disagrees with routes/stores, update this doc.

Last verified: **2026-07-13** (master consolidation Phases 0–6).

Related: [`master-module-audit.md`](master-module-audit.md) · [`master-api-map.md`](master-api-map.md) · [`master-usage-map.md`](master-usage-map.md) · [`master-dependency-map.md`](master-dependency-map.md) · [`SESSION_CHANGELOG.md`](SESSION_CHANGELOG.md)

---

## Rule

| Allowed | Not allowed |
|---------|-------------|
| CRM / Purchase / Sales hubs linking the same register | Separate “CRM Company Master” vs “Purchase Company Master” with different components/stores |
| Legacy path redirects (`Navigate replace`) | Two live CRUD trees for the same entity |
| FE classification flags (e.g. `isCustomer`) | Second master named “Customer” for the same `CrmCompany` |

---

## Canonical map (consolidated)

| Entity | Canonical name | Canonical route | Primary component | Permission key | Entity / API / store | Legacy aliases |
|--------|----------------|-----------------|-------------------|----------------|----------------------|----------------|
| Company | Company Master | `/masters/companies` | `CustomerListPage` / `CustomerFormPage` / `Customer360Page` | `masters.companies` | Prisma `CrmCompany` · `GET/POST /crm/companies` · FE `masterStore.customers` | `/masters/customers/*` |
| Role×Permission | Role Permission Matrix | `/masters/role-permissions` | `PermissionMatrixPage` | `masters.role-permissions` | FE `ROLE_PERMISSION_MATRIX` (`permissionMatrix.ts`) | `/masters/permissions`, `/settings/permissions` |
| User | User Management | `/masters/users` | `UserMasterListPage` → CRM `owners` | `masters.users` | CRM master kind `owners` (`crmMasterStore`) | `/crm/masters/owners*` |
| Approval | Approval Workflow | `/masters/approval-workflows` | `ApprovalMatrixConfigPage` | `masters.approval-workflows` | FE `approvalStore` | `/masters/approval-matrix`, `/settings/approval-matrix` |

**Intentionally not renamed in consolidation:** store key `customers`, components named `Customer*`, API path `/crm/companies`. Routes, nav labels, and catalog cards are canonical; internals rename is a separate ticket.

**Future (not implemented):** Party Type enum (`Customer | Prospect | Vendor | Partner | Other`). Keep FE `isCustomer` / `customerType` until an architecture ticket. Do **not** merge Vendor Master into Company.

---

## Must stay separate

| Pair | Why |
|------|-----|
| Item ≠ Product | Inventory / procurement identity vs FG sellable / configurable offering (`fgItemId` → Item) |
| Warehouse ≠ Location | Inventory facility vs BC-style document / org location |
| Payment Method ≠ Payment Terms | How money moves (NEFT, UPI…) vs when due (Net 30…) |
| Product ≠ Product Interest | FG catalog vs CRM interest relationship |
| Vendor ≠ Company | Procurement vendor register ≠ CRM company/party |
| Vendor ≠ Supplier | Same entity; **Vendor** is the system term; “Supplier” is display wording only |

---

## User / Employee / Owner

| Term | Intended meaning |
|------|------------------|
| **Employee** | Person employed by the organization (may have no login) |
| **User** | Application login / master assignment identity |
| **Owner** | Role/context assigned to an eligible user (lead, opportunity, quotation) |

**Today:** one CRM `owners` register at `/masters/users` (catalog label **User Management**). Legacy `/crm/masters/owners*` redirects there. Masters hub quick card uses the same label (no separate “Employees” master card).

**Gap (documented, not merged):** Auth API `User` (`/api/v1/t/:slug/users`) is separate from CRM owners. No unified auth-user admin UI in this pass. Future architecture may split Employee (HR) from User (login) if required. Field `employeeCode` remains an attribute on the user register.

---

## Module UX vs master registers

| Surface | Route | Role |
|---------|-------|------|
| Company Master | `/masters/companies` | Canonical register |
| CRM companies list | `/crm/customers` | CRM module UX (kept; not a second master) |
| Sales Company 360 hub | `/sales/customers` | Sales module UX (kept) |
| New Company deep links | `/masters/companies/new` | Prefer masters path |

---

## Commercial Terms — single source (P3-6 done 2026-07-13)

**Canonical source:** CRM masters (`crmMasterStore`)

| Kind | Register path | Consumers |
|------|---------------|-----------|
| Payment Terms | `/masters/payment-terms` | Quotation, SO `CommercialTermSelect`, Purchase PO, quick-create, search |
| Delivery Terms | `/crm/masters/delivery-terms` | Same |
| Warranty Terms | `/crm/masters/warranty-terms` | Quotation |
| Commercial Terms (clauses) | `/crm/masters/commercial-terms` | Quotation clause catalogue |

**Adapter:** `utils/commercialTermsAdapter.ts` maps CRM entries → `CommercialTerm` shape for SO / quick-create selects (`termType` payment \| delivery).

**Retired:** `masterStore.commercialTerms`, `seedCommercialTerms`, persist merge. Tax quick-create redirects users to GST masters (no CRM tax-term kind).

**SO values:** still store **term name** free-text (existing records keep a custom option when not in CRM list).

Purchase **freight-terms** remain purchase-owned.

---

## Purchase linked masters

Purchase hub shortcuts for **global** registers open the **canonical** register (hub cards use `listRoute` directly). Legacy `/purchase/masters/{slug}…` paths still work via `PurchaseLinkedMasterPage` → path-preserving `<Navigate replace />`.

| Purchase slug | Canonical `listRoute` | Display title |
|---------------|----------------------|---------------|
| vendors | `/masters/vendors` | Vendor Master |
| items | `/masters/items` | Item Master |
| item-categories | `/masters/item-categories` | Item Category |
| warehouses | `/masters/warehouses` | Warehouse |
| locations | `/masters/locations` | Location |
| uom | `/masters/uom` | UOM |
| payment-terms | `/masters/payment-terms` | Payment Terms |
| delivery-terms | `/crm/masters/delivery-terms` | Delivery Terms |
| approval-matrix | `/masters/approval-workflows` | **Approval Workflow** (legacy slug kept for bookmarks) |
| qc-parameters | `/quality/parameters` | QC Parameters |
| inspection-plans | `/quality/inspection-plans` | Inspection Plans |

Purchase-owned kinds (`freight-terms`, `buyers`, `qc-rules`, `grn-tolerance`, `return-reasons`, …) remain real CRUD under `/purchase/masters/...`.

---

## Company — consumers & aliases

| Area | Detail |
|------|--------|
| Live routes | `/masters/companies`, `/new`, `/:id/edit`, `/:id/360` |
| Legacy | `/masters/customers/*` → `MastersCustomersLegacyRedirect` → companies |
| Catalog | `masterModuleStructure.ts` — `companies` only (`legacyPaths` includes customers) |
| Helpers | `entity360Routes.ts` — `customer360Path` → `/masters/companies/.../360` |
| Classification | FE `isCustomer` / `firstInvoicedAt` (party status); not a second master |
| Bridge | `crmApiBridge` hydrates `customers` from `/crm/companies`; after company save with contact fields, hydrates linked contacts into `crmStore` |
| Contact sync | `contactPerson` / `contactPhone` / `contactEmail` on company create/update → primary `crm_contacts` row (backend `company.service`; demo: `syncCustomerFieldsToPrimaryContact`) |

---

## Navigation alias rule

CRM / Purchase / Sales hubs may list the same register for discoverability. Every entry must open the **canonical** path (or a catch-all that already Navigates there).

**Masters Data index:** Purchase-linked rows are **hidden** when `listRoute` already exists under Inventory / CRM / Quality (`buildPurchaseMasterSetupLinks`). The Purchase Masters hub still shows those shortcuts.

---

## How to prevent future duplicates

1. Add new masters only via [`trailer-erp/src/config/masterModuleStructure.ts`](../trailer-erp/src/config/masterModuleStructure.ts).
2. Update this registry in the same PR.
3. Prefer `legacyPaths` + `Navigate` over a second catalog `def(...)`.
4. Run `npm run test:route-integrity` (and `--write-baseline` when aliases change).
