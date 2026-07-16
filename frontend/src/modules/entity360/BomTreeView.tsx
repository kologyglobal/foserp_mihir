import { Link } from 'react-router-dom'
import type { BomLineEnriched } from '../../types/bom'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { cn } from '../../utils/cn'

function BomTreeNode({ node, depth = 0 }: { node: BomLineEnriched; depth?: number }) {
  return (
    <div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b border-erp-border/60 py-2 text-[13px]',
          depth > 0 && 'ml-4 border-l border-erp-border/40 pl-3',
        )}
        style={{ marginLeft: depth * 12 }}
      >
        <span className="font-mono font-semibold text-erp-primary">{node.itemCode}</span>
        <span className="text-erp-text">{node.itemName}</span>
        <span className="text-xs text-erp-muted">× {formatNumber(node.qtyPerProduct)}</span>
        <span className="rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] uppercase text-erp-muted">{node.sourceType}</span>
        <span className="ml-auto text-xs tabular-nums text-erp-muted">{formatCurrency(node.totalCost)}</span>
        <Link to={`/masters/items/${node.itemId}`} className="text-[11px] font-medium text-erp-primary hover:underline">
          Item 360
        </Link>
      </div>
      {node.children.map((child) => (
        <BomTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function BomTreeView({ tree }: { tree: BomLineEnriched[] }) {
  if (tree.length === 0) {
    return <p className="py-8 text-center text-[13px] text-erp-muted">No BOM structure lines</p>
  }
  return (
    <div className="rounded-erp border border-erp-border bg-erp-surface p-3">
      {tree.map((node) => (
        <BomTreeNode key={node.id} node={node} />
      ))}
    </div>
  )
}
