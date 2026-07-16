import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { TypeBadge } from '../ui/StatusBadge'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatCurrency } from '../../utils/formatters/currency'
import type { BomLineEnriched } from '../../types/bom'

const levelColors: Record<string, string> = {
  assembly: 'bg-blue-50 text-blue-700 border-blue-200',
  sub_assembly: 'bg-purple-50 text-purple-700 border-purple-200',
  component: 'bg-slate-50 text-slate-700 border-slate-200',
}

interface BomTreeProps {
  nodes: BomLineEnriched[]
  editable?: boolean
  onAddChild?: (parentLineId: string | null) => void
  onEditQty?: (line: BomLineEnriched) => void
  onRemove?: (lineId: string) => void
}

function TreeNode({
  node,
  depth,
  editable,
  onAddChild,
  onEditQty,
  onRemove,
}: {
  node: BomLineEnriched
  depth: number
  editable?: boolean
  onAddChild?: (parentLineId: string | null) => void
  onEditQty?: (line: BomLineEnriched) => void
  onRemove?: (lineId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 border-b border-erp-border px-3 py-1.5 hover:bg-slate-50',
          depth > 0 && 'ml-4 border-l-2 border-l-slate-200',
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-slate-400"
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="inline-block w-4" />
          )}
        </button>

        <span className={cn('rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', levelColors[node.nodeLevel])}>
          {node.nodeLevel.replace('_', ' ')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-slate-800">{node.itemCode}</span>
            <span className="text-sm text-slate-700">{node.itemName}</span>
            <TypeBadge value={node.itemType} color="gray" />
            <Badge color={node.sourceType === 'buy' ? 'blue' : node.sourceType === 'make' ? 'green' : 'orange'}>
              {node.sourceType === 'subcontract' ? 'subcontract' : node.sourceType}
            </Badge>
            {node.subAssemblyRule && (
              <Badge color="purple">{node.subAssemblyRule}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {node.specification}
            {node.issueWarehouseCode && (
              <span className="ml-2 text-slate-400">· Issue from {node.issueWarehouseCode}</span>
            )}
          </p>
        </div>

        <div className="hidden shrink-0 text-right text-xs lg:block">
          <p className="font-medium text-slate-800">{node.qtyPerProduct} {node.uomCode}</p>
          <p className="text-slate-500">Scrap {node.scrapPct}% · {node.leadTimeDays}d</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(node.totalCost)}</p>
          <p className="text-xs text-slate-500">@{formatCurrency(node.standardCost)}</p>
        </div>

        {editable && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="sm" title="Add child" onClick={() => onAddChild?.(node.id)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Edit qty" onClick={() => onEditQty?.(node)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Remove" onClick={() => onRemove?.(node.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            editable={editable}
            onAddChild={onAddChild}
            onEditQty={onEditQty}
            onRemove={onRemove}
          />
        ))}
    </div>
  )
}

export function BomTree({ nodes, editable, onAddChild, onEditQty, onRemove }: BomTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No BOM lines yet.
        {editable && onAddChild && (
          <div className="mt-3">
            <Button size="sm" onClick={() => onAddChild(null)}>
              <Plus className="h-4 w-4" /> Add Root Assembly
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="flex items-center gap-2 border-b border-erp-border bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="w-6" />
          <span className="flex-1">Item / Specification</span>
          <span className="hidden w-28 text-right lg:block">Qty / UOM</span>
          <span className="w-28 text-right">Total Cost</span>
          {editable && <span className="w-24" />}
        </div>
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            editable={editable}
            onAddChild={onAddChild}
            onEditQty={onEditQty}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}
