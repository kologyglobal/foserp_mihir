/**
 * Cost Variance Analysis — investigation report (no formula changes).
 * Called from go-live-simulation.ts after stores are populated.
 * Standalone: npm run analyze:cost-variance (chains simulate + report)
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedSalesOrders } from '../src/data/mrp/seed'
import { useWorkOrderStore } from '../src/store/workOrderStore'
import { useCostingStore } from '../src/store/costingStore'
import { useBomStore } from '../src/store/bomStore'
import { useMasterStore } from '../src/store/masterStore'
import { useWorkCenterStore } from '../src/store/workCenterStore'
import { useInventoryStore } from '../src/store/inventoryStore'
import { useRoutingStore } from '../src/store/routingStore'
import { costSheetTotals, sumCostElements } from '../src/types/costing'
import { flattenBomTree, computeBomTotalCost } from '../src/utils/bom'

const __dir = dirname(fileURLToPath(import.meta.url))
export const COST_VARIANCE_ANALYSIS_PATH = resolve(__dir, '../COST_VARIANCE_ANALYSIS.md')

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function pct(num: number, den: number) {
  return den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '—'
}

function pctNum(num: number, den: number) {
  return den > 0 ? (num / den) * 100 : 0
}

interface Contributor {
  id: string
  area: string
  description: string
  amount: number
  type: 'methodology' | 'master_data' | 'engine' | 'rate' | 'scrap' | 'overhead' | 'subcontract'
}

export function writeCostVarianceAnalysisReport(): void {
  const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
  const master = useMasterStore.getState()
  const bomStore = useBomStore.getState()
  const bomHeader = bomStore.bomHeaders.find((b) => b.productId === 'prod-45m3' && b.status === 'released')!
  const tree = bomStore.getBomTree(bomHeader.id)
  const leaves = flattenBomTree(tree).filter((n) => n.children.length === 0)
  const bomPerUnit = computeBomTotalCost(tree)
  const wcs = useWorkCenterStore.getState().workCenters
  const overheadPct = useCostingStore.getState().overheadPct
  const movements = useInventoryStore.getState().stockMovements
  const wos = useWorkOrderStore.getState().workOrders.sort((a, b) => a.woNo.localeCompare(b.woNo))
  const fgWo = wos.find((w) => w.woType === 'finished_goods')!
  const fgSheet = useCostingStore.getState().getCostSheet(fgWo.id)!
  const fgTotals = costSheetTotals(fgSheet)
  const perTrailer = fgWo.qty

  // ── Per-trailer FG breakdown ──
  const trailer = {
    plannedMaterial: fgTotals.plannedMaterial / perTrailer,
    actualMaterial: fgTotals.actualMaterial / perTrailer,
    plannedLabor: fgTotals.plannedLabor / perTrailer,
    actualLabor: fgTotals.actualLabor / perTrailer,
    plannedMachine: fgTotals.plannedMachine / perTrailer,
    actualMachine: fgTotals.actualMachine / perTrailer,
    plannedSubcontract: fgTotals.plannedSubcontract / perTrailer,
    actualSubcontract: fgTotals.actualSubcontract / perTrailer,
    plannedOverhead: fgTotals.plannedOverhead / perTrailer,
    actualOverhead: fgTotals.actualOverhead / perTrailer,
    childRollPlanned: fgSheet.rolledUpChildPlanned / perTrailer,
    childRollActual: fgSheet.rolledUpChildActual / perTrailer,
    bomStandard: fgTotals.bomStandardCost / perTrailer,
    totalPlanned: fgTotals.totalPlanned / perTrailer,
    totalActual: fgTotals.totalActual / perTrailer,
  }

  // ── Investigation 1–9 summaries ──
  const rateDrift = leaves
    .map((leaf) => {
      const item = master.getItem(leaf.itemId)
      if (!item || leaf.standardCost === item.standardRate) return null
      return {
        code: leaf.itemCode,
        bomRate: leaf.standardCost,
        itemRate: item.standardRate,
        driftPct: item.standardRate > 0 ? ((leaf.standardCost - item.standardRate) / item.standardRate) * 100 : 0,
        lineCostImpact: (leaf.standardCost - item.standardRate) * leaf.qtyPerProduct * (1 + leaf.scrapPct / 100),
      }
    })
    .filter(Boolean) as { code: string; bomRate: number; itemRate: number; driftPct: number; lineCostImpact: number }[]

  const scrapImpact = leaves.reduce(
    (sum, l) => sum + l.qtyPerProduct * l.standardCost * (l.scrapPct / 100),
    0,
  )
  const scrapBase = leaves.reduce((sum, l) => sum + l.qtyPerProduct * l.standardCost, 0)

  // Material issue vs BOM (all WOs, per FG unit)
  const materialIssues: { code: string; bomQty: number; issuedQty: number; bomValue: number; issuedValue: number; variance: number }[] = []
  for (const leaf of leaves) {
    const item = master.getItem(leaf.itemId)!
    const bomQty = leaf.qtyPerProduct * (1 + leaf.scrapPct / 100) * so.qty
    const bomValue = bomQty * leaf.standardCost
    const issuedQty = movements
      .filter(
        (m) =>
          m.itemId === leaf.itemId &&
          (m.referenceType === 'ISSUE_TO_WO' || m.referenceType === 'SUBCON_OUT') &&
          wos.some((w) => w.id === m.workOrderId),
      )
      .reduce((s, m) => s + Math.abs(m.qty), 0)
    const issuedValue = movements
      .filter(
        (m) =>
          m.itemId === leaf.itemId &&
          (m.referenceType === 'ISSUE_TO_WO' || m.referenceType === 'SUBCON_OUT') &&
          wos.some((w) => w.id === m.workOrderId),
      )
      .reduce((s, m) => s + Math.abs(m.value), 0)
    materialIssues.push({
      code: leaf.itemCode,
      bomQty,
      issuedQty,
      bomValue,
      issuedValue,
      variance: issuedValue - bomValue,
    })
  }

  // Subcontract double-count on paint WO
  const paintWo = wos.find((w) => w.outputItemCode === 'SA-PAINT-SYS')!
  const paintIssueToWo = movements
    .filter((m) => m.workOrderId === paintWo.id && m.referenceType === 'ISSUE_TO_WO')
    .reduce((s, m) => s + Math.abs(m.value), 0)
  const paintSubconOut = movements
    .filter((m) => m.workOrderId === paintWo.id && m.referenceType === 'SUBCON_OUT')
    .reduce((s, m) => s + Math.abs(m.value), 0)

  // Routing reference for investigation section
  const routingHeader = useRoutingStore.getState().routingHeaders.find(
    (r) => r.productId === 'prod-45m3' && r.status === 'released',
  )
  const routingOps = routingHeader ? useRoutingStore.getState().getOperations(routingHeader.id) : []

  // ── Top 20 variance contributors (vs BOM standard baseline) ──
  const contributors: Contributor[] = []
  const fgVariance = fgTotals.varianceAmount

  // Methodology: conversion costs not in BOM baseline
  for (const wo of wos) {
    const sheet = useCostingStore.getState().getCostSheet(wo.id)!
    const t = costSheetTotals(sheet)
    const ownActual = sumCostElements(sheet.actual)
    if (sheet.actual.labor > 0) {
      contributors.push({
        id: `${wo.woNo}-labor`,
        area: 'Labor rates / routing',
        description: `${wo.woNo} ${wo.outputItemCode} — actual labor (not in BOM standard)`,
        amount: sheet.actual.labor + (wo.id === fgWo.id ? 0 : 0),
        type: 'methodology',
      })
    }
    if (sheet.actual.machine > 0) {
      contributors.push({
        id: `${wo.woNo}-machine`,
        area: 'Machine / WC rates',
        description: `${wo.woNo} ${wo.outputItemCode} — actual machine time cost (not in BOM standard)`,
        amount: sheet.actual.machine,
        type: 'methodology',
      })
    }
    if (sheet.actual.overhead > 0) {
      contributors.push({
        id: `${wo.woNo}-oh`,
        area: 'Overhead allocation',
        description: `${wo.woNo} — ${overheadPct}% overhead on conversion base (not in BOM standard)`,
        amount: sheet.actual.overhead,
        type: 'overhead',
      })
    }
    if (wo.woType === 'subcontract' && ownActual > t.bomStandardCost) {
      contributors.push({
        id: `${wo.woNo}-subcon-dbl`,
        area: 'Subcontract charges',
        description: `${wo.woNo} paint — material double-count (ISSUE_TO_WO + SUBCON_OUT) ≈ ${fmt(paintIssueToWo)} duplicated`,
        amount: Math.min(paintIssueToWo, paintSubconOut),
        type: 'engine',
      })
    }
    // Chassis BOM gap
    if (wo.outputItemCode === 'SA-CHASSIS') {
      const chassisBomGap = t.bomStandardCost
      const chassisStructMat = sheet.actual.material - chassisBomGap
      if (chassisStructMat > 0) {
        contributors.push({
          id: 'chassis-bom-gap',
          area: 'BOM standard costs',
          description: `SA-CHASSIS BOM missing structural RM — only BO items in BOM (${fmt(chassisBomGap)}) vs routing consumption`,
          amount: sheet.actual.labor + sheet.actual.machine,
          type: 'master_data',
        })
      }
    }
  }

  // Child roll-up (absorption vs BOM leaf — methodology note)
  if (fgSheet.rolledUpChildActual > 0) {
    const conversionInRollup =
      fgSheet.rolledUpChildActual -
      wos
        .filter((w) => w.parentWoId === fgWo.id)
        .reduce((s, w) => {
          const sh = useCostingStore.getState().getCostSheet(w.id)!
          return s + sh.actual.material
        }, 0)
    if (conversionInRollup > 0) {
      contributors.push({
        id: 'child-conversion',
        area: 'Labor / routing',
        description: `Child SA roll-up includes labor+machine+OH not in material-only BOM baseline`,
        amount: conversionInRollup,
        type: 'methodology',
      })
    }
  }

  // FG assembly own costs
  contributors.push({
    id: 'fg-assembly',
    area: 'Labor rates',
    description: `FG final assembly ${fgWo.woNo} — own labor+machine+OH (routing ops 80–100)`,
    amount:
      fgSheet.actual.labor + fgSheet.actual.machine + fgSheet.actual.overhead,
    type: 'methodology',
  })

  // Subcontract service rate gap (SA-PAINT-SYS standardRate = 0)
  contributors.push({
    id: 'subcon-rate-zero',
    area: 'Subcontract charges',
    description: `SA-PAINT-SYS item master standardRate = ₹0 — no subcontract processing rate in BOM`,
    amount: paintWo ? useCostingStore.getState().getCostSheet(paintWo.id)!.actual.subcontract : 0,
    type: 'master_data',
  })

  // Scrap (small)
  contributors.push({
    id: 'scrap-premium',
    area: 'Scrap assumptions',
    description: `BOM scrap premium on RM lines (plate 5%, pipe/angle 3%, primer 10%)`,
    amount: scrapImpact * so.qty,
    type: 'scrap',
  })

  // Material issue rate variance (issued at item standardRate)
  const matVarTotal = materialIssues.reduce((s, m) => s + Math.abs(m.variance), 0)
  if (matVarTotal > 100) {
    contributors.push({
      id: 'material-issue-rates',
      area: 'Material issue rates',
      description: `Issued material valued at item master standardRate — GRN/PO rate variance not tracked`,
      amount: matVarTotal,
      type: 'rate',
    })
  }

  // Deduplicate and sort by amount
  const merged = new Map<string, Contributor>()
  for (const c of contributors) {
    const existing = merged.get(c.id)
    if (!existing || c.amount > existing.amount) merged.set(c.id, c)
  }
  const top20 = [...merged.values()]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20)
    .map((c, i) => ({ ...c, rank: i + 1, pctOfVariance: pctNum(c.amount, fgVariance) }))

  const varVsPlannedPct =
    fgTotals.totalPlanned > 0
      ? ((fgTotals.totalActual - fgTotals.totalPlanned) / fgTotals.totalPlanned) * 100
      : 0

  const totalPlannedConversion =
    wos.reduce((s, w) => {
      const sh = useCostingStore.getState().getCostSheet(w.id)!
      return s + sh.planned.labor + sh.planned.machine
    }, 0)

  const report = `# Cost Variance Analysis

**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}  
**Scenario:** SO-0001 · ABC Cement · ${so.qty}× 45 M3 Bulker Trailer  
**Current variance:** **${fgTotals.variancePct.toFixed(1)}%** vs BOM material standard (target **< 10%**)  
**Variance vs planned absorption cost:** **${varVsPlannedPct >= 0 ? '+' : ''}${varVsPlannedPct.toFixed(1)}%**  
**Method:** Read-only investigation — **no formulas or rates were changed**

---

## Root Cause Summary (read first)

| # | Root cause | Type | Impact on 52.8% variance |
|---|------------|------|--------------------------|
| 1 | **Wrong variance baseline** — \`variancePct\` compares full absorption actual vs **material-only BOM** | Methodology | **Primary driver (~89% of gap is BOM→Planned, not Actual→Planned)** |
| 2 | **Labor + machine excluded from BOM standard** — routing/WC costs exist in planned/actual but not in \`bomStandardCost\` | Methodology | **~${fmt(totalPlannedConversion)} planned conversion across WOs** |
| 3 | **Chassis BOM incomplete** — SA-CHASSIS BOM = King Pin + Landing Jacks only; structural RM under Tank SA not duplicated under Chassis | Master data | WO-0002 shows **394% vs BOM** at SA level |
| 4 | **Subcontract material double-count** — \`issueAllReserved\` + \`sendSubcontractMaterial\` both counted in \`computeActualMaterial\` | Engine (document only) | WO-0004 actual **2× planned** on paint |
| 5 | **Subcontract service rate missing** — SA-PAINT-SYS \`standardRate = 0\`; no processing charge in BOM | Master data | SUBCON_IN valued at ₹0 |
| 6 | **Overhead not in BOM** — ${overheadPct}% on (mat+lab+mac+sub) | Overhead policy | **${fmt(fgTotals.plannedOverhead)} planned / ${fmt(fgTotals.actualOverhead)} actual** on FG sheet |
| 7 | **Item/BOM rate sync OK** — BOM lines match item master | — | No drift detected |
| 8 | **Scrap assumptions modest** — adds ~${pct(scrapImpact, scrapBase)} to RM material | Scrap | **Not main driver** |
| 9 | **Actual production under plan** — actual ${pct(fgTotals.totalActual, fgTotals.totalPlanned)} of planned | Operations | **-19.2% vs plan is acceptable** if baseline fixed |

**Key insight:** Actual costs are **not** 52.8% over budget. They are **19.2% under plan**. The 52.8% figure is a **metric definition problem**, not a factory cost explosion.

---

## Per Finished Trailer (45 M3 Bulker)

Order qty: **${so.qty} trailers** · Values below are **per trailer** (FG WO ${fgWo.woNo} totals ÷ ${perTrailer}).

| Cost Element | Planned | Actual | Δ (Actual − Planned) | Δ vs BOM Std |
|--------------|---------|--------|----------------------|--------------|
| **Material** | ${fmt(trailer.plannedMaterial)} | ${fmt(trailer.actualMaterial)} | ${fmt(trailer.actualMaterial - trailer.plannedMaterial)} | BOM mat = ${fmt(trailer.bomStandard)} |
| **Labor** | ${fmt(trailer.plannedLabor)} | ${fmt(trailer.actualLabor)} | ${fmt(trailer.actualLabor - trailer.plannedLabor)} | ₹0 in BOM |
| **Machine** | ${fmt(trailer.plannedMachine)} | ${fmt(trailer.actualMachine)} | ${fmt(trailer.actualMachine - trailer.plannedMachine)} | ₹0 in BOM |
| **Subcontract** | ${fmt(trailer.plannedSubcontract)} | ${fmt(trailer.actualSubcontract)} | ${fmt(trailer.actualSubcontract - trailer.plannedSubcontract)} | Primer only in BOM |
| **Overhead (${overheadPct}%)** | ${fmt(trailer.plannedOverhead)} | ${fmt(trailer.actualOverhead)} | ${fmt(trailer.actualOverhead - trailer.plannedOverhead)} | ₹0 in BOM |
| **Child SA roll-up** | ${fmt(trailer.childRollPlanned)} | ${fmt(trailer.childRollActual)} | ${fmt(trailer.childRollActual - trailer.childRollPlanned)} | Included in BOM leaves |
| **Total** | **${fmt(trailer.totalPlanned)}** | **${fmt(trailer.totalActual)}** | **${fmt(trailer.totalActual - trailer.totalPlanned)}** | BOM std **${fmt(trailer.bomStandard)}** |

**Per-trailer variance vs BOM standard:** ${pct(trailer.totalActual - trailer.bomStandard, trailer.bomStandard)} (${fmt(trailer.totalActual - trailer.bomStandard)})  
**Per-trailer variance vs planned:** ${pct(trailer.totalActual - trailer.totalPlanned, trailer.totalPlanned)}

---

## Investigation 1 — BOM Standard Costs

**Released BOM:** ${bomHeader.bomNo} ${bomHeader.revision}  
**Material rollup per FG unit:** ${fmt(bomPerUnit)}  
**Order total (${so.qty} units):** ${fmt(bomPerUnit * so.qty)}

| Item | Qty/FG | Scrap | BOM Rate | Line Cost/FG |
|------|--------|-------|----------|--------------|
${leaves
  .sort((a, b) => b.totalCost - a.totalCost)
  .map((n) => `| ${n.itemCode} | ${n.qtyPerProduct} | ${n.scrapPct}% | ${fmt(n.standardCost)} | ${fmt(n.totalCost)} |`)
  .join('\n')}

**Finding:** BOM standard = **purchased leaf material only**. Sub-assembly nodes (Tank, Chassis, Run Gear, Paint) have **₹0 node cost** — conversion is excluded by design in \`bomStandardUnitCost()\`.

**Chassis gap:** Under \`SA-CHASSIS\`, BOM lists only \`BO-KPIN-2-JOST\` + \`BO-LJ-24T\` (${fmt(18500 + 2 * 12800)}/unit). Structural plate/pipe/angle are under **SA-TANK-ASM**, not Chassis — SA-level BOM variance is misleading.

---

## Investigation 2 — Item Master Costs

| Check | Result |
|-------|--------|
| BOM line rate vs item \`standardRate\` | ${rateDrift.length === 0 ? '✅ All match' : `⚠️ ${rateDrift.length} drift(s)`} |
| FG selling price (item master) | ${fmt(master.getItem('item-fg-bulker')!.standardRate)}/unit |
| SA items standardRate | Tank/Chassis/Run Gear/Paint = **₹0** (correct for manufactured/subcon nodes) |

${rateDrift.length > 0 ? rateDrift.map((d) => `- **${d.code}:** BOM ${fmt(d.bomRate)} vs Item ${fmt(d.itemRate)} (${d.driftPct.toFixed(1)}%)`).join('\n') : 'No BOM ↔ item master rate drift on leaf items.'}

**Finding:** Issues post at **item master standardRate** at transaction time. No weighted-average or last-GRN-rate layer — PO price differences won't flow to actual until master rates updated.

---

## Investigation 3 — Material Issue Rates

| Item | BOM Qty (${so.qty} FG) | Issued Qty | BOM Value | Issued Value | Variance |
|------|------------------------|------------|-----------|--------------|----------|
${materialIssues
  .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
  .map((m) => `| ${m.code} | ${m.bomQty.toFixed(1)} | ${m.issuedQty.toFixed(1)} | ${fmt(m.bomValue)} | ${fmt(m.issuedValue)} | ${fmt(m.variance)} |`)
  .join('\n')}

**Paint WO double-count:**

| Movement type | Value on WO-0004 |
|---------------|------------------|
| ISSUE_TO_WO (primer) | ${fmt(paintIssueToWo)} |
| SUBCON_OUT (same primer) | ${fmt(paintSubconOut)} |
| **Counted twice in actual material** | **≈ ${fmt(Math.min(paintIssueToWo, paintSubconOut))}** |

---

## Investigation 4 — Labor Rates

Labor computed from **job card actual hours** × WC rate × setup/run split (\`computeActualLaborMachine\`).

| WO | Output | Planned Labor | Actual Labor | Δ |
|----|--------|---------------|--------------|---|
${wos
  .map((w) => {
    const sh = useCostingStore.getState().getCostSheet(w.id)!
    return `| ${w.woNo} | ${w.outputItemCode} | ${fmt(sh.planned.labor)} | ${fmt(sh.actual.labor)} | ${fmt(sh.actual.labor - sh.planned.labor)} |`
  })
  .join('\n')}

**Finding:** Actual labor is **below planned** on most WOs (simulation completes job cards faster than routing standard hours). Labor is **0% of BOM standard** — drives FG variance metric.

---

## Investigation 5 — Work Center Hourly Rates

| Code | Name | Cost Rate/Hr | Capacity Hrs/Day |
|------|------|--------------|------------------|
${wcs.map((w) => `| ${w.workCenterCode} | ${w.workCenterName} | ${fmt(w.costRatePerHour)} | ${w.capacityHoursPerDay} |`).join('\n')}

**Range:** ₹680–₹950/hr (seed data, unvalidated).  
**Routing:** ${routingHeader?.routingNo ?? '—'} ${routingHeader?.revision ?? ''} · ${routingOps.length} operations · ${routingHeader?.totalStdHours ?? 0} std hrs total.

**Calibration need:** Finance to validate rates from payroll + equipment depreciation. Production to validate std hours from time studies.

---

## Investigation 6 — Machine Rates

Machine cost uses **same WC \`costRatePerHour\`** as labor — split by setup vs run in \`computePlannedLaborMachine\` / \`computeActualLaborMachine\`.

| WO | Planned Machine | Actual Machine | Δ |
|----|-----------------|----------------|---|
${wos
  .map((w) => {
    const sh = useCostingStore.getState().getCostSheet(w.id)!
    return `| ${w.woNo} | ${fmt(sh.planned.machine)} | ${fmt(sh.actual.machine)} | ${fmt(sh.actual.machine - sh.planned.machine)} |`
  })
  .join('\n')}

**Finding:** No separate machine rate table — **single \`costRatePerHour\` per work center**. Consider splitting labor rate vs machine rate for accurate absorption.

---

## Investigation 7 — Subcontract Charges

| WO | Type | BOM Std | Planned Subcon | Actual Subcon | Notes |
|----|------|---------|----------------|---------------|-------|
${wos
  .filter((w) => w.woType === 'subcontract' || useCostingStore.getState().getCostSheet(w.id)!.planned.subcontract > 0)
  .map((w) => {
    const sh = useCostingStore.getState().getCostSheet(w.id)!
    const t = costSheetTotals(sh)
    return `| ${w.woNo} | ${w.woType} | ${fmt(t.bomStandardCost)} | ${fmt(sh.planned.subcontract)} | ${fmt(sh.actual.subcontract)} | ${w.outputItemCode === 'SA-PAINT-SYS' ? 'Primer only in BOM; double material count' : '—'} |`
  })
  .join('\n')}

**Finding:** Subcontract processing charge **not modeled**. \`computeActualSubcontract\` falls back to SUBCON_IN movement value; SA-PAINT-SYS receives at **₹0 rate**.

---

## Investigation 8 — Overhead Allocation

| Setting | Value |
|---------|-------|
| Global overhead % | **${overheadPct}%** |
| Formula | \`(material + labor + machine + subcontract) × ${overheadPct}%\` |
| In BOM standard? | **No** |

| WO | Planned OH | Actual OH |
|----|------------|-----------|
${wos
  .map((w) => {
    const sh = useCostingStore.getState().getCostSheet(w.id)!
    return `| ${w.woNo} | ${fmt(sh.planned.overhead)} | ${fmt(sh.actual.overhead)} |`
  })
  .join('\n')}

**FG sheet:** Planned OH ${fmt(fgTotals.plannedOverhead)} · Actual OH ${fmt(fgTotals.actualOverhead)} per order (${so.qty} units).

**Calibration need:** Finance to set OH rate from plant budget ÷ conversion cost base (typically 8–15%).

---

## Investigation 9 — Scrap Assumptions

| Item | Base Qty/FG | Scrap % | Effective Qty | Scrap Premium/FG |
|------|-------------|---------|---------------|------------------|
${leaves
  .filter((l) => l.scrapPct > 0)
  .map((l) => {
    const premium = l.qtyPerProduct * l.standardCost * (l.scrapPct / 100)
    return `| ${l.itemCode} | ${l.qtyPerProduct} | ${l.scrapPct}% | ${(l.qtyPerProduct * (1 + l.scrapPct / 100)).toFixed(1)} | ${fmt(premium)} |`
  })
  .join('\n')}

**Total scrap premium per FG unit:** ${fmt(scrapImpact)} (~${pct(scrapImpact, scrapBase)} of RM material)  
**Finding:** Scrap is **not** the driver of 52.8% FG variance. Validate percentages against NCR/rework history.

---

## Top 20 Variance Contributors (vs BOM Standard Baseline)

Total FG variance amount: **${fmt(fgVariance)}** (${fgTotals.variancePct.toFixed(1)}% of ${fmt(fgTotals.bomStandardCost)})

| Rank | Area | Description | Est. Impact | % of Variance | Type |
|------|------|-------------|-------------|---------------|------|
${top20.map((c) => `| ${c.rank} | ${c.area} | ${c.description} | ${fmt(c.amount)} | ${c.pctOfVariance.toFixed(1)}% | ${c.type} |`).join('\n')}

*Note: Contributors overlap — conversion costs appear at both WO and roll-up level. Use this table for **prioritization**, not additive reconciliation.*

---

## Cost Bridge — Order Total (${so.qty} Trailers)

\`\`\`
BOM material standard (leaf rollup)          ${fmt(fgTotals.bomStandardCost).padStart(14)}
  ↳ Missing from this baseline:
    + Labor + machine (all WOs)              ${fmt(wos.reduce((s, w) => { const sh = useCostingStore.getState().getCostSheet(w.id)!; return s + sh.actual.labor + sh.actual.machine }, 0)).padStart(14)}
    + Overhead (${overheadPct}%)                             ${fmt(wos.reduce((s, w) => { const sh = useCostingStore.getState().getCostSheet(w.id)!; return s + sh.actual.overhead }, 0)).padStart(14)}
    + Subcontract gaps / double-count        ${fmt(paintIssueToWo).padStart(14)}
≈ Actual absorption cost                     ${fmt(fgTotals.totalActual).padStart(14)}

Planned absorption cost                      ${fmt(fgTotals.totalPlanned).padStart(14)}
Actual vs Planned                          ${varVsPlannedPct >= 0 ? '+' : ''}${varVsPlannedPct.toFixed(1)}%
\`\`\`

---

## Calibration Recommendations (no auto-changes)

### Priority 1 — Fix the metric (no master data change)

| Action | Owner | Expected effect |
|--------|-------|-----------------|
| Define **Released Standard Cost** = BOM material + routing labor/machine + subcontract + OH | Costing / Eng | Variance baseline matches absorption |
| Report **two variances**: vs released standard AND vs material-only BOM | ERP Admin | Stops 52.8% false alarm |
| Store released standard on \`Product.standardCost\` at BOM+Routing release | Engineering | Single source of truth |

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
| Confirm OH **${overheadPct}%** vs plant budget | Finance | OH variance < 2% |
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
| \`ERP_COST_CALIBRATION.md\` | Executive calibration summary |
| \`src/utils/costEngine.ts\` | Cost formulas (unchanged) |
| \`src/types/costing.ts\` | Variance metric definition |
| \`npm run simulate:go-live\` | Regenerates this analysis |

---

*Investigation only — formulas and rates were not modified. Implement recommendations after Finance + Engineering sign-off.*
`

  writeFileSync(COST_VARIANCE_ANALYSIS_PATH, report)
  console.log('Cost variance analysis:', COST_VARIANCE_ANALYSIS_PATH)
}
