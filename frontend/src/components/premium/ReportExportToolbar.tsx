import { Download } from 'lucide-react'
import { Button } from '../ui/Button'

export function ReportExportToolbar({ onExport, label = 'Export' }: { onExport?: () => void; label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={onExport} className="gap-1.5">
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
