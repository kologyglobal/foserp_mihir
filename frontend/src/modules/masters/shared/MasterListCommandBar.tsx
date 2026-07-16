import { useNavigate } from 'react-router-dom'
import { Download, LayoutGrid, Plus, Upload } from 'lucide-react'
import { ErpCommandBar, type ErpCommandAction } from '../../../components/erp/ErpCommandBar'

export interface MasterListCommandBarProps {
  createLabel: string
  createTo: string
  onImport?: () => void
  onExport?: () => void
  extraSecondary?: ErpCommandAction[]
  extraMore?: ErpCommandAction[]
  showHubLink?: boolean
}

export function MasterListCommandBar({
  createLabel,
  createTo,
  onImport,
  onExport,
  extraSecondary = [],
  extraMore = [],
  showHubLink = true,
}: MasterListCommandBarProps) {
  const navigate = useNavigate()

  return (
    <ErpCommandBar
      inline
      sticky={false}
      primaryAction={{
        id: 'create',
        label: createLabel,
        icon: Plus,
        onClick: () => navigate(createTo),
      }}
      secondaryActions={[
        {
          id: 'import',
          label: 'Import',
          icon: Upload,
          onClick: onImport ?? (() => window.alert('Download the import template from the register command bar, then upload CSV or Excel.')),
        },
        {
          id: 'export',
          label: 'Export',
          icon: Download,
          onClick: onExport ?? (() => window.alert('Export will download the current filtered register as CSV.')),
        },
        ...extraSecondary,
      ]}
      moreActions={[
        ...(showHubLink
          ? [{ id: 'hub', label: 'Master Data Hub', icon: LayoutGrid, onClick: () => navigate('/masters') }]
          : []),
        ...extraMore,
      ]}
    />
  )
}
