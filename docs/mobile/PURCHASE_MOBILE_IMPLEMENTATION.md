# Purchase Mobile — Implementation (Phases A–C)

> Native app only: `mobile/`  
> Scope: Approvals · PR editor · RFQ · PO · GRN (+ offline queue) · QI decide · invoices · returns

## Screens

| Route | Phase | Permission highlights |
|-------|-------|------------------------|
| Approvals list/detail | A | PR/PO view + approve/reject |
| Requisitions list/detail | B | `purchase.pr.view` · submit |
| Requisitions **edit** (create/edit draft lines) | **C** | `purchase.pr.create` / `.edit` |
| RFQ list/detail · send · convert from PR | **C** | `purchase.rfq.view` / `.send` / `.create` |
| PO list/detail + receipt % | A/B | `purchase.po.view` |
| GRN list/detail/receive | A | grn.view/create/post |
| Offline GRN queue on receive | **C** | same create; local FS/localStorage |
| Purchase QI list + **[id] accept/reject** | B/C | `purchase.qi.view` / `.complete` |
| Invoices list/detail · submit/approve | **C** | `purchase.invoice.view` / `.submit` / `.approve` |
| Returns list/detail · create from QI | **C** | `purchase.return.*` |

## Phase C non-goals (still desktop-heavy)

- Full RFQ quote entry, comparison, award, convert-to-PO
- Purchase invoice line create (view + lifecycle only)
- Full offline multi-doc sync beyond GRN create queue
- QI parameter checklists / photo attach (use Quality module for rich QC)

## Tests

```bash
cd mobile && npm run typecheck && npm run test:unit
```

Includes `verify-purchase-mobile.ts` + `verify-purchase-phase-c.ts`.
