# RBAC & Approval Matrix Completion Report

**Project:** Vasant ERP (`trailer-erp`)  
**Sprint:** Global Approval Matrix + RBAC Hardening  
**Date:** June 2026  
**Status:** ✅ Complete — central permission + approval framework wired across major modules

---

## Executive Summary

This sprint hardened the **single reusable RBAC and approval engine** already scaffolded in Factory Control Sprints 5–6. Work expanded granular roles, route/action guards, approval rejection workflow, module store wiring, settings/approvals UI, and automated test coverage — without changing core business transaction logic or redesigning existing screens.

| Area | Before | After |
|------|--------|-------|
| ERP roles | 14 coarse roles + aliases | **19 primary roles** + legacy aliases |
| Permission actions | 10 actions | **12 actions** (+ `submit`, `override`) |
| Route guards | Partial map; basic Access Denied | **Full module map** + page name + Dashboard button |
| Action guards | 2 `PermissionGate` usages | `ActionGuard` + store `assertPermission` |
| Approval doc types | 8 types | **14 types** (PR, PO amendment, WO release, NCR, job work, etc.) |
| Approval workflow | Approve-only | Approve + **reject (remarks required)** + return for correction |
| Module wiring | PO, BOM, cost, ECO | + **routing, dispatch override, invoice cancel, NCR closure** |
| Settings UI | `/masters/approval-matrix` only | `/settings/*` + `/approvals` inbox |
| Tests | `test:approval-matrix` (13) | **16** RBAC + **24** approval matrix |
| CI gate | Approval matrix only | **+ `test:rbac`** in factory-control |

**Test results (verified 23 Jun 2026):**
- `npm run test:rbac` — **16/16 passed**
- `npm run test:approval-matrix` — **24/24 passed**
- `npm run build` — **PASS**

---

## 1. Global RBAC Model ✅

**Config:** `src/config/permissionMatrix.ts`  
**Session / helpers:** `src/utils/permissions.ts`

### Primary roles (19)

Admin, CEO, Director, Engineering Head, Sales Manager, Planning Manager, Purchase Head, Purchase User, Store Manager, Store User, Production Head, Production Supervisor, Shop Floor Operator, Quality Head, Quality Inspector, Dispatch Manager, Dispatch User, Accounts Head, Accounts User

Legacy aliases retained (`purchase` → Purchase User, `management` → Director, etc.) for backward-compatible tests and store calls.

### Permission actions (12)

`view`, `create`, `edit`, `submit`, `approve`, `release`, `post`, `cancel`, `close`, `print`, `export`, `override`

### Permission scope

Module × action matrix in `ROLE_PERMISSION_MATRIX`. Route-level view permissions via `ROUTE_PERMISSION_MAP` (includes page names for Access Denied UI).

### Key role rules (examples)

| Role | Can | Cannot |
|------|-----|--------|
| Purchase User | Create/edit/submit PR & PO | Approve PO |
| Purchase Head | Full purchase module | — |
| Store User | Issue material (`inventory.post`) | Approve PO |
| Quality Inspector | Inspect (`quality.post`) | Close critical NCR |
| Shop Floor Operator | Start/complete job (`production.post`) | Close WO |
| Dispatch User | Prepare dispatch | Request override |
| Accounts User | Post payment | Cancel invoice |
| Engineering Head | Release ECO | — |
| Director | High-tier matrix approvals | — |

---

## 2. Route Guards ✅

**Component:** `src/components/auth/ProtectedRoute.tsx`  
**Wiring:** `AppShell` → `ProtectedOutlet` (global)

### Protected route prefixes

Sales, Purchase, Inventory, Production (WO/job-work/shop-floor/MRP), Quality, Dispatch, Invoice/Costing, Engineering, Reports, Masters, Settings, Approvals, Traceability/QR

### Access Denied page shows

- Page name (`resolveRoutePageName`)
- Required permission key
- Current role label
- **Go to Dashboard** button → `/home`

---

## 3. Action Guards ✅

**Components:**
- `PermissionGate` — hide when denied
- `ActionGuard` — disable with `title` reason when denied

**Store layer:** `assertPermission(module, action)` on all critical mutations (existing + expanded in routing, invoice, dispatch, quality).

**UI example:** PO Approve button on Purchase Detail uses `ActionGuard` — disabled with denial reason for Purchase User.

---

## 4. Approval Matrix Engine ✅

**Types:** `src/types/approvalMatrix.ts`  
**Seed rules:** `src/data/approval/seedApprovalMatrix.ts` (15 rules)  
**Store:** `src/store/approvalStore.ts`  
**Engine:** `src/utils/approvalEngine.ts`

### Rule fields

Rule ID, document type, condition type, condition value, approval level (sequence), required role (approver code), optional required user, escalation days, active/inactive

### Condition types

Amount, status, department, cost variance, QC severity, change impact, dispatch override, always, is revision

### Document types (14)

Purchase Requisition*, Purchase Order, PO Amendment, BOM Revision, Routing Revision, ECO, WO Release, Cost Override, QC Reject Closure, NCR Closure, Dispatch Override, Invoice Cancellation, Payment Adjustment, Job Work Order

\*PR type defined; wiring follows same engine pattern when PR submit adds matrix sync.

### Approver slots (8)

Purchase Head, Director, Engineering Head, Finance, Quality Head, Dispatch Head, Accounts Head, Production Head

---

## 5. Approval Workflow ✅

### Request statuses

`pending` → `approved` | `rejected` | `returned`

### Step record captures

Document type, entity ID, approval level, approver role, approver user, status, remarks, approved/rejected date, created date

### Rules implemented

