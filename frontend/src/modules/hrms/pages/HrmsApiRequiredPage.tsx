import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'

export function HrmsApiRequiredPage() {
  return (
    <OperationalPageShell title="HRMS" description="HRMS requires API mode (VITE_USE_API=true).">
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Enable API mode and sign in to manage employees, shifts, holidays, and roster.
      </div>
    </OperationalPageShell>
  )
}
