/** Trailer manufacturing inspection types keyed by routing operation name. */
export const TRAILER_INSPECTION_TYPES: Record<string, string> = {
  Cutting: 'Dimensional Check — Cut Parts',
  Welding: 'Welding Inspection — RT / Visual',
  'Tank Assembly': 'Tank Leak Test — Hydrostatic',
  'Chassis Assembly': 'Chassis Fitment Check',
  'Axle Mounting': 'Axle Alignment Check',
  Painting: 'Paint Thickness Check — DFT',
  Testing: 'Pneumatic Pressure Test — 2.5 bar',
  Assembly: 'Final Assembly Inspection',
  'Final Inspection': 'Pre-Dispatch Quality Gate',
}

export function resolveInspectionType(operationName: string): string {
  return TRAILER_INSPECTION_TYPES[operationName] ?? `In-Process QC — ${operationName}`
}

export const QC_INSPECTORS = ['Pradeep Singh', 'Lata Menon', 'Meera Joshi', 'Rajesh Kumar'] as const

export const REWORK_TEAMS = ['Welding Team A', 'Welding Team B', 'Tank Fitment Crew', 'Paint Booth Crew'] as const
