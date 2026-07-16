# Cost Variance Analysis

**Generated:** 2026-06-25 11:42:09  
**Scenario:** SO-0001 · ABC Cement · 2× 45 M3 Bulker Trailer  
**Current variance:** **52.8%** vs BOM material standard (target **< 10%**)  
**Variance vs planned absorption cost:** **-19.2%**  
**Method:** Read-only investigation — **no formulas or rates were changed**

---

## Root Cause Summary (read first)

| # | Root cause | Type | Impact on 52.8% variance |
|---|------------|------|--------------------------|
| 1 | **Wrong variance baseline** — `variancePct` compares full absorption actual vs **material-only BOM** | Methodology | **Primary driver (~89% of gap is BOM→Planned, not Actual→Planned)** |
| 2 | **Labor + machine excluded from BOM standard** — routing/WC costs exist in planned/actual but not in `bomStandardCost` | Methodology | **~₹22,12,640 planned conversion across WOs** |
| 3 | **Chassis BOM incomplete** — SA-CHASSIS BOM = King Pin + Landing Jacks only; structural RM under Tank SA not duplicated under Chassis | Master data | WO-0002 shows **394% vs BOM** at SA level |
| 4 | **Subcontract material double-count** — `issueAllReserved` + `sendSubcontractMaterial` both counted in `computeActualMaterial` | Engine (document only) | WO-0004 actual **2× planned** on paint |
| 5 | **Subcontract service rate missing** — SA-PAINT-SYS `standardRate = 0`; no processing charge in BOM | Master data | SUBCON_IN valued at ₹0 |
| 6 | **Overhead not in BOM** — 10% on (mat+lab+mac+sub) | Overhead policy | **₹55,316 planned / ₹30,836 actual** on FG sheet |
| 7 | **Item/BOM rate sync OK** — BOM lines match item master | — | No drift detected |
| 8 | **Scrap assumptions modest** — adds ~1.4% to RM material | Scrap | **Not main driver** |
| 9 | **Actual production under plan** — actual 80.8% of planned | Operations | **-19.2% vs plan is acceptable** if baseline fixed |

**Key insight:** Actual costs are **not** 52.8% over budget. They are **19.2% under plan**. The 52.8% figure is a **metric definition problem**, not a factory cost explosion.

---

## Per Finished Trailer (45 M3 Bulker)

Order qty: **2 trailers** · Values below are **per trailer** (FG WO WO-0005 totals ÷ 2).

| Cost Element | Planned | Actual | Δ (Actual − Planned) | Δ vs BOM Std |
|--------------|---------|--------|----------------------|--------------|
| **Material** | ₹0 | ₹0 | ₹0 | BOM mat = ₹15,18,221 |
| **Labor** | ₹18,940 | ₹18,940 | ₹0 | ₹0 in BOM |
| **Machine** | ₹2,57,640 | ₹1,35,240 | ₹-1,22,400 | ₹0 in BOM |
| **Subcontract** | ₹0 | ₹0 | ₹0 | Primer only in BOM |
| **Overhead (10%)** | ₹27,658 | ₹15,418 | ₹-12,240 | ₹0 in BOM |
| **Child SA roll-up** | ₹25,68,457 | ₹21,50,564 | ₹-4,17,893 | Included in BOM leaves |
| **Total** | **₹28,72,695** | **₹23,20,162** | **₹-5,52,533** | BOM std **₹15,18,221** |

**Per-trailer variance vs BOM standard:** 52.8% (₹8,01,941)  
**Per-trailer variance vs planned:** -19.2%

---

## Investigation 1 — BOM Standard Costs

**Released BOM:** BOM-45M3-001 Rev-A  
**Material rollup per FG unit:** ₹15,18,221  
**Order total (2 units):** ₹30,36,442

| Item | Qty/FG | Scrap | BOM Rate | Line Cost/FG |
|------|--------|-------|----------|--------------|
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

**Finding:** BOM standard = **purchased leaf material only**. Sub-assembly nodes (Tank, Chassis, Run Gear, Paint) have **₹0 node cost** — conversion is excluded by design in `bomStandardUnitCost()`.

**Chassis gap:** Under `SA-CHASSIS`, BOM lists only `BO-KPIN-2-JOST` + `BO-LJ-24T` (₹44,100/unit). Structural plate/pipe/angle are under **SA-TANK-ASM**, not Chassis — SA-level BOM variance is misleading.

---

## Investigation 2 — Item Master Costs

