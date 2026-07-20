# Phase 02 — Purchase Module Business Rules

**Date:** 2026-07-20  
**Status:** Official product rules (design contract)  
**Scope:** End-to-end procurement business rules for implementation  
**Prerequisite:** [`PHASE_01_PURCHASE_AUDIT.md`](./PHASE_01_PURCHASE_AUDIT.md)  
**Mode:** Documentation only — **no code was implemented in this phase**

This document is the **source of truth** for Purchase workflow behaviour. When demo frontend types or mock services disagree with this document, **this document wins** for backend and dual-mode API design. Align FE types in a later migration phase.

---

## 1. Purpose and definitions

### 1.1 End-to-end flow

```text
Purchase Requisition
  → Submit
  → Approval
  → RFQ decision (rfqRequired)
       ├─ RFQ Required = Yes  → RFQ → Vendor Quotation → Comparison → Vendor selection → PO
       └─ RFQ Required = No   → Purchase Planning Sheet → (group by vendor) → PO
  → Purchase Order
  → GRN (Goods Receipt)
  → Quality Inspection (when required)
  → Inventory Receipt (stock post)
  → Purchase Invoice
  → Payment
  → Close
```

### 1.2 Core terms

| Term | Meaning |
|------|---------|
| **PR** | Purchase Requisition (demand document) |
| **PR line** | One line item on a PR; has stable UUID `id` and display `lineNo` |
| **`rfqRequired`** | Boolean on PR header. `true` = RFQ path; `false` = Planning / direct-PO path (UI: “Skip RFQ? = Yes”) |
| **PPS / Planning row** | Purchase Planning Sheet row — **one per valid PR line**, never one per PR header |
| **RFQ** | Request for Quotation to vendors |
| **VQ** | Vendor Quotation (response to RFQ) |
| **PO** | Purchase Order |
| **GRN** | Goods Receipt Note |
| **QI** | Quality Inspection |
| **Valid PR line** | Line that may generate a Planning row (see §4.2) |
| **Tenant** | Isolation boundary; every query/mutation filters `tenantId` from auth context |

### 1.3 Identity rules

| Field | Role |
|-------|------|
| Document / line **UUID `id`** | Primary key for joins, APIs, sync |
| **`lineNo`** | Human display + sort order within a document; **not** a join key |
| Planning unique business key | **`tenantId` + `purchaseRequisitionLineId`** (see §5) |

---

## 2. RFQ decision (mandatory)

The RFQ decision is evaluated from the PR header flag **`rfqRequired`** after the PR reaches **final approval**.

### 2.1 RFQ Required = Yes (`rfqRequired = true`)

| Rule ID | Rule |
|---------|------|
| BR-RFQ-01 | Approved PR demand follows the **RFQ process**. |
| BR-RFQ-02 | Those PR lines **must never** appear on the Purchase Planning Sheet. |
| BR-RFQ-03 | Planning sync / create **must no-op** for the entire PR when `rfqRequired = true`. |
| BR-RFQ-04 | PO creation for this demand is allowed **only after** vendor quotation capture, **comparison**, and **vendor selection** (award). |
| BR-RFQ-05 | Direct “convert approved PR → PO” **without** RFQ/comparison is **forbidden** when `rfqRequired = true`. |

### 2.2 RFQ Required = No (`rfqRequired = false`)

| Rule ID | Rule |
|---------|------|
| BR-PPS-01 | After **final** approval, create **one Planning Sheet row per valid PR line**. |
| BR-PPS-02 | Do **not** create one Planning row per PR header. |
| BR-PPS-03 | Empty or invalid lines must **not** generate Planning rows. |
| BR-PPS-04 | Synchronization must be **idempotent** (see §5). |
| BR-PPS-05 | RFQ convert from this PR is **forbidden** while `rfqRequired = false` (user must reopen and change flag via controlled process — §7). |

### 2.3 Decision matrix

| `rfqRequired` | After final PR approval | Planning Sheet | Next commercial step |
|---------------|-------------------------|----------------|----------------------|
| `true` | No PPS rows | Never | Create / send RFQ |
| `false` | Sync PPS (1 row / valid line) | Yes | Plan → Create PO(s) by vendor |

---

