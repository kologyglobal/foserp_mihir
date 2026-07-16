/** Demo / test anchors for SO-0001 · 2× 45 M3 Bulker manufacturing scenario. */
export const DEMO_WO_ANCHORS = {
  salesOrderNo: 'SO-0001',
  /** First WO from MRP — Tank Assembly sub-assembly (manufactured). */
  tankAssemblyWoNo: 'WO-0001',
  tankOutputItemCode: 'SA-TANK-ASM',
  tankOutputItemName: 'Tank Assembly',
  /** Bulker routing — Welding QC rework demo step. */
  weldingSequenceNo: 40,
  weldingOperationName: 'Welding',
  /** Next in-house step after Welding PASS on bulker routing. */
  nextOperationAfterWeldingSeq: 50,
  nextOperationAfterWeldingName: 'Chassis Assembly',
} as const
