import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Factory, Sparkles } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { ErpSmartSelect } from '@/components/erp/ErpSmartSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/design-system/components/Button'
import { DatePicker } from '@/design-system/components/DatePicker'
import { LoadingState } from '@/design-system/components/LoadingState'
import { fetchAdminUsersApi } from '@/services/api/adminApi'
import {
  convertSalesOrderLine,
  createManualWorkOrder,
  getProfileReadiness,
  getRouting,
  getRoutingVersion,
  getSalesOrderLineEligibility,
  listBoms,
  listEligibleSalesOrders,
  listProfiles,
  listRoutings,
} from '@/services/api/manufacturingApi'
import type { EligibleSalesOrder, SalesOrderLineEligibility } from '@/types/manufacturingProduction'
import { PRODUCTION_PRIORITY_LABELS, PRODUCTION_PRIORITY_VALUES } from '@/types/manufacturingProduction'
import type { ProductionPriority } from '@/types/manufacturingProduction'
import type { Bom, BomVersion, Profile, ProfileReadiness, Routing, RoutingVersion } from '@/types/manufacturingSetup'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { ProductionPageHeader, ReadinessChecklist, type ReadinessItem } from '../ui'
import { WorkOrderQuickSetupWizard } from './WorkOrderQuickSetupWizard'

type CreateMode = 'manual' | 'sales_order'

type VersionOption = {
  id: string
  label: string
  bomId?: string
  routingId?: string
  isDefault?: boolean
  isTemplate?: boolean
}

type PendingVersion = {
  id: string
  label: string
  bomId?: string
  routingId?: string
  kind: 'bom' | 'route'
}

type UserOption = { id: string; label: string }

const today = () => new Date().toISOString().slice(0, 10)
const defaultDue = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function bomVersionLabel(bom: Bom, version: Pick<BomVersion, 'versionNumber' | 'revisionCode' | 'status'>) {
  return `${bom.code} v${version.versionNumber}${version.revisionCode ? ` (${version.revisionCode})` : ''} — ${bom.name}`
}

function routingVersionLabel(
  routing: Pick<Routing, 'code' | 'name'>,
  version: Pick<RoutingVersion, 'versionNumber' | 'revisionCode' | 'lifecycleLabel' | 'status'>,
) {
  const status = version.lifecycleLabel ?? version.status
  return `${routing.code} v${version.versionNumber}${version.revisionCode ? ` (${version.revisionCode})` : ''} — ${routing.name} · ${status}`
}

/**
 * Manufacturing Readiness context panel — server-derived profile readiness for
 * the selected product ("Recommended from Manufacturing Profile").
 */
