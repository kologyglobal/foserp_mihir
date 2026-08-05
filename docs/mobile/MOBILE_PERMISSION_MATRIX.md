# Mobile Permission Matrix (Operational Modules)

> Exact permission codes from backend routes + `backend/src/constants/permissions.ts`.  
> UI hide is UX only — backend enforces on every API call.  
> **Phase:** Purchase Phase A+B (PR, PO, GRN, QC handoff), store ops, QC photos (2026-08-05).  
> **Last updated:** 2026-08-05

| Mobile screen / entry | Module key | View / entry permission (anyOf) | Action permission (later) | Phase 1 UI | Backend protected |
|-----------------------|------------|----------------------------------|---------------------------|------------|-------------------|
| Purchase hub | `purchase` | `purchase.view`, `purchase.pr.view`, `purchase.po.view`, `purchase.pr.approve`, `purchase.po.approve`, `purchase.grn.view`, `purchase.grn.create`, `purchase.qi.view` | — | Hub (catalog tiles) | `requireModule('purchase')` + RBAC |
| Purchase approvals | `purchase` | `purchase.pr.approve`, `purchase.po.approve`, `purchase.pr.view`, `purchase.po.view` | Approve/reject lifecycle per document type | **Live** list + detail + deep links PR/PO/GRN | Approvals + PR/PO/GRN lifecycle |
| Purchase requisitions | `purchase` | `purchase.pr.view` | Submit draft: `purchase.pr.submit` | **Live** list + detail (no full editor) | `GET/POST …/requisitions` |
| Purchase orders | `purchase` | `purchase.po.view` | Receive entry needs `purchase.grn.create` | **Live** list + detail + receipt % | `GET /purchase/orders` |
| GRN register | `purchase` | `purchase.grn.view` | — | **Live** list | `GET /purchase/grns` |
| GRN detail | `purchase` | `purchase.grn.view` | Submit: `purchase.grn.create`; Post: `purchase.grn.post` | **Live** | submit + post-inventory |
| GRN receive | `purchase` | requires create path | `purchase.grn.create` | **Live** scan + qty + create/submit | `POST /purchase/grns` + receivable-lines |
| Purchase QC handoff | `purchase` | `purchase.qi.view` | Complete: `purchase.qi.complete` (accept/reject/hold) | **Live** list + decide | purchase QI lifecycle |
| RFQs | `purchase` | `purchase.rfq.view` | Send: `purchase.rfq.send`; convert PR: `purchase.rfq.create` | **Live** list/detail/send | `/purchase/rfqs` |
| Purchase invoices | `purchase` | `purchase.invoice.view` | submit / approve | **Live** register + lifecycle | `/purchase/invoices` |
| Purchase returns | `purchase` | `purchase.return.view` | create/submit/complete | **Live** + QI prefill create | `/purchase/returns` |
| Quality hub | `quality` | `quality.view`, `quality.incoming.view`, `purchase.qi.view`, `manufacturing.quality.view`, `manufacturing.quality.inspect` | — | Hub | Quality + QI routes |
| QC queue | `quality` | same as hub views | — | Live (photos where allowed) | kiosk / inspection routes |
| QC decide | `quality` | — | `quality.submit` \| `manufacturing.quality.inspect` | Deferred | kiosk decide |
| Store hub | `inventory` | materials + stock + count + store_workbench views | — | Hub | Mixed modules |
| Material issue | `manufacturing` | `manufacturing.materials.view` / `manufacturing.work_orders.view` | `manufacturing.materials.issue` (+ optional `manufacturing.material.additional_issue`) | **Live** — WO search/scan + `POST …/materials/issue` + `idempotencyKey` | materials issue |
| Material return | `manufacturing` | materials / WO view | `manufacturing.materials.return` | **Live** — net-issued lines only + `POST …/materials/return` | materials return |
| Stock inquiry | `inventory` | `inventory.stock.view` \| `inventory.view` (item lookup: `master.item.view`) | — | **Live** — item code scan → balances | `/inventory/balances` |
| Stock count | `inventory` | `inventory.stock_count.view` \| `inventory.view` | create/snapshot/count/submit per routes | **Live** list + detail (snapshot, enter, submit) | stock-count routes |
| Stock transfer | `inventory` | `inventory.transfers.view` \| `inventory.view` | create: `.create`; advance: `inventory.submit` / `inventory.transfer.approve` / `inventory.transfers.dispatch`; receive: `.receive` | **Live** list + create + detail (ship/receive) | `/inventory/transfers/*` |
| Gate hub | `gate` | dashboard / register / vehicle / material / approval views | — | Hub | gate routes |
| Gate in | `gate` | — | `gate.vehicle.create` \| `.entry` \| `gate.material_inward.create` | Coming soon | vehicle create |
| Gate out | `gate` | — | `gate.vehicle.exit` \| `gate.material_outward.release` | Coming soon | exit / release |
| Gate vehicles | `gate` | `gate.vehicle.view` | entry/exit later | Coming soon | vehicles |
| Gate / purchase approvals tab links | respective | catalogue anyOf | act perms later (gate); purchase acts live | Purchase rows on Approvals tab | yes |
| CRM Leads … Collection | `crm` | existing `crm.*` / `finance.ar.view` | existing | **Live** | yes |
| Quotation approve (Approvals tab) | `crm` | `crm.quotation.view` | `crm.quotation.approve` | **Live** | yes |
| Profile / Settings | `masters` | authenticated (no anyOf) | self | Live | `/auth/me` |

## Access rules (engine)

Implemented in `mobile/src/auth/navigationCatalog.ts`:

1. `permissions == null` → **deny** (fail closed).
2. Module flag disabled → **deny**.
3. `allOf` must all pass `can()`.
4. `anyOf` needs at least one `can()`.
5. Entries without `anyOf`/`allOf` (Profile/Settings) require a loaded permission array (including empty).
6. `tenant.manage` is a wildcard in `can()` (UI only; API still enforces).
7. **No role-name ACL.**

## Permission sync

```bash
cd backend
npx tsx scripts/sync-permissions.ts
```

No new permission codes were introduced for mobile Phase 1 — catalogue uses existing backend codes only.

## Related docs

- `docs/mobile/MOBILE_OPERATIONAL_MODULE_AUDIT.md`
- `docs/mobile/MOBILE_MULTI_MODULE_IMPLEMENTATION.md` (if present)
- `mobile/src/auth/navigationCatalog.ts`
