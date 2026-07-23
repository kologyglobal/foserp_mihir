import type { BomTreeNode } from '@/types/manufacturingSetup'
import type { ProductionOrderBomSnapshotLine } from '@/types/manufacturingProduction'

/**
 * Builds outline indices for a multilevel BOM tree (1, 1.1, 1.2, 2, 2.1…).
 * Sibling order follows `sequence`, then stable id.
 */
export function buildBomOutlineIndexMap(tree: BomTreeNode[]): Map<string, string> {
  const map = new Map<string, string>()

  const walk = (nodes: BomTreeNode[], prefix: number[]) => {
    const ordered = [...nodes].sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence
      return a.id.localeCompare(b.id)
    })
    ordered.forEach((node, i) => {
      const path = [...prefix, i + 1]
      map.set(node.id, path.join('.'))
      if (node.children.length > 0) walk(node.children, path)
    })
  }

  walk(tree, [])
  return map
}

/** Preferred description text for a BOM line in detail views (not the item name). */
export function bomLineDescription(
  node: Pick<BomTreeNode, 'descriptionOverride' | 'notes' | 'specification'>,
): string {
  return node.descriptionOverride?.trim() || node.notes?.trim() || node.specification?.trim() || '—'
}

export type WoBomTreeNode = ProductionOrderBomSnapshotLine & {
  children: WoBomTreeNode[]
}

/**
 * Outline index for WO snapshot trees (same numbering as master BOM detail).
 */
export function buildWoBomOutlineIndexMap(tree: WoBomTreeNode[]): Map<string, string> {
  const map = new Map<string, string>()
  const walk = (nodes: WoBomTreeNode[], prefix: number[]) => {
    const ordered = [...nodes].sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence
      return a.id.localeCompare(b.id)
    })
    ordered.forEach((node, i) => {
      const path = [...prefix, i + 1]
      map.set(node.id, path.join('.'))
      if (node.children.length > 0) walk(node.children, path)
    })
  }
  walk(tree, [])
  return map
}

/**
 * Build a multilevel tree from flat WO BOM snapshot lines.
 * Prefers `parentLineId`; if parents are missing, nests by `level` (material-detail style).
 */
export function buildWoBomTree(lines: ProductionOrderBomSnapshotLine[]): WoBomTreeNode[] {
  if (lines.length === 0) return []

  const byId = new Map<string, WoBomTreeNode>()
  for (const line of lines) {
    byId.set(line.id, { ...line, children: [] })
  }

  const hasAnyParent = lines.some((l) => Boolean(l.parentLineId))
  if (hasAnyParent) {
    const roots: WoBomTreeNode[] = []
    for (const line of lines) {
      const node = byId.get(line.id)!
      if (line.parentLineId && byId.has(line.parentLineId)) {
        byId.get(line.parentLineId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    const sortRec = (nodes: WoBomTreeNode[]) => {
      nodes.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
      nodes.forEach((n) => sortRec(n.children))
    }
    sortRec(roots)
    return roots
  }

  // Fallback: nest by level when parentLineId was not snapshotted.
  const ordered = [...lines].sort(
    (a, b) => a.sequence - b.sequence || a.level - b.level || a.id.localeCompare(b.id),
  )
  const roots: WoBomTreeNode[] = []
  const stack: WoBomTreeNode[] = []
  for (const line of ordered) {
    const node = byId.get(line.id)!
    while (stack.length > 0 && stack[stack.length - 1]!.level >= line.level) {
      stack.pop()
    }
    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1]!.children.push(node)
    }
    stack.push(node)
  }
  return roots
}

export function flattenWoBomTree(
  nodes: WoBomTreeNode[],
  expanded: Set<string>,
  depth = 0,
): Array<{ node: WoBomTreeNode; depth: number }> {
  const out: Array<{ node: WoBomTreeNode; depth: number }> = []
  const ordered = [...nodes].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
  for (const node of ordered) {
    out.push({ node, depth })
    if (node.children.length > 0 && expanded.has(node.id)) {
      out.push(...flattenWoBomTree(node.children, expanded, depth + 1))
    }
  }
  return out
}

export function collectExpandableWoBomIds(nodes: WoBomTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: WoBomTreeNode[]) => {
    for (const n of list) {
      if (n.children.length > 0) {
        ids.push(n.id)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return ids
}