## 3. Purchase Requisition rules

### 3.1 Lifecycle statuses (official)

```text
draft
submitted
pending_approval
approved
rejected
partially_converted
converted_to_po
cancelled
closed
```

> **Note vs current demo:** Demo also uses `converted_to_rfq` and may collapse `submitted` into `pending_approval`. Official API must implement the list above. Map `converted_to_rfq` → keep RFQ link fields while PR status may be `approved` / `partially_converted` / `converted_to_po` as lines convert; or add `converted_to_rfq` as an alias only if product later re-approves it. Prefer: PR stays `approved` until PO conversion progresses to `partially_converted` / `converted_to_po`.

### 3.2 Allowed PR status transitions

| From | To | Trigger | Permission (min) |
|------|-----|---------|------------------|
| `draft` | `submitted` | User Submit | `purchase.requisition.submit` |
| `submitted` | `pending_approval` | System (approval request created) | system |
| `draft` | `pending_approval` | Submit when matrix applies immediately | `purchase.requisition.submit` |
| `pending_approval` | `approved` | Final approver Approve | `purchase.requisition.approve` |
| `pending_approval` | `rejected` | Approver Reject | `purchase.requisition.approve` |
| `pending_approval` | `draft` | Send back / return for correction | `purchase.requisition.approve` |
| `rejected` | `draft` | Controlled reopen / revise | `purchase.requisition.edit` + policy |
| `approved` | `partially_converted` | First successful PO (or RFQ→PO) for some lines | system |
| `approved` | `converted_to_po` | All convertible demand fully on PO(s) | system |
| `partially_converted` | `converted_to_po` | Remaining lines fully ordered | system |
| `approved` / `partially_converted` | `cancelled` | Cancel remaining (policy) | `purchase.requisition.edit` + elevate |
| `draft` / `rejected` | `cancelled` | Cancel | `purchase.requisition.edit` |
| `converted_to_po` / `approved` / `partially_converted` | `closed` | Close when no open follow-on | `purchase.requisition.edit` / close perm |

### 3.3 Invalid PR transitions (examples)

| Transition | Why invalid |
|------------|-------------|
| `approved` → `draft` (uncontrolled) | Violates immutability; use reopen process |
| `converted_to_po` → `pending_approval` | Converted docs are not re-approved in place |
| `cancelled` → `approved` | Must clone / new PR |
| `closed` → any open status | Closed is terminal except audit reopen (out of band) |
| `draft` → `approved` | Skip submit/approval chain |
| Any → change `rfqRequired` after submit | See §7 |

### 3.4 PR validation rules

| Rule ID | When | Rule |
|---------|------|------|
| VAL-PR-01 | Create/update draft | At least one valid line before submit |
| VAL-PR-02 | Submit | Header: department, location, requester, date, priority required |
| VAL-PR-03 | Submit | Each started line: item (id or code+name), qty > 0, UOM |
| VAL-PR-04 | Submit | Each line must have own `locationId` (header location alone is insufficient for API) |
| VAL-PR-05 | Submit | Urgent priority requires purpose / justification |
| VAL-PR-06 | Submit | `rfqRequired` must be explicitly true or false |
| VAL-PR-07 | Line | `lineNo` unique within PR; renumber on save for display only |
| VAL-PR-08 | Approve | PR must be `pending_approval`; actor must match approval matrix level |

### 3.5 Approval requirements (PR)

| Rule ID | Rule |
|---------|------|
| APR-PR-01 | Approval matrix is amount-based (tenant Purchase Setup) with ordered roles. |
| APR-PR-02 | Each level must Approve before the next; final level sets `approved`. |
| APR-PR-03 | Reject at any pending level → `rejected` (configurable: all open steps cancelled). |
| APR-PR-04 | Return / send-back → `draft` (or `submitted` pending rework — product default: `draft`). |
| APR-PR-05 | Maker–checker: submitter cannot approve their own PR (unless tenant policy allows). |
| APR-PR-06 | On final `approved` + `rfqRequired = false` → run Planning sync (§4) in **same transaction** as approval commit. |
| APR-PR-07 | On final `approved` + `rfqRequired = true` → **do not** create Planning rows; emit event / allow Create RFQ. |

