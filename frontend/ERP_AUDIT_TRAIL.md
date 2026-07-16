# ERP Audit Trail Specification

**Document type:** Data integrity & compliance standard  
**System:** Vasant Trailer ERP  
**Status:** Specification — **partially present in frontend, not trustworthy yet**  
**Requires:** [`ERP_RBAC_PERMISSIONS.md`](./ERP_RBAC_PERMISSIONS.md) (authenticated user identity)  
**Target:** [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md) (PostgreSQL + NestJS)

---

## 1. Principle

> Every ERP transaction must answer: **Who created it? When? Who last changed it? Who approved it?**

Without consistent, server-enforced audit fields, inventory, costing, and compliance data cannot be trusted in a factory environment.

**Rules:**

1. Audit fields are **server-written only** — never accepted from the client payload.
2. **Posted** documents (GRN, stock movement, FG receipt, dispatch, invoice) are **immutable** — changes via reversal documents only.
3. **Approval** fields are set once at approval/release — not overwritten by later edits.
4. All audit values store **user ID** (FK) + denormalized **display name** for historical reports.
5. Timestamps are **UTC** in database (`TIMESTAMPTZ`); displayed in plant timezone (Asia/Kolkata).

---

## 2. Standard Audit Columns

Every **transaction header** and **master record** implements this base:

```typescript
interface AuditColumns {
  createdById: string      // FK → sys.users
  createdByName: string    // snapshot at create time
  createdAt: string        // ISO / TIMESTAMPTZ

  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null  // null until first edit after create

  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null  // null until approved/released/posted gate
}
```

### 2.1 Field semantics

| Field | Set when | Cleared when |
|-------|----------|--------------|
| `createdBy*` / `createdAt` | Record insert | Never |
| `modifiedBy*` / `modifiedAt` | Any update to non-posted record | Never (always latest edit) |
| `approvedBy*` / `approvedAt` | Approval, release, or post (per doc type) | Never |

### 2.2 Extended lifecycle fields (document-specific)

Some documents have additional **milestone** timestamps (keep alongside standard audit):

| Document | Extra fields |
|----------|--------------|
| Work Order | `releasedBy*`, `releasedAt`, `completedBy*`, `completedAt`, `closedBy*`, `closedAt` |
| GRN | `postedBy*`, `postedAt` |
| Invoice | `postedBy*`, `postedAt` |
| Dispatch | `dispatchedBy*`, `dispatchedAt`, `podRecordedBy*`, `podRecordedAt` |
| Stock movement | `postedBy*` (= `createdBy*`), `postedAt` (= `createdAt`) — ledger is insert-only |
| QC inspection | `inspectedBy*`, `inspectedAt`, `decidedAt` |
| Payment | `recordedBy*`, `recordedAt` |

**Naming rule:** `{action}ById`, `{action}ByName`, `{action}At` for each irreversible milestone.

---

## 3. Two-Layer Audit Architecture

### Layer A — Column audit (on every entity)

Fast to query on detail screens:

```text
Created by Ramesh Patil · 2026-06-01 08:30
Modified by Amit Shah · 2026-06-02 14:15
Approved by Plant Manager · 2026-06-03 09:00
```

### Layer B — Immutable event log (`sys.audit_log`)

Append-only journal for **every state transition** and **field change**:

```sql
CREATE TABLE sys.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES sys.users(id),
  user_name       VARCHAR(100) NOT NULL,
  user_role       VARCHAR(30) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,   -- e.g. work_order, grn, stock_movement
  entity_id       UUID NOT NULL,
  entity_no       VARCHAR(50),            -- WO-0001, GRN-0003
  action          VARCHAR(50) NOT NULL,   -- created, updated, approved, posted, cancelled
  from_status     VARCHAR(30),
  to_status       VARCHAR(30),
  changes_json    JSONB,                  -- { field: { old, new } } for updates
  ip_address      INET,
  user_agent      TEXT,
  correlation_id  UUID                   -- request trace
);

CREATE INDEX idx_audit_entity ON sys.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON sys.audit_log(user_id, occurred_at DESC);
CREATE INDEX idx_audit_time ON sys.audit_log(occurred_at DESC);
```

