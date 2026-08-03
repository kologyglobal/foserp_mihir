# Accounting Integration Closure Audit — FIN-CLOSE-1

> **Phase:** FIN-CLOSE-1  
> **Audit date:** 2026-07-29  
> **Rule:** Code is source of truth. Status-matrix docs that lag AP/Bank & Cash are noted; this audit follows live Prisma + services + routes.  
> **Status:** CODE CLOSURE MET — scoped chains plus purchase invoice **retro cost adjustment** are live-verified. Hostinger migrate deploy remains a human production action.

---

## Executive summary

Core accounting ownership is already in place:

| Layer | Status |
|-------|--------|
| Central `post()` engine | ✅ Immutable vouchers + GL + `PostingEvent` idempotency |
| AR / Money In | ✅ Invoice / receipt / CN / allocate / reverse |
| AP / Money Out | ✅ Vendor invoice / payment / adjustment / allocate / reverse |
| Inventory costing (4 methods) | ✅ Cost entries, layers, valuation recon (stock↔layers) |
| Inventory → GL events | ✅ Flag-gated (`INVENTORY_ACCOUNTING`, default OFF) |
| Manufacturing → GL events | ✅ Flag-gated (`MANUFACTURING_ACCOUNTING`, default OFF) + financial close |
| Dispatch → SI | ✅ Invoice-ready + POD gate + `sourceLinks` + settings |

**FIN-CLOSE-1 gaps (must close):**

1. ~~**Purchase Return → AP**~~ — **done** (VENDOR_DEBIT_NOTE draft handoff; live PASS)
2. ~~**Formal GR/IR clearing**~~ — **done** (`GRIR_CLEARING` + VI release + PPV; live PASS)
3. ~~**Purchase invoice retro cost adjustment**~~ — **done 2026-07-30** (additive immutable cost entry; remaining stock vs PPV split; reversal)
4. ~~**Inventory ↔ GL trial balance**~~ — **done** (`/accounting/inventory-gl-reconciliation`; no Force Balance)
5. ~~**WIP ↔ GL TB**~~ — **done** (same recon hub)
6. ~~**Unified failed-events / Finance recon hub**~~ — **done** (Inv + Mfg FAILED/RECORDED + retry)
7. ~~**Dispatch Invoice Ready UX polish**~~ — **done** (policy banner, POD/blockers columns, mode-aware Create, POD-waiting toggle)

**Non-goals (do not touch):** year-end, accruals, FX, live NIC, AIS, Budgeting Phase 2, FA method expansion, Money In/Out redesign, new GL engine.

---

## Ownership (canonical — preserve)

| Domain | Owns | Must not |
|--------|------|----------|
| **Purchase** | PO, GRN, QI, commercial PI/PR | Direct GL / open AP |
| **Inventory** | Stock, valuation, cost entries | Duplicate AP/AR |
| **Manufacturing** | WO execution, actual cost, FG capitalisation facts | Independent valuation for GL |
| **Accounting** | AP, AR, GL, posting engine, periods, financial reversals | Bypass — all GL via `post()` |
| **Dispatch** | Outbound, POD, invoice readiness signals | Parallel receivable ledger |

---

## Gap register

For each gap: existing surface → missing → duplication risk → migration → **reuse approach**.

---

### G1 — Purchase Return → AP adjustment

| Field | Finding |
|-------|---------|
| **Existing DB** | `PurchaseReturn` / lines (soft PO/GRN refs). **No** `vendorAdjustmentId`. `VendorAdjustment` + `VendorAdjustmentReason.PURCHASE_RETURN`. `VendorAdjustmentSourceLinkType` = VI / PO / GRN / … — **no `PURCHASE_RETURN`**. |
| **Existing API** | Purchase: `POST …/purchase/returns/:id/complete` → stock issue. AP: manual `…/payables/vendor-adjustments` (types `VENDOR_DEBIT_NOTE` / `VENDOR_CREDIT_ADJUSTMENT`). |
| **Existing FE** | `PurchaseReturnDetailPage` — amber **ACCOUNTING_ADJUSTMENT_PENDING** after post; Money Out link advice. Debit-note-from-return = demo-only (`notSupportedInApiMode`). |
| **Existing posting** | Inventory event `PURCHASE_RETURN` (when flag on): Dr `PURCHASE_RETURN` / Cr `RAW_MATERIAL_INVENTORY`. No AP open-item / VI liability change. |
| **Missing** | Eligibility (returned / invoiced / already adjusted / remaining $); auto draft/post VA linked to return + original VI; partial returns; skip when no posted VI (“Not Required”). |
| **Duplication risk** | Fake Purchase AP ledger; double-reducing payable if both manual VA and auto handoff run. |
| **Migration** | Soft UUID on return; additive enum `PURCHASE_RETURN` on source-link type; forward-only. |
| **Reuse approach** | Canonical: **`VendorAdjustment` (`VENDOR_DEBIT_NOTE` typical for return after invoice)** via existing Money Out post path. Soft-link return↔adjustment. Eligibility **backend-only**. Idempotent handoff key. |

