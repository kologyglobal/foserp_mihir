# Purchase Multi-Unit UOM — Test Plan

**Feature:** Vendor UOM → primary/stock UOM conversion (PO → GRN → Inventory)  
**Contract:** see [`PURCHASE_MULTI_UNIT_UOM.md`](./PURCHASE_MULTI_UNIT_UOM.md)  
**Audience:** QA + engineering sign-off  
**Environments:** local API mode + stage (after Hostinger SQL `purchase-multi-unit-uom-hostinger.sql`)

---

## 1. Field contract under test

| Name | Meaning | Example (3 m = 1 NOS) |
|------|---------|------------------------|
| `uomQuantity` | Qty in vendor / purchase UOM | 30 Meter |
| `uomId` / purchase UOM | Vendor UOM | Meter |
| `quantity` | Qty in primary / stock UOM | 10 NOS |
| `uomConversionFactor` | Vendor units per **1** primary | 3 |
| `rate` | Cost per vendor UOM | ₹30 / m |
| `unitCostPrimary` | Cost per primary UOM | ₹90 / NOS (`30 × 3`) |
| `amount` | Line amount | ₹900 (`30 × 30`) |

**Formulas (must hold on every pass):**

```text
quantity         = uomQuantity / uomConversionFactor
unitCostPrimary  = rate × uomConversionFactor
amount           = rate × uomQuantity
                 = unitCostPrimary × quantity
```

**Inventory rule:** stock balance / ledger movements store **primary `quantity` only**. Vendor qty may appear on movement snapshot / UI display.

**Precision:** backend uses `Decimal(18, 4)`. Unless Purchase Setup defines otherwise, expect **4 decimal places, no banker’s rounding policy** (e.g. `7 / 3 = 2.3333`). Document actual UI display rounding in results.

---

## 2. Preconditions (one-time setup)

| ID | Setup |
|----|--------|
| S1 | Migration applied (`20260727180000_purchase_multi_unit_uom` or Hostinger SQL). |
| S2 | UOMs exist: `NOS`, `MTR` (Meter), `KG`. |
| S3 | Items: |
| | **PIPE-56** — base=`NOS`, purchase=`MTR`, `uomConversionFactor=3` |
| | **ROD-ST** — base=`NOS`, purchase=`KG`, `uomConversionFactor=50` |
| | **BOLT-M8** — base=`NOS`, purchase=`NOS`, factor=`1` |
| | **BAG-20** — base=`NOS`, purchase=`KG`, `uomConversionFactor=20` |
| | **PIPE-5X** — base=`NOS`, purchase=`MTR`, factor=`5` |
| S4 | Warehouses: `WH-RM-01`, `WH-RM-02` (active). |
| S5 | Vendor + receivable PO path (approve → send to vendor) works. |
| S6 | Purchase Setup: note `allowOverReceipt` + `overReceiptTolerancePct` for scenarios 3 / excess. |
| S7 | Actor has PO create/approve, GRN create/submit, inventory post permissions. |

---

## 3. Scenario matrix (15 cases)

Legend: **Auto** = unit/API test candidate · **Manual** = UI/E2E · **Partial** = partially automated today · **Deferred** = out of multi-unit v1 scope (track separately)

