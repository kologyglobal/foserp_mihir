# Purchase Order Versioning

## Goal

Every meaningful change to a **released** PO is a numbered **revision** (Rev 0 → Rev 1 → …) with a persisted snapshot and field-level change log. Draft / sent-back (**Open**) POs still use normal **Edit** (no revision bump).

## Status labels (UI)

| Backend | UI label |
|---------|----------|
| `DRAFT` | Open |
| `PENDING_APPROVAL` | Pending Approved |
| `SENT_TO_VENDOR` | Released |

## Lifecycle (create / release)

| Setup | Behaviour |
|-------|-----------|
| `requireApprovalOnPo` **on** (default) | Open → Send for approval → Pending Approved → **Approve** → Released |
| `requireApprovalOnPo` **off** | Open → **Release** → Released |
| **Cancel** | Only from Pending Approved → back to **Open**. Not available when Released. Draft Delete soft-cancels Open POs. |

## Revision rules

| Rule | Behavior |
|------|----------|
| When | Status in `SENT_TO_VENDOR`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `PARTIALLY_INVOICED`, `FULLY_INVOICED` **and** no line has `receivedQuantity > 0` |
| Receipt block | Any partial/full receipt → Revise disabled (API + UI) |
| Reason | Required free-text amendment reason |
| Lines | Qty / rate change only on existing lines |
| Header | Expected delivery, payment/delivery terms, freight amount, remarks (v1 commercial set) |
| No change | Reject with `PO_REVISION_NO_CHANGES` |
| History | Dual-write: JSON `PurchaseOrderRevision` **and** relational `purchase_order_archived` / `purchase_line_archived` |
| Setup | `requireApprovalOnPoRevision` (default **true**) → after revise, status → `PENDING_APPROVAL`; off → keep status |

## Data model

- `PurchaseOrder.revisionNo` `Int` default `0`
- `PurchaseOrderRevision` — JSON `headerSnapshot` / `linesSnapshot` / `changes`
- `PurchaseOrderArchived` → table `purchase_order_archived` (header before revise)
- `PurchaseOrderLineArchived` → table `purchase_line_archived` (lines before revise)
- `PurchaseSettings.requireApprovalOnPo` / `requireApprovalOnPoRevision`

## API

- `POST /purchase/orders/:id/revise` — body: reason + optional header/line patches  
- `GET /purchase/orders/:id/revisions` — list  
- Permission: `purchase.po.edit` to revise; view for history  

## UI

- PO editor: four sections — General, Item Lines, Tax & Totals, Terms/Notes/Attachments  
- General: readonly **Status** + **Revised version**  
- Line grid: Expected Delivery Date + Requisition no.  
- List row actions: View / Edit / Delete / Print / **Reopen** (lifecycle actions on detail)  

## How to run

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/purchase/po-versioning.test.ts
```
