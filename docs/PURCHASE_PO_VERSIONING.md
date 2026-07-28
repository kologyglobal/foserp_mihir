# Purchase Order Versioning — Implementation Plan

## Goal

Every meaningful change to a **released** PO is a numbered **revision** (Rev 0 → Rev 1 → …) with a persisted snapshot and field-level change log, so Approvals / Detail / Reports can show history. Draft / sent-back POs still use normal **Edit** (no revision bump).

## Rules

| Rule | Behavior |
|------|----------|
| When | Status in `SENT_TO_VENDOR`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `PARTIALLY_INVOICED`, `FULLY_INVOICED` |
| Reason | Required free-text amendment reason |
| Lines | Qty / rate change only on existing lines; **qty ≥ receivedQuantity** |
| Header | Expected delivery, payment/delivery terms, freight amount, remarks (v1 commercial set) |
| No change | Reject with `PO_REVISION_NO_CHANGES` |
| History | Immutable `PurchaseOrderRevision` row per Rev N (before snapshot + changes JSON) |
| Setup | `requireApprovalOnPoRevision` (default **true**) → after revise, status → `PENDING_APPROVAL` + approval queue row; approve → `APPROVED` (re-send to vendor as today) |
| Setup off | Bump revision, keep current status |

## Data model

- `PurchaseOrder.revisionNo` `Int` default `0`
- `PurchaseOrderRevision` — `revisionNo`, `reason`, `revisedById`, `revisedAt`, `statusBefore`, `headerSnapshot` (JSON), `linesSnapshot` (JSON), `changes` (JSON array)
- `PurchaseSettings.requireApprovalOnPoRevision` `Boolean` default `true`

## API

- `POST /purchase/orders/:id/revise` — body: reason + optional header/line patches  
- `GET /purchase/orders/:id/revisions` — list  
- Permission: `purchase.po.edit` to revise; view for history  

## UI

- Enable **Revise** on PO detail in API mode when status revisable  
- Map `revisionNo`, `revisions`, `changeHistory` from API  
- Purchase Setup → General: **Require approval on PO revision**  
- Approvals page already lists `PURCHASE_ORDER` pending — reused when setup requires re-approval  

## Out of scope (v1)

- Adding/removing lines on revise (use cancel + new PO or later phase)  
- Restoring prior revision as live document  
- Separate “amendment approval” document type  

## How to demo

1. Purchase Setup → General → **Require approval on PO revision** (default on).
2. Open a released PO → **Revise** → change qty/rate + reason → Save.
3. Approvals queue shows the PO again (if setup on).
4. Approve → **Send to vendor** again.
5. PO detail → revision history / change log (Rev 1, Rev 2, …).

## How to run

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/purchase/po-versioning.test.ts
```