| # | Scenario | Input (vendor) | Factor | Expected primary | Cost check (example rate) | Type | Status |
|---|----------|----------------|--------|------------------|---------------------------|------|--------|
| 1 | Exact match | PO/GRN `uomQuantity=30` MTR | 3 | `quantity=10` NOS; stock +10 | rate 30 → `unitCostPrimary=90`; amount 900 | Auto+Manual | Must pass |
| 2 | Partial delivery | PO 30 m; GRN 15 m | 3 | GRN posts 5 NOS; PO open = 5 NOS (15 m) | amount on GRN = rate×15 | Auto+Manual | Must pass |
| 3 | Over-delivery | PO 30 m; GRN 36 m | 3 | If over-receipt **off**: reject `GRN_QTY_EXCEEDS`. If on + within tolerance: accept; `excessQuantity` flagged; stock +12 NOS | — | Manual | Must pass (both Setup modes) |
| 4 | Fractional result | PO/GRN 7 m | 3 | `quantity=2.3333` (4 dp) | rate 30 → unitCostPrimary 90; amount 210 | Auto+Manual | Must pass |
| 5 | Same UOM | PO 10 NOS | 1 | 10 NOS | unitCostPrimary = rate | Auto+Manual | Must pass |
| 6 | KG → NOS | PO/GRN 1000 KG | 50 | 20 NOS | rate 2 → unitCostPrimary 100; amount 2000 | Auto+Manual | Must pass |
| 7 | Large meter qty | PO/GRN 1200 m | 3 | 400 NOS | rate 10 → unitCostPrimary 30; amount 12000 | Manual | Must pass |
| 8 | Split GRNs | PO 100 m, factor 5; GRN1 60 m; GRN2 40 m | 5 | +12 then +8 NOS; PO fully received | Cumulative stock 20 | Manual | Must pass |
| 9 | Multi-item GRN | PIPE 30 m /3 →10; BAG 100 kg /20 →5 | mixed | Per-line stock correct | Per-line amount = rate×uomQty | Manual | Must pass |
| 10 | Backdated PO | Order date = yesterday | 3 | **Policy:** if app has no backdate gate, record **N/A / Deferred**; if gate exists, draft/submit blocked without approval | — | Deferred* | Sign-off N/A unless policy shipped |
| 11 | Fewer lines on GRN | PO 5 lines; GRN receives 3 | mixed | Only 3 lines stocked; other PO lines remain open | — | Manual | Must pass |
| 12 | Unit mismatch | PO UOM Meter; attempt KG on GRN | — | **v1:** GRN inherits PO line `uomId` (cannot freely switch). Attempt to post wrong UOM via API should keep PO UOM or fail validation if override attempted | — | Manual/API | Must pass (inherit PO UOM) |
| 13 | Invoice > GRN | PO/GRN 30 m →10 NOS; Invoice 33 m | 3 | Flag / block extra 3 m (1 NOS) on invoice match | — | Deferred* | Track under invoice matching |
| 14 | Fractional on invoice | 7 m → 2.3333 NOS end-to-end | 3 | Invoice qty converts same as GRN | — | Deferred* | Same as #13 when invoice dual-UOM lands |
| 15 | Multi-warehouse | PO 60 m; GRN A 30 m → WH1; GRN B 30 m → WH2 | 3 | WH1 +10 NOS; WH2 +10 NOS; no cross-warehouse bleed | — | Manual | Must pass |

\*Deferred = not blocking multi-unit **conversion** sign-off; still listed so QA does not invent false failures.

---

## 4. Detailed expected values (cost + qty)

### Scenario 1 — Exact match (PIPE-56)

| Step | `uomQuantity` | `quantity` | `rate` | `unitCostPrimary` | `amount` | Stock Δ |
|------|---------------|------------|--------|-------------------|----------|---------|
| PO line | 30 | 10 | 30 | 90 | 900 | 0 |
| GRN receive + post | 30 | 10 | 30 | 90 | 900 | +10 NOS @ avg reflecting 90 |

### Scenario 2 — Partial

| Step | Vendor | Primary | PO open (primary) |
|------|--------|---------|-------------------|
| PO | 30 m | 10 | 10 |
| GRN1 | 15 m | 5 | 5 remaining |
| Identity | `5 = 15/3` | stock +5 | |

### Scenario 6 — Weight (ROD-ST)

| Field | Value |
|-------|-------|
| uomQuantity | 1000 KG |
| quantity | 20 NOS |
| rate (₹/kg) | 2 |
| unitCostPrimary | 100 |
| amount | 2000 |

### Scenario 8 — Split GRNs (PIPE-5X, factor 5)

| Doc | Vendor | Primary | Stock cumulative |
|-----|--------|---------|------------------|
| PO | 100 m | 20 | 0 |
| GRN1 | 60 m | 12 | 12 |
| GRN2 | 40 m | 8 | 20 |
| PO status | — | fully received | |

### Scenario 4 / 14 — Fractional

| Vendor | Primary (4 dp) |
|--------|----------------|
| 7 m | 2.3333 NOS |
| amount @ rate 30 | 210 |
| unitCostPrimary | 90 |

---

## 5. Cross-cutting checks (every scenario that posts stock)

