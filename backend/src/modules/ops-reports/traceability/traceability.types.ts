export type TraceabilityEntityType =
  | 'SALES_ORDER'
  | 'WORK_ORDER'
  | 'FG_RECEIPT'
  | 'DISPATCH'
  | 'DISPATCH_REQUIREMENT'
  | 'PICK_LIST'
  | 'PACKING_SESSION'
  | 'DELIVERY_CHALLAN'
  | 'INSPECTION'
  | 'NCR'

export interface TraceabilitySearchResult {
  entityType: TraceabilityEntityType
  entityId: string
  label: string
  subtitle: string
}

export interface TraceabilityNode {
  entityType: TraceabilityEntityType
  entityId: string
  label: string
  status: string | null
  detail: Record<string, unknown>
}

export interface TraceabilityEdge {
  from: string
  to: string
  relationship: string
}

export interface TraceabilityLineage {
  root: TraceabilityNode
  nodes: TraceabilityNode[]
  edges: TraceabilityEdge[]
  warnings: string[]
}

export function nodeRef(node: Pick<TraceabilityNode, 'entityType' | 'entityId'>): string {
  return `${node.entityType}:${node.entityId}`
}
