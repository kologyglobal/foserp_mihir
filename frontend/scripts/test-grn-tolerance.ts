/**
 * Frontend GRN tolerance — single-line + multi-line document plans.
 *
 * Plans mirror docs/PURCHASE_GRN_TOLERANCE_TEST_PLAN.md
 *
 * Usage (from frontend/):
 *   npm run test:grn-tolerance
 */
import {
  evaluateGrnDocumentTolerance,
  evaluateGrnLineTolerance,
  GRN_TOLERANCE_STATUS_LABELS,
  lineRequiresToleranceApproval,
  resolveReceivingTolerancePct,
  type GrnLineToleranceStatus,
  type GrnToleranceLineSnapshot,
} from '../src/services/purchase/grnTolerance.ts'

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function nearly(a: number | null, b: number | null, eps = 1e-4): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= eps
}

/** Plan A–D: single-line matrix (open = 100). */
const LINE_SCENARIOS: Array<{
  id: string
  itemTol: number
  received: number
  close?: boolean
  setupTol?: number
  allowOver?: boolean
  expect: GrnLineToleranceStatus
  approval: boolean
}> = [
  { id: 'A1 0% exact', itemTol: 0, received: 100, expect: 'OK', approval: false },
  { id: 'A2 0% +1', itemTol: 0, received: 101, expect: 'EXCESS_OUTSIDE', approval: true },
  { id: 'A3 0% short', itemTol: 0, received: 90, expect: 'PARTIAL', approval: false },
  {
    id: 'A4 0% short close',
    itemTol: 0,
    received: 90,
    close: true,
    expect: 'SHORT_OUTSIDE',
    approval: true,
  },
  { id: 'A5 0% zero', itemTol: 0, received: 0, expect: 'NOT_RECEIVED', approval: false },
  { id: 'B1 2% exact', itemTol: 2, received: 100, expect: 'OK', approval: false },
  { id: 'B2 2% +1.5', itemTol: 2, received: 101.5, expect: 'EXCESS_WITHIN', approval: false },
  { id: 'B3 2% +5', itemTol: 2, received: 105, expect: 'EXCESS_OUTSIDE', approval: true },
  { id: 'B4 2% half', itemTol: 2, received: 50, expect: 'PARTIAL', approval: false },
  { id: 'C1 10% +5', itemTol: 10, received: 105, expect: 'EXCESS_WITHIN', approval: false },
  { id: 'C2 10% +11', itemTol: 10, received: 111, expect: 'EXCESS_OUTSIDE', approval: true },
  { id: 'C3 10% at lower (90)', itemTol: 10, received: 90, expect: 'OK', approval: false },
  { id: 'C4 10% below band', itemTol: 10, received: 85, expect: 'PARTIAL', approval: false },
  {
    id: 'D1 setup fallback',
    itemTol: 0,
    received: 103,
    setupTol: 5,
    allowOver: true,
    expect: 'EXCESS_WITHIN',
    approval: false,
  },
  {
    id: 'D2 setup blocked',
    itemTol: 0,
    received: 103,
    setupTol: 5,
    allowOver: false,
    expect: 'EXCESS_OUTSIDE',
    approval: true,
  },
  // Extra edge accuracy
  { id: 'E1 2% upper edge 102', itemTol: 2, received: 102, expect: 'EXCESS_WITHIN', approval: false },
  { id: 'E2 2% just over 102.01', itemTol: 2, received: 102.01, expect: 'EXCESS_OUTSIDE', approval: true },
  { id: 'E3 10% upper edge 110', itemTol: 10, received: 110, expect: 'EXCESS_WITHIN', approval: false },
  { id: 'E4 fractional open', itemTol: 10, received: 10.5, expect: 'EXCESS_WITHIN', approval: false },
]

/** Canonical 3-item PO lines used across multi-line plans. */
const THREE_ITEMS = {
  zero: { itemCode: 'TOL-ITEM-0PCT', openQuantity: 100, itemTolerancePct: 0 },
  two: { itemCode: 'TOL-ITEM-2PCT', openQuantity: 100, itemTolerancePct: 2 },
  ten: { itemCode: 'TOL-ITEM-10PCT', openQuantity: 100, itemTolerancePct: 10 },
} as const

