# Dual-Variable (Catch-Weight) UOM — Design Document & Schema Proposal

**Status:** PROPOSAL — Phase 2A architecture decision. No code/migration shipped yet.
**Date:** 2026-08-10
**Depends on:** `docs/PURCHASE_MULTI_UNIT_UOM.md` (fixed conversion, shipped), `docs/STORE_OPERATIONS.md`
**Blocks:** Shared movement-line editor (Phase 2B), ad-hoc movement reversal (Phase 2C)

---

## 1. Decision being made

How FOS ERP represents quantity for items where **two physical measurements are both facts** —
e.g. castings/forgings bought by weight but handled by pieces:

```
Received: 40 NOS and 1,015 KG        (not 40 NOS × 25 KG/NOS = 1,000 KG)
```

Today the ledger stores **one** base quantity; a vendor quantity is kept as a
transaction **audit snapshot** (`uomQuantity ÷ uomConversionFactor = stock qty`). That is correct
for fixed conversion (bolt boxes, standard pipe lengths) and **wrong** for variable-weight
material: the actual KG gets overwritten by a derived number.

## 2. Correction to the 4-mode proposal

The proposed `inventoryMode = SIMPLE | VARIABLE | SERIAL | BATCH` conflates two orthogonal
concerns. In the current schema, **batch and serial are already independent tracking flags**
(`MasterItem.batchTracked` / `serialTracked` with `InventoryBatchBalance` /
`InventorySerial` balances) — and a casting is typically *batch/heat-tracked AND dual-quantity*.
Making SERIAL/BATCH exclusive "modes" would regress what already works.

**Adopted model — two orthogonal axes:**

| Axis | Values | Where it lives |
|------|--------|----------------|
| **UOM mode** (new) | `SINGLE` · `FIXED_CONVERSION` · `DUAL_VARIABLE` | `MasterItem.uomMode` |
| **Tracking** (existing) | none / batch / serial / lot+heat | `batchTracked`, `serialTracked` (unchanged) |

Examples:

| Item | uomMode | Tracking |
|------|---------|----------|
| Lubricant (LTR) | SINGLE | none |
| Bolt (1 BOX = 100 PCS) | FIXED_CONVERSION | none |
| Pump housing casting (NOS + KG) | DUAL_VARIABLE | batch (heat no.) |
| Steel coil (COIL + actual KG) | DUAL_VARIABLE | batch |
| Machine (serialised) | SINGLE | serial |

`FIXED_CONVERSION` is what the shipped purchase MUOM already does (`purchaseUomId` +
`MasterItemUomConversion.conversionFactor`); `uomMode` formalises it so the movement editor
can pick the right line UI per item.

## 3. What already exists (ground truth)

| Layer | Today | Dual-variable gap |
|-------|-------|-------------------|
| `MasterItem` | `baseUomId`, `purchaseUomId`, `batchTracked`, `serialTracked` | no mode flag, no secondary UOM / planned factor / tolerance |
| `MasterItemUomConversion` | fixed factor per alternate UOM | fine as-is (fixed mode only) |
| `InventoryStockMovement` | signed `quantity` (primary) + `uomQuantity`/`uomId`/`uomConversionFactor` **audit** | no real signed secondary quantity |
| `InventoryStockBalance` | `onHandQty` + status buckets (qcHold/blocked/rejected/reserved), `avgRate`, `stockValue` | single dimension |
| `InventoryBatchBalance` | `quantity` per batch × WH × status | single dimension |
| `InventoryTransferLine` | `quantity` / `dispatchedQty` / `receivedQty` | primary only |
| `InventoryStockCountLine` | `systemQty` / `countedQty` / `varianceQty` | primary only |
| `InventoryAdjustmentLine` | signed `quantity` | primary only |
| `InventoryStockReservation` | `quantity` (primary) | — (see §7 decision: primary-only in v1) |
| Costing (`InventoryCostEntry`, layers) | value + primary qty | unchanged (see §8) |

## 4. Schema proposal (additive, all nullable — zero impact on existing rows)

### 4.1 Enum + Item master

```prisma
enum ItemUomMode {
  SINGLE
  FIXED_CONVERSION
  DUAL_VARIABLE
}

model MasterItem {
  // existing fields unchanged …
  uomMode                  ItemUomMode @default(SINGLE)
  /// DUAL_VARIABLE only: the second real quantity unit (e.g. KG when base is NOS).
  secondaryUomId           String?
  /// Planned secondary units per 1 primary unit (e.g. 25 KG/NOS). Nominal — never derives actuals.
  plannedConversionFactor  Decimal?    @db.Decimal(18, 6)
  /// ± % tolerance of actual vs planned ratio before override is required. Null = no check.
  conversionTolerancePct   Decimal?    @db.Decimal(5, 2)
}
```