---

### G2 — Purchase Return before invoice / partial invoice

| Field | Finding |
|-------|---------|
| **Existing** | Return qty vs PO `returnedQuantity`; PI increments `invoicedQuantity`. Matching on submit does **not** strongly enforce remaining uninvoiced vs prior posts. |
| **Missing** | Explicit “financial adjustment required?” using GRN line + VI line source refs; never adjust beyond invoiced eligible value; no-invoice path = inventory only + “Not Required”. |
| **Reuse approach** | Resolve eligibility from `goodsReceiptLineId` / VI `sourceLinks` / PI lines — **no FE guessing**. |

---

### G3 — Formal GR/IR clearing

| Field | Finding |
|-------|---------|
| **Existing DB / mapping** | `DefaultAccountMappingKey` has **`PURCHASE`**, **`PURCHASE_RETURN`**, inventory keys — **no `GRIR_CLEARING` / `GR_IR`** (confirmed grep). |
| **Existing posting** | Inv `GRN_INWARD`: Dr `RAW_MATERIAL_INVENTORY` / Cr **`PURCHASE`** (builder ADR: interim GR/IR-style proxy). VI post: Dr **`PURCHASE`** + tax / Cr `VENDOR_PAYABLE`. |
| **Existing report** | Qty GRNI: `GET …/purchase/reports/grni` + FE `/purchase/reports/grn-grni` (FE rebuilds client-side; does not call API). |
| **Missing** | Dedicated clearing mapping; GRN Cr clearing; VI clear clearing + PPV; partial clear across multi-GRN/multi-invoice; GL GR/IR recon report. |
| **Duplication risk** | Using `PURCHASE` as both expense and clearing obscures RNI; do **not** keep dual semantics after GR/IR lands. |
| **Migration** | Add enum value `GRIR_CLEARING` (or project-approved name); seed mapping; **forward-only** new events (do not rewrite historical Inv events). |
| **Reuse approach** | Extend inventory accounting builder + VI posting builder; central `post()` only. Qty GRNI stays Purchase operational; GL GR/IR is Accounting recon. |

---

### G4 — Purchase invoice → AP handoff (baseline — keep)

| Field | Finding |
|-------|---------|
| **Existing** | `handoffPurchaseInvoiceToVendorInvoiceDraft` on PI post → VI **DRAFT**; soft `vendorInvoiceId`. GL only on Money Out VI post. Docs: `PURCHASE_AP_INTEGRATION.md`, `VENDOR_INVOICE_PURCHASE_INTEGRATION.md`. |
| **Missing for FIN-CLOSE** | Not a redesign — wire GR/IR clear + optional cost adjust **after** VI post / on post. |
| **Reuse approach** | Keep dual-document model. Never post GL from Purchase controller. |

---

### G5 — Purchase invoice retro cost adjustment

| Field | Finding |
|-------|---------|
| **Existing** | Receipt cost ≈ PO `unitCostPrimary` → `InventoryCostEntry` via `postStockMovement`. `correctionOfId` on cost entry exists but unused for PI path. Doc code: `PURCHASE_INVOICE_COST_ADJUSTMENT_DEFERRED`. |
| **Implemented** | Vendor Invoice calculation resolves the GRN receipt cost entry/layer. FIFO/Specific use exact remaining layer ratio; Moving Average capitalises attributable current on-hand; Standard remains PPV. Posting creates an additive `InventoryCostEntry` correction and updates the existing costing authority; original receipt is immutable. |
| **Duplication risk** | Editing original cost entry; inventing purchase-side valuation. |
| **Reuse approach** | Inventory Costing owns valuation changes; the Vendor Invoice voucher splits the receipt delta between `RAW_MATERIAL_INVENTORY` and `PURCHASE_PRICE_VARIANCE`. Idempotent movement/cost-entry keys prevent duplicate adjustments. Reversal removes the delta still on hand and reclassifies already-consumed delta to PPV. |

