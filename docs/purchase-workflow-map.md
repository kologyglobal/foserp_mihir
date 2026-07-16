# Purchase Workflow Map

Canonical procurement process (UX source of truth). Purchase remains **demo frontend only** — transactional inventory / quality / AP backends are deferred by design.

Code: `frontend/src/config/purchaseWorkflow.ts`, labels/next steps: `frontend/src/utils/purchaseStatusLabels.ts`.

| # | Canonical step | Coverage | Route / page | Demo notes |
|---|----------------|----------|--------------|------------|
| 1 | Demand Generated | partial | `/purchase/requisitions` | PR source labels (MRP, manual, reorder, WO…). No standalone demand register. |
| 2 | Stock and Incoming Quantity Checked | deferred | — | Planned with inventory. |
| 3 | Purchase Requisition Created | exists | `/purchase/requisitions`, `/new` | Demo PR CRUD + statuses. |
| 4 | Requisition Approved | exists | PR 360 | `submitted` → `approved`. |
| 5 | RFQ Sent to Approved Vendors | exists | `/purchase/rfqs` | Send RFQ action. |
| 6 | Vendor Quotations Received | exists | `/purchase/vendor-quotations`, RFQ Responses | Quote capture on RFQ. |
| 7 | Technical and Commercial Comparison | exists | `/purchase/comparison/:rfqId` | Comparison matrix. |
| 8 | Vendor Selected | partial | RFQ recommendation / compare award | No formal award document. |
| 9 | Purchase Order Created | exists | `/purchase/orders`, from PR/RFQ | Manual / From PR / From RFQ. |
| 10 | Purchase Order Approved and Released | exists | PO 360 | `approved` + `released`. |
| 11 | Vendor Confirmation Received | partial | PO `sent` | Sent status proxies acknowledgement. |
| 12 | Material Delivered | partial | PO partial/received | Inferred from GRN qty. |
| 13 | Gate Entry and GRN | partial | `/purchase/grn` | GRN live; gate fields stub/Planned. |
| 14 | Quality Inspection | partial | GRN `pending_qc` → `/quality/incoming` | Cross-module Quality demo. |
| 15 | Accepted Stock Posted to Inventory | partial | GRN `posted` | Demo stock post — no inventory ledger API. |
| 16 | Vendor Invoice Received | deferred | — | Finance / AP. |
| 17 | PO–GRN–Invoice Matching | deferred | — | Finance / AP. |
| 18 | Invoice Approved and Posted | deferred | — | Finance / AP. |
| 19 | Vendor Payment | deferred | — | Finance / AP. |
| 20 | Purchase Order Closed | exists | PO Close action | After fully received. |

## Demo journey (click-through)

```text
/purchase (process map)
  → Create Requisition → Submit → Approve
  → Send RFQ to Vendors → Record quotes → Compare → Select vendor
  → Create PO → Approve → Release → Send
  → Gate Entry & GRN → QC (if required) → Posted (demo stock)
  → Close PO
```

Planned for later backends: stock check (2), formal gate-pass (13), AP invoice path (16–19).

## Related

- Module still **Deferred by design** in `PROJECT_STATUS.md` / `REMAINING_WORK.md` P3-2.
- Do not mark Purchase “complete” without API + DB + permissions + tests.
