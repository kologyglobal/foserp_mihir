# ERP Role-Based Access Control (RBAC)

**Document type:** Security & permissions specification  
**System:** Vasant Trailer ERP  
**Status:** Design only — **not implemented** (no auth today)  
**Companion:** [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md) Phase 0 (AuthModule)

---

## 1. Roles

| Role | Code | Primary users | Department |
|------|------|---------------|------------|
| **Admin** | `admin` | IT / ERP administrator | IT |
| **Sales** | `sales` | Sales executives, commercial team | Commercial |
| **Purchase** | `purchase` | Buyers, procurement officers | Procurement |
| **Stores** | `stores` | Store keepers, material issuers | Stores / Inventory |
| **Production** | `production` | Planners, supervisors, shop floor | Production |
| **Quality** | `quality` | QC inspectors, quality engineers | Quality |
| **Dispatch** | `dispatch` | Logistics, loading bay, transport desk | Dispatch |
| **Accounts** | `accounts` | Finance, billing, receivables | Finance |
| **Management** | `management` | Plant head, production manager, GM | Management |

Users may hold **one primary role** + optional **secondary roles** (e.g. Production supervisor also has Quality read).  
**Admin** bypasses all permission checks except audit-immutable records.

---

## 2. Permission Model

### 2.1 Naming convention

```text
{module}.{resource}.{action}
```

| Action | Meaning | Example |
|--------|---------|---------|
| `view` | Read lists and detail | `inventory.stock.view` |
| `create` | Create draft records | `purchase.po.create` |
| `edit` | Modify draft / open records | `masters.item.edit` |
| `submit` | Send for approval | `bom.header.submit` |
| `approve` | Approval gate (separation of duties) | `purchase.pr.approve` |
| `release` | Release to production / MRP consumption | `bom.header.release` |
| `post` | Irreversible ledger / document post | `inventory.grn.post` |
| `execute` | Operational command (no approval) | `production.job_card.complete` |
| `cancel` | Cancel open documents | `dispatch.plan.cancel` |
| `close` | Close completed lifecycle | `production.wo.close` |
| `admin` | Module configuration | `system.settings.admin` |

### 2.2 Enforcement layers

| Layer | Rule |
|-------|------|
| **API (NestJS)** | `@RequirePermission('purchase.pr.approve')` on every command endpoint — **mandatory** |
| **UI (React)** | Hide/disable buttons when permission missing — **UX only, not security** |
| **Audit** | Log `userId`, `role`, `permission`, `entityId` on every `post`, `approve`, `release`, `close` |

---

## 3. Separation of Duties (SoD) — Hard Rules

These combinations are **never allowed** on the same user (even with multiple roles):

| Rule | Cannot combine |
|------|----------------|
| **SOD-1** | `purchase.pr.create/submit` + `purchase.pr.approve` |
| **SOD-2** | `purchase.po.create` + `purchase.po.approve` (future PO approval) |
| **SOD-3** | `bom.header.submit` + `bom.header.approve` |
| **SOD-4** | `routing.header.submit` + `routing.header.approve` |
| **SOD-5** | `production.job_card.complete` + `quality.inspection.decide` on same WO operation |
| **SOD-6** | `dispatch.plan.confirm` + `dispatch.pod.record` |
| **SOD-7** | `invoice.header.create` + `invoice.payment.record` above threshold* |

*Threshold configurable — e.g. payments > ₹5,00,000 require Management co-approval (Phase 2).

### 3.1 Store User — explicit denials (your example)

A user with role **`stores`** must **NOT** have:

| Permission | Why |
|------------|-----|
| `bom.header.approve` | Engineering / management approval |
| `bom.header.release` | Released BOM drives MRP & costing |
| `routing.header.approve` | Process engineering gate |
| `routing.header.release` | Production eligibility gate |
| `purchase.pr.approve` | Procurement approval |
| `purchase.po.approve` | Commitment of company funds |
| `purchase.po.create` | Buyer function — not store keeper |
| `production.wo.close` | Production completion authority |
| `production.wo.release` | Planner function |
| `mrp.run.execute` | Planning function |
| `invoice.header.post` | Finance function |
| `invoice.payment.record` | Finance function |
| `masters.product.edit` | Master data governance |

Store User **CAN**:

| Permission | Maps to today |
|------------|---------------|
| `inventory.stock.view` | Dashboard, ledger, stock positions |
| `inventory.inward.post` | Material inward, GRN posting |
| `inventory.issue.post` | Material issue (non-WO) |
| `inventory.issue_wo.post` | Issue to work order |
| `inventory.reservation.create/edit` | WO / SO reservations |
| `inventory.adjustment.post` | Stock adjustment* |
| `purchase.grn.post` | Post GRN from PO |
| `production.material.issue` | Issue all reserved on WO |
| `dispatch.plan.view` | Read-only dispatch register |

*Stock adjustment may require Management approval above value threshold — configurable.

---

## 4. Permission Matrix by Module

Legend: ✅ Allowed · 👁 View only · ❌ Denied · ⚡ Own records only

### 4.1 Masters

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `masters.uom.view` | ✅ | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | ✅ |
| `masters.uom.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `masters.item.view` | ✅ | 👁 | 👁 | ✅ | ✅ | 👁 | 👁 | 👁 | ✅ |
| `masters.item.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `masters.customer.view` | ✅ | ✅ | 👁 | 👁 | 👁 | ❌ | 👁 | ✅ | ✅ |
| `masters.customer.edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `masters.vendor.view` | ✅ | 👁 | ✅ | 👁 | 👁 | ❌ | 👁 | ✅ | ✅ |
| `masters.vendor.edit` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `masters.product.view` | ✅ | ✅ | 👁 | 👁 | ✅ | 👁 | 👁 | 👁 | ✅ |
| `masters.product.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `masters.warehouse.view` | ✅ | 👁 | 👁 | ✅ | 👁 | 👁 | 👁 | 👁 | ✅ |
| `masters.warehouse.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.2 Engineering — BOM & Routing

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `bom.header.view` | ✅ | 👁 | 👁 | 👁 | ✅ | 👁 | ❌ | 👁 | ✅ |
| `bom.header.create/edit` | ✅ | ❌ | ❌ | ❌ | ⚡ | ❌ | ❌ | ❌ | ✅ |
| `bom.header.submit` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `bom.header.approve` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `bom.header.release` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `routing.header.view` | ✅ | 👁 | 👁 | 👁 | ✅ | 👁 | ❌ | 👁 | ✅ |
| `routing.header.create/edit` | ✅ | ❌ | ❌ | ❌ | ⚡ | ❌ | ❌ | ❌ | ✅ |
| `routing.header.submit` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `routing.header.approve` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `routing.header.release` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `work_center.view/edit` | ✅ | ❌ | ❌ | ❌ | ⚡/❌ | 👁 | ❌ | ❌ | ✅ |

### 4.3 Sales & MRP

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `sales.order.view` | ✅ | ✅ | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | ✅ |
| `sales.order.create/edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `sales.order.confirm` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `sales.order.cancel` | ✅ | ⚡ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `mrp.dashboard.view` | ✅ | 👁 | 👁 | 👁 | ✅ | 👁 | ❌ | 👁 | ✅ |
| `mrp.run.execute` | ✅ | ❌ | ❌ | **❌** | ✅ | ❌ | ❌ | ❌ | ✅ |
| `mrp.reservation.execute` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### 4.4 Purchase

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `purchase.pr.view` | ✅ | 👁 | ✅ | 👁 | 👁 | ❌ | ❌ | 👁 | ✅ |
| `purchase.pr.create` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.pr.submit` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.pr.approve` | ✅ | ❌ | ⚡ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.rfq.view/create` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.po.view` | ✅ | 👁 | ✅ | 👁 | 👁 | ❌ | ❌ | 👁 | ✅ |
| `purchase.po.create` | ✅ | ❌ | ✅ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.po.approve` | ✅ | ❌ | ⚡ | **❌** | ❌ | ❌ | ❌ | ❌ | ✅ |
| `purchase.grn.view` | ✅ | ❌ | ✅ | ✅ | 👁 | ❌ | ❌ | 👁 | ✅ |
| `purchase.grn.post` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.5 Inventory / Stores

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `inventory.stock.view` | ✅ | 👁 | 👁 | ✅ | ✅ | 👁 | 👁 | 👁 | ✅ |
| `inventory.ledger.view` | ✅ | ❌ | 👁 | ✅ | 👁 | ❌ | ❌ | 👁 | ✅ |
| `inventory.opening.post` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `inventory.inward.post` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `inventory.issue.post` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `inventory.issue_wo.post` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `inventory.adjustment.post` | ✅ | ❌ | ❌ | ⚡ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `inventory.reservation.view` | ✅ | 👁 | 👁 | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `inventory.reservation.create` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `inventory.reservation.cancel` | ✅ | ❌ | ❌ | ⚡ | ⚡ | ❌ | ❌ | ❌ | ✅ |

### 4.6 Production / Work Orders

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `production.wo.view` | ✅ | 👁 | 👁 | 👁 | ✅ | ✅ | 👁 | 👁 | ✅ |
| `production.wo.create` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.wo.plan` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.wo.release` | ✅ | ❌ | ❌ | **❌** | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.material.reserve` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.material.issue` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.start` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.job_card.start` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.job_card.complete` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.wo.complete` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.sa_receipt.post` | ✅ | ❌ | ❌ | ⚡ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.fg_receipt.post` | ✅ | ❌ | ❌ | ⚡ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `production.wo.close` | ✅ | ❌ | ❌ | **❌** | ⚡ | ❌ | ❌ | ❌ | ✅ |
| `production.subcontract.send/receive` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### 4.7 Quality

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `quality.inspection.view` | ✅ | ❌ | ❌ | 👁 | 👁 | ✅ | ❌ | ❌ | ✅ |
| `quality.inspection.decide` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `quality.rework.view` | ✅ | ❌ | ❌ | 👁 | 👁 | ✅ | ❌ | ❌ | ✅ |
| `quality.rework.start/complete` | ✅ | ❌ | ❌ | ❌ | ⚡ | ✅ | ❌ | ❌ | ✅ |
| `quality.ncr.view` | ✅ | ❌ | ❌ | 👁 | 👁 | ✅ | ❌ | ❌ | ✅ |
| `quality.ncr.edit/close` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

### 4.8 Costing

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `costing.dashboard.view` | ✅ | 👁 | 👁 | ❌ | ✅ | 👁 | ❌ | ✅ | ✅ |
| `costing.wo_sheet.view` | ✅ | ❌ | ❌ | ❌ | ✅ | 👁 | ❌ | ✅ | ✅ |
| `costing.settings.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.9 Dispatch

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `dispatch.plan.view` | ✅ | 👁 | ❌ | 👁 | 👁 | ❌ | ✅ | 👁 | ✅ |
| `dispatch.plan.create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `dispatch.logistics.edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `dispatch.loading.execute` | ✅ | ❌ | ❌ | ⚡ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `dispatch.confirm.post` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `dispatch.pod.record` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `dispatch.cancel` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚡ | ❌ | ✅ |