---

### G6 — Inventory → GL contract

| Field | Finding |
|-------|---------|
| **Existing** | `InventoryAccountingEvent`; auto on movements when flag on; partition excludes mfg-owned refs. FE `/inventory/accounting`. Gate requires `COST_OF_GOODS_SOLD` + `FINISHED_GOODS_INVENTORY` to enable (RM/PURCHASE needed at **post** time). |
| **Missing** | GR/IR counterpart swap; enablement UI put-client; stricter enable mapping set including RM + GR/IR; inventory↔GL TB. |
| **Reuse approach** | Keep flag OFF by default; extend builder mappings; no second posting engine. |

---

### G7 — Inventory ↔ GL trial balance reconciliation

| Field | Finding |
|-------|---------|
| **Existing** | Valuation recon: stock ↔ layers/MA/standard (`…/inventory/costing/valuation-reconciliation`). Reason codes are **costing** codes (`UNCOSTED_MOVEMENT`, `FIFO_LAYER_MISMATCH`, …). Explicit note: GL TB deferred; GL not shown as ₹0. |
| **Missing** | ~~Inventory value ↔ GL inventory asset by account/item drill-down; GL-oriented reason codes (`ACCOUNTING_EVENT_FAILED`, `GRIR_NOT_CLEARED`, `MANUAL_GL_ENTRY_DIFFERENCE`, …); actions Retry/Open Event/Voucher — **no Force Balance**.~~ **Landed 2026-07-29** — `/accounting/inventory-gl-reconciliation` (trial-balance + unified failed-events). |
| **Duplication risk** | Fake GL zeros in UI (already avoided — keep). |
| **Reuse approach** | New Accounting recon read model aggregating cost entries + posted Inv/Mfg events + GL balances by mapping account. FE under Accounting Reconciliation hub; reuse costing recon for stock↔layers only. |

---

### G8 — Manufacturing material / FG / variance → GL

| Field | Finding |
|-------|---------|
| **Existing** | `ProductionAccountingEvent`; issue/return/FG/variance/absorptions; amount = movement/cost facts; orchestrator + financial close APIs; FE `/accounting/manufacturing`. |
| **Missing for closure** | Controlled pilot enablement proof + WIP↔GL TB; ensure issue amount always = `InventoryCostEntry.totalCost` (assert in UAT). Variance already posts `PRODUCTION_VARIANCE`. |
| **Reuse approach** | Do not rebuild; tighten assertions + recon + failed-event visibility. Flag stays OFF until readiness. |

---

### G9 — WIP reconciliation / manufacturing financial close

| Field | Finding |
|-------|---------|
| **Existing** | Workspace WIP KPI (snapshot − FG capitalised); `GET …/accounting/workspace/reconciliation` (ops cost vs posted events); `POST …/work-orders/:id/financial-close[/preview]`; sign-offs; period-close mfg checks. |
| **Missing** | Dedicated WIP ↔ GL account TB columns; Finance Control dashboard strip. |
| **Reuse approach** | Extend existing workspace/recon APIs; preserve operational COMPLETE ≠ financial close. |

---

### G10 — Failed accounting events register

| Field | Finding |
|-------|---------|
| **Existing** | Mfg: `…/costing/accounting/workspace/failed`. Inventory: list/status on `/inventory/accounting`. Period close counts FAILED. |
| **Missing** | Unified Finance register (Inv + Mfg + PostingEvent FAILED) with Retry (idempotent), Open Source, Open Mapping — no silent success. |
| **Reuse approach** | Aggregate read API under `/accounting/…`; do not invent parallel status machine. |

---

### G11 — Dispatch → AR policy polish