---

## 4. Purchase Planning Sheet rules

### 4.1 Official statuses

```text
pending_planning
under_review
vendor_selected
approved
po_pending
po_created
partially_ordered
on_hold
cancelled
completed
```

### 4.2 Valid PR line (eligible for PPS creation)

A PR line is **valid** for Planning sync only if **all** hold:

1. Parent PR `status` is `approved` (or later conversion states that still have unordered lines — sync only creates missing rows once).  
2. Parent PR `rfqRequired = false`.  
3. Line is not soft-deleted.  
4. Line has identity: `itemId` **or** non-blank `itemCode` **or** non-blank `itemName`.  
5. `requiredQuantity` (ordered qty) **> 0**.  

Invalid / empty template rows → **skip** (no PPS row, no error for blank placeholders).

### 4.3 Sync behaviour

| Rule ID | Rule |
|---------|------|
| BR-PPS-10 | Trigger: final PR approval (`rfqRequired = false`), and idempotent repair on Planning list read (optional). |
| BR-PPS-11 | For each valid line without an existing PPS row for `(tenantId, purchaseRequisitionLineId)`, insert one row. |
| BR-PPS-12 | Initial status: `pending_planning` (or `vendor_selected` if preferred vendor already on line). |
| BR-PPS-13 | Copy: item, UOM, qty, rate, dates, vendor prefs, dept, requester, PR numbers, `lineNo` snapshot optional. |
| BR-PPS-14 | Compute `netPurchaseQuantity` per §6 at create and on relevant updates. |

### 4.4 Allowed PPS transitions

| From | To | Trigger |
|------|-----|---------|
| `pending_planning` | `under_review` | Buyer opens / assigns |
| `pending_planning` / `under_review` | `vendor_selected` | Vendor set |
| `vendor_selected` | `approved` | Planning approve (optional gate before PO) |
| `approved` / `vendor_selected` | `po_pending` | Selected for Create PO (Action Message) |
| `po_pending` | `po_created` | PO created for full net qty |
| `po_pending` / `po_created` | `partially_ordered` | Partial qty ordered (if supported) |
| `*` (open) | `on_hold` | Hold |
| `on_hold` | previous / `under_review` | Release hold |
| open | `cancelled` | Cancel row |
| `po_created` / `partially_ordered` | `completed` | Fully ordered + no further action |

### 4.5 Invalid PPS transitions

| Transition | Why invalid |
|------------|-------------|
| `po_created` → `po_pending` → Create PO again | Duplicate PO prevention (§8) |
| `cancelled` / `completed` → `po_created` | Terminal |
| Any status while parent `rfqRequired = true` | Row must not exist |
| Edit qty/vendor on `po_created` without amendment policy | Immutability |

### 4.6 Planning eligibility for Create PO

A row may be included in Create PO only if:

| Check | Requirement |
|-------|-------------|
| Selection | User-selected (e.g. Action Message = true) |
| Status | Not `cancelled`, `completed`, `po_created` (unless partial policy allows remainder) |
| Vendor | `preferredVendorId` (or selected vendor) present |
| Qty | `netPurchaseQuantity > 0` **or** (if net is 0 by stock, policy may block — default: require net > 0) |
| Rate | `expectedRate > 0` |
| Hold | Not `on_hold` |

---

## 5. Duplicate prevention (Planning)

| Rule ID | Rule |
|---------|------|
| BR-DUP-01 | Unique business key: **`tenantId` + `purchaseRequisitionLineId`**. |
| BR-DUP-02 | DB: unique constraint / unique index on `(tenantId, purchaseRequisitionLineId)` where `deletedAt IS NULL`. |
| BR-DUP-03 | Sync must use insert-if-not-exists (or upsert that does not duplicate). Concurrent approvals must not create two rows. |
| BR-DUP-04 | Do **not** use `lineNo` alone as uniqueness. |
| BR-DUP-05 | Error if client tries to create a second Planning row for the same PR line: `PPS_DUPLICATE_LINE` (§12). |

---

## 6. Net Purchase Quantity

### 6.1 Formula

```text
netPurchaseQuantity =
  max(
    0,
    requiredQuantity
      - currentStockQuantity
      - openPurchaseOrderQuantity
  )
```

