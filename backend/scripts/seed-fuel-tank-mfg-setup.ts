/**
 * Fuel Tank Manufacturing setup (live API / DB — not demo FE):
 *   Plant → WC → Machine → Warehouses → QC plans → multilevel BOM →
 *   PARALLEL route (stage groups = Job Cards) → Profile → warehouse mapping
 *
 * SFG handling: LOGICAL_WIP — no child WOs; MAKE SFGs execute as Job Cards
 * (stage groups / ops) under the FG Work Order on release.
 *
 * Prereq: npx tsx scripts/seed-fuel-tank-pilot-items.ts
 *
 * Usage:
 *   npx tsx scripts/seed-fuel-tank-mfg-setup.ts
 *   npx tsx scripts/seed-fuel-tank-mfg-setup.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'
import { nextCode } from '../src/services/codeSeries.service.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

const FG_CODE = 'FG-FUEL-TANK-5000L'
const FG_NAME = '5000 Litre Mild Steel Fuel Storage Tank'
const BOM_CODE = 'BOM-FUEL-TANK-5000L'
const PROFILE_CODE = 'MP-FUEL-TANK-5000L'
const PLANT = 'MAIN-PLANT'

type LineType = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'CONSUMABLE' | 'SUBASSEMBLY'
type MakeOrBuy = 'MAKE' | 'BUY'

interface BomNode {
  ref: string
  parentRef: string | null
  itemCode: string
  qty: number
  uomCode: string
  sequence: number
  makeOrBuy: MakeOrBuy
  lineType: LineType
  /** Route link code stored in drawingReference */
  routeLink?: string
  notes?: string
}

const WORK_CENTRES = [
  { code: 'WC-CUTTING', name: 'Cutting Shop', departmentRef: 'FABRICATION' },
  { code: 'WC-FORMING', name: 'Forming Shop', departmentRef: 'FABRICATION' },
  { code: 'WC-WELDING', name: 'Welding Shop', departmentRef: 'WELDING' },
  { code: 'WC-FABRICATION', name: 'Fabrication Shop', departmentRef: 'FABRICATION' },
  { code: 'WC-ASSEMBLY', name: 'Assembly Shop', departmentRef: 'ASSEMBLY' },
  { code: 'WC-QUALITY', name: 'Quality Bay', departmentRef: 'QUALITY' },
  { code: 'WC-BLASTING', name: 'Surface Preparation', departmentRef: 'SURFACE' },
  { code: 'WC-PAINTING', name: 'Paint Shop', departmentRef: 'SURFACE' },
  { code: 'WC-FG', name: 'Finished Goods Store', departmentRef: 'STORES' },
] as const

const MACHINES: Array<{ code: string; name: string; workCentreCode: string }> = [
  { code: 'M-CNC-PLASMA-01', name: 'CNC Plasma Cutting Machine', workCentreCode: 'WC-CUTTING' },
  { code: 'M-ROLL-01', name: 'Plate Rolling Machine', workCentreCode: 'WC-FORMING' },
  { code: 'M-PRESS-01', name: 'Hydraulic Dished-End Forming Press', workCentreCode: 'WC-FORMING' },
  { code: 'M-MIG-01', name: 'MIG Welding Machine', workCentreCode: 'WC-WELDING' },
  { code: 'M-SMAW-01', name: 'SMAW Welding Set', workCentreCode: 'WC-WELDING' },
  { code: 'M-HYDRO-PUMP-01', name: 'Hydro Test Pump', workCentreCode: 'WC-QUALITY' },
  { code: 'M-BLAST-01', name: 'Shot Blasting Machine', workCentreCode: 'WC-BLASTING' },
  { code: 'M-PAINT-BOOTH-01', name: 'Paint Booth', workCentreCode: 'WC-PAINTING' },
]

const WAREHOUSES = [
  { code: 'RM-MAIN', name: 'Raw Material Main Store', warehouseType: 'raw_material' },
  { code: 'BO-MAIN', name: 'Bought Out Main Store', warehouseType: 'bought_out' },
  { code: 'RM-CONSUMABLES', name: 'Consumables Store', warehouseType: 'raw_material' },
  { code: 'WIP', name: 'WIP Warehouse', warehouseType: 'wip' },
  { code: 'FG-MAIN', name: 'Finished Goods Main', warehouseType: 'finished_goods' },
  { code: 'QC-HOLD', name: 'QC Hold', warehouseType: 'quarantine' },
  { code: 'SCRAP', name: 'Scrap Yard', warehouseType: 'scrap' },
  { code: 'JOB-WORK', name: 'Job Work Warehouse', warehouseType: 'wip' },
] as const