| Field | Finding |
|-------|---------|
| **Existing DB** | `DispatchSettings.invoiceMode` (`ONE_PER_DISPATCH` \| `CONSOLIDATED` \| `MANUAL_ONLY`), `requirePodBeforeInvoice`, partial/multi/over flags. |
| **Existing API** | `GET/PUT …/dispatch/settings`; `GET …/receivables/invoices/invoice-ready` (+ `policy` in meta, `blockers` / `canCreateInvoice` / POD fields, `excludePodBlocked`); `POST …/prefill-from-dispatch`; POD assert; `SalesInvoiceSourceLink` `OUTBOUND_DISPATCH`. |
| **Existing FE** | `/dispatch/settings`; `/accounting/money-in/invoice-ready` — policy banner, POD + blockers columns, Create disabled for multi-customer / POD-blocked / ONE_PER_DISPATCH multi-dispatch; Show POD-waiting; partial qty via draft SI edit (capped). Outbound Create Invoice. |
| **Missing** | — **closed for FIN-CLOSE-1** (live e-Way still deferred separately). |
| **Duplication risk** | Second billing engine — avoid. |
| **Reuse approach** | Polish FE + harden remaining-qty checks; settings already canonical. |

---

### G12 — Accounting Period / reversals / identity

| Field | Finding |
|-------|---------|
| **Existing** | `resolvePostingPeriod` / closed & under-review blockers; AR/AP/journal reverse via compensating vouchers; master soft-links + snapshots on commercial docs. |
| **Missing for FIN-CLOSE** | Ensure new GR/IR, return VA, cost-adjust, recon retry paths call same period validation — no auto next-period post. |
| **Reuse approach** | Hook every new `post()` caller through existing period services. |

---

### G13 — Permissions

| Field | Finding |
|-------|---------|
| **Existing** | `finance.ap.*`, `finance.ar.*`, `finance.posting_event.view`, `manufacturing.accounting.*`, `purchase.invoice.*`, `purchase.return.*`, inventory costing / accounting perms. |
| **Missing** | Additive recon / failed-events / purchase-adjustment view perms **only if** no existing equivalent — audit matrix before inventing. |
| **Reuse approach** | Prefer extend existing `finance.*` / `manufacturing.accounting.failed_events.*` rather than duplicate. |

---

## Mapping key inventory (authoritative)

From `DefaultAccountMappingKey` in Prisma (no GR/IR / PPV today):

`CUSTOMER_RECEIVABLE`, `VENDOR_PAYABLE`, `SALES_REVENUE`, `SALES_RETURN`, `PURCHASE`, `PURCHASE_RETURN`, `RAW_MATERIAL_INVENTORY`, `WIP_INVENTORY`, `FINISHED_GOODS_INVENTORY`, `STOCK_ADJUSTMENT`, `MATERIAL_CONSUMPTION`, absorption keys, `PRODUCTION_VARIANCE`, scrap keys, freight, GST in/out, TDS, bank/treasury keys, FA keys, `RETAINED_EARNINGS`, `COST_OF_GOODS_SOLD`, …

**Proposed additive keys (implementation phase — product confirm):**

| Key | Purpose |
|-----|---------|
| `GRIR_CLEARING` | Goods received not invoiced clearing |
| `PURCHASE_PRICE_VARIANCE` | Invoice vs receipt / standard purchase variance (if not folded into existing expense key) |

Do **not** invent parallel mapping tables (ADR-039).

---

## Feature flags

| Flag | Default | Notes |
|------|---------|-------|
| `INVENTORY_ACCOUNTING` | OFF | Events recorded; GL when on |
| `MANUFACTURING_ACCOUNTING` | OFF | Events recorded; GL when on + readiness/sign-offs |

FIN-CLOSE-1 must **not** auto-enable either flag.

---

## Target chains vs current state

```text
PURCHASE (today)
PO → GRN → Stock + CostEntry → [Inv GL: Dr RM / Cr PURCHASE*] → PI → VI draft → [Money Out post: Dr PURCHASE / Cr AP]
Return → Stock out + [Inv GL PURCHASE_RETURN] → ❌ no AP VA

* PURCHASE used as informal clearing

TARGET
PO → GRN → CostEntry → Dr RM / Cr GRIR → PI → Dr GRIR (±PPV) / Cr AP → Return → Inv reverse + VendorAdjustment
```

