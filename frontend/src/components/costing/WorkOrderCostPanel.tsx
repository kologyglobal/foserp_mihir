import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { DetailGrid, DetailField } from '../masters/MasterLayouts'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { useCostingStore } from '../../store/costingStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { costSheetTotals } from '../../types/costing'
import { cn } from '../../utils/cn'

interface WorkOrderCostPanelProps {
  workOrderId: string
}

function CostRow({
  label,
  planned,
  actual,
  highlight,
}: {
  label: string
  planned: number
  actual: number
  highlight?: boolean
}) {
  const variance = actual - planned
  const variancePct = planned > 0 ? (variance / planned) * 100 : 0
  return (
    <tr className={highlight ? 'bg-slate-50 font-medium' : undefined}>
      <td className="px-4 py-2 text-sm text-slate-700">{label}</td>
      <td className="px-4 py-2 text-right font-mono text-sm">{formatCurrency(planned)}</td>
      <td className="px-4 py-2 text-right font-mono text-sm">{formatCurrency(actual)}</td>
      <td
        className={cn(
          'px-4 py-2 text-right font-mono text-sm',
          variance > 0 ? 'text-red-600' : variance < 0 ? 'text-emerald-600' : 'text-slate-500',
        )}
      >
        {variance >= 0 ? '+' : ''}
        {formatCurrency(variance)}
        <span className="ml-1 text-xs text-slate-400">({formatNumber(variancePct)}%)</span>
      </td>
    </tr>
  )
}

export function WorkOrderCostPanel({ workOrderId }: WorkOrderCostPanelProps) {
  const overheadPct = useCostingStore((s) => s.overheadPct)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const stockMovements = useInventoryStore((s) => s.stockMovements)

  const sheet = useMemo(
    () => useCostingStore.getState().getCostSheet(workOrderId),
    [workOrderId, overheadPct, workOrders, materialLines, jobCards, productionOperations, stockMovements],
  )

  const totals = useMemo(() => (sheet ? costSheetTotals(sheet) : null), [sheet])

  if (!sheet || !totals) {
    return <p className="p-6 text-sm text-slate-500">Cost sheet not available for this work order.</p>
  }

  return (
    <div className="space-y-4 p-4">
      <DetailGrid>
        <DetailField label="Cost Sheet ID" value={sheet.costSheetId} />
        <DetailField label="BOM Standard Cost" value={formatCurrency(totals.bomStandardCost)} />
        <DetailField label="Overhead Rate" value={`${overheadPct}%`} />
        <DetailField
          label="Variance vs Standard"
          value={
            <span className={totals.varianceAmount > 0 ? 'text-red-600' : 'text-emerald-600'}>
              {formatCurrency(totals.varianceAmount)} ({formatNumber(totals.variancePct)}%)
            </span>
          }
        />
      </DetailGrid>

      {(sheet.rolledUpChildActual > 0 || sheet.rolledUpChildPlanned > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sub-Assembly Roll-Up</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Child WO costs rolled into this sheet — Planned{' '}
            <span className="font-mono font-medium">{formatCurrency(sheet.rolledUpChildPlanned)}</span>
            {' · '}
            Actual{' '}
            <span className="font-mono font-medium">{formatCurrency(sheet.rolledUpChildActual)}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Planned vs Actual Cost</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-erp-border bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Element</th>
                <th className="px-4 py-2 text-right">Planned</th>
                <th className="px-4 py-2 text-right">Actual</th>
                <th className="px-4 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border">
              <CostRow label="Material" planned={totals.plannedMaterial} actual={totals.actualMaterial} />
              <CostRow label="Labor" planned={totals.plannedLabor} actual={totals.actualLabor} />
              <CostRow label="Machine" planned={totals.plannedMachine} actual={totals.actualMachine} />
              <CostRow
                label="Subcontract"
                planned={totals.plannedSubcontract}
                actual={totals.actualSubcontract}
              />
              <CostRow label="Overhead" planned={totals.plannedOverhead} actual={totals.actualOverhead} />
              {sheet.rolledUpChildPlanned > 0 || sheet.rolledUpChildActual > 0 ? (
                <CostRow
                  label="Sub-Assembly Roll-Up"
                  planned={sheet.rolledUpChildPlanned}
                  actual={sheet.rolledUpChildActual}
                />
              ) : null}
              <CostRow
                label="Total"
                planned={totals.totalPlanned}
                actual={totals.totalActual}
                highlight
              />
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