**No UPDATE or DELETE** on `audit_log` — DB role restrictions + application policy.

---

## 4. Approval vs Modify vs Post

| Action | Updates `modifiedBy*` | Updates `approvedBy*` | Writes audit_log |
|--------|----------------------|----------------------|------------------|
| Create draft | — (sets `createdBy*`) | — | `created` |
| Edit draft | ✅ | — | `updated` + diff |
| Submit for approval | ✅ | — | `submitted` |
| Approve / Release | ✅ | ✅ | `approved` / `released` |
| Post to ledger | ✅ | ✅ (or `postedBy*`) | `posted` |
| Cancel (open only) | ✅ | — | `cancelled` |

Once **posted**, header fields are frozen; `modifiedBy*` no longer applies — only reversal entries.

---

## 5. Entity-by-Entity Requirements

### 5.1 Master data (`md.*`)

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| UOM, Category, Warehouse | ✅ | ✅ | — |
| Item, Product, Customer, Vendor | ✅ | ✅ | — |
| BOM header | ✅ | ✅ | ✅ release gate |
| Routing header | ✅ | ✅ | ✅ release gate |
| Work center | ✅ | ✅ | — |

### 5.2 Commercial

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| Sales order | ✅ | ✅ | ✅ on `confirm` |
| MRP run | ✅ | — (immutable) | — |

### 5.3 Procurement

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| Purchase requisition | ✅ | ✅ | ✅ on `approvePr` |
| RFQ | ✅ | ✅ | — |
| Purchase order | ✅ | ✅ | ✅ on PO approval (future) |
| GRN | ✅ | ✅ until post | ✅ on `postGrn` → `postedBy*` |

### 5.4 Inventory

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| Stock movement | ✅ insert-only | ❌ never | ✅ = create (ledger) |
| Reservation | ✅ | ✅ | — |

### 5.5 Production

| Entity | created | modified | approved / milestone |
|--------|---------|----------|----------------------|
| Work order | ✅ | ✅ | `releasedBy*`, `completedBy*`, `closedBy*` |
| WO material line | ✅ | ✅ on issue | — |
| Job card | ✅ | ✅ | `completedBy*` on complete |
| SA / FG receipt | ✅ | ❌ after post | `postedBy*` |
| Subcontract shipment | ✅ | ✅ | `sentBy*`, `receivedBy*` |
| WO activity log | ✅ | ❌ | — (already event-style) |

### 5.6 Quality

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| QC inspection | ✅ | ✅ | `inspectedBy*` on decision |
| Rework order | ✅ | ✅ | `completedBy*` |
| NCR | ✅ | ✅ | `closedBy*` |

### 5.7 Fulfillment & finance

| Entity | created | modified | approved |
|--------|---------|----------|----------|
| Dispatch plan | ✅ | ✅ | `dispatchedBy*` on confirm |
| Customer POD | ✅ | ❌ | `podRecordedBy*` |
| Sales invoice | ✅ | ✅ until post | `postedBy*` |
| Payment record | ✅ | ❌ | `recordedBy*` |

---

## 6. Current Codebase Gap Analysis

### 6.1 What exists today

| Area | Status |
|------|--------|
| `createdAt` / `updatedAt` | On most TS types — **timestamps only, no user FK** |
| BOM / Routing | `approvedBy`, `approvedAt`, `submittedBy`, `submittedAt` — **string names, hardcoded** |
| Stock movement | `createdBy` — **hardcoded `'Store Admin'`** in `inventoryStore.ts` |
| WO activity | `createdBy` — **hardcoded `'Production Planner'`** |
| Quality entities | `createdBy: 'Quality'` in store |
| PR | `requestedBy: 'MRP Planner'` — not linked to auth |
| MRP run | `runBy: 'MRP Planner'` — string only |
| Invoice | `postedAt`, `updatedAt` — **no postedBy** |
| Dispatch | `dispatchedAt`, `updatedAt` — **no dispatchedBy** |
| Master data | `createdAt` only on most — **no createdBy** |