```text
MFG (today when flag on)
Issue → CostEntry + ProductionAccountingEvent → Dr WIP / Cr RM
FG → capitalise + event → Dr FG / Cr WIP
Variance → PRODUCTION_VARIANCE on financial close

TARGET
Same postings + assert $ parity + WIP↔GL TB + failed-event control
```

```text
RECON (today)
Stock ↔ layers ✅ | Inventory ↔ GL ❌ | Qty GRNI ✅ | GL GR/IR ❌ | WIP ops↔events ✅ | WIP↔GL ❌

TARGET
Inventory↔GL + GR/IR + WIP↔GL with reason codes; no Force Balance
```

```text
O2C (today)
Dispatch → invoice-ready → SI sourceLinks → AR → receipt ✅
Policy settings ✅ | Invoice Ready UX polish ⚠️
```

---

## Key file index

| Concern | Path |
|---------|------|
| Post engine | `backend/src/modules/accounting/posting/posting.service.ts` |
| Mapping enum | `backend/prisma/schema.prisma` → `DefaultAccountMappingKey` |
| PI→VI | `backend/src/modules/purchase/invoices/purchase-invoice-ap-handoff.service.ts` |
| Return complete | `backend/src/modules/purchase/returns/*` |
| Inv GL builder | `backend/src/modules/inventory/accounting/inventory-accounting-builder.service.ts` |
| Mfg orchestrator | `backend/src/modules/manufacturing/costing/posting-orchestrator.service.ts` |
| Costing recon | `backend/src/modules/inventory/costing/costing.service.ts` |
| Vendor adjustments | `backend/src/modules/accounting/payables/` (+ Prisma `VendorAdjustment*`) |
| Dispatch policy | `DispatchSettings` + `dispatch-commercial-enforcement.ts` |
| FE Money In/Out | `frontend/src/routes/accountingRoutes.tsx` |
| FE costing | `frontend/src/routes/inventoryRoutes.tsx` |

---

## Implementation sequencing (after audit approval)

1. **Schema:** `GRIR_CLEARING` (+ optional `PURCHASE_PRICE_VARIANCE`); return↔VA soft link; VA source type `PURCHASE_RETURN`
2. **Purchase Return → AP** eligibility + handoff (G1/G2)
3. **GR/IR** builder + VI clear + partial (G3)
4. **Retro cost adjust** via Inventory Costing (G5)
5. **Inventory↔GL + GR/IR + WIP recon** read models + hub FE (G7/G9)
6. **Failed events** unified register (G10)
7. **Dispatch Invoice Ready** polish (G11)
8. **UAT A–N** + concurrency/tenant/LE + regression Money In/Out/Bank/FA/Budget/Period Close P1
9. Docs pack (§66) + final readiness verdict

---

## Hard blockers (from brief — pre-commit gates)

Do **not** mark FIN-CLOSE-1 complete if:

- Inventory cost ≠ GL posting value  
- GR/IR does not reconcile  
- Return duplicates AP adjustment  
- Invoice mutates original cost entry  
- WO material ≠ accounting event  
- FG capitalised ≠ Inv/GL  
- Failed events ignorable / Force Balance exists  
- Closed period accepts post  
- Duplicate GL on retry  
- Tenant / LE leakage  

---

## Audit verdict

| Question | Answer |
|----------|--------|
| Safe to implement without redesigning Money In/Out? | **Yes** |
| Central posting engine reusable? | **Yes** |
| Largest architectural addition | **`GRIR_CLEARING` + Inventory↔GL TB + Return→VA** |
| Estimated risk | **High on GR/IR semantics change** (forward-only migration mandatory) |
| Ready to enter implementation | **Yes — all four product decisions confirmed (below)** |

**Audit status: COMPLETE.**  
**Implementation status: FIN-CLOSE-1 STOP** — scoped chains closed (GR/IR + Return→AP live; Inventory↔GL / WIP↔GL + failed events; Dispatch→AR Invoice Ready polish). Do **not** continue into deferred statutory / advanced Finance or Money In/Out redesign from this phase.

**Explicitly still open as human/optional work:**

- Hostinger migrate deploy of `20260729160000_fin_close_1_grir_ppv_return_ap` and newer migrations, then run `scripts/map-fin-close-1-grir-ppv.ts`
- GR/IR ageing report (nice-to-have; not a stop blocker)

---

## Product decisions — CONFIRMED

All four were resolved in favour of the audit recommendation and are now in code.

