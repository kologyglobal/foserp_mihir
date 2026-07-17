import { cn } from '@/utils/cn'
import type { BomTravelerDocument, BomTravelerRow } from '@/types/bomTravelerPreview'

function fmtWt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

function LevelCell({ row }: { row: BomTravelerRow }) {
  if (row.kind === 'process') {
    return (
      <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
        PROC
      </span>
    )
  }
  return <span className="font-semibold tabular-nums">{row.level}</span>
}

export function BomTravelerPreviewTable({ document }: { document: BomTravelerDocument }) {
  const { meta, rows } = document
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-[#1e3a5f] px-4 py-3 text-white">
        <h2 className="text-[14px] font-bold tracking-wide">{meta.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-200">
          <span>
            <span className="text-slate-400">Quotation:</span> {meta.quotationRef}
          </span>
          <span>
            <span className="text-slate-400">Design Code:</span> {meta.designCode}
          </span>
          <span>
            <span className="text-slate-400">Shell:</span> {meta.shellMaterial}
          </span>
          <span>
            <span className="text-slate-400">MAWP:</span> {meta.mawp}
          </span>
          <span>
            <span className="text-slate-400">Capacity:</span> {meta.capacity}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-300">
          <span>
            BOM {meta.bomNumber} · {meta.revision}
          </span>
          <span>
            Product {meta.productCode} — {meta.productName}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="bg-[#1e3a5f] text-[10px] font-semibold uppercase tracking-wide text-white">
              <th className="border border-slate-500/40 px-2 py-2">Level</th>
              <th className="border border-slate-500/40 px-2 py-2">BOM No.</th>
              <th className="border border-slate-500/40 px-2 py-2">Parent</th>
              <th className="border border-slate-500/40 px-2 py-2">Item No.</th>
              <th className="border border-slate-500/40 px-2 py-2 min-w-[12rem]">Description / Part Name</th>
              <th className="border border-slate-500/40 px-2 py-2">Material / Grade</th>
              <th className="border border-slate-500/40 px-2 py-2 text-right">Qty</th>
              <th className="border border-slate-500/40 px-2 py-2">Unit</th>
              <th className="border border-slate-500/40 px-2 py-2 text-right">Weight (kg)</th>
              <th className="border border-slate-500/40 px-2 py-2 text-right">Total Wt (kg)</th>
              <th className="border border-slate-500/40 px-2 py-2 min-w-[9rem]">Dimensions / Spec</th>
              <th className="border border-slate-500/40 px-2 py-2 min-w-[11rem]">Production Process</th>
              <th className="border border-slate-500/40 px-2 py-2 min-w-[8rem]">Machine / Tool</th>
              <th className="border border-slate-500/40 px-2 py-2 min-w-[8rem]">QC / Inspection</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProc = row.kind === 'process'
              const indent = row.level != null ? Math.min(row.level, 3) * 10 : 18
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-slate-200',
                    isProc ? 'bg-amber-50' : row.level === 0 ? 'bg-slate-50 font-semibold' : 'bg-white',
                    row.level === 1 && !isProc && 'bg-sky-50/40',
                  )}
                >
                  <td className="border border-slate-100 px-2 py-1.5 text-center">
                    <LevelCell row={row} />
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-[10px]">{row.bomNo}</td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-[10px] text-slate-600">
                    {row.parentBomNo ?? '—'}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono">{row.itemNo}</td>
                  <td className="border border-slate-100 px-2 py-1.5" style={{ paddingLeft: 8 + indent }}>
                    {row.description}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5">{row.materialGrade}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {row.qty == null ? '—' : row.qty}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5">{row.unit}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {fmtWt(row.weightKg)}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">
                    {fmtWt(row.totalWeightKg)}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5 text-slate-700">{row.dimensionsSpec}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-slate-700">{row.productionProcess || '—'}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-slate-700">{row.machineTool || '—'}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-slate-700">{row.qcInspection || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