/** Multilevel BOM — SFG MAKE at L1; materials under SFG; Final consumes SFGs + fasteners; paint at FG. */
const BOM_NODES: BomNode[] = [
  {
    ref: 'L1-SHELL',
    parentRef: null,
    itemCode: 'SFG-TANK-SHELL-5000L',
    qty: 1,
    uomCode: 'Nos',
    sequence: 10,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    notes: 'JC-SHELL',
  },
  {
    ref: 'L1-DISH',
    parentRef: null,
    itemCode: 'SFG-DISHED-END-5000L',
    qty: 2,
    uomCode: 'Nos',
    sequence: 20,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    notes: 'JC-DISHED-END',
  },
  {
    ref: 'L1-SADDLE',
    parentRef: null,
    itemCode: 'SFG-SADDLE-SUPPORT-5000L',
    qty: 1,
    uomCode: 'SET',
    sequence: 30,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    notes: 'JC-SADDLE',
  },
  {
    ref: 'L1-NOZZLE',
    parentRef: null,
    itemCode: 'SFG-NOZZLE-MANHOLE-5000L',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    notes: 'JC-NOZZLE',
  },
  {
    ref: 'L1-FINAL',
    parentRef: null,
    itemCode: 'SFG-FINAL-TANK-ASSY-5000L',
    qty: 1,
    uomCode: 'Nos',
    sequence: 50,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    notes: 'JC-FINAL-ASSEMBLY',
  },
  {
    ref: 'L1-PRIMER',
    parentRef: null,
    itemCode: 'CON-PAINT-EPOXY-PRIMER',
    qty: 12,
    uomCode: 'LTR',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'PAINTING',
  },
  {
    ref: 'L1-TOPCOAT',
    parentRef: null,
    itemCode: 'CON-PAINT-PU-TOPCOAT',
    qty: 16,
    uomCode: 'LTR',
    sequence: 70,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'PAINTING',
  },
  {
    ref: 'L1-THINNER',
    parentRef: null,
    itemCode: 'CON-THINNER',
    qty: 5,
    uomCode: 'LTR',
    sequence: 80,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'PAINTING',
  },

  // Shell materials
  {
    ref: 'L2-SHELL-PLATE',
    parentRef: 'L1-SHELL',
    itemCode: 'RM-MS-PLATE-006',
    qty: 620,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'SHELL-CUT',
  },
  {
    ref: 'L2-SHELL-WIRE',
    parentRef: 'L1-SHELL',
    itemCode: 'CON-WELD-ER70S6',
    qty: 12,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'SHELL-WELD',
  },
  {
    ref: 'L2-SHELL-GAS',
    parentRef: 'L1-SHELL',
    itemCode: 'CON-GAS-CO2',
    qty: 10,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'SHELL-WELD',
  },

  // Dished end materials
  {
    ref: 'L2-DISH-PLATE',
    parentRef: 'L1-DISH',
    itemCode: 'RM-MS-PLATE-008',
    qty: 220,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'END-FORM',
  },
  {
    ref: 'L2-DISH-E7018',
    parentRef: 'L1-DISH',
    itemCode: 'CON-WELD-E7018',
    qty: 4,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'END-FORM',
  },

  // Saddle materials
  {
    ref: 'L2-SAD-PLATE',
    parentRef: 'L1-SADDLE',
    itemCode: 'RM-MS-PLATE-010',
    qty: 120,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'SADDLE-FAB',
  },
  {
    ref: 'L2-SAD-ANGLE',
    parentRef: 'L1-SADDLE',
    itemCode: 'RM-MS-ANGLE-50X50X6',
    qty: 45,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'SADDLE-FAB',
  },
  {
    ref: 'L2-SAD-E7018',
    parentRef: 'L1-SADDLE',
    itemCode: 'CON-WELD-E7018',
    qty: 6,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'SADDLE-FAB',
  },

  // Nozzle / manhole materials
  {
    ref: 'L2-NOZ-PIPE50',
    parentRef: 'L1-NOZZLE',
    itemCode: 'RM-MS-PIPE-DN50',
    qty: 2.5,
    uomCode: 'MTR',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-PIPE25',
    parentRef: 'L1-NOZZLE',
    itemCode: 'RM-MS-PIPE-DN25',
    qty: 1.5,
    uomCode: 'MTR',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-COVER',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-MANHOLE-COVER-450',
    qty: 1,
    uomCode: 'Nos',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-GASKET',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-GASKET-MANHOLE-450',
    qty: 1,
    uomCode: 'Nos',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-BALL',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-BALL-VALVE-DN50',
    qty: 1,
    uomCode: 'Nos',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-DRAIN',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-DRAIN-VALVE-DN25',
    qty: 1,
    uomCode: 'Nos',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-VENT',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-VENT-CAP',
    qty: 1,
    uomCode: 'Nos',
    sequence: 70,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-GAUGE',
    parentRef: 'L1-NOZZLE',
    itemCode: 'BO-LEVEL-GAUGE',
    qty: 1,
    uomCode: 'Nos',
    sequence: 80,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    routeLink: 'NOZZLE-FAB',
  },
  {
    ref: 'L2-NOZ-E7018',
    parentRef: 'L1-NOZZLE',
    itemCode: 'CON-WELD-E7018',
    qty: 5,
    uomCode: 'KG',
    sequence: 90,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'NOZZLE-FAB',
  },

  // Final assembly — SFG inputs (logical) + fasteners
  {
    ref: 'L2-FIN-SHELL',
    parentRef: 'L1-FINAL',
    itemCode: 'SFG-TANK-SHELL-5000L',
    qty: 1,
    uomCode: 'Nos',
    sequence: 10,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    routeLink: 'FINAL-ASSY',
    notes: 'Logical input from JC-SHELL',
  },
  {
    ref: 'L2-FIN-DISH',
    parentRef: 'L1-FINAL',
    itemCode: 'SFG-DISHED-END-5000L',
    qty: 2,
    uomCode: 'Nos',
    sequence: 20,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    routeLink: 'FINAL-ASSY',
  },
  {
    ref: 'L2-FIN-SADDLE',
    parentRef: 'L1-FINAL',
    itemCode: 'SFG-SADDLE-SUPPORT-5000L',
    qty: 1,
    uomCode: 'SET',
    sequence: 30,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    routeLink: 'FINAL-ASSY',
  },
  {
    ref: 'L2-FIN-NOZZLE',
    parentRef: 'L1-FINAL',
    itemCode: 'SFG-NOZZLE-MANHOLE-5000L',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    routeLink: 'FINAL-ASSY',
  },
  {
    ref: 'L2-FIN-FAST',
    parentRef: 'L1-FINAL',
    itemCode: 'CON-FASTENER-MISC',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    routeLink: 'FINAL-ASSY',
  },
]

