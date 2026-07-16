# ERP Cost Calibration Report

**Generated:** 2026-06-25 11:42:09  
**Scenario:** SO-0001 · ABC Cement · 2× 45 M3 Bulker  
**Target:** Production-ready variance **< 10%** vs standard  
**Current FG variance:** **52.8%** vs BOM standard — **FAIL**

---

## Executive Finding

The **52.8% FG variance is not primarily a runaway actual cost problem**. Actual total (₹46,40,324) is **80.8% of planned** (₹57,45,390) — production came in **under plan**.

The red flag is a **baseline mismatch**: variance is computed as **actual full cost** (material + labor + machine + subcontract + overhead + child roll-up) vs **BOM standard**, which is **material-at-BOM-rates only** — no routing labor, no work-center conversion cost, no overhead.

| Baseline | FG Total (2 trailers) | vs Actual |
|----------|----------------------|-----------|
| BOM standard (material only) | ₹30,36,442 | Actual is **+52.8%** |
| Planned (BOM mat + routing + OH) | ₹57,45,390 | Actual is **-19.2%** |
| Selling price (item master) | ₹57,00,000 | Margin analysis separate |

**Root cause #1 (methodology):** Comparing apples (full absorption cost) to oranges (BOM leaf material) guarantees high variance on fabricated assemblies.

**Root cause #2 (master data):** Several BOM/routing/master gaps inflate planned cost and distort SA-level variance.

---

## 1. Variance by Work Order

| WO | Output | Qty | BOM Std | Planned | Actual | Var vs BOM | Var vs Plan | Labor+Mac % of Actual |
|----|--------|-----|---------|---------|--------|------------|-------------|----------------------|
| WO-0001 | SA-TANK-ASM | 2 | ₹9,40,362 | ₹16,42,874 | ₹13,18,060 | 40.2% | -19.8% | 20% |
| WO-0002 | SA-CHASSIS | 2 | ₹88,200 | ₹7,05,496 | ₹4,36,216 | 394.6% | -38.2% | 71% |
| WO-0003 | SA-RUN-GEAR | 2 | ₹19,56,800 | ₹27,60,956 | ₹24,91,676 | 27.3% | -9.8% | 12% |
| WO-0004 | SA-PAINT-SYS | 2 | ₹25,080 | ₹27,588 | ₹55,176 | 120.0% | +100.0% | 0% |
| WO-0005 | FG-BULKER-45M3 | 2 | ₹30,36,442 | ₹57,45,390 | ₹46,40,324 | 52.8% | -19.2% | 7% |

### Outlier: WO-0002 Chassis (394% vs BOM)

BOM standard for SA-CHASSIS = **₹88,200** — only **King Pin + 2 Landing Jacks** (₹44,100 × qty 2).

**Missing from BOM:** structural RM for chassis fabrication (plate, pipe, angle). The chassis WO still consumes **₹88,200** material + **₹3,08,360** labor/machine from routing — none of which exists in BOM standard baseline.

### Outlier: WO-0004 Paint Subcontract (120% vs BOM, +100% vs plan)

BOM subcontract baseline = primer material only (₹25,080). Actual **₹55,176** ≈ **2× planned** (₹27,588).

**Engine bug:** Simulation issues primer via `issueAllReserved` (ISSUE_TO_WO) then `sendSubcontractMaterial` (SUBCON_OUT). `computeActualMaterial` sums both — **double-counts** material on subcontract WOs.

**Master data gap:** No subcontract processing rate in BOM; SUBCON_IN posts at output item standardRate (₹0 for SA-PAINT-SYS).

---

## 2. BOM Material Baseline (per FG unit)

**BOM Rev-A material rollup:** ₹15,18,221 per trailer × 2 = **₹30,36,442**

| Item | Qty/FG | Scrap | BOM Rate | Line Cost |
|------|--------|-------|----------|-----------|
| BO-AXL-ABS6620 | 1 | 0% | ₹4,85,000 | ₹4,85,000 |
| RM-MS-PLT-16 | 4200 | 5% | ₹69 | ₹3,02,085 |
| BO-TYRE-925 | 12 | 0% | ₹22,500 | ₹2,70,000 |
| BO-SUSP-14T | 1 | 0% | ₹1,25,000 | ₹1,25,000 |
| BO-RIM-925 | 12 | 0% | ₹8,200 | ₹98,400 |
| RM-PIPE-150-CHS | 48 | 3% | ₹1,850 | ₹91,464 |
| RM-ANGLE-75X75 | 120 | 3% | ₹620 | ₹76,632 |
| BO-LJ-24T | 2 | 0% | ₹12,800 | ₹25,600 |
| BO-KPIN-2-JOST | 1 | 0% | ₹18,500 | ₹18,500 |
| BO-AIRTANK-40L | 2 | 0% | ₹6,500 | ₹13,000 |
| RM-PRIMER-RO | 40 | 10% | ₹285 | ₹12,540 |

### Scrap % in BOM