| # | Decision | Resolution | Where |
|---|----------|-----------|-------|
| 1 | GRN counterpart account | New **`GRIR_CLEARING`** mapping key; `PURCHASE` is no longer the GRN proxy | `DefaultAccountMappingKey`, `inventory-accounting-builder.service.ts` |
| 2 | Purchase price variance account | New **`PURCHASE_PRICE_VARIANCE`** mapping key | `DefaultAccountMappingKey`, `finance.constants.ts` |
| 3 | Return-after-invoice document | **`VENDOR_DEBIT_NOTE`** (reason `PURCHASE_RETURN`), created as an Accounting **draft** — never auto-posted | `purchase-return-ap-handoff.service.ts` |
| 4 | GR/IR GL gating | **Yes** — same `INVENTORY_ACCOUNTING` feature gate; enabling now also requires `RAW_MATERIAL_INVENTORY` + `GRIR_CLEARING` mappings | `inventory-accounting-feature.service.ts` |

### What decision 1 changes

`GRN_INWARD` posts `Dr RAW_MATERIAL_INVENTORY / Cr GRIR_CLEARING` (reversal flips).
Forward-only: historical events keep their original `PURCHASE` counterpart — migration
`20260729160000_fin_close_1_grir_ppv_return_ap` adds enum values only and rewrites no rows.

### GR/IR closes on Vendor Invoice post

A vendor invoice line linked to a goods receipt (`sourceLinkType = GOODS_RECEIPT` with a
`sourceDocumentLineId`) no longer debits `PURCHASE`. It posts:

```text
Dr  GRIR_CLEARING            receipt cost   (releases what the GRN parked)
Dr/Cr PURCHASE_PRICE_VARIANCE  invoice taxable − receipt cost
Dr  PURCHASE                 non-recoverable tax only
```

Total debit is unchanged, so the voucher balances exactly as before.

Guard rails:

- A line only clears GR/IR when its GRN inward event actually reached `POSTED`. If
  `INVENTORY_ACCOUNTING` was off at receipt time there is no GR/IR balance, and the line keeps
  the ordinary `PURCHASE` debit — this is what makes decision 4 hold on the invoice side too.
- Receipt cost comes from the posted `InventoryAccountingEvent`, joined to the GRN line through
  the deterministic movement key `grn-in:<grnId>:<grnLineId>` — no guessing by item/warehouse.
- Partial invoicing releases proportionally; quantity already billed by a POSTED vendor invoice
  on the same receipt line is excluded, so GR/IR cannot be released twice.
- The final release for a receipt line snaps to the exact remaining balance, so rounding never
  strands a paisa in GR/IR.
- Reversal is automatic: `reverseVendorInvoice` mirrors the original voucher lines.

Live MySQL proof (`npm run test:fin-close-1-live`, 2026-07-29):

- GRN credited `GRIR_CLEARING` ₹1,000
- Vendor Invoice debited `GRIR_CLEARING` ₹1,000 and debited
  `PURCHASE_PRICE_VARIANCE` ₹100
- closing GR/IR balance was ₹0
- a two-unit invoiced Purchase Return created a ₹220 `VENDOR_DEBIT_NOTE` draft with an
  explicit `PURCHASE_RETURN` source link

### What decision 3 changes

On `POST /purchase/returns/:id/complete`, the invoiced portion of the return is handed off
to a Vendor Debit Note draft in Money Out. Eligibility is **backend-owned**:

- invoiced quantity comes from `PurchaseInvoiceLine` rows on `POSTED`/`CLOSED` purchase
  invoices, matched by explicit `goodsReceiptLineId` (falling back to `purchaseOrderLineId`)
- quantity already covered by an adjustment on another return for the same source line is
  subtracted, so the same invoiced quantity cannot be adjusted twice
- value uses the **invoiced** rate, not the return rate, and never exceeds invoiced value
- no posted invoice ⇒ `financialAdjustmentRequired: false`, reason `NO_POSTED_INVOICE`, and
  no AP document is created (inventory-only return)

Idempotency is held by `PurchaseReturn.vendorAdjustmentId`. The handoff is best-effort at
complete time (the stock issue is already committed) and re-runnable via
`POST /purchase/returns/:id/ap-adjustment`; `GET …/ap-adjustment-preview` is read-only.
