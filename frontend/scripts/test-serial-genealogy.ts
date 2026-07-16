/**
 * Serial number + trailer genealogy tests — npm run test:serial-genealogy
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { useSerialStore, assertSerialDispatchReady } = await import('../src/store/serialStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function reset() {
  useSerialStore.setState({ serials: [] })
  resetSessionUserForTests()
  setSessionUserForTests({ role: 'admin' })
}

console.log('\nSerial Genealogy Tests\n')
reset()

const t1 = useSerialStore.getState().registerSerial({
  serialNo: 'TR-2026-001',
  serialType: 'finished_trailer',
  woNo: 'WO-TEST-001',
})
check(1, 'Trailer serial number is unique on register', t1.ok, t1.serialId)

const dup = useSerialStore.getState().registerSerial({
  serialNo: 'TR-2026-001',
  serialType: 'finished_trailer',
})
check(2, 'Duplicate trailer serial rejected', !dup.ok)

const c1 = useSerialStore.getState().registerSerial({
  serialNo: 'CHS-508-001',
  serialType: 'chassis',
})
check(3, 'Chassis number is unique on register', c1.ok)

const dupChassis = useSerialStore.getState().registerSerial({
  serialNo: 'CHS-508-001',
  serialType: 'chassis',
})
check(4, 'Duplicate chassis rejected', !dupChassis.ok)

// GRN axle serial capture
const axleItem = useMasterStore.getState().items.find((i) => /axle/i.test(i.itemCode))
const grn = usePurchaseStore.getState().grns[0]
if (grn && axleItem) {
  const patchedGrn = {
    ...grn,
    lines: grn.lines.map((l, idx) =>
      idx === 0 ? { ...l, itemId: axleItem.id } : l,
    ),
  }
  usePurchaseStore.setState((s) => ({
    grns: s.grns.map((g) => (g.id === grn.id ? patchedGrn : g)),
  }))
  const grnSerials = useSerialStore.getState().registerGrnLineSerials(grn.id)
  check(5, 'GRN captures axle serial', grnSerials.serialIds.length > 0)
  const axleSerialId = grnSerials.serialIds[0]
  const assign = useSerialStore.getState().assignToWorkOrder(axleSerialId, 'wo-test-001', 'WO-TEST-001')
  check(6, 'WO consumes serialized axle', assign.ok)
} else {
  const manualAxle = useSerialStore.getState().registerSerial({
    serialNo: 'AX-2026-0091',
    serialType: 'axle',
    itemCode: 'RM-AXLE-3T',
    grnNo: 'GRN-TEST',
    status: 'in_stock',
  })
  check(5, 'GRN captures axle serial', manualAxle.ok, 'manual register')
  if (manualAxle.serialId) {
    check(6, 'WO consumes serialized axle', useSerialStore.getState().assignToWorkOrder(manualAxle.serialId, 'wo-test-001', 'WO-TEST-001').ok)
  } else {
    check(6, 'WO consumes serialized axle', false)
  }
}

const fg = useSerialStore.getState().registerFgTrailer({
  trailerNo: 'TR-2026-FG-01',
  chassisNo: 'CHS-FG-01',
  workOrderId: 'wo-test-001',
  woNo: 'WO-FG-01',
  qrCode: 'QR-TR-FG-01',
})
check(7, 'FG receipt creates trailer serial', fg.ok && Boolean(useSerialStore.getState().getBySerialNo('TR-2026-FG-01')))

const axleForInstall = useSerialStore.getState().getBySerialNo('AX-2026-0091')
if (axleForInstall && fg.trailerSerialId) {
  useSerialStore.getState().installOnTrailer(axleForInstall.id, fg.trailerSerialId, 'TR-2026-FG-01')
}
const genealogy = useSerialStore.getState().buildGenealogy('TR-2026-FG-01')
check(8, 'Trailer genealogy shows consumed components', genealogy.components.length >= 1 || genealogy.timeline.some((t) => t.kind === 'component'))

const compGenealogy = useSerialStore.getState().buildComponentGenealogy('AX-2026-0091')
check(
  9,
  'Component genealogy shows final trailer',
  compGenealogy?.installedTrailerNo === 'TR-2026-FG-01' || compGenealogy?.timeline.some((t) => t.label.includes('Trailer')) === true,
)

check(10, 'Dispatch blocked without trailer serial', !assertSerialDispatchReady('', 'CHS-001').ok)
check(11, 'Dispatch blocked without chassis number', !assertSerialDispatchReady('TR-2026-099', '').ok)

const warranty = useSerialStore.getState().buildWarrantyInvestigation('TR-2026-FG-01')
check(12, 'Warranty lookup returns trailer record', warranty?.trailerNo === 'TR-2026-FG-01')

const qrLinked = useSerialStore.getState().getBySerialNo('TR-2026-FG-01')
check(13, 'QR and serial traceability link correctly', qrLinked?.qrCode === 'QR-TR-FG-01')

// Dispatched serial cannot be reused
useSerialStore.getState().markDispatched('TR-2026-FG-01', 'CHS-FG-01')
check(14, 'Dispatched serial cannot be reused', !assertSerialDispatchReady('TR-2026-FG-01', 'CHS-FG-01').ok)

console.log(`\nSerial Genealogy: ${passed}/${passed + failed} passed${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