| Field | Meaning |
|-------|---------|
| `requiredQuantity` | Demand qty on PR / Planning row |
| `currentStockQuantity` | Available / on-hand considered for netting (tenant policy: warehouse scope) |
| `openPurchaseOrderQuantity` | Open ordered qty not yet received for same item/demand link |

### 6.2 Rules

| Rule ID | Rule |
|---------|------|
| BR-NET-01 | Always floor at **0** (never negative). |
| BR-NET-02 | Recalculate on Planning create, stock refresh, and before Create PO. |
| BR-NET-03 | `estimatedAmount = netPurchaseQuantity × expectedRate` (unless policy uses required qty). |
| BR-NET-04 | Create PO line qty defaults to `netPurchaseQuantity` when > 0; else block (default policy). |

---

## 7. Immutability

| Rule ID | Rule |
|---------|------|
| BR-IMM-01 | **`rfqRequired` cannot change** after PR leaves `draft` (i.e. after submit) except via **controlled reopen**. |
| BR-IMM-02 | Controlled reopen: privileged action → status back to `draft` (or `rejected` revise), clear in-flight approvals, **delete or void** any PPS rows if flag flips to RFQ-required, audit event `PR_RFQ_FLAG_CHANGED`. |
| BR-IMM-03 | **Approved** PR header/lines: no direct edit; use amendment / revise / cancel+copy policy. |
| BR-IMM-04 | **Converted** records (`partially_converted`, `converted_to_po`, RFQ/PO linked): no direct edit of quantities that would orphan downstream docs. |
| BR-IMM-05 | Planning rows in `po_created` (full) **cannot** be converted again. |
| BR-IMM-06 | PO `approved` / `sent_to_vendor` / received: edits only via formal amend/revise endpoints. |

---

## 8. Purchase Order creation

### 8.1 From Planning (direct path)

| Rule ID | Rule |
|---------|------|
| BR-PO-01 | Only **eligible selected** Planning rows convert (§4.6). |
| BR-PO-02 | **Group rows by selected vendor** (`preferredVendorId`). |
| BR-PO-03 | Create **one PO per vendor group**. |
| BR-PO-04 | Create **all POs in one database transaction**. On any failure → roll back all POs and Planning updates in that request. |
| BR-PO-05 | Every PO line must link to: `planningSheetRowId`, `purchaseRequisitionId`, `purchaseRequisitionLineId`. |
| BR-PO-06 | After success: Planning rows → `po_created` (or `partially_ordered`); clear selection flags; set `purchaseOrderId` / number. |
| BR-PO-07 | Update PR conversion status: if all valid direct lines ordered → `converted_to_po`; else → `partially_converted`. |
| BR-PO-08 | Number series from tenant Purchase Setup (PO series); allocate atomically inside the transaction. |
| BR-PO-09 | PO `origin` = `purchase_requisition` (planning) for this path. |

### 8.2 From RFQ path

| Rule ID | Rule |
|---------|------|
| BR-PO-20 | Allowed only when comparison complete and vendor selected (`RFQ` status `vendor_selected` or equivalent). |
| BR-PO-21 | PO lines from awarded quotation lines; link `rfqId`, `vendorQuotationId`, PR ids. |
| BR-PO-22 | Must **not** create Planning rows as a side effect. |

### 8.3 Manual PO

| Rule ID | Rule |
|---------|------|
| BR-PO-30 | Allowed only if tenant setup `allowDirectPo` (or equivalent) is true. |
| BR-PO-31 | Still subject to PO approval matrix and RBAC. |

---

## 9. RFQ path rules

### 9.1 Official RFQ statuses

```text
draft
sent
quotation_received
under_comparison
vendor_selected
converted_to_po
cancelled
closed
```

### 9.2 Allowed RFQ transitions

| From | To | Trigger |
|------|-----|---------|
| `draft` | `sent` | Send to vendors |
| `sent` | `quotation_received` | First complete quote set / threshold |
| `quotation_received` | `under_comparison` | Open comparison |
| `under_comparison` | `vendor_selected` | Award vendor |
| `vendor_selected` | `converted_to_po` | PO created from award |
| open | `cancelled` | Cancel |
| `converted_to_po` / done | `closed` | Close |