/** QC test groups → QualityInspectionPlan.planCode */
const QC_PLANS: Array<{
  planCode: string
  planName: string
  category: 'IN_PROCESS' | 'FINAL'
  tests: string[]
}> = [
  {
    planCode: 'QC-DIMENSIONAL-SHELL',
    planName: 'Shell dimensional check',
    category: 'IN_PROCESS',
    tests: ['Shell diameter', 'Shell length', 'Roundness', 'Plate alignment', 'Edge preparation'],
  },
  {
    planCode: 'QC-WELD-VISUAL-DPT',
    planName: 'Weld visual + DPT',
    category: 'IN_PROCESS',
    tests: ['Weld visual acceptance', 'Undercut', 'Porosity', 'Crack', 'DPT result', 'Weld size'],
  },
  {
    planCode: 'QC-DISHED-END-DIMENSION',
    planName: 'Dished end dimensional',
    category: 'IN_PROCESS',
    tests: ['Diameter', 'Crown depth', 'Knuckle radius', 'Thickness', 'Surface defect'],
  },
  {
    planCode: 'QC-SUPPORT-DIMENSION',
    planName: 'Saddle support dimensional',
    category: 'IN_PROCESS',
    tests: ['Saddle spacing', 'Height', 'Alignment', 'Weld size'],
  },
  {
    planCode: 'QC-NOZZLE-ORIENTATION',
    planName: 'Nozzle orientation',
    category: 'IN_PROCESS',
    tests: ['Nozzle location', 'Nozzle angle', 'Flange orientation', 'Manhole diameter', 'Gasket seating'],
  },
  {
    planCode: 'QC-ASSEMBLY-DIMENSION',
    planName: 'Assembly dimensional',
    category: 'IN_PROCESS',
    tests: ['Overall length', 'Tank center line', 'End alignment', 'Shell-end fitment', 'Weld joint gap'],
  },
  {
    planCode: 'QC-FITMENT-CHECK',
    planName: 'Saddle and nozzle fitment',
    category: 'IN_PROCESS',
    tests: ['Saddle alignment', 'Nozzle fitment', 'Valve fitment', 'Drain location', 'Vent installation'],
  },
  {
    planCode: 'QC-HYDRO-LEAK-TEST',
    planName: 'Hydrostatic and leak test',
    category: 'IN_PROCESS',
    tests: ['Test pressure', 'Holding time', 'Pressure drop', 'Leakage', 'Deformation', 'Final result'],
  },
  {
    planCode: 'QC-SURFACE-PREP',
    planName: 'Surface preparation',
    category: 'IN_PROCESS',
    tests: ['Surface cleanliness', 'Rust removal', 'Profile depth', 'Oil/grease absence'],
  },
  {
    planCode: 'QC-PAINT-DFT',
    planName: 'Primer DFT',
    category: 'IN_PROCESS',
    tests: ['Primer DFT', 'Surface coverage', 'Pinholes', 'Adhesion'],
  },
  {
    planCode: 'QC-PAINT-FINAL',
    planName: 'Final paint finish',
    category: 'IN_PROCESS',
    tests: ['Final DFT', 'Colour', 'Finish', 'Runs/sags', 'Surface defects'],
  },
  {
    planCode: 'QC-FINAL-FUEL-TANK',
    planName: 'Final fuel tank inspection',
    category: 'FINAL',
    tests: [
      'Capacity confirmation',
      'Overall dimensions',
      'Nameplate',
      'Serial number',
      'Valve operation',
      'Leak test reference',
      'Paint finish',
      'Documentation completeness',
    ],
  },
]

type OpDef = {
  code: string
  name: string
  seq: number
  setupMin: number
  runValue: number
  runUnit: 'MINUTE' | 'HOUR'
  waitHours?: number
  machine?: string
  qualityRequired?: boolean
  qcPlan?: string
  routeLink?: string
  predecessors?: string[]
  outputType?: 'SEMI_FINISHED' | 'FINISHED_GOOD' | 'NONE'
  outputItemCode?: string
}

type StageDef = {
  code: string
  name: string
  order: number
  wc: string
  parallelAllowed: boolean
  ops: OpDef[]
}