| Check | Result |
|-------|--------|
| BOM line rate vs item `standardRate` | ✅ All match |
| FG selling price (item master) | ₹28,50,000/unit |
| SA items standardRate | Tank/Chassis/Run Gear/Paint = **₹0** (correct for manufactured/subcon nodes) |

No BOM ↔ item master rate drift on leaf items.

**Finding:** Issues post at **item master standardRate** at transaction time. No weighted-average or last-GRN-rate layer — PO price differences won't flow to actual until master rates updated.

---

## Investigation 3 — Material Issue Rates

| Item | BOM Qty (2 FG) | Issued Qty | BOM Value | Issued Value | Variance |
|------|------------------------|------------|-----------|--------------|----------|
| BO-AIRTANK-40L | 4.0 | 0.0 | ₹26,000 | ₹0 | ₹-26,000 |
| RM-PRIMER-RO | 88.0 | 176.0 | ₹25,080 | ₹50,160 | ₹25,080 |
| RM-MS-PLT-16 | 8820.0 | 8820.0 | ₹6,04,170 | ₹6,04,170 | ₹0 |
| RM-PIPE-150-CHS | 98.9 | 98.9 | ₹1,82,928 | ₹1,82,928 | ₹0 |
| RM-ANGLE-75X75 | 247.2 | 247.2 | ₹1,53,264 | ₹1,53,264 | ₹0 |
| BO-AXL-ABS6620 | 2.0 | 2.0 | ₹9,70,000 | ₹9,70,000 | ₹0 |
| BO-SUSP-14T | 2.0 | 2.0 | ₹2,50,000 | ₹2,50,000 | ₹0 |
| BO-TYRE-925 | 24.0 | 24.0 | ₹5,40,000 | ₹5,40,000 | ₹0 |
| BO-RIM-925 | 24.0 | 24.0 | ₹1,96,800 | ₹1,96,800 | ₹0 |
| BO-KPIN-2-JOST | 2.0 | 2.0 | ₹37,000 | ₹37,000 | ₹0 |
| BO-LJ-24T | 4.0 | 4.0 | ₹51,200 | ₹51,200 | ₹0 |

**Paint WO double-count:**

| Movement type | Value on WO-0004 |
|---------------|------------------|
| ISSUE_TO_WO (primer) | ₹25,080 |
| SUBCON_OUT (same primer) | ₹25,080 |
| **Counted twice in actual material** | **≈ ₹25,080** |

---

## Investigation 4 — Labor Rates

Labor computed from **job card actual hours** × WC rate × setup/run split (`computeActualLaborMachine`).

| WO | Output | Planned Labor | Actual Labor | Δ |
|----|--------|---------------|--------------|---|
| WO-0001 | SA-TANK-ASM | ₹37,880 | ₹31,366 | ₹-6,514 |
| WO-0002 | SA-CHASSIS | ₹37,880 | ₹37,880 | ₹0 |
| WO-0003 | SA-RUN-GEAR | ₹37,880 | ₹37,880 | ₹0 |
| WO-0004 | SA-PAINT-SYS | ₹0 | ₹0 | ₹0 |
| WO-0005 | FG-BULKER-45M3 | ₹37,880 | ₹37,880 | ₹0 |

**Finding:** Actual labor is **below planned** on most WOs (simulation completes job cards faster than routing standard hours). Labor is **0% of BOM standard** — drives FG variance metric.

---

## Investigation 5 — Work Center Hourly Rates

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

**Range:** ₹680–₹950/hr (seed data, unvalidated).  
**Routing:** RTG-45M3-BULKER-001 Rev-A · 10 operations · 186 std hrs total.

**Calibration need:** Finance to validate rates from payroll + equipment depreciation. Production to validate std hours from time studies.

---

## Investigation 6 — Machine Rates

Machine cost uses **same WC `costRatePerHour`** as labor — split by setup vs run in `computePlannedLaborMachine` / `computeActualLaborMachine`.

| WO | Planned Machine | Actual Machine | Δ |
|----|-----------------|----------------|---|
| WO-0001 | ₹5,15,280 | ₹2,26,509 | ₹-2,88,771 |
| WO-0002 | ₹5,15,280 | ₹2,70,480 | ₹-2,44,800 |
| WO-0003 | ₹5,15,280 | ₹2,70,480 | ₹-2,44,800 |
| WO-0004 | ₹0 | ₹0 | ₹0 |
| WO-0005 | ₹5,15,280 | ₹2,70,480 | ₹-2,44,800 |

