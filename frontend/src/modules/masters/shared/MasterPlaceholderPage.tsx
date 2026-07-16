import { Link, useNavigate } from 'react-router-dom'
import { Clock, Download, Plus, Upload } from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import {
  getMasterDefinitionById,
  getMasterGroupById,
  type MasterDefinition,
} from '../../../config/masterModuleStructure'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'

export function MasterPlaceholderPage({ masterId }: { masterId: string }) {
  const navigate = useNavigate()
  const master = getMasterDefinitionById(masterId)
  if (!master) {
    return (
      <OperationalPageShell title="Master not found" breadcrumbs={[{ label: 'Master Data', to: '/masters' }, { label: 'Not found' }]}>
        <Link to="/masters" className="text-sm font-semibold text-erp-primary">Back to Master Data</Link>
      </OperationalPageShell>
    )
  }

  const group = getMasterGroupById(master.groupId)
  const breadcrumbs = buildMasterBreadcrumbs(master.groupId, master.label)

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Master Data"
      title={master.label}
      description={master.description}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={master.path}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'new', label: 'New', icon: Plus, disabled: true, onClick: () => undefined }}
          secondaryActions={[
            { id: 'import', label: 'Import', icon: Upload, disabled: true, onClick: () => undefined },
            { id: 'export', label: 'Export', icon: Download, disabled: true, onClick: () => undefined },
          ]}
        />
      )}
    >
      <div className="masters-empty-state crm-masters-card rounded-lg border border-erp-border bg-erp-surface p-6 shadow-[var(--erp-shadow-card)]">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-erp-text">Register planned — UI shell ready</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-erp-muted">
              {master.label} is catalogued under <strong className="font-medium text-erp-text">{group?.title ?? master.groupId}</strong>.
              The enterprise master layout (Object Page, Smart Form, Smart Table, import/export, audit) will ship in the next sprint.
              Navigation, routing, permissions, and breadcrumbs are already wired.
            </p>
            <ul className="mt-4 space-y-1.5 text-[12px] text-erp-muted">
              <li>Excel / CSV import and export</li>
              <li>Created by, modified by, version, and change history</li>
              <li>View · Create · Edit · Delete · Approve permissions</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px] font-semibold"
                onClick={() => navigate('/masters')}
              >
                Back to Master Data Hub
              </button>
              <Link to="/masters" className="erp-btn erp-btn-ghost inline-flex h-9 items-center px-4 text-[13px] font-semibold">
                Browse all masters
              </Link>
            </div>
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}

export function masterPlaceholderRoute(masterId: string) {
  return <MasterPlaceholderPage masterId={masterId} />
}

export function resolvePlaceholderMaster(path: string): MasterDefinition | undefined {
  const master = getMasterDefinitionById(path)
  return master?.status === 'placeholder' ? master : undefined
}
