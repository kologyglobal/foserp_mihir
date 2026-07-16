/**
 * Cost calibration investigation — reads post-simulation store state.
 * Called from go-live-simulation.ts; also: npm run calibrate:cost
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
export const COST_CALIBRATION_PATH = resolve(__dir, '../ERP_COST_CALIBRATION.md')

import { seedSalesOrders } from '../src/data/mrp/seed'
import { useWorkOrderStore } from '../src/store/workOrderStore'
import { useCostingStore } from '../src/store/costingStore'
import { useBomStore } from '../src/store/bomStore'
import { useMasterStore } from '../src/store/masterStore'
import { useWorkCenterStore } from '../src/store/workCenterStore'
import { costSheetTotals } from '../src/types/costing'
import { flattenBomTree, computeBomTotalCost } from '../src/utils/bom'

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function pct(num: number, den: number) {
  return den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '—'
}

export function writeCostCalibrationReport(): { fgVarianceVsBom: number; fgVarianceVsPlanned: number } {
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const bomStore = useBomStore.getState()
const bomHeader = bomStore.bomHeaders.find((b) => b.productId === 'prod-45m3' && b.status === 'released')!
const tree = bomStore.getBomTree(bomHeader.id)
const leaves = flattenBomTree(tree).filter((n) => n.children.length === 0)
const bomPerUnit = computeBomTotalCost(tree)

const wos = useWorkOrderStore.getState().workOrders.sort((a, b) => a.woNo.localeCompare(b.woNo))
const fgWo = wos.find((w) => w.woType === 'finished_goods')!
const fgSheet = useCostingStore.getState().getCostSheet(fgWo.id)!
const fgTotals = costSheetTotals(fgSheet)

// BOM vs item master rate drift
const master = useMasterStore.getState()
const rateDrift: { code: string; bomRate: number; itemRate: number; driftPct: number }[] = []
for (const leaf of leaves) {
  const item = master.getItem(leaf.itemId)
  if (!item || leaf.standardCost === item.standardRate) continue
  const drift = item.standardRate > 0 ? ((leaf.standardCost - item.standardRate) / item.standardRate) * 100 : 0
  rateDrift.push({
    code: leaf.itemCode,
    bomRate: leaf.standardCost,
    itemRate: item.standardRate,
    driftPct: drift,
  })
}

// Work center rates
const wcs = useWorkCenterStore.getState().workCenters

interface WoBreakdown {
  woNo: string
  item: string
  qty: number
  bomStd: number
  plannedMat: number
  plannedLab: number
  plannedMac: number
  plannedSub: number
  plannedOh: number
  plannedTotal: number
  actualMat: number
  actualLab: number
  actualMac: number
  actualSub: number
  actualOh: number
  actualTotal: number
  childRollActual: number
  varVsBomPct: number
  varVsPlannedPct: number
  laborShareOfActual: number
}

const rows: WoBreakdown[] = []
for (const wo of wos) {
  const sheet = useCostingStore.getState().getCostSheet(wo.id)!
  const t = costSheetTotals(sheet)
  const actualBase =
    sheet.actual.material +
    sheet.actual.labor +
    sheet.actual.machine +
    sheet.actual.subcontract +
    sheet.actual.overhead +
    sheet.rolledUpChildActual
  rows.push({
    woNo: wo.woNo,
    item: wo.outputItemCode,
    qty: wo.qty,
    bomStd: t.bomStandardCost,
    plannedMat: sheet.planned.material,
    plannedLab: sheet.planned.labor,
    plannedMac: sheet.planned.machine,
    plannedSub: sheet.planned.subcontract,
    plannedOh: sheet.planned.overhead,
    plannedTotal: t.totalPlanned,
    actualMat: sheet.actual.material,
    actualLab: sheet.actual.labor,
    actualMac: sheet.actual.machine,
    actualSub: sheet.actual.subcontract,
    actualOh: sheet.actual.overhead,
    actualTotal: t.totalActual,
    childRollActual: sheet.rolledUpChildActual,
    varVsBomPct: t.variancePct,
    varVsPlannedPct: t.totalPlanned > 0 ? ((t.totalActual - t.totalPlanned) / t.totalPlanned) * 100 : 0,
    laborShareOfActual: actualBase > 0 ? ((sheet.actual.labor + sheet.actual.machine) / actualBase) * 100 : 0,
  })
}

// FG element bridge: actual vs BOM (material-only baseline)
const fgRow = rows.find((r) => r.woNo === fgWo.woNo)!
const childActualSum = rows.filter((r) => r.woNo !== fgWo.woNo).reduce((s, r) => s + r.actualTotal, 0)
const fgOwnActual =
  fgRow.actualMat + fgRow.actualLab + fgRow.actualMac + fgRow.actualSub + fgRow.actualOh

// Scrap summary from BOM
const scrapLines = leaves.filter((l) => l.scrapPct > 0).map((l) => ({
  code: l.itemCode,
  scrapPct: l.scrapPct,
  qtyBase: l.qtyPerProduct,
  withScrap: l.qtyPerProduct * (1 + l.scrapPct / 100),
}))

const report = `# ERP Cost Calibration Report

**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}  
**Scenario:** SO-0001 · ABC Cement · ${so.qty}× 45 M3 Bulker  
**Target:** Production-ready variance **< 10%** vs standard  
**Current FG variance:** **${fgTotals.variancePct.toFixed(1)}%** vs BOM standard — **FAIL**

---

## Executive Finding

The **52.8% FG variance is not primarily a runaway actual cost problem**. Actual total (${fmt(fgTotals.totalActual)}) is **${pct(fgTotals.totalActual, fgTotals.totalPlanned)} of planned** (${fmt(fgTotals.totalPlanned)}) — production came in **under plan**.

The red flag is a **baseline mismatch**: variance is computed as **actual full cost** (material + labor + machine + subcontract + overhead + child roll-up) vs **BOM standard**, which is **material-at-BOM-rates only** — no routing labor, no work-center conversion cost, no overhead.

| Baseline | FG Total (2 trailers) | vs Actual |
|----------|----------------------|-----------|
| BOM standard (material only) | ${fmt(fgTotals.bomStandardCost)} | Actual is **+${fgTotals.variancePct.toFixed(1)}%** |
| Planned (BOM mat + routing + OH) | ${fmt(fgTotals.totalPlanned)} | Actual is **${fgRow.varVsPlannedPct >= 0 ? '+' : ''}${fgRow.varVsPlannedPct.toFixed(1)}%** |
| Selling price (item master) | ${fmt(master.getItem('item-fg-bulker')!.standardRate * so.qty)} | Margin analysis separate |

**Root cause #1 (methodology):** Comparing apples (full absorption cost) to oranges (BOM leaf material) guarantees high variance on fabricated assemblies.

**Root cause #2 (master data):** Several BOM/routing/master gaps inflate planned cost and distort SA-level variance.

---

## 1. Variance by Work Order

| WO | Output | Qty | BOM Std | Planned | Actual | Var vs BOM | Var vs Plan | Labor+Mac % of Actual |
|----|--------|-----|---------|---------|--------|------------|-------------|----------------------|
${rows.map((r) => `| ${r.woNo} | ${r.item} | ${r.qty} | ${fmt(r.bomStd)} | ${fmt(r.plannedTotal)} | ${fmt(r.actualTotal)} | ${r.varVsBomPct.toFixed(1)}% | ${r.varVsPlannedPct >= 0 ? '+' : ''}${r.varVsPlannedPct.toFixed(1)}% | ${r.laborShareOfActual.toFixed(0)}% |`).join('\n')}

### Outlier: WO-0002 Chassis (394% vs BOM)

BOM standard for SA-CHASSIS = **${fmt(rows.find((r) => r.woNo === 'WO-0002')!.bomStd)}** — only **King Pin + 2 Landing Jacks** (${fmt(18500 + 2 * 12800)} × qty 2).

**Missing from BOM:** structural RM for chassis fabrication (plate, pipe, angle). The chassis WO still consumes **${fmt(rows.find((r) => r.woNo === 'WO-0002')!.actualMat)}** material + **${fmt(rows.find((r) => r.woNo === 'WO-0002')!.actualLab + rows.find((r) => r.woNo === 'WO-0002')!.actualMac)}** labor/machine from routing — none of which exists in BOM standard baseline.

### Outlier: WO-0004 Paint Subcontract (120% vs BOM, +100% vs plan)

BOM subcontract baseline = primer material only (${fmt(rows.find((r) => r.woNo === 'WO-0004')!.bomStd)}). Actual **${fmt(rows.find((r) => r.woNo === 'WO-0004')!.actualTotal)}** ≈ **2× planned** (${fmt(rows.find((r) => r.woNo === 'WO-0004')!.plannedTotal)}).

**Engine bug:** Simulation issues primer via \`issueAllReserved\` (ISSUE_TO_WO) then \`sendSubcontractMaterial\` (SUBCON_OUT). \`computeActualMaterial\` sums both — **double-counts** material on subcontract WOs.

**Master data gap:** No subcontract processing rate in BOM; SUBCON_IN posts at output item standardRate (₹0 for SA-PAINT-SYS).

---

## 2. BOM Material Baseline (per FG unit)

**BOM Rev-A material rollup:** ${fmt(bomPerUnit)} per trailer × ${so.qty} = **${fmt(bomPerUnit * so.qty)}**

| Item | Qty/FG | Scrap | BOM Rate | Line Cost |
|------|--------|-------|----------|-----------|
${leaves
  .sort((a, b) => b.totalCost - a.totalCost)
  .map((n) => `| ${n.itemCode} | ${n.qtyPerProduct} | ${n.scrapPct}% | ${fmt(n.standardCost)} | ${fmt(n.totalCost)} |`)
  .join('\n')}

### Scrap % in BOM

| Item | Base Qty | Scrap % | Effective Qty |
|------|----------|---------|---------------|
${scrapLines.map((s) => `| ${s.code} | ${s.qtyBase} | ${s.scrapPct}% | ${s.withScrap.toFixed(1)} |`).join('\n')}

Scrap adds ~${pct(
  leaves.reduce((sum, l) => sum + l.qtyPerProduct * l.standardCost * (l.scrapPct / 100), 0),
  leaves.reduce((sum, l) => sum + l.qtyPerProduct * l.standardCost, 0),
)} to RM material on affected lines (plate 5%, pipe/angle 3%, primer 10%). **Not the main driver of 52.8% FG variance.**

---

## 3. BOM Rate vs Item Master Rate

${rateDrift.length === 0 ? 'All BOM line rates match item master standardRate — **no drift**.' : rateDrift.map((d) => `- **${d.code}:** BOM ${fmt(d.bomRate)} vs Item ${fmt(d.itemRate)} (${d.driftPct >= 0 ? '+' : ''}${d.driftPct.toFixed(1)}%)`).join('\n')}

**Issue:** Movements value stock at **item master standardRate** at issue time. If GRN posts at PO rate ≠ standard, actual material will diverge — **no FIFO/weighted-average layer yet**.

---

## 4. Work Center Rates

| Code | Name | Cost Rate/Hr | Capacity Hrs/Day |
|------|------|--------------|------------------|
${wcs.map((w) => `| ${w.workCenterCode} | ${w.workCenterName} | ${fmt(w.costRatePerHour)} | ${w.capacityHoursPerDay} |`).join('\n')}

Rates range **₹680–₹950/hr** (seed). Planned labor+machine for all WOs drives **${pct(
  rows.reduce((s, r) => s + r.plannedLab + r.plannedMac, 0),
  rows.reduce((s, r) => s + r.plannedTotal, 0),
)}** of total planned cost — excluded entirely from BOM standard baseline.

---

## 5. Overhead Allocation

- **Current setting:** ${useCostingStore.getState().overheadPct}% on (material + labor + machine + subcontract)
- **FG planned OH:** ${fmt(fgRow.plannedOh)} · **FG actual OH:** ${fmt(fgRow.actualOh)}
- Overhead is **not in BOM standard** — adds ~${pct(fgRow.plannedOh, fgTotals.totalPlanned)} to planned, ~${pct(fgRow.actualOh, fgTotals.totalActual)} to actual

**Calibration action:** Confirm plant OH rate (typically 8–15% of conversion cost). Recalculate after labor rates validated.

---

## 6. FG Cost Bridge (2 trailers)

\`\`\`
BOM material standard (leaf rollup)     ${fmt(fgTotals.bomStandardCost).padStart(12)}
+ Planned labor + machine (not in BOM)    ${fmt(rows.reduce((s, r) => s + r.plannedLab + r.plannedMac, 0)).padStart(12)}
+ Planned subcontract processing          ${fmt(rows.reduce((s, r) => s + r.plannedSub, 0)).padStart(12)}
+ Planned overhead (10%)                  ${fmt(rows.reduce((s, r) => s + r.plannedOh, 0)).padStart(12)}
≈ Total planned                           ${fmt(fgTotals.totalPlanned).padStart(12)}

Actual child SA roll-up                   ${fmt(childActualSum).padStart(12)}
+ FG assembly own cost                    ${fmt(fgOwnActual).padStart(12)}
= Total actual                            ${fmt(fgTotals.totalActual).padStart(12)}
\`\`\`

Gap BOM → Planned explains **${pct(fgTotals.totalPlanned - fgTotals.bomStandardCost, fgTotals.bomStandardCost)}** — mostly **missing labor/routing in standard**.

Gap Planned → Actual: **${fgRow.varVsPlannedPct >= 0 ? '+' : ''}${fgRow.varVsPlannedPct.toFixed(1)}%** — acceptable if < 10%.

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

\`\`\`
Released Standard (per FG unit) =
  Σ (BOM leaf qty × (1 + scrap%) × item standard rate)
  + Σ (routing op setup + run × qty × work center rate)
  + Subcontract service rates
  + Overhead % × conversion base
\`\`\`

Store on \`md.product.standardCost\` at BOM+Routing release. Variance = actual WO cost vs this — not vs material-only rollup.

---

*Generated by \`npm run calibrate:cost\` · See \`src/utils/costEngine.ts\` and \`src/types/costing.ts\`*
`

writeFileSync(COST_CALIBRATION_PATH, report)
console.log('Cost calibration report:', COST_CALIBRATION_PATH)
console.log('FG variance vs BOM:', fgTotals.variancePct.toFixed(1) + '%')
console.log('FG variance vs Planned:', fgRow.varVsPlannedPct.toFixed(1) + '%')
return { fgVarianceVsBom: fgTotals.variancePct, fgVarianceVsPlanned: fgRow.varVsPlannedPct }
}

// Standalone: run go-live simulation first (separate process), then this script alone won't have state.
// Use npm run calibrate:cost which chains simulate + report.
if (process.argv[1]?.endsWith('cost-calibration.ts')) {
  const wos = useWorkOrderStore.getState().workOrders
  if (wos.length === 0) {
    console.error('No work orders in store — run npm run simulate:go-live first')
    process.exit(1)
  }
  writeCostCalibrationReport()
}