**Finding:** No separate machine rate table — **single `costRatePerHour` per work center**. Consider splitting labor rate vs machine rate for accurate absorption.

---

## Investigation 7 — Subcontract Charges

| WO | Type | BOM Std | Planned Subcon | Actual Subcon | Notes |
|----|------|---------|----------------|---------------|-------|
| WO-0004 | subcontract | ₹25,080 | ₹0 | ₹0 | Primer only in BOM; double material count |

**Finding:** Subcontract processing charge **not modeled**. `computeActualSubcontract` falls back to SUBCON_IN movement value; SA-PAINT-SYS receives at **₹0 rate**.

---

## Investigation 8 — Overhead Allocation

| Setting | Value |
|---------|-------|
| Global overhead % | **10%** |
| Formula | `(material + labor + machine + subcontract) × 10%` |
| In BOM standard? | **No** |

| WO | Planned OH | Actual OH |
|----|------------|-----------|
| WO-0001 | ₹1,49,352 | ₹1,19,824 |
| WO-0002 | ₹64,136 | ₹39,656 |
| WO-0003 | ₹2,50,996 | ₹2,26,516 |
| WO-0004 | ₹2,508 | ₹5,016 |
| WO-0005 | ₹55,316 | ₹30,836 |

**FG sheet:** Planned OH ₹55,316 · Actual OH ₹30,836 per order (2 units).

**Calibration need:** Finance to set OH rate from plant budget ÷ conversion cost base (typically 8–15%).

---

## Investigation 9 — Scrap Assumptions

| Item | Base Qty/FG | Scrap % | Effective Qty | Scrap Premium/FG |
|------|-------------|---------|---------------|------------------|
| RM-MS-PLT-16 | 4200 | 5% | 4410.0 | ₹14,385 |
| RM-PIPE-150-CHS | 48 | 3% | 49.4 | ₹2,664 |
| RM-ANGLE-75X75 | 120 | 3% | 123.6 | ₹2,232 |
| RM-PRIMER-RO | 40 | 10% | 44.0 | ₹1,140 |

**Total scrap premium per FG unit:** ₹20,421 (~1.4% of RM material)  
**Finding:** Scrap is **not** the driver of 52.8% FG variance. Validate percentages against NCR/rework history.

---

## Top 20 Variance Contributors (vs BOM Standard Baseline)

Total FG variance amount: **₹16,03,882** (52.8% of ₹30,36,442)

| Rank | Area | Description | Est. Impact | % of Variance | Type |
|------|------|-------------|-------------|---------------|------|
| 1 | Labor / routing | Child SA roll-up includes labor+machine+OH not in material-only BOM baseline | ₹12,65,606 | 78.9% | methodology |
| 2 | Labor rates | FG final assembly WO-0005 — own labor+machine+OH (routing ops 80–100) | ₹3,39,196 | 21.1% | methodology |
| 3 | Machine / WC rates | WO-0002 SA-CHASSIS — actual machine time cost (not in BOM standard) | ₹2,70,480 | 16.9% | methodology |
| 4 | Machine / WC rates | WO-0003 SA-RUN-GEAR — actual machine time cost (not in BOM standard) | ₹2,70,480 | 16.9% | methodology |
| 5 | Machine / WC rates | WO-0005 FG-BULKER-45M3 — actual machine time cost (not in BOM standard) | ₹2,70,480 | 16.9% | methodology |
| 6 | Overhead allocation | WO-0003 — 10% overhead on conversion base (not in BOM standard) | ₹2,26,516 | 14.1% | overhead |
| 7 | Machine / WC rates | WO-0001 SA-TANK-ASM — actual machine time cost (not in BOM standard) | ₹2,26,509 | 14.1% | methodology |
| 8 | Overhead allocation | WO-0001 — 10% overhead on conversion base (not in BOM standard) | ₹1,19,824 | 7.5% | overhead |
| 9 | Material issue rates | Issued material valued at item master standardRate — GRN/PO rate variance not tracked | ₹51,080 | 3.2% | rate |
| 10 | Scrap assumptions | BOM scrap premium on RM lines (plate 5%, pipe/angle 3%, primer 10%) | ₹40,842 | 2.5% | scrap |
| 11 | Overhead allocation | WO-0002 — 10% overhead on conversion base (not in BOM standard) | ₹39,656 | 2.5% | overhead |
| 12 | Labor rates / routing | WO-0002 SA-CHASSIS — actual labor (not in BOM standard) | ₹37,880 | 2.4% | methodology |
| 13 | Labor rates / routing | WO-0003 SA-RUN-GEAR — actual labor (not in BOM standard) | ₹37,880 | 2.4% | methodology |
| 14 | Labor rates / routing | WO-0005 FG-BULKER-45M3 — actual labor (not in BOM standard) | ₹37,880 | 2.4% | methodology |
| 15 | Labor rates / routing | WO-0001 SA-TANK-ASM — actual labor (not in BOM standard) | ₹31,366 | 2.0% | methodology |
| 16 | Overhead allocation | WO-0005 — 10% overhead on conversion base (not in BOM standard) | ₹30,836 | 1.9% | overhead |
| 17 | Subcontract charges | WO-0004 paint — material double-count (ISSUE_TO_WO + SUBCON_OUT) ≈ ₹25,080 duplicated | ₹25,080 | 1.6% | engine |
| 18 | Overhead allocation | WO-0004 — 10% overhead on conversion base (not in BOM standard) | ₹5,016 | 0.3% | overhead |