/** Stage groups = Job Cards under FG WO */
const STAGES: StageDef[] = [
  {
    code: 'JC-SHELL',
    name: 'JC-SHELL — Tank Shell',
    order: 1,
    wc: 'WC-CUTTING',
    parallelAllowed: true,
    ops: [
      {
        code: 'OP-10',
        name: 'Shell Plate Cutting',
        seq: 10,
        setupMin: 30,
        runValue: 2,
        runUnit: 'HOUR',
        machine: 'M-CNC-PLASMA-01',
        routeLink: 'SHELL-CUT',
      },
      {
        code: 'OP-20',
        name: 'Shell Rolling',
        seq: 20,
        setupMin: 45,
        runValue: 3,
        runUnit: 'HOUR',
        machine: 'M-ROLL-01',
        qualityRequired: true,
        qcPlan: 'QC-DIMENSIONAL-SHELL',
        routeLink: 'SHELL-ROLL',
        predecessors: ['OP-10'],
      },
      {
        code: 'OP-30',
        name: 'Longitudinal Shell Welding',
        seq: 30,
        setupMin: 30,
        runValue: 5,
        runUnit: 'HOUR',
        machine: 'M-MIG-01',
        qualityRequired: true,
        qcPlan: 'QC-WELD-VISUAL-DPT',
        routeLink: 'SHELL-WELD',
        predecessors: ['OP-20'],
        outputType: 'SEMI_FINISHED',
        outputItemCode: 'SFG-TANK-SHELL-5000L',
      },
    ],
  },
  {
    code: 'JC-DISHED-END',
    name: 'JC-DISHED-END — Dished Ends',
    order: 2,
    wc: 'WC-CUTTING',
    parallelAllowed: true,
    ops: [
      {
        code: 'OP-40',
        name: 'Dished End Plate Cutting',
        seq: 40,
        setupMin: 20,
        runValue: 1.5,
        runUnit: 'HOUR',
        machine: 'M-CNC-PLASMA-01',
        routeLink: 'END-FORM',
      },
      {
        code: 'OP-50',
        name: 'Dished End Forming',
        seq: 50,
        setupMin: 60,
        runValue: 4,
        runUnit: 'HOUR',
        machine: 'M-PRESS-01',
        qualityRequired: true,
        qcPlan: 'QC-DISHED-END-DIMENSION',
        routeLink: 'END-FORM',
        predecessors: ['OP-40'],
        outputType: 'SEMI_FINISHED',
        outputItemCode: 'SFG-DISHED-END-5000L',
      },
    ],
  },
  {
    code: 'JC-SADDLE',
    name: 'JC-SADDLE — Saddle Support',
    order: 3,
    wc: 'WC-FABRICATION',
    parallelAllowed: true,
    ops: [
      {
        code: 'OP-60',
        name: 'Saddle Support Fabrication',
        seq: 60,
        setupMin: 30,
        runValue: 4,
        runUnit: 'HOUR',
        qualityRequired: true,
        qcPlan: 'QC-SUPPORT-DIMENSION',
        routeLink: 'SADDLE-FAB',
        outputType: 'SEMI_FINISHED',
        outputItemCode: 'SFG-SADDLE-SUPPORT-5000L',
      },
    ],
  },
  {
    code: 'JC-NOZZLE',
    name: 'JC-NOZZLE — Nozzle & Manhole',
    order: 4,
    wc: 'WC-FABRICATION',
    parallelAllowed: true,
    ops: [
      {
        code: 'OP-70',
        name: 'Nozzle and Manhole Fabrication',
        seq: 70,
        setupMin: 30,
        runValue: 5,
        runUnit: 'HOUR',
        machine: 'M-SMAW-01',
        qualityRequired: true,
        qcPlan: 'QC-NOZZLE-ORIENTATION',
        routeLink: 'NOZZLE-FAB',
        outputType: 'SEMI_FINISHED',
        outputItemCode: 'SFG-NOZZLE-MANHOLE-5000L',
      },
    ],
  },
  {
    code: 'JC-FINAL-ASSEMBLY',
    name: 'JC-FINAL-ASSEMBLY — Final Tank Assy',
    order: 5,
    wc: 'WC-ASSEMBLY',
    parallelAllowed: false,
    ops: [
      {
        code: 'OP-80',
        name: 'Shell and Dished End Assembly',
        seq: 80,
        setupMin: 45,
        runValue: 6,
        runUnit: 'HOUR',
        qualityRequired: true,
        qcPlan: 'QC-ASSEMBLY-DIMENSION',
        routeLink: 'FINAL-ASSY',
        predecessors: ['OP-30', 'OP-50'],
      },
      {
        code: 'OP-90',
        name: 'Saddle and Nozzle Fitment',
        seq: 90,
        setupMin: 30,
        runValue: 5,
        runUnit: 'HOUR',
        qualityRequired: true,
        qcPlan: 'QC-FITMENT-CHECK',
        routeLink: 'FINAL-ASSY',
        predecessors: ['OP-60', 'OP-70', 'OP-80'],
        outputType: 'SEMI_FINISHED',
        outputItemCode: 'SFG-FINAL-TANK-ASSY-5000L',
      },
    ],
  },
  {
    code: 'JC-TEST-FINISH',
    name: 'JC-TEST-FINISH — Test / Paint / FG',
    order: 6,
    wc: 'WC-QUALITY',
    parallelAllowed: false,
    ops: [
      {
        code: 'OP-100',
        name: 'Hydrostatic and Leak Testing',
        seq: 100,
        setupMin: 30,
        runValue: 3,
        runUnit: 'HOUR',
        machine: 'M-HYDRO-PUMP-01',
        qualityRequired: true,
        qcPlan: 'QC-HYDRO-LEAK-TEST',
        routeLink: 'PRESSURE-TEST',
        predecessors: ['OP-90'],
      },
      {
        code: 'OP-110',
        name: 'Shot Blasting and Surface Preparation',
        seq: 110,
        setupMin: 30,
        runValue: 3,
        runUnit: 'HOUR',
        machine: 'M-BLAST-01',
        qualityRequired: true,
        qcPlan: 'QC-SURFACE-PREP',
        routeLink: 'FINAL-FINISH',
        predecessors: ['OP-100'],
      },
      {
        code: 'OP-120',
        name: 'Epoxy Primer Application',
        seq: 120,
        setupMin: 30,
        runValue: 2,
        runUnit: 'HOUR',
        waitHours: 8,
        machine: 'M-PAINT-BOOTH-01',
        qualityRequired: true,
        qcPlan: 'QC-PAINT-DFT',
        routeLink: 'PAINTING',
        predecessors: ['OP-110'],
      },
      {
        code: 'OP-130',
        name: 'PU Topcoat Application',
        seq: 130,
        setupMin: 20,
        runValue: 2,
        runUnit: 'HOUR',
        waitHours: 12,
        machine: 'M-PAINT-BOOTH-01',
        qualityRequired: true,
        qcPlan: 'QC-PAINT-FINAL',
        routeLink: 'PAINTING',
        predecessors: ['OP-120'],
      },
      {
        code: 'OP-140',
        name: 'Final Inspection and Identification',
        seq: 140,
        setupMin: 15,
        runValue: 2,
        runUnit: 'HOUR',
        qualityRequired: true,
        qcPlan: 'QC-FINAL-FUEL-TANK',
        routeLink: 'FINAL-FINISH',
        predecessors: ['OP-130'],
      },
      {
        code: 'OP-150',
        name: 'Finished Goods Receipt Readiness',
        seq: 150,
        setupMin: 0,
        runValue: 30,
        runUnit: 'MINUTE',
        routeLink: 'FINAL-FINISH',
        predecessors: ['OP-140'],
        outputType: 'FINISHED_GOOD',
        outputItemCode: FG_CODE,
      },
    ],
  },
]