type DocPlan = {
  id: string
  lines: GrnToleranceLineSnapshot[]
  expect: {
    statuses: GrnLineToleranceStatus[]
    requiresApproval: boolean
    notReceivedCount: number
    receivableLineCount: number
    allNotReceived?: boolean
  }
}

/** Plan M: multi-line GRN — receive 1 of 3, mixed, all zero, one outside. */
const DOCUMENT_PLANS: DocPlan[] = [
  {
    id: 'M1 receive only middle of 3 (exact)',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 0 },
      { ...THREE_ITEMS.two, receivedQuantity: 100 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['NOT_RECEIVED', 'OK', 'NOT_RECEIVED'],
      requiresApproval: false,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
  {
    id: 'M2 receive only first of 3 (0% item exact)',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 100 },
      { ...THREE_ITEMS.two, receivedQuantity: 0 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['OK', 'NOT_RECEIVED', 'NOT_RECEIVED'],
      requiresApproval: false,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
  {
    id: 'M3 receive only last of 3 (+5% within 10%)',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 0 },
      { ...THREE_ITEMS.two, receivedQuantity: 0 },
      { ...THREE_ITEMS.ten, receivedQuantity: 105 },
    ],
    expect: {
      statuses: ['NOT_RECEIVED', 'NOT_RECEIVED', 'EXCESS_WITHIN'],
      requiresApproval: false,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
  {
    id: 'M4 receive 1 of 3 outside on 0% item → header approval',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 110 },
      { ...THREE_ITEMS.two, receivedQuantity: 0 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['EXCESS_OUTSIDE', 'NOT_RECEIVED', 'NOT_RECEIVED'],
      requiresApproval: true,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
  {
    id: 'M5 receive 2 of 3 (partial + exact), leave one zero',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 50 },
      { ...THREE_ITEMS.two, receivedQuantity: 100 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['PARTIAL', 'OK', 'NOT_RECEIVED'],
      requiresApproval: false,
      notReceivedCount: 1,
      receivableLineCount: 2,
    },
  },
  {
    id: 'M6 all three exact — no approval',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 100 },
      { ...THREE_ITEMS.two, receivedQuantity: 100 },
      { ...THREE_ITEMS.ten, receivedQuantity: 100 },
    ],
    expect: {
      statuses: ['OK', 'OK', 'OK'],
      requiresApproval: false,
      notReceivedCount: 0,
      receivableLineCount: 3,
    },
  },
  {
    id: 'M7 all three zero — all NOT_RECEIVED, no approval',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 0 },
      { ...THREE_ITEMS.two, receivedQuantity: 0 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['NOT_RECEIVED', 'NOT_RECEIVED', 'NOT_RECEIVED'],
      requiresApproval: false,
      notReceivedCount: 3,
      receivableLineCount: 0,
      allNotReceived: true,
    },
  },
  {
    id: 'M8 mixed: within + outside + not received → approval',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 0 },
      { ...THREE_ITEMS.two, receivedQuantity: 101 },
      { ...THREE_ITEMS.ten, receivedQuantity: 120 },
    ],
    expect: {
      statuses: ['NOT_RECEIVED', 'EXCESS_WITHIN', 'EXCESS_OUTSIDE'],
      requiresApproval: true,
      notReceivedCount: 1,
      receivableLineCount: 2,
    },
  },
  {
    id: 'M9 receive only 2% item outside (+5%) → approval; others stay open',
    lines: [
      { ...THREE_ITEMS.zero, receivedQuantity: 0 },
      { ...THREE_ITEMS.two, receivedQuantity: 105 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['NOT_RECEIVED', 'EXCESS_OUTSIDE', 'NOT_RECEIVED'],
      requiresApproval: true,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
  {
    id: 'M10 short-close on one line only → approval',
    lines: [
      {
        ...THREE_ITEMS.zero,
        receivedQuantity: 90,
        closeOpenQuantity: true,
      },
      { ...THREE_ITEMS.two, receivedQuantity: 0 },
      { ...THREE_ITEMS.ten, receivedQuantity: 0 },
    ],
    expect: {
      statuses: ['SHORT_OUTSIDE', 'NOT_RECEIVED', 'NOT_RECEIVED'],
      requiresApproval: true,
      notReceivedCount: 2,
      receivableLineCount: 1,
    },
  },
]

export function runGrnToleranceFrontendTests() {
  console.log('\n── FE Plan resolve ──')
  check(
    'item beats setup',
    resolveReceivingTolerancePct({
      itemTolerancePct: 10,
      setupTolerancePct: 5,
      allowOverReceipt: true,
    }) === 10,
  )
  check(
    'setup fallback when item 0',
    resolveReceivingTolerancePct({
      itemTolerancePct: 0,
      setupTolerancePct: 5,
      allowOverReceipt: true,
    }) === 5,
  )
  check(
    'no setup when allowOverReceipt false',
    resolveReceivingTolerancePct({
      itemTolerancePct: 0,
      setupTolerancePct: 10,
      allowOverReceipt: false,
    }) === 0,
  )

  console.log('\n── FE Plan A–E single-line (open=100) ──')
  for (const s of LINE_SCENARIOS) {
    const open = s.id.startsWith('E4') ? 10 : 100
    const r = evaluateGrnLineTolerance({
      openQuantity: open,
      receivedQuantity: s.received,
      itemTolerancePct: s.itemTol,
      setupTolerancePct: s.setupTol,
      allowOverReceipt: s.allowOver,
      closeOpenQuantity: s.close,
    })
    const ok = r.toleranceStatus === s.expect && r.requiresApproval === s.approval
    check(
      s.id,
      ok,
      `got ${r.toleranceStatus} approval=${r.requiresApproval} (want ${s.expect}/${s.approval})`,
    )
    check(
      `${s.id} lineRequires…`,
      lineRequiresToleranceApproval(r.toleranceStatus) === s.approval,
    )
  }

  console.log('\n── FE Plan M multi-line (1-of-3 / mixed) ──')
  for (const plan of DOCUMENT_PLANS) {
    const doc = evaluateGrnDocumentTolerance(plan.lines)
    const statusOk = plan.expect.statuses.every((st, i) => doc.lines[i]?.toleranceStatus === st)
    check(
      `${plan.id} statuses`,
      statusOk,
      `got [${doc.lines.map((l) => l.toleranceStatus).join(', ')}]`,
    )
    check(
      `${plan.id} header approval`,
      doc.requiresApproval === plan.expect.requiresApproval,
      `requiresApproval=${doc.requiresApproval}`,
    )
    check(
      `${plan.id} notReceived=${plan.expect.notReceivedCount}`,
      doc.notReceivedCount === plan.expect.notReceivedCount,
    )
    check(
      `${plan.id} receivable=${plan.expect.receivableLineCount}`,
      doc.receivableLineCount === plan.expect.receivableLineCount,
    )
    if (plan.expect.allNotReceived != null) {
      check(`${plan.id} allNotReceived`, doc.allNotReceived === plan.expect.allNotReceived)
    }
  }

  console.log('\n── Labels & variance ──')
  for (const key of Object.keys(GRN_TOLERANCE_STATUS_LABELS) as GrnLineToleranceStatus[]) {
    check(`label ${key}`, Boolean(GRN_TOLERANCE_STATUS_LABELS[key]))
  }

  const multiGrn = evaluateGrnLineTolerance({
    openQuantity: 40,
    receivedQuantity: 42,
    itemTolerancePct: 10,
  })
  check('multi-GRN variance vs open', nearly(multiGrn.variancePercentage, 5), `var=${multiGrn.variancePercentage}`)
  check('multi-GRN within 10%', multiGrn.toleranceStatus === 'EXCESS_WITHIN')

  // Remaining open after 1-of-3: UI remainingOpenQty = sum(max(0, open-received))
  {
    const lines = DOCUMENT_PLANS[0]!.lines
    const remaining = lines.reduce(
      (s, l) => s + Math.max(0, l.openQuantity - l.receivedQuantity),
      0,
    )
    check('M1 remaining open qty on PO after receive 1/3', remaining === 200, `remaining=${remaining}`)
  }

  console.log(`\nFE GRN tolerance: ${passed} passed, ${failed} failed\n`)
  return failed === 0
}

const ok = runGrnToleranceFrontendTests()
process.exit(ok ? 0 : 1)