*Note: Contributors overlap — conversion costs appear at both WO and roll-up level. Use this table for **prioritization**, not additive reconciliation.*

---

## Cost Bridge — Order Total (2 Trailers)

```
BOM material standard (leaf rollup)              ₹30,36,442
  ↳ Missing from this baseline:
    + Labor + machine (all WOs)                  ₹11,82,954
    + Overhead (10%)                                  ₹4,21,848
    + Subcontract gaps / double-count               ₹25,080
≈ Actual absorption cost                         ₹46,40,324

Planned absorption cost                          ₹57,45,390
Actual vs Planned                          -19.2%
```

---

## Calibration Recommendations (no auto-changes)

### Priority 1 — Fix the metric (no master data change)

| Action | Owner | Expected effect |
|--------|-------|-----------------|
| Define **Released Standard Cost** = BOM material + routing labor/machine + subcontract + OH | Costing / Eng | Variance baseline matches absorption |
| Report **two variances**: vs released standard AND vs material-only BOM | ERP Admin | Stops 52.8% false alarm |
| Store released standard on `Product.standardCost` at BOM+Routing release | Engineering | Single source of truth |

### Priority 2 — Master data corrections

| Action | Owner | Expected effect |
|--------|-------|-----------------|
| Add **subcontract processing rate** for paint (service line or item rate) | Purchase / Eng | Subcon actual > 0 with correct baseline |
| Review **SA-CHASSIS BOM** — confirm RM allocation (Tank vs Chassis) | Engineering | SA-level variance becomes meaningful |
| Validate **WC rates** ₹680–950/hr against payroll + depreciation | Finance | Planned labor within ±8% of actual |
| Time-study **routing std hours** per operation | Production | Planned hours match shop floor |

### Priority 3 — Engine fixes (requires dev approval)

| Action | Owner | Expected effect |
|--------|-------|-----------------|
| Exclude double-count: don't sum ISSUE_TO_WO + SUBCON_OUT for same material on subcontract WOs | Dev | WO-0004 actual ≈ planned |
| SUBCON_IN at **service rate** not output item ₹0 rate | Dev | Subcontract actual captured |
| Optional: split WC into labor rate + machine rate | Dev | Finer variance analysis |

### Priority 4 — Policy

| Action | Owner | Expected effect |
|--------|-------|-----------------|
| Confirm OH **10%** vs plant budget | Finance | OH variance < 2% |
| Validate scrap % from quality history | Quality | Material variance < 5% |
| GRN rate → item standard sync on approval | Stores | Issue rate matches procurement |

---

## Target State After Calibration

| Metric | Current | Target |
|--------|---------|--------|
| FG variance vs **released standard** | Not computed | **< 10%** |
| FG variance vs material-only BOM | 52.8% | Report separately (informational) |
| FG variance vs planned | -19.2% | **< 10%** (already close) |
| Material issued vs BOM qty × rate | ~0% (standard rate issues) | **< 5%** |
| Labor actual vs routing std | Under plan | **< 8%** |

---

## Related Artifacts

| File | Purpose |
|------|---------|
| `ERP_COST_CALIBRATION.md` | Executive calibration summary |
| `src/utils/costEngine.ts` | Cost formulas (unchanged) |
| `src/types/costing.ts` | Variance metric definition |
| `npm run simulate:go-live` | Regenerates this analysis |

---

*Investigation only — formulas and rates were not modified. Implement recommendations after Finance + Engineering sign-off.*