### 9.3 Invalid RFQ transitions

| Transition | Why invalid |
|------------|-------------|
| `draft` → `converted_to_po` | Skip comparison / selection |
| `sent` → `vendor_selected` | Skip quotations / comparison |
| Create PPS from RFQ PR | Forbidden (`rfqRequired` path) |
| PO from RFQ while `under_comparison` without award | Forbidden |

### 9.4 RFQ validation

| Rule ID | Rule |
|---------|------|
| VAL-RFQ-01 | Source PR must be `approved` and `rfqRequired = true`. |
| VAL-RFQ-02 | At least one vendor invite; respect setup minimum vendor count when configured. |
| VAL-RFQ-03 | Lines must map to PR lines 1:1 or explicit subset with remaining qty tracking. |

---

## 10. Purchase Order rules

### 10.1 Official PO statuses

```text
draft
pending_approval
approved
sent_to_vendor
partially_received
fully_received
cancelled
closed
```

> **Note vs current demo:** Demo uses `released` / `sent` / `invoiced`. Official mapping: `released`+send → `sent_to_vendor`; invoicing tracked on invoice docs / PO flags, not necessarily a PO status.

### 10.2 Allowed PO transitions

| From | To | Trigger |
|------|-----|---------|
| `draft` | `pending_approval` | Submit |
| `pending_approval` | `approved` | Final approve |
| `pending_approval` | `draft` | Return |
| `pending_approval` | `cancelled` | Reject/cancel policy |
| `approved` | `sent_to_vendor` | Release + send to vendor |
| `sent_to_vendor` | `partially_received` | First partial GRN post |
| `sent_to_vendor` / `partially_received` | `fully_received` | Received qty covers ordered (within tolerance) |
| `fully_received` / `partially_received` | `closed` | Close after invoice/payment policy met |
| open | `cancelled` | Cancel (block if GRN posted — policy) |

### 10.3 Invalid PO transitions

| Transition | Why invalid |
|------------|-------------|
| `draft` → `sent_to_vendor` | Skip approval |
| `cancelled` → `approved` | Terminal |
| `fully_received` → `draft` | Immutable |
| Soft-delete PO with posted GRN | Forbidden |

### 10.4 PO approval

| Rule ID | Rule |
|---------|------|
| APR-PO-01 | Amount matrix from Purchase Setup (may differ tiers from PR). |
| APR-PO-02 | Maker–checker applies. |
| APR-PO-03 | Cannot send to vendor before `approved`. |

---

## 11. Downstream: GRN → QI → Inventory → Invoice → Payment → Close

### 11.1 GRN

| Rule ID | Rule |
|---------|------|
| BR-GRN-01 | GRN only against `sent_to_vendor` / `partially_received` / `approved` POs per policy (default: after `sent_to_vendor`). |
| BR-GRN-02 | Received qty ≤ open qty × (1 + tolerance%). |
| BR-GRN-03 | Posting GRN updates PO received qty and status (`partially_received` / `fully_received`). |
| BR-GRN-04 | If item requires incoming QC → GRN waits QI before inventory accept post. |

### 11.2 Quality Inspection

| Rule ID | Rule |
|---------|------|
| BR-QI-01 | Created when GRN/item requires QC. |
| BR-QI-02 | Accept / reject / partial drives accepted qty to inventory. |
| BR-QI-03 | Rejected qty may feed Purchase Return flow. |

### 11.3 Inventory Receipt

| Rule ID | Rule |
|---------|------|
| BR-INV-01 | Only accepted qty posts to inventory ledger (when inventory API exists). |
| BR-INV-02 | Stock post is a **transaction** with GRN accept (or explicit post step). |
| BR-INV-03 | Until inventory API ships: demo post only; do not claim Complete. |

### 11.4 Purchase Invoice

| Rule ID | Rule |
|---------|------|
| BR-PI-01 | Invoice matches PO and/or GRN (three-way when required by setup). |
| BR-PI-02 | Variance beyond tolerance → block post or require approval. |
| BR-PI-03 | Coordinate with Finance/AP; do not invent divergent GL rules here. |

### 11.5 Payment