async function resolveUomId(tenantId: string, code: string, cache: Map<string, string>): Promise<string> {
  const aliases =
    code === 'Nos' || code.toUpperCase() === 'NOS'
      ? ['Nos', 'NOS', 'nos']
      : [code, code.toUpperCase()]
  for (const alias of aliases) {
    const hit = cache.get(alias)
    if (hit) return hit
  }
  for (const alias of aliases) {
    const row = await prisma.masterUom.findFirst({
      where: { tenantId, code: alias, deletedAt: null },
    })
    if (row) {
      for (const a of aliases) cache.set(a, row.id)
      return row.id
    }
  }
  throw new Error(`UOM not found: ${code} — run seed-fuel-tank-pilot-items.ts`)
}

async function requireItem(tenantId: string, code: string): Promise<{ id: string; code: string }> {
  const item = await prisma.masterItem.findFirst({
    where: { tenantId, code, deletedAt: null },
    select: { id: true, code: true },
  })
  if (!item) throw new Error(`Item ${code} missing — run: npx tsx scripts/seed-fuel-tank-pilot-items.ts`)
  return item
}

function paramCode(planCode: string, idx: number): string {
  return `QP-FT-${planCode.replace(/^QC-/, '').slice(0, 18)}-${String(idx).padStart(2, '0')}`
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id ?? null

  console.log(`\n=== Fuel Tank Manufacturing setup (${tenant.slug}) ===\n`)

  const plant = await prisma.masterPlant.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: PLANT } },
    create: {
      tenantId: tenant.id,
      code: PLANT,
      name: 'Main Plant',
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Main Plant', updatedBy: userId },
  })

  // Work centres
  const workCentreIds = new Map<string, string>()
  for (const wc of WORK_CENTRES) {
    const row = await prisma.manufacturingWorkCentre.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: wc.code } },
      create: {
        tenantId: tenant.id,
        code: wc.code,
        name: wc.name,
        plantCode: PLANT,
        departmentRef: wc.departmentRef,
        capacityPerShift: 8,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: wc.name,
        plantCode: PLANT,
        departmentRef: wc.departmentRef,
        deletedAt: null,
        isActive: true,
        updatedBy: userId,
      },
    })
    workCentreIds.set(wc.code, row.id)
    console.log(`  WC  ${wc.code.padEnd(16)} ${wc.name}`)
  }
  console.log(`✓ Work centres: ${workCentreIds.size}`)

  // Machines
  const machineIds = new Map<string, string>()
  for (const m of MACHINES) {
    const workCentreId = workCentreIds.get(m.workCentreCode)
    if (!workCentreId) throw new Error(`WC missing for machine ${m.code}`)
    const row = await prisma.manufacturingMachine.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: m.code } },
      create: {
        tenantId: tenant.id,
        code: m.code,
        name: m.name,
        workCentreId,
        status: 'AVAILABLE',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: m.name,
        workCentreId,
        deletedAt: null,
        isActive: true,
        status: 'AVAILABLE',
        updatedBy: userId,
      },
    })
    machineIds.set(m.code, row.id)
    console.log(`  MC  ${m.code.padEnd(20)} → ${m.workCentreCode}`)
  }
  console.log(`✓ Machines: ${machineIds.size}`)

  // Warehouses
  const warehouseIds = new Map<string, string>()
  for (const w of WAREHOUSES) {
    const row = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: w.code } },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: PLANT,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        plantId: plant.id,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: PLANT,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    warehouseIds.set(w.code, row.id)
  }
  console.log(`✓ Warehouses: ${[...warehouseIds.keys()].join(', ')}`)

  // QC plans + parameters
  const qcPlanIds = new Map<string, string>()
  for (const plan of QC_PLANS) {
    const paramIds: string[] = []
    for (let i = 0; i < plan.tests.length; i += 1) {
      const code = paramCode(plan.planCode, i + 1)
      const row = await prisma.qualityParameter.upsert({
        where: { tenantId_parameterCode: { tenantId: tenant.id, parameterCode: code } },
        create: {
          tenantId: tenant.id,
          parameterCode: code,
          parameterName: plan.tests[i]!,
          parameterType: 'BOOLEAN',
          mandatory: true,
          severity: 'MAJOR',
          passFailRule: 'BOOLEAN_TRUE',
          active: true,
          createdBy: userId,
        },
        update: {
          parameterName: plan.tests[i]!,
          active: true,
          deletedAt: null,
          updatedBy: userId,
        },
      })
      paramIds.push(row.id)
    }

    let existing = await prisma.qualityInspectionPlan.findFirst({
      where: { tenantId: tenant.id, planCode: plan.planCode, deletedAt: null },
    })
    if (!existing) {
      existing = await prisma.qualityInspectionPlan.create({
        data: {
          tenantId: tenant.id,
          planCode: plan.planCode,
          planName: plan.planName,
          category: plan.category,
          status: 'ACTIVE',
          revision: 'A',
          createdBy: userId,
          lines: {
            create: paramIds.map((parameterId, sortOrder) => ({
              tenantId: tenant.id,
              parameterId,
              sortOrder,
            })),
          },
        },
      })
      console.log(`  QC  ${plan.planCode} (${plan.tests.length} tests)`)
    } else {
      await prisma.qualityInspectionPlan.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', planName: plan.planName, deletedAt: null, updatedBy: userId },
      })
      console.log(`  QC  ${plan.planCode} (exists)`)
    }
    qcPlanIds.set(plan.planCode, existing.id)
  }
  console.log(`✓ QC test groups: ${qcPlanIds.size}`)

  const fg = await requireItem(tenant.id, FG_CODE)
  const uomCache = new Map<string, string>()
  const itemIds = new Map<string, string>([[FG_CODE, fg.id]])
  for (const node of BOM_NODES) {
    if (itemIds.has(node.itemCode)) continue
    const item = await requireItem(tenant.id, node.itemCode)
    itemIds.set(item.code, item.id)
  }

  // ── BOM ───────────────────────────────────────────────────────────────
  const bom = await prisma.manufacturingBom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: BOM_CODE } },
    create: {
      tenantId: tenant.id,
      code: BOM_CODE,
      name: '5000 Litre Fuel Tank Multilevel BOM',
      productItemId: fg.id,
      description:
        'Multilevel MAKE SFG + BUY materials. LOGICAL SFG — Job Cards under FG WO (no child SFG WO).',
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: '5000 Litre Fuel Tank Multilevel BOM',
      productItemId: fg.id,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })

  let bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId: tenant.id, bomId: bom.id, versionNumber: 1, deletedAt: null },
  })

  if (!bomVersion) {
    const baseUomId = await resolveUomId(tenant.id, 'Nos', uomCache)
    bomVersion = await prisma.manufacturingBomVersion.create({
      data: {
        tenantId: tenant.id,
        bomId: bom.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        baseQuantity: 1,
        baseUomId,
        expectedYieldPercent: 100,
        revisionNotes: 'Initial fuel tank multilevel BOM (Under Development → Certified as ACTIVE)',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const lineIdByRef = new Map<string, string>()
    const ordered = [
      ...BOM_NODES.filter((n) => n.parentRef == null),
      ...BOM_NODES.filter((n) => n.parentRef != null),
    ]
    for (const node of ordered) {
      const itemId = itemIds.get(node.itemCode)
      const uomId = await resolveUomId(tenant.id, node.uomCode, uomCache)
      if (!itemId) throw new Error(`Missing item for BOM node ${node.ref}`)
      const parentLineId = node.parentRef ? lineIdByRef.get(node.parentRef) ?? null : null
      if (node.parentRef && !parentLineId) throw new Error(`Parent ${node.parentRef} missing for ${node.ref}`)

      const line = await prisma.manufacturingBomLine.create({
        data: {
          tenantId: tenant.id,
          bomVersionId: bomVersion.id,
          parentLineId,
          sequence: node.sequence,
          level: node.parentRef ? 2 : 1,
          itemId,
          quantity: node.qty,
          uomId,
          quantityBasis: 'PER_UNIT',
          scrapPercent: 0,
          yieldPercent: 100,
          makeOrBuy: node.makeOrBuy,
          lineType: node.lineType,
          isOptional: false,
          substituteAllowed: false,
          qualityRequired: node.lineType === 'SUBASSEMBLY',
          certificateRequired: node.lineType === 'BOUGHT_OUT',
          // LOGICAL pilot — SFGs do NOT spawn child WOs
          childProductionOrderRequired: false,
          stockedSemiFinished: false,
          phantomAssembly: false,
          drawingReference: node.routeLink ?? null,
          notes: node.notes ?? (node.routeLink ? `RouteLink:${node.routeLink}` : null),
          createdBy: userId,
          updatedBy: userId,
        },
      })
      lineIdByRef.set(node.ref, line.id)
    }
    console.log(`✓ BOM ${BOM_CODE} v1 DRAFT (${ordered.length} lines)`)
  } else {
    console.log(`  BOM ${BOM_CODE} v1 exists (status=${bomVersion.status})`)
  }

  if (bomVersion.status !== 'ACTIVE') {
    await prisma.manufacturingBomVersion.updateMany({
      where: { tenantId: tenant.id, bomId: bom.id, status: 'ACTIVE', id: { not: bomVersion.id } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    bomVersion = await prisma.manufacturingBomVersion.update({
      where: { id: bomVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ BOM ${BOM_CODE} v1 CERTIFIED (ACTIVE, read-only)`)
  } else {
    console.log(`✓ BOM ${BOM_CODE} v1 already ACTIVE`)
  }

  // ── Routing (auto code via MANUFACTURING_ROUTING series) ──────────────
  let routing = await prisma.manufacturingRouting.findFirst({
    where: {
      tenantId: tenant.id,
      productItemId: fg.id,
      deletedAt: null,
      name: { contains: 'Fuel Tank Manufacturing Route' },
    },
  })

  if (!routing) {
    const routeCode = await nextCode(tenant.id, 'MANUFACTURING_ROUTING')
    routing = await prisma.manufacturingRouting.create({
      data: {
        tenantId: tenant.id,
        code: routeCode,
        name: '5000 Litre Fuel Tank Manufacturing Route',
        productItemId: fg.id,
        description:
          'PARALLEL: Shell / Ends / Saddle / Nozzle → Final Assy → Test / Paint / FG. Stage groups = Job Cards.',
        productionFlowType: 'PARALLEL',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ Routing created ${routing.code} (auto series)`)
  } else {
    routing = await prisma.manufacturingRouting.update({
      where: { id: routing.id },
      data: {
        name: '5000 Litre Fuel Tank Manufacturing Route',
        productionFlowType: 'PARALLEL',
        deletedAt: null,
        isActive: true,
        updatedBy: userId,
      },
    })
    console.log(`  Routing ${routing.code} exists`)
  }

  let routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId: tenant.id, routingId: routing.id, versionNumber: 1, deletedAt: null },
  })

  const opIdByCode = new Map<string, string>()
  const firstOpIdByRouteLink = new Map<string, string>()

  if (!routingVersion) {
    routingVersion = await prisma.manufacturingRoutingVersion.create({
      data: {
        tenantId: tenant.id,
        routingId: routing.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        revisionNotes: 'Initial PARALLEL fuel tank route',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    for (const stage of STAGES) {
      // Per-op WC may differ within a JC; default WC from stage header
      const defaultWcId = workCentreIds.get(stage.wc)
      if (!defaultWcId) throw new Error(`WC ${stage.wc} missing`)

      const stageGroup = await prisma.manufacturingStageGroup.create({
        data: {
          tenantId: tenant.id,
          routingVersionId: routingVersion.id,
          code: stage.code,
          name: stage.name,
          displayOrder: stage.order,
          defaultWorkCentreId: defaultWcId,
          parallelAllowed: stage.parallelAllowed,
          qualityRequired: stage.ops.some((o) => o.qualityRequired),
          completionRule: 'ALL_OPERATIONS',
          createdBy: userId,
          updatedBy: userId,
        },
      })

      for (const op of stage.ops) {
        // Resolve WC from machine if present, else stage default
        let wcId = defaultWcId
        if (op.machine) {
          const mc = MACHINES.find((m) => m.code === op.machine)
          if (mc) {
            const mid = workCentreIds.get(mc.workCentreCode)
            if (mid) wcId = mid
          }
        }
        // Paint / blast / quality / FG ops: map WC from op semantics
        if (op.code === 'OP-20' || op.code === 'OP-50') wcId = workCentreIds.get('WC-FORMING')!
        if (op.code === 'OP-30') wcId = workCentreIds.get('WC-WELDING')!
        if (op.code === 'OP-80' || op.code === 'OP-90') wcId = workCentreIds.get('WC-ASSEMBLY')!
        if (op.code === 'OP-100' || op.code === 'OP-140') wcId = workCentreIds.get('WC-QUALITY')!
        if (op.code === 'OP-110') wcId = workCentreIds.get('WC-BLASTING')!
        if (op.code === 'OP-120' || op.code === 'OP-130') wcId = workCentreIds.get('WC-PAINTING')!
        if (op.code === 'OP-150') wcId = workCentreIds.get('WC-FG')!

        const machineId = op.machine ? machineIds.get(op.machine) ?? null : null
        const qcTestGroupId = op.qcPlan ? qcPlanIds.get(op.qcPlan) ?? null : null
        if (op.qualityRequired && !qcTestGroupId) {
          throw new Error(`QC plan ${op.qcPlan} missing for ${op.code}`)
        }
        const outputItemId = op.outputItemCode ? itemIds.get(op.outputItemCode) ?? null : null
        const waitNote = op.waitHours ? `Wait / cure time: ${op.waitHours} HOURS. ` : ''

        const created = await prisma.manufacturingRoutingOperation.create({
          data: {
            tenantId: tenant.id,
            routingVersionId: routingVersion.id,
            stageGroupId: stageGroup.id,
            code: op.code,
            name: op.name,
            sequence: op.seq,
            description: `${waitNote}${op.name}`,
            workCentreId: wcId,
            defaultMachineId: machineId,
            setupTimeMinutes: op.setupMin,
            setupTimeUnit: 'MINUTE',
            runTimeValue: op.runValue,
            runTimeUnit: op.runUnit,
            runTimeBasis: 'PER_UNIT',
            workInstructions: waitNote || null,
            drawingReference: op.routeLink ?? null,
            inputType: 'MATERIAL',
            outputType: op.outputType ?? 'NONE',
            outputItemId,
            qualityRequired: op.qualityRequired ?? false,
            qualityPlanRef: op.qcPlan ?? null,
            qcTestGroupId,
            createdBy: userId,
            updatedBy: userId,
          },
        })
        opIdByCode.set(op.code, created.id)
        if (op.routeLink && !firstOpIdByRouteLink.has(op.routeLink)) {
          firstOpIdByRouteLink.set(op.routeLink, created.id)
        }
        console.log(
          `  OP  ${op.code.padEnd(7)} ${op.name.slice(0, 42).padEnd(42)} link=${(op.routeLink ?? '—').padEnd(14)} QC=${op.qcPlan ?? '—'}`,
        )
      }
    }

    // Dependencies
    let depCount = 0
    for (const stage of STAGES) {
      for (const op of stage.ops) {
        for (const pred of op.predecessors ?? []) {
          const predId = opIdByCode.get(pred)
          const succId = opIdByCode.get(op.code)
          if (!predId || !succId) throw new Error(`Dependency missing ${pred} → ${op.code}`)
          await prisma.manufacturingOperationDependency.create({
            data: {
              tenantId: tenant.id,
              routingVersionId: routingVersion.id,
              predecessorOperationId: predId,
              successorOperationId: succId,
              dependencyType: 'FINISH_TO_START',
              minimumCompletionPercent: 100,
              isMandatory: true,
              allowParallel: false,
              createdBy: userId,
              updatedBy: userId,
            },
          })
          depCount += 1
        }
      }
    }
    console.log(`✓ Routing ${routing.code} v1 DRAFT (${STAGES.length} Job Card stages, ${depCount} deps)`)
  } else {
    console.log(`  Routing ${routing.code} v1 exists (status=${routingVersion.status})`)
    const ops = await prisma.manufacturingRoutingOperation.findMany({
      where: { tenantId: tenant.id, routingVersionId: routingVersion.id, deletedAt: null },
      select: { id: true, code: true, drawingReference: true },
    })
    for (const op of ops) {
      opIdByCode.set(op.code, op.id)
      if (op.drawingReference && !firstOpIdByRouteLink.has(op.drawingReference)) {
        firstOpIdByRouteLink.set(op.drawingReference, op.id)
      }
    }
  }

  // Link BOM lines → issue operations by route link
  if (firstOpIdByRouteLink.size > 0) {
    const lines = await prisma.manufacturingBomLine.findMany({
      where: { tenantId: tenant.id, bomVersionId: bomVersion.id, deletedAt: null },
      select: { id: true, drawingReference: true },
    })
    for (const line of lines) {
      if (!line.drawingReference) continue
      const opId = firstOpIdByRouteLink.get(line.drawingReference)
      if (!opId) continue
      await prisma.manufacturingBomLine.update({
        where: { id: line.id },
        data: { issueOperationId: opId, updatedBy: userId },
      })
    }
    console.log(`✓ BOM route-link → issueOperationId mapped (${firstOpIdByRouteLink.size} links)`)
  }

  if (routingVersion.status !== 'ACTIVE') {
    await prisma.manufacturingRoutingVersion.updateMany({
      where: {
        tenantId: tenant.id,
        routingId: routing.id,
        status: 'ACTIVE',
        id: { not: routingVersion.id },
      },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    routingVersion = await prisma.manufacturingRoutingVersion.update({
      where: { id: routingVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        approvedAt: new Date(),
        approvedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ Routing ${routing.code} v1 CERTIFIED (ACTIVE, read-only)`)
  } else {
    console.log(`✓ Routing ${routing.code} v1 already ACTIVE`)
  }

  // ── Manufacturing Profile ─────────────────────────────────────────────
  const prodWh = warehouseIds.get('WIP')
  const fgWh = warehouseIds.get('FG-MAIN')
  const rmWh = warehouseIds.get('RM-MAIN')
  const qcWh = warehouseIds.get('QC-HOLD')
  const scrapWh = warehouseIds.get('SCRAP')
  const jwWh = warehouseIds.get('JOB-WORK')
  if (!prodWh || !fgWh || !rmWh) throw new Error('WIP / FG-MAIN / RM-MAIN required')

  const profile = await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: PROFILE_CODE } },
    create: {
      tenantId: tenant.id,
      code: PROFILE_CODE,
      name: '5000 Litre Fuel Tank Manufacturing Profile',
      productItemId: fg.id,
      productionType: 'FABRICATION',
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      defaultQualityPlanRef: 'QC-FINAL-FUEL-TANK',
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      plantCode: PLANT,
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'LOGICAL_WIP',
      outputTrackingMethod: 'SERIAL',
      directProductionOrderAllowed: true,
      partialCompletionAllowed: true,
      overproductionTolerancePercent: 0,
      underproductionTolerancePercent: 0,
      serialTrackingRequired: true,
      childProductionOrdersEnabled: false,
      subcontractingAllowed: true,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: '5000 Litre Fuel Tank Manufacturing Profile',
      productItemId: fg.id,
      productionType: 'FABRICATION',
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      defaultQualityPlanRef: 'QC-FINAL-FUEL-TANK',
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      plantCode: PLANT,
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'LOGICAL_WIP',
      outputTrackingMethod: 'SERIAL',
      directProductionOrderAllowed: true,
      partialCompletionAllowed: true,
      overproductionTolerancePercent: 0,
      serialTrackingRequired: true,
      childProductionOrdersEnabled: false,
      subcontractingAllowed: true,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })
  console.log(`✓ Profile ${PROFILE_CODE} → FG=${FG_CODE} BOM=${BOM_CODE} RT=${routing.code}`)

  // Tenant manufacturing settings (pilot: reservation warning only; no close without QC)
  await prisma.manufacturingSettings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      version: 1,
      payloadJson: { fuelTankPilot: true },
      allowOverproduction: false,
      overproductionTolerancePercent: 0,
      allowCloseWithoutQc: false,
      requireReservation: false,
      allowPartialProduction: true,
      allowProductionWithoutFullMaterial: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      allowCloseWithoutQc: false,
      requireReservation: false,
      allowPartialProduction: true,
      allowOverproduction: false,
      overproductionTolerancePercent: 0,
      updatedBy: userId,
    },
  })

  // Warehouse role mapping for MAIN-PLANT
  const existingMap = await prisma.manufacturingWarehouseMapping.findFirst({
    where: { tenantId: tenant.id, plantCode: PLANT, deletedAt: null },
  })
  if (!existingMap) {
    await prisma.manufacturingWarehouseMapping.create({
      data: {
        tenantId: tenant.id,
        plantCode: PLANT,
        rawMaterialWarehouseId: rmWh,
        productionIssueWarehouseId: prodWh,
        wipWarehouseId: prodWh,
        finishedGoodsWarehouseId: fgWh,
        qualityHoldWarehouseId: qcWh ?? null,
        scrapWarehouseId: scrapWh ?? null,
        jobWorkWarehouseId: jwWh ?? null,
        isDefault: false,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ Warehouse mapping plant=${PLANT}`)
  } else {
    await prisma.manufacturingWarehouseMapping.update({
      where: { id: existingMap.id },
      data: {
        rawMaterialWarehouseId: rmWh,
        productionIssueWarehouseId: prodWh,
        wipWarehouseId: prodWh,
        finishedGoodsWarehouseId: fgWh,
        qualityHoldWarehouseId: qcWh ?? null,
        scrapWarehouseId: scrapWh ?? null,
        jobWorkWarehouseId: jwWh ?? null,
        isActive: true,
        deletedAt: null,
        updatedBy: userId,
      },
    })
    console.log(`✓ Warehouse mapping plant=${PLANT} (updated)`)
  }

  // Verification / readiness
  console.log('\n── Profile readiness ──')
  const checks = [
    { label: 'Finished Item', ok: !!fg },
    { label: 'Certified BOM', ok: bomVersion.status === 'ACTIVE' },
    { label: 'Certified Route', ok: routingVersion.status === 'ACTIVE' },
    { label: 'Work Centres', ok: workCentreIds.size === WORK_CENTRES.length },
    { label: 'Machines', ok: machineIds.size === MACHINES.length },
    { label: 'QC Test Groups', ok: qcPlanIds.size === QC_PLANS.length },
    { label: 'RM Warehouse', ok: !!rmWh },
    { label: 'WIP Warehouse', ok: !!prodWh },
    { label: 'FG Warehouse', ok: !!fgWh },
    { label: 'QC Hold Warehouse', ok: !!qcWh },
    { label: 'Scrap Warehouse', ok: !!scrapWh },
    { label: 'Tracking Policy', ok: profile.serialTrackingRequired && profile.outputTrackingMethod === 'SERIAL' },
    { label: 'LOGICAL SFG (no child WO)', ok: !profile.childProductionOrdersEnabled },
    { label: 'Profile Active', ok: profile.isActive },
  ]
  let allOk = true
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.label}`)
    if (!c.ok) allOk = false
  }
  console.log(`\n  ${allOk ? 'READY FOR ACTIVATION / WO CREATE' : 'NOT READY — fix failures above'}`)
  console.log(`\nUI: /manufacturing/work-orders/new → ${FG_CODE}`)
  console.log(`Route: ${routing.code}  Profile: ${PROFILE_CODE}`)
  console.log(`Next: npx tsx scripts/test-fuel-tank-wo-execution.ts\n`)

  if (!allOk) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
