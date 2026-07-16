import type { IntegrityReport } from '../../bootstrap/erpStartup'

export function IntegrityBanner({ report }: { report: IntegrityReport }) {
  if (report.ok) return null

  return (
    <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-900">
      <p className="font-semibold">Manufacturing data integrity errors ({report.errorCount})</p>
      <p className="mt-1 text-red-800">
        Work orders reference BOM, routing, or work center records that are missing. Production actions may fail until
        masters are restored.
      </p>
      <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-red-800">
        {report.issues
          .filter((i) => i.severity === 'error')
          .slice(0, 8)
          .map((issue) => (
            <li key={`${issue.code}-${issue.entityId}`}>{issue.message}</li>
          ))}
      </ul>
    </div>
  )
}