| Rule ID | Rule |
|---------|------|
| BR-PAY-01 | Payment against posted / approved invoice via Payables. |
| BR-PAY-02 | Purchase module records payment status reference; cash/bank posting is Finance. |

### 11.6 Close

| Rule ID | Rule |
|---------|------|
| BR-CLS-01 | PO `closed` when fully received (or short-closed with permission) and invoice/payment policy satisfied. |
| BR-CLS-02 | PR `closed` when no open Planning/RFQ/PO remain for its demand. |
| BR-CLS-03 | RFQ `closed` when converted or cancelled and no further action. |

---

## 12. Error codes

Stable machine codes for API / service layer:

| Code | HTTP | Meaning |
|------|------|---------|
| `PR_NOT_FOUND` | 404 | Requisition missing / wrong tenant |
| `PR_INVALID_STATUS` | 409/422 | Transition not allowed |
| `PR_VALIDATION_FAILED` | 400 | Header/line validation |
| `PR_NOT_EDITABLE` | 422 | Submitted PR cannot be edited |
| `PR_MUST_REOPEN` | 422 | Approved PR must be reopened before amendment |
| `PR_DEPARTMENT_REQUIRED` | 400 | Department is required |
| `PR_REQUESTED_BY_REQUIRED` | 400 | Requested By is required |
| `PR_REQUISITION_DATE_REQUIRED` | 400 | Requisition date is required |
| `PR_REQUIRED_DATE_REQUIRED` | 400 | Required date is required |
| `PR_RFQ_REQUIRED_SELECTION` | 400 | RFQ Required selection is mandatory |
| `PR_NO_LINES` | 400 | Add at least one item |
| `PR_ITEM_REQUIRED` | 400 | Item is required |
| `PR_QTY_INVALID` | 400 | Quantity must be greater than zero |
| `PR_UOM_REQUIRED` | 400 | UOM is required |
| `PR_REQUIRED_DATE_BEFORE_REQUISITION` | 400 | Required date cannot be before requisition date |
| `PR_REJECTION_REASON_REQUIRED` | 400 | Rejection reason is required |
| `PR_RFQ_FLAG_LOCKED` | 409 | `rfqRequired` change blocked |
| `PR_NOT_APPROVED` | 409 | Action requires approved PR |
| `PR_RFQ_REQUIRED` | 409 | Direct PO / PPS forbidden; use RFQ |
| `PR_DIRECT_PO_PATH` | 409 | RFQ forbidden; use Planning / direct PO |
| `PPS_NOT_FOUND` | 404 | Planning row missing |
| `PPS_DUPLICATE_LINE` | 409 | Unique `(tenantId, purchaseRequisitionLineId)` violation |
| `PPS_NOT_ELIGIBLE` | 409 | Row not eligible for Create PO |
| `PPS_NO_SELECTION` | 400 | No rows selected |
| `PPS_READ_ONLY` | 409 | Terminal / locked row |
| `PPS_PO_NOT_READY` | 409 | Missing vendor/qty/rate/date |
| `PPS_VENDOR_REQUIRED` | 400 | Selected vendor required before PO |
| `PPS_NET_QTY_INVALID` | 400 | Net purchase qty must be > 0 |
| `PPS_RATE_REQUIRED` | 400 | Rate required before PO |
| `PPS_REQUIRED_DATE_REQUIRED` | 400 | Required date required |
| `PPS_ALREADY_CONVERTED` | 409 | PO-created rows cannot be edited/converted again |
| `PPS_CANCELLED` | 409 | Cancelled rows cannot be converted |
| `PPS_RFQ_REQUIRED` | 409 | RFQ-required PR items cannot use Planning |
| `RFQ_NOT_FOUND` | 404 | — |
| `RFQ_INVALID_STATUS` | 409 | — |
| `RFQ_COMPARISON_REQUIRED` | 409 | PO before award |
| `PO_NO_ELIGIBLE_ROWS` | 400 | Select at least one eligible Planning row |
| `PO_TENANT_MISMATCH` | 403 | All rows must belong to current tenant |
| `PO_VENDOR_INACTIVE` | 400 | Vendor must be active |
| `PO_ITEM_INACTIVE` | 400 | Item must be active |
| `PO_UOM_INACTIVE` | 400 | UOM must be active |
| `PO_COMMERCIAL_TERMS_REQUIRED` | 400 | Required commercial terms missing |
| `PO_ALREADY_CONVERTED` | 409 | Converted rows must not be selected again |
| `PO_NOT_FOUND` | 404 | — |
| `PO_INVALID_STATUS` | 409 | — |
| `PO_CREATE_FAILED` | 500 / 409 | Transaction rolled back |
| `GRN_QTY_EXCEEDS` | 409 | Over-receipt |
| `GRN_QC_REQUIRED` | 409 | Cannot stock-post before QI |
| `TENANT_MISMATCH` | 403 | Cross-tenant access |
| `FORBIDDEN` | 403 | Missing permission |
| `APPROVAL_NOT_ELIGIBLE` | 403 | Not current approver |
| `CONFLICT_VERSION` | 409 | Optimistic lock |