1. **PO DTO** returns both `uomQuantity` and `quantity` (+ factor, `unitCostPrimary`).
2. **GRN DTO** returns `receivedUomQuantity` and `receivedQuantity` (primary).
3. **Stock balance** `onHandQty` / `quantity` increases by **primary** only.
4. **Stock balance display** may expose computed `uomQuantity` (= primary × factor) — must not drift from item factor after posting.
5. **Movement** (optional): snapshot `uomQuantity` / `uomId` / factor present on GRN inward.
6. **UI:** PO line shows vendor entry + “→ N stock”; GRN shows UOM code; inventory list shows dual when factor ≠ 1.
7. **Idempotent post-inventory:** second post does not double stock.
8. **Factor ≤ 0** rejected on item save / line normalize.

---

## 6. Negative / edge cases (beyond the 15)

| ID | Case | Expected |
|----|------|----------|
| N1 | Item factor 0 or negative | Validation error |
| N2 | Purchase UOM = base UOM but factor ≠ 1 | Forced to 1 on item save |
| N3 | GRN without `receivedUomQuantity` and without `receivedQuantity` | Validation error |
| N4 | Legacy client sends only `quantity` with factor 1 | Treated 1:1 (both sides equal) |
| N5 | Change item factor after posted GRN | Historical PO/GRN snapshots unchanged; new docs use new factor |
| N6 | Reverse GRN | Stock decreases by same primary qty posted |

---

## 7. Automation map

| Layer | Coverage |
|-------|----------|
| Unit | `backend/tests/purchase/uom-conversion.test.ts` — formulas, factor 1, reject ≤0, dual resolve | Scenarios **1, 4, 5, 6** math |
| API (recommended next) | PO create with `uomQuantity`; GRN create + `post-inventory`; assert balance | Scenarios **1, 2, 5, 6, 8** |
| Live E2E | Stage after Hostinger SQL | Full matrix Manual column |
| Not automated yet | Over-receipt Setup matrix, multi-WH UI, invoice (#13–14), backdate (#10) | |

**Suggested API test seed:** create PIPE-56 in fixture → PO 30 m @ 30 → GRN 30 → post-inventory → `onHandQty === 10`, `avgRate` reflects primary cost path.

---

## 8. Execution checklist (QA)

```text
[ ] S1–S7 preconditions
[ ] #1 Exact match + cost identity
[ ] #2 Partial + PO open qty
[ ] #3 Over-delivery (Setup OFF then ON)
[ ] #4 Fractional 7/3
[ ] #5 Factor 1
[ ] #6 KG→NOS cost
[ ] #7 Large qty
[ ] #8 Two GRNs accumulate
[ ] #9 Multi-item one GRN
[ ] #10 Backdate — mark N/A or pass per policy
[ ] #11 Subset of PO lines on GRN
[ ] #12 UOM locked to PO line
[ ] #13–14 Invoice — N/A until dual-UOM invoice
[ ] #15 Two warehouses
[ ] N1–N6 negatives (sample)
[ ] Sign-off: date / build / tester / env
```

### Sign-off block

| Field | Value |
|-------|--------|
| Build / commit | |
| Environment | local / stage |
| Tester | |
| Date | |
| Result | PASS / PASS WITH CONDITION / FAIL |
| Conditions / defects | |

---

## 9. Known v1 gaps (do not fail conversion sign-off)

1. **Invoice dual-UOM** (#13, #14) — invoice still largely single qty; recon in vendor UOM is follow-up.
2. **Backdate approval** (#10) — not part of UOM conversion feature.
3. **Arbitrary GRN UOM override** (#12) — v1 inherits PO UOM; full “reject wrong unit” UX is optional hardening.
4. **Company rounding rules** — no separate rounding policy table; use Decimal 18,4.
5. **Balance does not persist vendor qty** — by design; display is computed.

---

## 10. Related artifacts

- Implementation notes: [`PURCHASE_MULTI_UNIT_UOM.md`](./PURCHASE_MULTI_UNIT_UOM.md)
- Hostinger SQL: [`backend/scripts/purchase-multi-unit-uom-hostinger.sql`](../backend/scripts/purchase-multi-unit-uom-hostinger.sql)
- Unit tests: [`backend/tests/purchase/uom-conversion.test.ts`](../backend/tests/purchase/uom-conversion.test.ts)
- Conversion helper: [`backend/src/modules/purchase/shared/uom-conversion.ts`](../backend/src/modules/purchase/shared/uom-conversion.ts)
