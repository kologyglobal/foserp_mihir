/**
 * Multilevel traveler BOM preview — display types only (demo UI).
 * Not persisted; not used by Work Order explosion in Phase 1.
 */

export type TravelerRowKind = 'assembly' | 'component' | 'process'

export interface BomTravelerDocumentMeta {
  id: string
  title: string
  productCode: string
  productName: string
  quotationRef: string
  designCode: string
  shellMaterial: string
  mawp: string
  capacity: string
  bomNumber: string
  revision: string
  /** Link into existing demo masters BOM (optional) */
  mastersBomHeaderId: string | null
  /** Link into manufacturing BOM register (optional) */
  manufacturingBomId: string | null
  /** Linked demo Work Order (optional) */
  workOrderId: string | null
  workOrderNo: string | null
  disclaimer: string
}

export interface BomTravelerRow {
  id: string
  /** Numeric level 0–3, or null for process rows */
  level: number | null
  kind: TravelerRowKind
  bomNo: string
  parentBomNo: string | null
  itemNo: string
  description: string
  materialGrade: string
  qty: number | null
  unit: string
  weightKg: number | null
  totalWeightKg: number | null
  dimensionsSpec: string
  productionProcess: string
  machineTool: string
  qcInspection: string
}

export interface BomTravelerDocument {
  meta: BomTravelerDocumentMeta
  rows: BomTravelerRow[]
}