No separate `ItemUOMConfig` table: an item has exactly one secondary unit, and
`MasterItemUomConversion` already covers additional fixed alternates. One less join on the
hot posting path.

### 4.2 Movement (ledger)

```prisma
model InventoryStockMovement {
  // existing fields unchanged (incl. the vendor-UOM audit trio) …
  /// DUAL_VARIABLE only: signed actual secondary qty. Same sign as `quantity`.
  secondaryQuantity        Decimal? @db.Decimal(18, 4)
  secondaryBalanceAfter    Decimal? @db.Decimal(18, 4)
  /// Nominal factor at posting time — for variance reporting, never for derivation.
  plannedFactorSnapshot    Decimal? @db.Decimal(18, 6)
}
```

`actualRatio = secondaryQuantity / quantity` is derived, not stored. The existing
`uomQuantity` trio stays untouched — it remains the *vendor transaction* audit
(a PO in KG for a FIXED_CONVERSION item), distinct from a *real second stock quantity*.

### 4.3 Balances

```prisma
model InventoryStockBalance {
  // existing …
  secondaryOnHandQty  Decimal? @db.Decimal(18, 4)
}

model InventoryBatchBalance {
  // existing …
  secondaryQuantity   Decimal? @db.Decimal(18, 4)
}
```

Status buckets (`qcHoldQty` etc.) stay primary-only in v1; QC hold/release moves carry their
own `secondaryQuantity` so the ledger stays exact, and bucket-level secondary can be derived
if ever needed. (Castings under QC hold are still counted in `secondaryOnHandQty`.)

### 4.4 Document lines

```prisma
model InventoryTransferLine {
  secondaryQuantity          Decimal? @db.Decimal(18, 4)
  dispatchedSecondaryQty     Decimal  @default(0) @db.Decimal(18, 4)
  receivedSecondaryQty       Decimal  @default(0) @db.Decimal(18, 4)
}

model InventoryStockCountLine {
  systemSecondaryQty         Decimal? @db.Decimal(18, 4)
  countedSecondaryQty        Decimal? @db.Decimal(18, 4)
  varianceSecondaryQty       Decimal? @db.Decimal(18, 4)
}

model InventoryAdjustmentLine {
  secondaryQuantity          Decimal? @db.Decimal(18, 4)   // signed, same sign as quantity
}
```

### 4.5 Purchase (GRN) — behaviour change, minimal schema change

GRN lines already persist `uomQuantity` + `uomConversionFactor`. For DUAL_VARIABLE items the
semantics change from *derive* to *capture*:

- Operator enters **both**: pieces received (primary) and actual weight (secondary).
- `uomQuantity` stores the actual weight; the line factor snapshot stores the **planned** factor.
- Tolerance check compares `actual weight` vs `pieces × plannedConversionFactor` (§6).
- GRN → inventory bridge passes `secondaryQuantity = actual weight` into the posting engine.

PO/PR for dual items are ordered in either unit (typically KG); outstanding/received tracking
stays primary-based with secondary shown alongside.

## 5. Posting rules (engine: `postStockMovement`)

1. **Applicability** — `secondaryQuantity` accepted only when `item.uomMode = DUAL_VARIABLE`
   (else reject); required for OPENING/INWARD/ISSUE/ADJUSTMENT of dual items.
2. **Sign lock** — `sign(secondaryQuantity) === sign(quantity)`; zero secondary with non-zero
   primary is invalid (and vice versa) except stock-count corrections which may vary one
   dimension only.
3. **Balance math** — `secondaryOnHandQty += secondaryQuantity` alongside the existing primary
   update; `secondaryBalanceAfter` recorded per movement; batch balance updated when batch given.
4. **Negative guard, both dimensions** — an issue must not drive primary *or* secondary below
   the corresponding available quantity (same `allowNegativeStock` override applies to both).
5. **Issue/transfer suggestion** — UI pre-fills secondary = primary × *current actual average
   ratio of the balance* (`secondaryOnHandQty / onHandQty`), operator overrides with the real
   weighed figure. The engine never silently substitutes the suggestion.
6. **Transfers** — dispatch issues both quantities at source; receive posts the same
   secondary per line (pinned like cost, partial receive pro-rates by primary with operator
   override); reversal negates both.
7. **Stock count** — snapshot captures both system quantities; operator counts both; variance
   posts as ADJUSTMENT carrying both signed variances (either may be zero — e.g. 0 NOS / −4 KG).
8. **Idempotency / reversal** — unchanged; reversal documents negate both quantities.

## 6. Tolerance — validate, never rewrite

```
expected  = primaryQty × plannedConversionFactor
variance% = (actualSecondary − expected) / expected × 100

|variance%| ≤ conversionTolerancePct   → post
|variance%| >  conversionTolerancePct  → block; override requires
                                          inventory.override (or purchase tolerance perms on GRN)
                                          + mandatory reason (audit remark)
```