| Item | Base Qty | Scrap % | Effective Qty |
|------|----------|---------|---------------|
| RM-MS-PLT-16 | 4200 | 5% | 4410.0 |
| RM-PIPE-150-CHS | 48 | 3% | 49.4 |
| RM-ANGLE-75X75 | 120 | 3% | 123.6 |
| RM-PRIMER-RO | 40 | 10% | 44.0 |

Scrap adds ~1.4% to RM material on affected lines (plate 5%, pipe/angle 3%, primer 10%). **Not the main driver of 52.8% FG variance.**

---

## 3. BOM Rate vs Item Master Rate

All BOM line rates match item master standardRate — **no drift**.

**Issue:** Movements value stock at **item master standardRate** at issue time. If GRN posts at PO rate ≠ standard, actual material will diverge — **no FIFO/weighted-average layer yet**.

---

## 4. Work Center Rates

| Code | Name | Cost Rate/Hr | Capacity Hrs/Day |
|------|------|--------------|------------------|
| WC-CUTTING | Cutting Bay | ₹850 | 16 |
| WC-ROLLING | Rolling Bay | ₹920 | 16 |
| WC-TANK-ASM | Tank Assembly | ₹780 | 16 |
| WC-WELDING | Welding Bay | ₹950 | 16 |
| WC-CHASSIS | Chassis Assembly | ₹820 | 16 |
| WC-RUN-GEAR | Running Gear Fitment | ₹880 | 16 |
| WC-PNEUMATIC | Pneumatic Installation | ₹760 | 16 |
| WC-ELECTRICAL | Electrical Bay | ₹740 | 16 |
| WC-PAINT | Paint Shop | ₹680 | 16 |
| WC-TESTING | Testing & QC | ₹900 | 16 |

Rates range **₹680–₹950/hr** (seed). Planned labor+machine for all WOs drives **20.3%** of total planned cost — excluded entirely from BOM standard baseline.

---

## 5. Overhead Allocation

- **Current setting:** 10% on (material + labor + machine + subcontract)
- **FG planned OH:** ₹55,316 · **FG actual OH:** ₹30,836
- Overhead is **not in BOM standard** — adds ~1.0% to planned, ~0.7% to actual

**Calibration action:** Confirm plant OH rate (typically 8–15% of conversion cost). Recalculate after labor rates validated.

---

## 6. FG Cost Bridge (2 trailers)

```
BOM material standard (leaf rollup)       ₹30,36,442
+ Planned labor + machine (not in BOM)      ₹22,12,640
+ Planned subcontract processing                    ₹0
+ Planned overhead (10%)                     ₹5,22,308
≈ Total planned                             ₹57,45,390

Actual child SA roll-up                     ₹43,01,128
+ FG assembly own cost                       ₹3,39,196
= Total actual                              ₹46,40,324
```

Gap BOM → Planned explains **89.2%** — mostly **missing labor/routing in standard**.

Gap Planned → Actual: **-19.2%** — acceptable if < 10%.

---

## 7. Calibration Checklist (Before Go-Live)

| # | Area | Current Issue | Action | Owner |
|---|------|---------------|--------|-------|
| 1 | **Standard cost definition** | Variance = actual vs material-only BOM | Define **released standard** = BOM material + routing labor/machine + OH | Costing / Eng |
| 2 | **BOM completeness** | Chassis SA missing structural RM | Add plate/pipe/angle lines under SA-CHASSIS | Engineering |
| 3 | **Subcontract standard** | Paint BOM = primer only; SUBCON_IN at ₹0 rate | Add service rate line; fix double-count (ISSUE_TO_WO + SUBCON_OUT) in cost engine | Purchase / Dev |
| 4 | **BOM rates** | Copied from item master at line create | Sync on BOM release; GRN weighted avg feed-back | Stores |
| 5 | **Work center rates** | Seed ₹680–950/hr unvalidated | Calibrate from payroll + machine depreciation | Finance |
| 6 | **Routing hours** | Standard hours drive planned labor | Time-study / historical avg per operation | Production |
| 7 | **Scrap %** | 3–10% on RM lines only | Validate from NCR/rework history; add SA-level scrap | Quality |
| 8 | **Overhead %** | Fixed 10% global | Plant OH budget / conversion cost base | Finance |
| 9 | **Variance metric** | vs BOM material only | Report **variance vs released standard** AND material-only BOM | ERP Admin |

---

## 8. Target State

After calibration:

| Metric | Target |
|--------|--------|
| FG variance vs **released standard cost** | **< 10%** |
| Material variance (issued vs BOM qty × rate) | **< 5%** |
| Labor variance (actual hrs vs routing) | **< 8%** |
| BOM revision tied to standard cost roll | On every Rev release |

---

## 9. Recommended Standard Cost Formula

```
Released Standard (per FG unit) =
  Σ (BOM leaf qty × (1 + scrap%) × item standard rate)
  + Σ (routing op setup + run × qty × work center rate)
  + Subcontract service rates
  + Overhead % × conversion base
```

Store on `md.product.standardCost` at BOM+Routing release. Variance = actual WO cost vs this — not vs material-only rollup.

---

*Generated by `npm run calibrate:cost` · See `src/utils/costEngine.ts` and `src/types/costing.ts`*