function ManufacturingReadinessPanel({
  productItemId,
  profile,
  bomVersionId,
  routingVersionId,
}: {
  productItemId: string
  profile: Profile | null
  bomVersionId: string
  routingVersionId: string
}) {
  const [loading, setLoading] = useState(false)
  const [readiness, setReadiness] = useState<ProfileReadiness | null>(null)

  useEffect(() => {
    if (!profile) {
      setReadiness(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void getProfileReadiness(profile.id)
      .then((r) => {
        if (!cancelled) setReadiness(r.data)
      })
      .catch(() => {
        if (!cancelled) setReadiness(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  if (!productItemId) {
    return (
      <div className="rounded-lg border border-erp-border bg-white p-4 text-[12px] text-erp-muted">
        Select an item to check manufacturing readiness — profile, BOM, routing and warehouses.
      </div>
    )
  }
  if (loading) return <LoadingState variant="card" />
  if (!profile) {
    return (
      <ReadinessChecklist
        title="Manufacturing Readiness"
        items={[
          {
            id: 'profile',
            label: 'Manufacturing Profile',
            state: 'missing',
            detail: 'No active profile for this item. Create one under Setup → Profiles before release.',
          },
        ]}
      />
    )
  }

  const checks = readiness?.checks
  const items: ReadinessItem[] = [
    {
      id: 'profile',
      label: 'Manufacturing Profile',
      state: 'ready',
      detail: `${profile.code} — ${profile.name}`,
    },
    {
      id: 'bom',
      label: 'BOM Version',
      state: bomVersionId ? 'ready' : checks?.hasDefaultBomVersion && checks.defaultBomVersionActive ? 'ready' : 'missing',
      detail: bomVersionId
        ? 'Selected for this work order — snapshotted at release.'
        : checks?.hasDefaultBomVersion
          ? checks.defaultBomVersionActive
            ? 'Active default version will be snapshotted at release.'
            : 'Default BOM version is not active.'
          : 'Select an active BOM version.',
    },
    {
      id: 'routing',
      label: 'Routing Version',
      state: routingVersionId
        ? 'ready'
        : checks?.hasDefaultRoutingVersion && checks.defaultRoutingVersionActive
          ? 'ready'
          : 'missing',
      detail: routingVersionId
        ? 'Selected for this work order — snapshotted at release.'
        : checks?.hasDefaultRoutingVersion
          ? checks.defaultRoutingVersionActive
            ? 'Active default version will be snapshotted at release.'
            : 'Default routing version is not active.'
          : 'Select an active routing version.',
    },
    {
      id: 'rm-warehouse',
      label: 'Raw Material Warehouse',
      state: checks?.hasProductionWarehouse ? 'ready' : 'missing',
    },
    {
      id: 'wip-warehouse',
      label: 'WIP Warehouse',
      state: checks?.hasWipWarehouse ? 'ready' : 'missing',
    },
    {
      id: 'fg-warehouse',
      label: 'Finished Goods Warehouse',
      state: checks?.hasFinishedGoodsWarehouse ? 'ready' : 'missing',
    },
  ]
  return (
    <div className="space-y-2">
      <ReadinessChecklist title="Manufacturing Readiness" items={items} />
      {readiness && !readiness.ready ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          You can still create a draft work order — missing setup blocks release, not draft creation.
        </p>
      ) : null}
    </div>
  )
}

type ExecutionSetupValue = {
  manufacturingProfileId: string
  bomVersionId: string
  routingVersionId: string
  plantCode: string
  supervisorId: string
  managerId: string
}

function ExecutionSetupSection({
  productItemId,
  productItemCode,
  productItemName,
  productUomId,
  value,
  onChange,
  onProfileResolved,
  users,
}: {
  productItemId: string
  productItemCode: string
  productItemName: string
  productUomId: string
  value: ExecutionSetupValue
  onChange: (next: Partial<ExecutionSetupValue>) => void
  onProfileResolved: (profile: Profile | null) => void
  users: UserOption[]
}) {
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [bomOptions, setBomOptions] = useState<VersionOption[]>([])
  const [routeOptions, setRouteOptions] = useState<VersionOption[]>([])
  const [pendingBoms, setPendingBoms] = useState<PendingVersion[]>([])
  const [pendingRoutes, setPendingRoutes] = useState<PendingVersion[]>([])

  useEffect(() => {
    if (!productItemId) {
      setProfiles([])
      setBomOptions([])
      setRouteOptions([])
      setPendingBoms([])
      setPendingRoutes([])
      onProfileResolved(null)
      onChange({
        manufacturingProfileId: '',
        bomVersionId: '',
        routingVersionId: '',
        plantCode: '',
      })
      return
    }

    let cancelled = false
    setLoadingSetup(true)
    void (async () => {
      try {
        const [profileRes, bomRes, itemRouteRes, allRouteRes] = await Promise.all([
          listProfiles({ productItemId, isActive: true, limit: 50 }),
          listBoms({ productItemId, limit: 50 }),
          listRoutings({ productItemId, isActive: true, limit: 50 }),
          listRoutings({ isActive: true, limit: 100 }),
        ])
        if (cancelled) return

        const nextProfiles = profileRes.data
        setProfiles(nextProfiles)
        const preferred = nextProfiles[0] ?? null
        onProfileResolved(preferred)

        const bomOpts: VersionOption[] = []
        const draftBoms: PendingVersion[] = []
        for (const bom of bomRes.data) {
          for (const version of bom.versions ?? []) {
            const label = bomVersionLabel(bom, version)
            if (version.status === 'ACTIVE') {
              bomOpts.push({
                id: version.id,
                bomId: bom.id,
                label,
                isDefault: preferred?.defaultBomVersionId === version.id,
              })
            } else if (version.status === 'DRAFT') {
              draftBoms.push({ id: version.id, bomId: bom.id, label, kind: 'bom' })
            }
          }
        }
        bomOpts.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)))
        setBomOptions(bomOpts)
        setPendingBoms(draftBoms)

        const routeMap = new Map<string, VersionOption>()
        const draftRoutes: PendingVersion[] = []
        const addRouteVersions = async (
          routing: Routing & { versions?: RoutingVersion[] },
          isTemplate: boolean,
        ) => {
          const versions =
            routing.versions?.length
              ? routing.versions
              : ((await getRouting(routing.id)).data.versions ?? [])
          for (const version of versions) {
            const label = routingVersionLabel(routing, version)
            if (version.status === 'ACTIVE') {
              routeMap.set(version.id, {
                id: version.id,
                routingId: routing.id,
                label,
                isDefault: preferred?.defaultRoutingVersionId === version.id,
                isTemplate,
              })
            } else if (version.status === 'DRAFT' && !isTemplate) {
              draftRoutes.push({ id: version.id, routingId: routing.id, label, kind: 'route' })
            }
          }
        }

        const templateRoutes = allRouteRes.data.filter((r) => !r.productItemId)
        await Promise.all([
          ...itemRouteRes.data.map((routing) => addRouteVersions(routing, false)),
          ...templateRoutes.map((routing) => addRouteVersions(routing, true)),
        ])

        if (preferred?.defaultRoutingVersionId && !routeMap.has(preferred.defaultRoutingVersionId)) {
          try {
            const versionRes = await getRoutingVersion(preferred.defaultRoutingVersionId)
            const version = versionRes.data
            const routingRes = await getRouting(version.routingId)
            routeMap.set(version.id, {
              id: version.id,
              routingId: version.routingId,
              label: routingVersionLabel(routingRes.data, version),
              isDefault: true,
              isTemplate: !routingRes.data.productItemId,
            })
          } catch {
            /* profile default may be missing */
          }
        }

        const routeOpts = [...routeMap.values()].sort((a, b) => {
          const score = (o: VersionOption) =>
            Number(Boolean(o.isDefault)) * 4 + Number(!o.isTemplate) * 2 + Number(Boolean(o.isTemplate))
          return score(b) - score(a)
        })
        setRouteOptions(routeOpts)
        setPendingRoutes(draftRoutes)

        if (cancelled) return
        onChange({
          manufacturingProfileId: preferred?.id ?? '',
          bomVersionId:
            (preferred?.defaultBomVersionId && bomOpts.some((o) => o.id === preferred.defaultBomVersionId)
              ? preferred.defaultBomVersionId
              : bomOpts[0]?.id) ?? '',
          routingVersionId:
            (preferred?.defaultRoutingVersionId &&
            routeOpts.some((o) => o.id === preferred.defaultRoutingVersionId)
              ? preferred.defaultRoutingVersionId
              : routeOpts.find((o) => !o.isTemplate)?.id ?? routeOpts[0]?.id) ?? '',
          plantCode: preferred?.plantCode ?? '',
        })
      } catch (e) {
        if (!cancelled) {
          notify.error(e instanceof Error ? e.message : 'Failed to load BOM / route options')
          setProfiles([])
          setBomOptions([])
          setRouteOptions([])
          setPendingBoms([])
          setPendingRoutes([])
          onProfileResolved(null)
        }
      } finally {
        if (!cancelled) setLoadingSetup(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productItemId, reloadKey])

  const selectedProfile = profiles.find((p) => p.id === value.manufacturingProfileId) ?? null
  const selectedBom = bomOptions.find((o) => o.id === value.bomVersionId) ?? null
  const selectedRoute = routeOptions.find((o) => o.id === value.routingVersionId) ?? null

  useEffect(() => {
    onProfileResolved(selectedProfile)
  }, [selectedProfile, onProfileResolved])

  const needsPrepare =
    profiles.length === 0 ||
    bomOptions.length === 0 ||
    routeOptions.length === 0 ||
    (selectedProfile &&
      (!selectedProfile.defaultBomVersionId || !selectedProfile.defaultRoutingVersionId))

  if (!productItemId) {
    return (
      <section className="rounded-lg border border-dashed border-erp-border bg-slate-50/60 p-4 text-[13px] text-erp-muted">
        Select an item to choose manufacturing profile, BOM and route for this work order.
      </section>
    )
  }

  if (loadingSetup) {
    return (
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <LoadingState variant="card" />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-erp-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-erp-text">Execution setup</h2>
          <p className="mt-0.5 text-[12px] text-erp-muted">
            Required to release and execute this work order. Selections are locked onto the WO at
            release — master BOM / route revisions later do not change it.
          </p>
        </div>
      </div>

      {needsPrepare ? (
        <div className="mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-[12px] font-semibold text-amber-950">Prepare manufacturing for this item</p>
          <ul className="list-inside list-disc space-y-0.5 text-[12px] text-amber-900">
            {profiles.length === 0 ? <li>No active manufacturing profile</li> : null}
            {bomOptions.length === 0 ? (
              <li>
                No ACTIVE BOM
                {pendingBoms.length > 0 ? ` (${pendingBoms.length} draft found)` : ''}
              </li>
            ) : null}
            {routeOptions.length === 0 ? (
              <li>
                No ACTIVE route
                {pendingRoutes.length > 0 ? ` (${pendingRoutes.length} draft found)` : ''}
              </li>
            ) : null}
          </ul>
          <p className="text-[12px] text-amber-900">
            Follow the guided steps to create what is missing. No separate setup training needed.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Start guided setup
            </Button>
            <Link
              to="/manufacturing/setup/boms"
              className="text-[11px] font-medium text-erp-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Advanced: BOMs
            </Link>
            <Link
              to="/manufacturing/setup/routings"
              className="text-[11px] font-medium text-erp-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Advanced: Routes
            </Link>
            <Link
              to="/manufacturing/profiles"
              className="text-[11px] font-medium text-erp-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Advanced: Profiles
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
          <p className="text-[12px] text-emerald-900">Execution setup looks ready for this item.</p>
          <Button size="sm" variant="secondary" onClick={() => setWizardOpen(true)}>
            Review / change setup
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Manufacturing Profile"
          required
          className="sm:col-span-2"
          hint="Controls warehouses, consumption and default BOM / route."
        >
          <Select
            value={value.manufacturingProfileId}
            onChange={(e) => {
              const nextId = e.target.value
              const next = profiles.find((p) => p.id === nextId) ?? null
              onChange({
                manufacturingProfileId: nextId,
                plantCode: next?.plantCode || value.plantCode,
                bomVersionId:
                  (next?.defaultBomVersionId && bomOptions.some((o) => o.id === next.defaultBomVersionId)
                    ? next.defaultBomVersionId
                    : value.bomVersionId) || value.bomVersionId,
                routingVersionId:
                  (next?.defaultRoutingVersionId &&
                  routeOptions.some((o) => o.id === next.defaultRoutingVersionId)
                    ? next.defaultRoutingVersionId
                    : value.routingVersionId) || value.routingVersionId,
              })
            }}
            disabled={profiles.length === 0}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="BOM Version"
          required
          hint="Active BOM for this item. Required quantities scale with planned qty."
        >
          <Select
            value={value.bomVersionId}
            onChange={(e) => onChange({ bomVersionId: e.target.value })}
            disabled={bomOptions.length === 0}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {bomOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.isDefault ? `${opt.label} · Profile default` : opt.label}
              </option>
            ))}
          </Select>
          {selectedBom?.bomId ? (
            <Link
              to={`/manufacturing/setup/boms/${selectedBom.bomId}`}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-erp-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open BOM <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </FormField>

        <FormField
          label="Route Version"
          required
          hint="Item route or shared template. Snapshotted at release."
        >
          <Select
            value={value.routingVersionId}
            onChange={(e) => onChange({ routingVersionId: e.target.value })}
            disabled={routeOptions.length === 0}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {routeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.isDefault
                  ? `${opt.label} · Profile default`
                  : opt.isTemplate
                    ? `${opt.label} · Template`
                    : opt.label}
              </option>
            ))}
          </Select>
          {selectedRoute?.routingId ? (
            <Link
              to={`/manufacturing/setup/routings/${selectedRoute.routingId}`}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-erp-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open route <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </FormField>

        <FormField label="Plant Code" hint="Defaults from the manufacturing profile.">
          <Input
            value={value.plantCode}
            onChange={(e) => onChange({ plantCode: e.target.value })}
            placeholder="e.g. PLANT-01"
          />
        </FormField>

        <FormField label="Supervisor">
          <Select value={value.supervisorId} onChange={(e) => onChange({ supervisorId: e.target.value })}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Manager">
          <Select value={value.managerId} onChange={(e) => onChange({ managerId: e.target.value })}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <WorkOrderQuickSetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        productItemId={productItemId}
        productItemCode={productItemCode}
        productItemName={productItemName}
        productUomId={productUomId}
        plantCode={value.plantCode}
        existingProfile={selectedProfile}
        preferredRoutingVersionId={value.routingVersionId || routeOptions[0]?.id}
        onCompleted={(result) => {
          onChange({
            manufacturingProfileId: result.manufacturingProfileId,
            bomVersionId: result.bomVersionId,
            routingVersionId: result.routingVersionId,
            plantCode: result.plantCode,
          })
          setReloadKey((k) => k + 1)
        }}
      />
    </section>
  )
}

/** Create Work Order — Manual entry, or convert a confirmed sales order line (Phase 2A). */
export function ApiWorkOrderCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useManufacturingWorkOrderPermissions()
  const initialMode: CreateMode = searchParams.get('mode') === 'sales_order' ? 'sales_order' : 'manual'
  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [saving, setSaving] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const [productItemId, setProductItemId] = useState('')
  const [productItemCode, setProductItemCode] = useState('')
  const [productItemName, setProductItemName] = useState('')
  const [productUomId, setProductUomId] = useState('')
  const [plannedQuantity, setPlannedQuantity] = useState('1')
  const [requiredCompletionDate, setRequiredCompletionDate] = useState(defaultDue())
  const [plannedStartDate, setPlannedStartDate] = useState(today())
  const [priority, setPriority] = useState<ProductionPriority>('MEDIUM')
  const [jobNumber, setJobNumber] = useState('')
  const [notes, setNotes] = useState('')

  const [execution, setExecution] = useState<ExecutionSetupValue>({
    manufacturingProfileId: '',
    bomVersionId: '',
    routingVersionId: '',
    plantCode: '',
    supervisorId: '',
    managerId: '',
  })
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])

  const [salesOrders, setSalesOrders] = useState<EligibleSalesOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState('')
  const [lines, setLines] = useState<SalesOrderLineEligibility[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState('')
  const [convertQty, setConvertQty] = useState('')
  const [convertDue, setConvertDue] = useState('')

  const prioritySelectOptions = useMemo(
    () =>
      PRODUCTION_PRIORITY_VALUES.map((p) => ({
        value: p,
        label: PRODUCTION_PRIORITY_LABELS[p],
        searchText: PRODUCTION_PRIORITY_LABELS[p].toLowerCase(),
      })),
    [],
  )

  const salesOrderSelectOptions = useMemo(
    () =>
      salesOrders.map((so) => {
        const company = so.customerName?.trim() || so.customerCode?.trim() || null
        const label = company
          ? `${so.salesOrderNo} · ${company} · ${so.lineCount} line(s)`
          : `${so.salesOrderNo} · ${so.lineCount} line(s)`
        return {
          value: so.id,
          label,
          searchText: `${so.salesOrderNo} ${company ?? ''}`.toLowerCase(),
          subtitle: company ?? undefined,
        }
      }),
    [salesOrders],
  )

  useEffect(() => {
    void fetchAdminUsersApi()
      .then((rows) =>
        setUsers(
          rows.map((u) => ({
            id: u.id,
            label: `${u.firstName} ${u.lastName}`.trim() || u.email,
          })),
        ),
      )
      .catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    if (mode !== 'sales_order') return
    let cancelled = false
    setLoadingOrders(true)
    listEligibleSalesOrders()
      .then((res) => {
        if (cancelled) return
        setSalesOrders(res.data)
      })
      .catch((e) => {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Failed to load sales orders')
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (!selectedSalesOrderId) return
    if (salesOrders.some((order) => order.id === selectedSalesOrderId)) return
    setSelectedSalesOrderId('')
    setSelectedLineId('')
    setLines([])
  }, [salesOrders, selectedSalesOrderId])

  const loadLines = useCallback((salesOrderId: string) => {
    setSelectedSalesOrderId(salesOrderId)
    setSelectedLineId('')
    setLines([])
    if (!salesOrderId) return
    setLoadingLines(true)
    getSalesOrderLineEligibility(salesOrderId)
      .then((res) => setLines(res.data.lines))
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load sales order lines'))
      .finally(() => setLoadingLines(false))
  }, [])

  const selectedLine = lines.find((l) => l.lineId === selectedLineId)
  const effectiveItemId = mode === 'manual' ? productItemId : (selectedLine?.resolvedItemId ?? '')

  useEffect(() => {
    if (!selectedLine) return
    setConvertQty(String(Number(selectedLine.remainingQuantity) || selectedLine.qty))
    setConvertDue(defaultDue())
  }, [selectedLine])

  const patchExecution = useCallback((next: Partial<ExecutionSetupValue>) => {
    setExecution((prev) => ({ ...prev, ...next }))
  }, [])

  const onProfileResolved = useCallback((profile: Profile | null) => {
    setResolvedProfile(profile)
  }, [])

  const validateExecution = () => {
    if (!execution.manufacturingProfileId) {
      notify.error('Manufacturing profile is required')
      return false
    }
    if (!execution.bomVersionId) {
      notify.error('BOM version is required')
      return false
    }
    if (!execution.routingVersionId) {
      notify.error('Route version is required')
      return false
    }
    return true
  }

  const submitManual = async () => {
    if (!productItemId || Number(plannedQuantity) <= 0 || !requiredCompletionDate) {
      notify.error('Item, planned quantity, and required completion date are required')
      return
    }
    if (!validateExecution()) return
    setSaving(true)
    try {
      const res = await createManualWorkOrder({
        productItemId,
        plannedQuantity: Number(plannedQuantity),
        requiredCompletionDate,
        plannedStartDate: plannedStartDate || undefined,
        priority,
        plantCode: execution.plantCode.trim() || undefined,
        managerId: execution.managerId || undefined,
        supervisorId: execution.supervisorId || undefined,
        manufacturingProfileId: execution.manufacturingProfileId,
        bomVersionId: execution.bomVersionId,
        routingVersionId: execution.routingVersionId,
        jobNumber: jobNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success('Work order created')
      navigate(`/manufacturing/work-orders/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create work order')
    } finally {
      setSaving(false)
    }
  }

  const submitConversion = async () => {
    if (!selectedSalesOrderId || !selectedLine || Number(convertQty) <= 0) {
      notify.error('Select an eligible sales order line and enter a quantity')
      return
    }
    if (!selectedLine.eligible) {
      notify.error('This line is not eligible for conversion')
      return
    }
    if (!validateExecution()) return
    setSaving(true)
    try {
      const res = await convertSalesOrderLine(selectedSalesOrderId, selectedLine.lineId, {
        quantity: Number(convertQty),
        requiredDate: convertDue || undefined,
        priority,
        plantCode: execution.plantCode.trim() || undefined,
        managerId: execution.managerId || undefined,
        supervisorId: execution.supervisorId || undefined,
        manufacturingProfileId: execution.manufacturingProfileId,
        bomVersionId: execution.bomVersionId,
        routingVersionId: execution.routingVersionId,
        notes: notes.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success('Sales order line converted to a work order')
      navigate(`/manufacturing/work-orders/${res.data.order.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Conversion failed')
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canCreateWo) {
    return (
      <ProductionPageHeader title="New Work Order" backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}>
        <EmptyState icon={Factory} title="Access denied" description="Missing work order create permission." />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="New Work Order"
      description="Create manually, or convert a confirmed sales order line into production."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: 'New' },
      ]}
      backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}
      primaryAction={{
        id: 'create',
        label: saving ? 'Working…' : 'Create Work Order',
        icon: CheckCircle2,
        onClick: () => void (mode === 'manual' ? submitManual() : submitConversion()),
        disabled: saving,
      }}
      secondaryActions={[{ id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/work-orders') }]}
    >
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <div className="flex gap-1 rounded-lg border border-erp-border bg-white p-1" role="tablist" aria-label="Work order source">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              onClick={() => setMode('manual')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition',
                mode === 'manual' ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              Manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'sales_order'}
              onClick={() => setMode('sales_order')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition',
                mode === 'sales_order' ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              From Sales Order
            </button>
          </div>

          {mode === 'manual' ? (
            <div className="space-y-3">
              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-erp-text">Item & quantity</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label="Item"
                    required
                    className="sm:col-span-2"
                    hint="Finished goods, assemblies, and sub-assemblies only."
                  >
                    <ItemLookupSelect
                      value={productItemId}
                      allowEmpty
                      itemTypes={['finished_good', 'sub_assembly']}
                      placeholder="Search FG / assembly / sub-assembly…"
                      onChange={(sel) => {
                        setProductItemId(sel?.itemId ?? '')
                        setProductItemCode(sel?.itemCode ?? '')
                        setProductItemName(sel?.itemName ?? '')
                        setProductUomId(sel?.uomId ?? '')
                      }}
                    />
                  </FormField>
                  <FormField label="Planned Quantity" required>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={plannedQuantity}
                      onChange={(e) => setPlannedQuantity(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Priority">
                    <ErpSmartSelect
                      options={prioritySelectOptions}
                      value={priority}
                      onChange={(next) => {
                        if (next) setPriority(next as ProductionPriority)
                      }}
                      placeholder={SELECT_PLACEHOLDER}
                      appearance="dropdown"
                    />
                  </FormField>
                  <FormField label="Planned Start Date">
                    <DatePicker value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} />
                  </FormField>
                  <FormField label="Required Completion Date" required>
                    <DatePicker
                      value={requiredCompletionDate}
                      onChange={(e) => setRequiredCompletionDate(e.target.value)}
                    />
                  </FormField>
                </div>
              </section>

              <ExecutionSetupSection
                productItemId={productItemId}
                productItemCode={productItemCode}
                productItemName={productItemName}
                productUomId={productUomId}
                value={execution}
                onChange={patchExecution}
                onProfileResolved={onProfileResolved}
                users={users}
              />

              <section className="rounded-lg border border-erp-border bg-white p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-erp-text"
                  onClick={() => setShowOptional((v) => !v)}
                  aria-expanded={showOptional}
                >
                  Optional details
                  <span className="text-[11px] font-medium text-erp-muted">{showOptional ? 'Hide' : 'Show'}</span>
                </button>
                {showOptional ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <FormField label="Job Number">
                      <Input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
                    </FormField>
                    <FormField label="Notes" className="sm:col-span-2">
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </FormField>
                  </div>
                ) : null}
              </section>
            </div>
          ) : (
            <section className="space-y-3">
              <div className="rounded-lg border border-erp-border bg-white p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-erp-text">1. Select sales order</h2>
                <FormField
                  label="Sales Order"
                  required
                  hint="Only confirmed / in-production sales orders with remaining convertible quantity are listed."
                >
                  {loadingOrders ? (
                    <p className="text-[12px] text-erp-muted">Loading sales orders…</p>
                  ) : (
                    <ErpSmartSelect
                      options={salesOrderSelectOptions}
                      value={selectedSalesOrderId}
                      onChange={(next) => void loadLines(next)}
                      placeholder={SELECT_PLACEHOLDER}
                      allowEmpty
                      appearance="dropdown"
                      emptyMessage="No sales orders match"
                    />
                  )}
                  {!loadingOrders && salesOrders.length === 0 ? (
                    <p className="mt-1 text-[12px] text-erp-muted">No confirmed / in-production sales orders found.</p>
                  ) : null}
                </FormField>
              </div>

              {selectedSalesOrderId ? (
                <div className="rounded-lg border border-erp-border bg-white p-4">
                  <h2 className="mb-3 text-[13px] font-semibold text-erp-text">2. Choose line</h2>
                  {loadingLines ? (
                    <LoadingState variant="table" rows={3} />
                  ) : lines.length === 0 ? (
                    <p className="text-[13px] text-erp-muted">No lines found on this sales order.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr>
                            <th />
                            <th>Line</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Remaining</th>
                            <th>Eligibility</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.lineId} className={cn(!line.eligible && 'opacity-80')}>
                              <td>
                                <input
                                  type="radio"
                                  name="line"
                                  checked={selectedLineId === line.lineId}
                                  onChange={() => setSelectedLineId(line.lineId)}
                                />
                              </td>
                              <td>
                                <div className="font-medium">{line.productOrItem || line.resolvedItemCode || '—'}</div>
                                {line.description ? <div className="text-erp-muted">{line.description}</div> : null}
                              </td>
                              <td className="text-right tabular-nums">
                                {line.qty} {line.uom}
                              </td>
                              <td className="text-right tabular-nums">{line.remainingQuantity}</td>
                              <td>
                                {line.eligible ? (
                                  <span className="font-semibold text-emerald-700">Eligible</span>
                                ) : (
                                  <div className="max-w-[280px]">
                                    <span className="font-semibold text-rose-700">Blocked</span>
                                    {line.reasons.length > 0 ? (
                                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] font-normal text-rose-700/90">
                                        {line.reasons.map((reason) => (
                                          <li key={reason}>{reason}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {selectedLine ? (
                <>
                  <div className="rounded-lg border border-erp-border bg-white p-4">
                    <h2 className="mb-3 text-[13px] font-semibold text-erp-text">3. Convert quantity</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Quantity to Convert" required>
                        <Input
                          type="number"
                          min={0.001}
                          step="any"
                          value={convertQty}
                          onChange={(e) => setConvertQty(e.target.value)}
                        />
                      </FormField>
                      <FormField label="Required Date">
                        <DatePicker value={convertDue} onChange={(e) => setConvertDue(e.target.value)} />
                      </FormField>
                      <FormField label="Priority">
                        <ErpSmartSelect
                          options={prioritySelectOptions}
                          value={priority}
                          onChange={(next) => {
                            if (next) setPriority(next as ProductionPriority)
                          }}
                          placeholder={SELECT_PLACEHOLDER}
                          appearance="dropdown"
                        />
                      </FormField>
                      <FormField label="Notes">
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </FormField>
                    </div>
                    {!selectedLine.eligible ? (
                      <p className="mt-2 text-[12px] font-medium text-rose-700">{selectedLine.reasons.join('; ')}</p>
                    ) : null}
                  </div>

                  <ExecutionSetupSection
                    productItemId={selectedLine.resolvedItemId ?? ''}
                    productItemCode={selectedLine.resolvedItemCode ?? ''}
                    productItemName={selectedLine.productOrItem ?? selectedLine.resolvedItemCode ?? ''}
                    productUomId=""
                    value={execution}
                    onChange={patchExecution}
                    onProfileResolved={onProfileResolved}
                    users={users}
                  />
                </>
              ) : null}
            </section>
          )}
        </div>
        <div className="space-y-3 lg:col-span-4">
          <ManufacturingReadinessPanel
            productItemId={effectiveItemId}
            profile={resolvedProfile}
            bomVersionId={execution.bomVersionId}
            routingVersionId={execution.routingVersionId}
          />
          <div className="rounded-lg border border-erp-border bg-white p-4 text-[12px] text-erp-muted">
            <p className="font-semibold text-erp-text">What happens next</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1">
              <li>Draft is created with the selected profile, BOM and route.</li>
              <li>Release snapshots that BOM and route onto this WO (immutable).</li>
              <li>Material requirements sync for reservation and issue.</li>
              <li>Start production once readiness passes.</li>
            </ol>
          </div>
        </div>
      </div>
    </ProductionPageHeader>
  )
}