The stored quantities are **always the actuals** (40 NOS / 1,025 KG), whether or not an
override happened. Tolerance is a gate, not a calculator. Items with `conversionTolerancePct
= null` skip the check (weight is informational).

## 7. Reservations & dispatch — v1 decision

Reservations stay **primary-only** (`quantity` in NOS). Rationale: demand documents (SO/WO)
state pieces; the weighed figure is only known at physical issue. The issue that consumes a
reservation carries the actual secondary. Revisit only if a client sells castings by weight.

## 8. Costing & valuation — v1 decision

**Valuation basis stays primary.** `InventoryCostEntry` / FIFO layers / moving average remain
keyed on primary qty; movement `value` is unchanged. For weight-priced purchases the GRN line
value is already `actual KG × ₹/KG`, so per-piece cost = value ÷ pieces absorbs actual weight
correctly — heavier receipts cost more per piece, as they should. A SAP-style "valuation UOM =
secondary" option is explicitly **deferred**; it would touch every costing method and GL recon.

## 9. Migration & backfill plan (when approved)

1. Migration `inventory_dual_variable_uom`: new enum + all nullable columns above. No data
   rewrite; every existing row keeps `NULL` secondary (renders as `-`).
2. Backfill `uomMode`: items with a `purchaseUomId` whose conversion factor ≠ 1 →
   `FIXED_CONVERSION`; all others `SINGLE`. **No item becomes DUAL_VARIABLE automatically** —
   that is a per-item product decision (item master edit, allowed only while the item has no
   open documents, or with a cutover count).
3. Zod schemas: movement/transfer/count/adjustment endpoints accept optional
   `secondaryQuantity` (validated against item mode server-side).
4. Frontend: movement forms and the Phase 2B shared line editor render the secondary input
   from `uomMode`; Item Stock 360 shows `NOS / KG` from real balances instead of the current
   fixed-conversion *display* equivalent for dual items.
5. Tests: engine unit tests (sign lock, dual negative guard, tolerance gate/override), live
   lifecycle scripts per §10, costing parity (per-piece cost from weight-priced GRN).

## 10. Acceptance scenarios (must pass before Phase 2B ships)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | GRN casting: 50 NOS, actual 430 KG (planned 25 KG/NOS would say 1,250 — planned factor set to 8.6 for the test item) | Stock 50 NOS / 430 KG — actuals stored, never derived |
| 2 | Production issue 10 NOS weighed 86 KG | Stock 40 NOS / 344 KG |
| 3 | Count: system 40 NOS / 344 KG, physical 40 NOS / 340 KG | Variance 0 NOS / −4 KG posts; both ledger dims exact |
| 4 | Transfer 20 NOS / 170 KG A→B (partial receive allowed) | A: 20/174 remaining · B: 20/170 (per-line pinned) · company total unchanged |
| 5 | Tolerance: expected 1,000 KG ±2%, actual 1,015 KG | PASS, posts 1,015 |
| 6 | Tolerance: actual 1,025 KG (+2.5%) | BLOCK → override with reason → posts **1,025** |
| 7 | Issue exceeding secondary balance (40 NOS ok, 400 KG > 344 KG) | BLOCK (dual negative guard) |
| 8 | Reverse posted count/adjustment on dual item | Both dimensions restored, linked reversal rows |
| 9 | Fixed-conversion item regression (bolt box, pipe) | Behaviour identical to today (uomQuantity audit path) |
| 10 | Costing: two GRNs same pieces, different weights, weight-priced | Per-piece cost differs correctly; Inventory↔GL parity holds |

## 11. Open product decisions (need business answers before migration)

1. **Item classification** — which live items become DUAL_VARIABLE (castings, forgings,
   coils?). Provide the list with primary/secondary UOM, planned factor, tolerance %.
2. **Tolerance policy** — per-item % (proposed) vs tenant default; who holds override.
3. **Cutover** — dual items start with `secondaryOnHandQty = onHand × planned factor` or a
   physical weighing count? (Recommended: one-time weighed stock count at go-live.)
4. **Sales side** — any dual item sold by weight? (Drives reservation/dispatch secondary —
   deferred in v1, §7.)
5. Confirm valuation stays primary-based (§8).

## 12. Execution order after sign-off

```
2A  Schema migration + posting-engine dual support + tolerance gate + tests   (this doc)
2B  Shared InventoryMovementLineEditor (mode/tracking-aware, multi-line)      (blocked by 2A)
2C  Ad-hoc movement reversal documents (linked, reasoned, both dims)          (parallel-safe after 2A)
2D  BIN workshop → bin-dimension decision (separate epic)                      (unchanged)
```