### 4.10 Accounts / Invoice

| Permission | Admin | Sales | Purchase | Stores | Production | Quality | Dispatch | Accounts | Mgmt |
|------------|-------|-------|----------|--------|------------|---------|----------|----------|------|
| `invoice.view` | ✅ | 👁 | ❌ | ❌ | ❌ | ❌ | 👁 | ✅ | ✅ |
| `invoice.create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚡ | ✅ | ✅ |
| `invoice.post` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ✅ | ✅ |
| `invoice.payment.record` | ✅ | ❌ | ❌ | **❌** | ❌ | ❌ | ❌ | ✅ | ✅ |
| `invoice.cancel` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚡ | ✅ |
| `invoice.receivables.view` | ✅ | 👁 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### 4.11 System

| Permission | Admin | All others |
|------------|-------|------------|
| `system.users.manage` | ✅ | ❌ |
| `system.roles.manage` | ✅ | ❌ |
| `system.audit.view` | ✅ | Mgmt 👁 |
| `system.settings.admin` | ✅ | ❌ |
| `system.migration.import` | ✅ | ❌ |

---

## 5. Role Summaries (Quick Reference)

### Admin
Full access. Manages users, roles, sequences, migration imports.

### Sales
Customers, products (view), sales orders (create/confirm), MRP dashboard (view), dispatch/invoice (view), receivables (view).

### Purchase
Vendors, PR/RFQ/PO lifecycle, GRN (view + post with Stores), cannot approve own PR above policy without Management.

### Stores ⭐
**Inventory operations only.** GRN posting, inward, issue to WO, reservations, stock views.  
**Cannot:** approve BOM, approve/release routing, approve PR/PO, run MRP, release/close WO, post invoice, edit masters.

### Production
MRP run, WO full lifecycle (except close — supervisor/management), job cards, SA/FG receipt, subcontract, BOM/routing submit (draft edits).

### Quality
QC decisions, rework, NCR — **cannot** complete job cards on same operation they inspect (SOD-5).

### Dispatch
Dispatch plan, loading, confirm (FG issue), POD — **cannot** create invoice or record payment.

### Accounts
Invoices, post, payments, receivables, costing/finance views — **cannot** alter production or inventory.

### Management
Approves BOM, routing, PR, PO; closes WOs; costing settings; full read across modules; can override with audit trail.

---

## 6. Map Permissions → Existing Store Actions

| Store method | Required permission |
|--------------|---------------------|
| `bomStore.approveBom` | `bom.header.approve` |
| `bomStore.releaseBom` | `bom.header.release` |
| `routingStore.approveRouting` | `routing.header.approve` |
| `routingStore.releaseRouting` | `routing.header.release` |
| `purchaseStore.approvePr` | `purchase.pr.approve` |
| `purchaseStore.createPoFromPr` | `purchase.po.create` |
| `purchaseStore.postGrn` | `purchase.grn.post` |
| `inventoryStore.postIssueToWorkOrder` | `inventory.issue_wo.post` |
| `inventoryStore.postAdjustment` | `inventory.adjustment.post` |
| `mrpStore.runMrpForOrder` | `mrp.run.execute` |
| `workOrderStore.releaseWorkOrder` | `production.wo.release` |
| `workOrderStore.closeWorkOrder` | `production.wo.close` |
| `workOrderStore.postFgReceipt` | `production.fg_receipt.post` |
| `qualityStore.recordInspectionDecision` | `quality.inspection.decide` |
| `dispatchStore.confirmDispatch` | `dispatch.confirm.post` |
| `invoiceStore.postInvoice` | `invoice.post` |
| `invoiceStore.recordPayment` | `invoice.payment.record` |

---

## 7. Database Schema (Auth)

Align with [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md):

```sql
-- sys.users
id, email, password_hash, full_name, employee_code, primary_role_id, is_active

