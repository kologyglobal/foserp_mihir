import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { AccountHierarchyNode } from '../../../types/chartOfAccounts'
import { cn } from '../../../utils/cn'
import { SearchInput } from '../../ui/SearchInput'

function filterTree(nodes: AccountHierarchyNode[], q: string): AccountHierarchyNode[] {
  if (!q.trim()) return nodes
  const query = q.toLowerCase()
  const walk = (list: AccountHierarchyNode[]): AccountHierarchyNode[] =>
    list
      .map((n) => {
        const children = walk(n.children)
        const selfMatch = `${n.code} ${n.name}`.toLowerCase().includes(query)
        if (selfMatch || children.length) return { ...n, children }
        return null
      })
      .filter(Boolean) as AccountHierarchyNode[]
  return walk(nodes)
}

function collectIds(nodes: AccountHierarchyNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...collectIds(n.children)])
}

function TreeNode({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
}: {
  node: AccountHierarchyNode
  depth: number
  selectedId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  const isOpen = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const selected = selectedId === node.id

  return (
    <div>
      <div
        className={cn(
          'group flex w-full items-center gap-0.5 rounded-md pr-1 text-left text-[12px]',
          selected ? 'bg-erp-primary-soft text-erp-primary' : 'hover:bg-erp-surface-alt',
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          className="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded text-erp-muted"
          aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={() => onToggle(node.id)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
          onClick={() => onSelect(node.id)}
          aria-current={selected ? 'true' : undefined}
        >
          <span className="truncate font-medium tabular-nums">{node.code}</span>
          <span className="truncate text-erp-muted group-hover:text-erp-text">{node.name}</span>
          <span className="ml-auto shrink-0 rounded bg-erp-surface-alt px-1 text-[10px] font-semibold text-erp-muted">
            {node.childCount}
          </span>
        </button>
      </div>
      {hasChildren && isOpen
        ? node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export function AccountHierarchyTree({
  nodes,
  selectedId,
  expandedIds,
  onExpandedChange,
  onSelect,
  className,
}: {
  nodes: AccountHierarchyNode[]
  selectedId: string | null
  expandedIds: string[]
  onExpandedChange: (ids: string[]) => void
  onSelect: (id: string | null) => void
  className?: string
}) {
  const [treeSearch, setTreeSearch] = useState('')
  const filtered = useMemo(() => filterTree(nodes, treeSearch), [nodes, treeSearch])
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds])

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onExpandedChange([...next])
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col border-r border-erp-border bg-erp-surface', className)}>
      <div className="shrink-0 space-y-2 border-b border-erp-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-erp-text">Account Groups</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
              title="Expand all"
              aria-label="Expand all account groups"
              onClick={() => onExpandedChange(collectIds(nodes))}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
              title="Collapse all"
              aria-label="Collapse all account groups"
              onClick={() => onExpandedChange(nodes.map((n) => n.id))}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <SearchInput
          value={treeSearch}
          onChange={setTreeSearch}
          placeholder="Search groups…"
          className="w-full"
          size="sm"
        />
        {selectedId ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-primary hover:underline"
            onClick={() => onSelect(null)}
          >
            Clear group filter
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" role="tree" aria-label="Account hierarchy">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-erp-muted">No groups match.</p>
        ) : (
          filtered.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={toggle}
              onSelect={(id) => onSelect(id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