User-facing copy is centralized in `backend/src/modules/purchase/shared/purchase-error-catalog.ts` and `frontend/src/utils/purchase/purchaseErrorMessages.ts`. Technical Prisma/SQL/stack details are logged server-side only.

---

## 13. Tenant-isolation rules

| Rule ID | Rule |
|---------|------|
| BR-TEN-01 | Every purchase table includes `tenantId` (non-null). |
| BR-TEN-02 | Tenant resolved from auth / route `:tenantSlug` — **never** from request body. |
| BR-TEN-03 | All queries: `WHERE tenantId = :ctxTenantId` (and soft-delete filters). |
| BR-TEN-04 | FKs to PR/PPS/PO/RFQ must be same-tenant; reject cross-tenant IDs with `TENANT_MISMATCH`. |
| BR-TEN-05 | Number series allocated **per tenant**. |
| BR-TEN-06 | Masters (vendor/item) referenced must belong to same tenant. |

---

## 14. RBAC rules

### 14.1 Existing catalog (keep / enforce server-side)

| Permission | Typical use |
|------------|-------------|
| `purchase.view` | Module shell |
| `purchase.dashboard.view` | Dashboard |
| `purchase.requisition.view` / `create` / `edit` / `submit` / `approve` | PR |
| `purchase.rfq.view` / `create` / `send` | RFQ |
| `purchase.quotation.view` / `create` / `compare` | VQ / comparison |
| `purchase.order.view` / `create` / `edit` / `approve` / `release` / `cancel` | PO |
| `purchase.grn.view` / `create` / `post` | GRN |
| `purchase.quality.view` / `inspect` | QI |
| `purchase.invoice.*` | Invoice |
| `purchase.return.*` | Returns |
| `purchase.reports.view` | Reports |
| `purchase.setup.manage` | Setup / native masters |

### 14.2 Required additions (official)

| Permission | Use |
|------------|-----|
| `purchase.planning.view` | View Planning Sheet |
| `purchase.planning.edit` | Update vendor/rate/hold/selection |
| `purchase.planning.create_po` | Create PO(s) from Planning selection |
| `purchase.planning.approve` | Optional planning approval gate |

### 14.3 Enforcement

| Rule ID | Rule |
|---------|------|
| BR-RBAC-01 | UI gates are **not** security; API must enforce the same keys. |
| BR-RBAC-02 | Approve actions require approve permission **and** eligibility on the approval step. |
| BR-RBAC-03 | `purchase.setup.manage` required to change approval matrix / skip-RFQ default / series. |

---

## 15. Audit-log events

Write to platform `audit_logs` (module = `purchase`) on success of mutations:

| Event / action | Entity | When |
|----------------|--------|------|
| `PR_CREATED` | `PurchaseRequisition` | Create |
| `PR_UPDATED` | `PurchaseRequisition` | Draft update |
| `PR_SUBMITTED` | `PurchaseRequisition` | Submit |
| `PR_APPROVAL_LEVEL_ADVANCED` | `PurchaseRequisition` | Mid-level approve |
| `PR_APPROVED` | `PurchaseRequisition` | Final approve |
| `PR_REJECTED` | `PurchaseRequisition` | Reject |
| `PR_RETURNED` | `PurchaseRequisition` | Send back |
| `PR_CANCELLED` | `PurchaseRequisition` | Cancel |
| `PR_RFQ_FLAG_CHANGED` | `PurchaseRequisition` | Controlled reopen only |
| `PR_CONVERSION_UPDATED` | `PurchaseRequisition` | partial / full converted |
| `PPS_SYNCED` | `PurchasePlanningSheetRow` | Rows created on approve |
| `PPS_UPDATED` | `PurchasePlanningSheetRow` | Edit |
| `PPS_PO_CREATED` | `PurchasePlanningSheetRow` | After Create PO |
| `RFQ_CREATED` / `RFQ_SENT` / `RFQ_VENDOR_SELECTED` / `RFQ_CONVERTED` | RFQ | Lifecycle |
| `VQ_CREATED` / `VQ_UPDATED` | VendorQuotation | — |
| `PO_CREATED` / `PO_SUBMITTED` / `PO_APPROVED` / `PO_SENT` / `PO_CANCELLED` / `PO_CLOSED` | PO | — |
| `GRN_CREATED` / `GRN_POSTED` | GRN | — |
| `QI_COMPLETED` | QI | — |
| `PI_POSTED` | PurchaseInvoice | — |

Each entry: `tenantId`, `userId`, `entity`, `entityId`, `action`, `oldValues` / `newValues` (redact secrets), optional IP/UA.

---

## 16. Transaction boundaries

| Operation | Must be atomic (single DB transaction) |
|-----------|----------------------------------------|
| PR final approve + PPS sync (`rfqRequired = false`) | Approval status + approval step close + **all** new PPS inserts |
| PR final approve (`rfqRequired = true`) | Approval only; **zero** PPS inserts |
| Create POs from Planning selection | All PO headers/lines + series allocate + all PPS status updates + PR conversion status |
| Create PO from RFQ award | PO + RFQ status + VQ award flags + PR conversion |
| GRN post + PO qty/status (+ optional QI spawn) | One transaction |
| QI accept + inventory receipt (when API exists) | One transaction |
| Invoice post + match updates | One transaction (finance coordination) |

| Operation | Not required in same TX |
|-----------|-------------------------|
| Sending email/notification after commit | After-commit outbox |
| Recalculating unrelated reports | Async |

**Failure rule:** On error inside a Create-PO-from-Planning request, **no** PO may remain committed and **no** PPS row may flip to `po_created`.

---

## 17. Status quick reference

### Purchase Requisition

`draft` → `submitted` → `pending_approval` → `approved` | `rejected` → … → `partially_converted` → `converted_to_po` → `closed` / `cancelled`

### Purchase Planning

`pending_planning` → `under_review` → `vendor_selected` → `approved` → `po_pending` → `po_created` / `partially_ordered` → `completed`  
Also: `on_hold`, `cancelled`

### RFQ

`draft` → `sent` → `quotation_received` → `under_comparison` → `vendor_selected` → `converted_to_po` → `closed`  
Also: `cancelled`

### Purchase Order

`draft` → `pending_approval` → `approved` → `sent_to_vendor` → `partially_received` → `fully_received` → `closed`  
Also: `cancelled`

---

## 18. Alignment with Phase 01 audit

| Topic | Demo today | This document |
|-------|------------|---------------|
| RFQ vs PPS split | Implemented in mock sync | **Official — keep** |
| PPS unique key | Soft check by pr+line id | **Mandate DB unique `(tenantId, purchaseRequisitionLineId)`** |
| Net qty | Implemented in mock | **Official formula** |
| Create PO by vendor group | Implemented in mock | **Official + single TX** |
| Status enums | Differ slightly | **Official lists above** — migrate FE/BE together |
| Backend / audit / RBAC planning keys | Missing | **Required for Complete** |

---

## 19. Out of scope for this phase

- No Prisma models, APIs, or FE code changes.  
- No payment gateway or full AP GL design (reference Finance module).  
- No inventory ledger schema (reference Inventory when un-deferred).

---

## 20. Next phase recommendation

**Phase 03 — Data model & API contract:** ERD + OpenAPI for PR + Planning + lifecycle endpoints implementing §§2–8 and §§12–16, with dual-mode FE still on demo until bridge ships.