-- sys.roles
id, role_code  -- admin | sales | purchase | stores | production | quality | dispatch | accounts | management

-- sys.permissions
id, permission_code  -- e.g. bom.header.approve

-- sys.role_permissions
role_id, permission_id

-- sys.user_roles (secondary roles)
user_id, role_id

-- sys.audit_log
id, user_id, permission_code, action, entity_type, entity_id, payload_json, ip, created_at
```

### Prisma seed — role → permission bundles

Ship default bundles from Section 4 matrices; Admin gets `*.*.*`.

---

## 8. NestJS Implementation Sketch

```typescript
// roles.decorator.ts
export const RequirePermission = (...perms: string[]) =>
  SetMetadata('permissions', perms)

// permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const required = reflector.get<string[]>('permissions', ctx.getHandler())
    const user = ctx.switchToHttp().getRequest().user
    if (user.roles.includes('admin')) return true
    return required.every(p => user.permissions.includes(p))
  }
}

// Example controller
@Post('bom/:id/approve')
@RequirePermission('bom.header.approve')
approveBom(@Param('id') id: string, @CurrentUser() user: User) { ... }
```

### React hook (Phase 10 cutover)

```typescript
function usePermission(code: string): boolean {
  const perms = useAuthStore(s => s.permissions)
  return perms.includes(code) || perms.includes('*')
}

// BomApprovalBar.tsx
{usePermission('bom.header.approve') && (
  <Button onClick={onApprove}>Approve</Button>
)}
```

---

## 9. Implementation Phases

| Phase | Deliverable |
|-------|-------------|
| **P0** | Login, JWT, 9 roles seeded, permission guard on API skeleton |
| **P1** | Guards on approval endpoints (BOM, routing, PR) first |
| **P2** | Inventory + production commands |
| **P3** | UI button gating + audit log viewer (Management) |
| **P4** | SoD validation on role assignment, payment thresholds |

**Do not** add permissions only in UI — every gated button must have a matching API guard before go-live.

---

## 10. Test Cases (acceptance)

| # | User role | Action | Expected |
|---|-----------|--------|----------|
| T1 | Stores | `POST /bom/:id/approve` | **403 Forbidden** |
| T2 | Stores | `POST /purchase/pr/:id/approve` | **403 Forbidden** |
| T3 | Stores | `POST /work-orders/:id/close` | **403 Forbidden** |
| T4 | Stores | `POST /purchase/grn` | **200 OK** |
| T5 | Stores | `POST /inventory/issue-to-wo` | **200 OK** |
| T6 | Purchase | `POST /purchase/pr/:id/approve` (own PR) | **403** if SOD-1 |
| T7 | Production | `POST /quality/inspections/:id/decide` on own job card | **403** if SOD-5 |
| T8 | Management | `POST /bom/:id/approve` | **200 OK** |
| T9 | Accounts | `POST /invoices/:id/payments` | **200 OK** |
| T10 | Dispatch | `POST /invoices/:id/post` | **403 Forbidden** |

---

*Design document only. Implement with AuthModule in backend migration Phase 0.*