### 6.2 Critical trust gaps

```text
❌ No authenticated user — all "Created By" values are fiction
❌ modifiedBy missing on 90% of entities
❌ approvedBy missing on PR, PO, GRN, WO, invoice, dispatch
❌ No immutable audit_log table
❌ localStorage can be edited in browser DevTools
❌ No UI "Audit" tab on document detail pages (except partial WO activity)
```

**Verdict:** Audit columns exist as **placeholders**. They do **not** meet factory trust requirements until backend + auth ship.

---

## 7. UI Requirements

Every **document detail page** must show an **Audit** strip or tab:

```text
┌─ Audit ─────────────────────────────────────────────────────┐
│ Created   │ Ramesh Patil (Stores)     │ 01-Jun-2026 08:30  │
│ Modified  │ Amit Shah (Purchase)      │ 02-Jun-2026 14:15  │
│ Approved  │ S. Mehta (Management)    │ 03-Jun-2026 09:00  │
│ Posted    │ Ramesh Patil (Stores)     │ 03-Jun-2026 11:45  │
└─────────────────────────────────────────────────────────────┘
[ View full history → ]  → opens audit_log timeline for this entity
```

### Pages requiring audit strip (minimum)

| Module | Screens |
|--------|---------|
| Masters | Item, Product, BOM, Routing detail |
| MRP | MRP run detail |
| Purchase | PR, PO, GRN detail |
| Inventory | Movement detail (from ledger drill-down) |
| Production | Work order detail |
| Quality | Inspection, NCR detail |
| Dispatch | Dispatch plan detail |
| Invoice | Invoice detail |

### Audit history timeline (from `sys.audit_log`)

```text
03-Jun 09:00  APPROVED     S. Mehta (Management)     PR-0002
02-Jun 14:15  UPDATED      Amit Shah (Purchase)      qty line 3: 100 → 120
01-Jun 08:30  CREATED      Ramesh Patil (Stores)     from MRP-0001
```

---

## 8. Backend Implementation (NestJS + Prisma)

### 8.1 Prisma base mixin

```prisma
model AuditableDocument {
  createdById    String   @map("created_by_id")
  createdByName  String   @map("created_by_name")
  createdAt      DateTime @default(now()) @map("created_at")

  modifiedById   String?  @map("modified_by_id")
  modifiedByName String?  @map("modified_by_name")
  modifiedAt     DateTime? @map("modified_at")

  approvedById   String?  @map("approved_by_id")
  approvedByName String?  @map("approved_by_name")
  approvedAt     DateTime? @map("approved_at")
}
```