- Document blocked while approval pending (store checks + `assertMatrixApproval`)
- Rejection **requires remarks** (`rejectCurrentStep` / `rejectApprovalStep`)
- Return for correction unlocks resubmit path (`returnForCorrection`)
- Final approval updates entity status (PO, BOM, ECO, routing, etc.)

---

## 6. Module Integration ✅

| Module | Integration |
|--------|-------------|
| **Purchase** | PO amount tiers (existing); PO Approve action guard |
| **Engineering** | BOM revision (existing); **routing revision** matrix; ECO panel |
| **Production** | WO release rule seeded (`wo_release`); job work rule seeded |
| **Quality** | **Critical NCR closure** requires Quality Head matrix approval |
| **Dispatch** | **Dispatch override** request + approval; confirm checks override when QC missing |
| **Invoice** | **Cancellation** requires Accounts Head approval before cancel |
| **Cost** | Cost override (existing) |

All integration uses `syncApprovalRequest` / `assertMatrixApproval` / `advanceApprovalStep` — **no hardcoded approvers in pages**.

---

## 7. UI / UX ✅

### Routes

| Route | Page |
|-------|------|
| `/settings` | Settings home |
| `/settings/roles` | Role Master |
| `/settings/permissions` | Permission Matrix (read-only view) |
| `/settings/approval-matrix` | Approval Matrix config |
| `/approvals` | My Approvals |
| `/approvals/:id` | Approval Detail + timeline |
| `/masters/approval-matrix` | Legacy alias (same config page) |

### Approval panels added

| Document | Panel location |
|----------|----------------|
| PO | Purchase Detail (existing) |
| ECO | ECO Detail |
| BOM | BOM Detail (existing) |
| Routing | Routing Detail |
| Cost override | Product Detail (existing) |
| Dispatch override | Dispatch Detail |
| Invoice cancellation | Invoice Detail |

### Components

- `ApprovalChainPanel` — step chain on document pages
- `ApprovalTimeline` — wraps design-system `Timeline` for approval events

Uses existing design system: `OperationalPageShell`, `DataGrid`, `Timeline`, semantic status tokens.

---

## 8. Tests ✅

| Script | Cases | CI |
|--------|-------|-----|
| `npm run test:rbac` | 16 | ✅ factory-control |
| `npm run test:approval-matrix` | 24 | ✅ factory-control |

### Coverage highlights

1. Purchase User cannot approve PO ✅  
2. Purchase Head has approve permission ✅  
3. Director has high-level approve ✅  
4. Store User can issue, not approve PO ✅  
5. ECO matrix approval chain ✅  
6. Critical NCR closure gate (store) ✅  
7. Dispatch override request ✅  
8. Invoice cancellation approval gate ✅  
9. Unauthorized `/settings` route blocked ✅  
10. Permission denial reason descriptive ✅  
11. Rejection requires remarks ✅  
12. Approval timeline records events ✅  

---

## File Inventory

| File | Role |
|------|------|
| `src/config/permissionMatrix.ts` | Role × module × action matrix + route map |
| `src/utils/permissions.ts` | Session, `canPermission`, `assertPermission`, denial reasons |
| `src/components/auth/ProtectedRoute.tsx` | Route guard, Access Denied, ActionGuard |
| `src/types/approvalMatrix.ts` | Approval domain types |
| `src/data/approval/seedApprovalMatrix.ts` | Default rules + approver mappings |
| `src/store/approvalStore.ts` | Persisted rules, requests, reject/return |
| `src/utils/approvalEngine.ts` | Rule resolution, workflow, timeline builder |
| `src/modules/settings/SettingsPages.tsx` | Role + permission admin views |
| `src/modules/approval/ApprovalPages.tsx` | My Approvals + detail |
| `src/modules/approval/ApprovalMatrixPage.tsx` | Matrix config (expanded filters) |
| `src/components/approval/ApprovalTimeline.tsx` | Timeline component |
| `scripts/test-rbac.ts` | RBAC test suite |
| `scripts/test-approval-matrix.ts` | Extended approval tests |

**Store wiring updated:** `routingStore`, `dispatchStore`, `invoiceStore`, `qualityStore`

---

## Constraints Honoured

- ✅ No changes to core ERP transaction flows (GRN, WO, dispatch posting logic unchanged)
- ✅ No UI redesign — panels and guards added to existing detail pages
- ✅ No duplicated approval logic in pages — all via `approvalEngine`
- ✅ Legacy role aliases preserved for existing tests

---

## Remaining (P2)

| Item | Notes |
|------|-------|
| Wire `purchase_requisition` matrix on PR submit | Type + engine ready |
| WO release matrix on `releaseWorkOrder` | Rule seeded; optional WO flag not yet set in store |
| Job work order matrix on send | Rule seeded; job work store hook pending |
| Payment adjustment matrix | Rule seeded; hook on payment adjust pending |
| Universal `ActionGuard` on all module buttons | PO approve exemplar; extend incrementally |
| Real AuthModule / JWT | Mock session remains |
| Persist migration for old approval rules missing `conditionType` | Reset to defaults via config UI |

---

## Manual Verification Checklist

1. Switch role to **Purchase User** → open submitted PO → Approve button disabled with reason  
2. Switch to **Purchase Head** → approve ₹6L PO  
3. Open **Settings → Role Master** and **Permission Matrix**  
4. Open **Settings → Approval Matrix** → filter ECO / dispatch / NCR rules  
5. Open **My Approvals** (`/approvals`) → pending items for approver role  
6. ECO Detail → Approval Matrix panel shows engineering head step  
7. Dispatch without final QC → request override → approve → confirm dispatch  
8. Shop Floor role → navigate to `/settings` → Access Denied with page name + permission  

---

*Generated after Global RBAC + Approval Matrix Hardening sprint.*
