import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { formatCurrency } from '../../utils/formatters/currency'
import type { BomLineEnriched } from '../../types/bom'

interface BomCostSummaryProps {
  totalCost: number
  flatLines: BomLineEnriched[]
  productPrice?: number
}

export function BomCostSummary({ totalCost, flatLines, productPrice }: BomCostSummaryProps) {
  const buyCost = flatLines
    .filter((l) => l.sourceType === 'buy' && l.children.length === 0)
    .reduce((s, l) => s + l.totalCost, 0)
  const makeCost = flatLines
    .filter((l) => l.sourceType === 'make' && l.children.length === 0)
    .reduce((s, l) => s + l.totalCost, 0)
  const subcontractCost = flatLines
    .filter((l) => l.sourceType === 'subcontract' && l.children.length === 0)
    .reduce((s, l) => s + l.totalCost, 0)

  const margin = productPrice ? productPrice - totalCost : null
  const marginPct = margin && productPrice ? ((margin / productPrice) * 100).toFixed(1) : null

  const byType = [
    { label: 'Buy (Bought Out / RM)', value: buyCost, color: 'text-blue-600' },
    { label: 'Make (Fabrication)', value: makeCost, color: 'text-emerald-600' },
    { label: 'Subcontract', value: subcontractCost, color: 'text-orange-600' },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>BOM Cost Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-xs uppercase text-slate-500">Total BOM Cost / Unit</p>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalCost)}</p>
          </div>
          <div className="space-y-2">
            {byType.map((t) => (
              <div key={t.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{t.label}</span>
                <span className={`font-semibold ${t.color}`}>{formatCurrency(t.value)}</span>
              </div>
            ))}
          </div>
          {productPrice && margin !== null && (
            <div className="mt-4 border-t border-erp-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Product Std Price</span>
                <span className="font-medium">{formatCurrency(productPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Gross Margin</span>
                <span className={`font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(margin)} ({marginPct}%)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cost by Source Type</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {byType.map((t) => {
              const pct = totalCost > 0 ? (t.value / totalCost) * 100 : 0
              return (
                <div key={t.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-medium">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${t.color.replace('text-', 'bg-')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {flatLines.filter((l) => l.children.length === 0).length} component lines · Max lead time{' '}
            {Math.max(...flatLines.map((l) => l.leadTimeDays), 0)} days
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