Apply to all `tx.*` headers via Prisma [preview feature](https://www.prisma.io/docs) or copy fields per model.

### 8.2 Audit interceptor (every mutating request)

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user  // from JWT
    req.auditContext = { userId: user.id, userName: user.fullName, role: user.primaryRole }
    return next.handle().pipe(
      tap(async (result) => {
        await auditService.record({
          ...req.auditContext,
          entityType: req.auditMeta?.entityType,
          entityId: result?.id,
          action: req.auditMeta?.action,
          changes: req.auditMeta?.changes,
        })
      }),
    )
  }
}
```

### 8.3 Service layer pattern

```typescript
async approvePr(prId: string, ctx: AuditContext) {
  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseRequisition.update({
      where: { id: prId },
      data: {
        status: 'approved',
        approvedById: ctx.userId,
        approvedByName: ctx.userName,
        approvedAt: new Date(),
        modifiedById: ctx.userId,
        modifiedByName: ctx.userName,
        modifiedAt: new Date(),
      },
    })
    await this.auditLog.write(tx, { action: 'approved', entity: updated, ctx })
    return updated
  })
}
```

### 8.4 Remove hardcoded users

Replace all occurrences in stores (migration to delete from frontend):

| File | Hardcoded value | Replace with |
|------|-----------------|--------------|
| `inventoryStore.ts` | `'Store Admin'` | JWT user |
| `workOrderStore.ts` | `'Production Planner'` | JWT user |
| `qualityStore.ts` | `'Quality'` | JWT user |
| `bomStore.ts` | `'Engineering User'` | JWT user |
| `routingStore.ts` | `'Process Engineer'` | JWT user |
| `purchaseStore.ts` | `'MRP Planner'` | JWT user |
| `mrpStore.ts` | `'MRP Planner'` | JWT user |

---

## 9. TypeScript Type Updates (frontend contract)

Extend shared `@vasant-erp/types` package:

```typescript
export interface AuditStamp {
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export interface SalesInvoice extends AuditStamp { /* existing fields */ }
export interface WorkOrder extends AuditStamp { /* + milestone fields */ }
// ... all transaction headers
```

Detail DTOs returned by API always include audit block — UI never fabricates names.

---

## 10. Reporting & Compliance

| Report | Source |
|--------|--------|
| Who approved BOM revision X? | `md.bom_headers.approved_by_name`, `audit_log` |
| GRN posting trail for PO-0003 | `tx.grn_headers` + `inv.stock_movements` + `audit_log` |
| WO cost dispute — who issued materials? | `inv.stock_movements.created_by_name` + WO pegging |
| Invoice payment audit | `tx.payment_records.recorded_by_name` |
| User activity (SOX-style) | `sys.audit_log` filtered by `user_id` |

Retention: **7 years** minimum for financial and inventory audit_log (configurable).

---

## 11. Implementation Phases

| Phase | When | Deliverable |
|-------|------|-------------|
| **A0** | Backend Phase 0 | `sys.users`, JWT, `AuditContext` on every request |
| **A1** | Backend Phase 0 | `sys.audit_log` table + write service |
| **A2** | Backend Phase 1–3 | Audit columns on all `md.*` + `inv.*` tables |
| **A3** | Backend Phase 4–6 | Audit on PR/PO/GRN/WO/job cards |
| **A4** | Backend Phase 7–9 | QC, dispatch, invoice audit |
| **A5** | Frontend Phase 10 | Audit strip component on all detail pages |
| **A6** | Frontend Phase 10 | Remove hardcoded `createdBy` strings |
| **A7** | Hardening | Audit log viewer for Management role |

**Blocker:** Phases A5–A6 are meaningless without A0 (real user identity).

---

## 12. Acceptance Criteria

Migration audit work is complete when:

1. **Zero** hardcoded user names in application code.
2. Every API `POST/PATCH` on transactional entities writes `createdBy*` or `modifiedBy*`.
3. Every approval endpoint writes `approvedBy*` and audit_log `approved` event.
4. Every ledger post writes movement with authenticated `createdBy*`.
5. Sample go-live simulation (SO-0001) produces audit_log with **≥ 50 events** traceable to test users.
6. Management can open any WO, GRN, or invoice and see Created / Modified / Approved with real names.
7. Posted records cannot be edited via API (returns 409 Conflict).

---

## 13. Example — PR-0002 audit trail (target state)

```text
Entity: PR-0002 · Purchase Requisition

Created By:     Amit Shah (Purchase)        01-Jun-2026 08:45
Modified By:    Amit Shah (Purchase)        01-Jun-2026 09:00
Approved By:    S. Mehta (Management)       01-Jun-2026 10:30

History:
  01-Jun 10:30  APPROVED      S. Mehta (Management)
  01-Jun 09:00  SUBMITTED     Amit Shah (Purchase)
  01-Jun 08:45  CREATED       Amit Shah (Purchase)     source: MRP-0001
```

---

## 14. Cross-References

| Document | Relationship |
|----------|--------------|
| [`ERP_RBAC_PERMISSIONS.md`](./ERP_RBAC_PERMISSIONS.md) | User identity + who may approve |
| [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md) | `sys.audit_log`, Phase 0 AuthModule |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Extend DDL with audit columns on all `tx` headers |
| [`ERP_GO_LIVE_READINESS.md`](./ERP_GO_LIVE_READINESS.md) | "No audit trail" listed as factory blocker |

---

*Specification only. Trust requires server-side enforcement — not localStorage timestamps.*
