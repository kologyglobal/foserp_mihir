import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Factory, Package, Route as RouteIcon, Sparkles } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  activateBomVersion,
  createBom,
  createBomLine,
  createBomVersion,
  createProfile,
  getBomVersion,
  listBoms,
  listRoutings,
  getRouting,
  updateProfile,
} from '@/services/api/manufacturingApi'
import type { Profile, Routing, RoutingVersion } from '@/types/manufacturingSetup'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export type QuickSetupResult = {
  manufacturingProfileId: string
  bomVersionId: string
  routingVersionId: string
  plantCode: string
}

type RouteChoice = {
  id: string
  routingId: string
  label: string
  isTemplate?: boolean
}

type StepId = 'overview' | 'bom' | 'route' | 'profile' | 'done'

const STEPS: Array<{ id: StepId; label: string; icon: typeof Package }> = [
  { id: 'overview', label: 'What we need', icon: Sparkles },
  { id: 'bom', label: 'Bill of materials', icon: Package },
  { id: 'route', label: 'Production route', icon: RouteIcon },
  { id: 'profile', label: 'Manufacturing profile', icon: Factory },
  { id: 'done', label: 'Ready', icon: Check },
]

function sanitizeCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function routingLabel(
  routing: Pick<Routing, 'code' | 'name'>,
  version: Pick<RoutingVersion, 'versionNumber' | 'revisionCode' | 'lifecycleLabel' | 'status'>,
) {
  const status = version.lifecycleLabel ?? version.status
  return `${routing.code} v${version.versionNumber}${version.revisionCode ? ` (${version.revisionCode})` : ''} — ${routing.name} · ${status}`
}

type Props = {
  open: boolean
  onClose: () => void
  productItemId: string
  productItemCode: string
  productItemName: string
  productUomId: string
  plantCode: string
  existingProfile: Profile | null
  preferredRoutingVersionId?: string
  onCompleted: (result: QuickSetupResult) => void
}

/**
 * Guided popup so shop/planning users can create BOM + route + profile for an item
 * without leaving New Work Order.
 */
export function WorkOrderQuickSetupWizard({
  open,
  onClose,
  productItemId,
  productItemCode,
  productItemName,
  productUomId,
  plantCode,
  existingProfile,
  preferredRoutingVersionId,
  onCompleted,
}: Props) {
  const perms = useManufacturingSetupPermissions()
  const [step, setStep] = useState<StepId>('overview')
  const [busy, setBusy] = useState(false)

  const [bomVersionId, setBomVersionId] = useState('')
  const [bomStatus, setBomStatus] = useState<'none' | 'draft' | 'active'>('none')
  const [draftBomId, setDraftBomId] = useState('')
  const [draftVersionId, setDraftVersionId] = useState('')

  const [componentItemId, setComponentItemId] = useState('')
  const [componentUomId, setComponentUomId] = useState('')
  const [componentQty, setComponentQty] = useState('1')
  const [componentLabel, setComponentLabel] = useState('')

  const [routeChoices, setRouteChoices] = useState<RouteChoice[]>([])
  const [routingVersionId, setRoutingVersionId] = useState('')

  const [profilePlantCode, setProfilePlantCode] = useState(plantCode)
  const [result, setResult] = useState<QuickSetupResult | null>(null)

  const itemTitle = productItemName || productItemCode || 'Selected item'
  const codeBase = sanitizeCode(productItemCode || productItemId.slice(0, 8)) || 'ITEM'

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  useEffect(() => {
    if (!open) return
    setStep('overview')
    setBusy(false)
    setBomVersionId('')
    setBomStatus('none')
    setDraftBomId('')
    setDraftVersionId('')
    setComponentItemId('')
    setComponentUomId('')
    setComponentQty('1')
    setComponentLabel('')
    setRoutingVersionId(preferredRoutingVersionId || '')
    setProfilePlantCode(plantCode)
    setResult(null)

    let cancelled = false
    void (async () => {
      try {
        const [bomRes, itemRoutes, allRoutes] = await Promise.all([
          listBoms({ productItemId, limit: 50 }),
          listRoutings({ productItemId, isActive: true, limit: 50 }),
          listRoutings({ isActive: true, limit: 100 }),
        ])
        if (cancelled) return

        let activeBom = ''
        let draftBom = ''
        let draftVer = ''
        for (const bom of bomRes.data) {
          for (const version of bom.versions ?? []) {
            if (version.status === 'ACTIVE' && !activeBom) {
              activeBom = version.id
            } else if (version.status === 'DRAFT' && !draftVer) {
              draftBom = bom.id
              draftVer = version.id
            }
          }
        }
        if (activeBom) {
          setBomVersionId(activeBom)
          setBomStatus('active')
        } else if (draftVer) {
          setDraftBomId(draftBom)
          setDraftVersionId(draftVer)
          setBomStatus('draft')
        } else {
          setBomStatus('none')
        }

        const choices: RouteChoice[] = []
        const add = async (routing: Routing, isTemplate: boolean) => {
          const detail = routing.versions?.length ? routing : (await getRouting(routing.id)).data
          for (const version of detail.versions ?? []) {
            if (version.status !== 'ACTIVE') continue
            choices.push({
              id: version.id,
              routingId: routing.id,
              label: routingLabel(routing, version),
              isTemplate,
            })
          }
        }
        const templates = allRoutes.data.filter((r) => !r.productItemId)
        await Promise.all([
          ...itemRoutes.data.map((r) => add(r, false)),
          ...templates.map((r) => add(r, true)),
        ])
        const unique = new Map(choices.map((c) => [c.id, c]))
        const list = [...unique.values()]
        setRouteChoices(list)
        setRoutingVersionId((prev) => prev || preferredRoutingVersionId || list[0]?.id || '')
      } catch (e) {
        if (!cancelled) notify.error(e instanceof Error ? e.message : 'Unable to load setup options')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, productItemId, plantCode, preferredRoutingVersionId])

  const checklist = useMemo(
    () => [
      {
        id: 'bom',
        label: 'Active BOM',
        ready: bomStatus === 'active' || Boolean(bomVersionId),
        detail:
          bomStatus === 'active'
            ? 'Already active for this item'
            : bomStatus === 'draft'
              ? 'Draft found — we will add a line if needed and activate it'
              : 'We will create a BOM, add one component, and activate it',
      },
      {
        id: 'route',
        label: 'Production route',
        ready: Boolean(routingVersionId),
        detail: routingVersionId
          ? 'Template or item route selected'
          : 'Pick a certified route (shared templates work)',
      },
      {
        id: 'profile',
        label: 'Manufacturing profile',
        ready: Boolean(existingProfile?.defaultBomVersionId && existingProfile.defaultRoutingVersionId),
        detail: existingProfile
          ? 'Profile exists — we will link BOM and route'
          : 'We will create a profile for warehouses and defaults',
      },
    ],
    [bomStatus, bomVersionId, routingVersionId, existingProfile],
  )

  const goNext = () => {
    const order: StepId[] = ['overview', 'bom', 'route', 'profile', 'done']
    const idx = order.indexOf(step)
    if (idx < order.length - 1) setStep(order[idx + 1])
  }

  const goBack = () => {
    const order: StepId[] = ['overview', 'bom', 'route', 'profile', 'done']
    const idx = order.indexOf(step)
    if (idx > 0) setStep(order[idx - 1])
  }

  const ensureBomActive = async (): Promise<string> => {
    if (bomVersionId && bomStatus === 'active') return bomVersionId

    if (!productUomId) {
      throw new Error('This item has no base UOM. Set UOM on the item in Item Master first.')
    }
    if (!perms.canManageBom && bomStatus === 'none') {
      throw new Error('You do not have permission to create BOMs.')
    }
    if (!perms.canActivateBom && bomStatus !== 'active') {
      throw new Error('You do not have permission to activate BOMs.')
    }

    let versionId = draftVersionId
    let bomId = draftBomId

    if (bomStatus === 'none') {
      const bom = await createBom({
        code: `BOM-${codeBase}`.slice(0, 64),
        name: `${itemTitle} BOM`.slice(0, 300),
        productItemId,
      })
      bomId = bom.data.id
      const version = await createBomVersion(bomId, {
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        baseQuantity: 1,
        baseUomId: productUomId,
        expectedYieldPercent: 100,
      })
      versionId = version.data.id
    }

    if (!versionId) throw new Error('Could not resolve a BOM version to activate.')

    const existing = await getBomVersion(versionId)
    const hasLines = (existing.data.lines?.length ?? 0) > 0
    if (!hasLines) {
      if (!componentItemId || !componentUomId) {
        throw new Error('Add at least one component item and quantity for the BOM.')
      }
      await createBomLine(versionId, {
        itemId: componentItemId,
        quantity: Number(componentQty) || 1,
        uomId: componentUomId,
        quantityBasis: 'PER_UNIT',
        makeOrBuy: 'BUY',
        lineType: 'RAW_MATERIAL',
        scrapPercent: 0,
        yieldPercent: 100,
      })
    }

    const activated = await activateBomVersion(versionId)
    const activeId = activated.data.id
    setBomVersionId(activeId)
    setBomStatus('active')
    return activeId
  }

  const finishSetup = async () => {
    setBusy(true)
    try {
      if (!routingVersionId) throw new Error('Select a production route first.')
      const activeBomId = bomVersionId && bomStatus === 'active' ? bomVersionId : await ensureBomActive()

      let profile = existingProfile
      if (!profile) {
        if (!perms.canManageProfile) throw new Error('You do not have permission to create profiles.')
        const created = await createProfile({
          code: `PROF-${codeBase}-${Date.now().toString(36).slice(-4)}`.slice(0, 64),
          name: `${itemTitle} Production`.slice(0, 300),
          productItemId,
          productionType: 'ASSEMBLY',
          executionMode: 'DETAILED',
          defaultBomVersionId: activeBomId,
          defaultRoutingVersionId: routingVersionId,
          plantCode: profilePlantCode.trim() || undefined,
          materialConsumptionMethod: 'BACKFLUSH',
          wipTrackingMethod: 'LOGICAL_WIP',
          outputTrackingMethod: 'QUANTITY',
          isActive: true,
        })
        profile = created.data
      } else {
        if (!perms.canManageProfile) throw new Error('You do not have permission to update profiles.')
        const updated = await updateProfile(profile.id, {
          defaultBomVersionId: activeBomId,
          defaultRoutingVersionId: routingVersionId,
          ...(profilePlantCode.trim() ? { plantCode: profilePlantCode.trim() } : {}),
        })
        profile = updated.data
      }

      const payload: QuickSetupResult = {
        manufacturingProfileId: profile.id,
        bomVersionId: activeBomId,
        routingVersionId,
        plantCode: profile.plantCode ?? profilePlantCode,
      }
      setResult(payload)
      setStep('done')
      notify.success('Manufacturing setup is ready for this work order')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  const onPrimary = async () => {
    if (step === 'overview') {
      goNext()
      return
    }
    if (step === 'bom') {
      if (bomStatus === 'active' && bomVersionId) {
        goNext()
        return
      }
      setBusy(true)
      try {
        await ensureBomActive()
        notify.success('BOM activated')
        goNext()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'BOM step failed')
      } finally {
        setBusy(false)
      }
      return
    }
    if (step === 'route') {
      if (!routingVersionId) {
        notify.error('Select a route to continue')
        return
      }
      goNext()
      return
    }
    if (step === 'profile') {
      await finishSetup()
      return
    }
    if (step === 'done' && result) {
      onCompleted(result)
      onClose()
    }
  }

  const primaryLabel =
    step === 'overview'
      ? 'Start setup'
      : step === 'bom'
        ? bomStatus === 'active'
          ? 'Continue'
          : 'Save & activate BOM'
        : step === 'route'
          ? 'Continue'
          : step === 'profile'
            ? 'Create profile & finish'
            : 'Use this setup'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick manufacturing setup"
      description={`Prepare ${itemTitle} so you can create and run a work order — no separate training path needed.`}
      size="lg"
      closeDisabled={busy}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" disabled={busy || step === 'overview' || step === 'done'} onClick={goBack}>
            Back
          </Button>
          <div className="flex gap-2">
            {step !== 'done' ? (
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => void onPrimary()}>
              {busy ? 'Working…' : primaryLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <ol className="flex flex-wrap gap-1.5" aria-label="Setup steps">
          {STEPS.map((s, index) => {
            const done = index < stepIndex
            const current = s.id === step
            return (
              <li
                key={s.id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  current && 'bg-erp-primary text-white',
                  done && !current && 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
                  !done && !current && 'bg-slate-100 text-erp-muted',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{index + 1}</span>}
                {s.label}
                {index < STEPS.length - 1 ? <ChevronRight className="h-3 w-3 opacity-50" /> : null}
              </li>
            )
          })}
        </ol>

        {step === 'overview' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-text">
              We will walk through three short steps. When finished, this work order can be created and
              later released with the correct BOM and route locked in.
            </p>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px]',
                    item.ready ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70',
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold text-erp-text">
                    {item.ready ? (
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white">
                        !
                      </span>
                    )}
                    {item.label}
                  </div>
                  <p className="mt-0.5 text-erp-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'bom' ? (
          <div className="space-y-3">
            {bomStatus === 'active' ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                An active BOM already exists for this item. Continue to confirm the production route.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-erp-text">
                  {bomStatus === 'draft'
                    ? 'A draft BOM exists. Add one component line, then we activate it for production.'
                    : 'No BOM yet. We create a draft BOM for this item, add one component, then activate it.'}
                </p>
                <FormField
                  label="Component item"
                  required
                  hint="Raw material / bought-out / sub-assembly used to build this product."
                >
                  <ItemLookupSelect
                    value={componentItemId}
                    allowEmpty
                    placeholder="Search component item…"
                    onChange={(sel) => {
                      setComponentItemId(sel?.itemId ?? '')
                      setComponentUomId(sel?.uomId ?? '')
                      setComponentLabel(
                        sel ? `${sel.itemCode} — ${sel.itemName}` : '',
                      )
                    }}
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Quantity per unit" required>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={componentQty}
                      onChange={(e) => setComponentQty(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Selected component">
                    <Input value={componentLabel || '—'} readOnly />
                  </FormField>
                </div>
                {bomStatus === 'draft' ? (
                  <p className="text-[12px] text-erp-muted">
                    If the draft already has component lines, you can continue without adding another —
                    we will only ask for a component when the BOM is empty.
                  </p>
                ) : null}
                {!productUomId ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                    Finished item is missing a base UOM. Fix that in Item Master before activating a BOM.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === 'route' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-text">
              Choose how this item is manufactured. Shared templates (Assembly / Fabrication) are fine
              for a first run; you can refine the route later without changing this work order after
              release.
            </p>
            <FormField label="Route version" required>
              <Select
                value={routingVersionId}
                onChange={(e) => setRoutingVersionId(e.target.value)}
                disabled={routeChoices.length === 0}
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {routeChoices.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.isTemplate ? `${opt.label} · Template` : opt.label}
                  </option>
                ))}
              </Select>
            </FormField>
            {routeChoices.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                No certified routes found. Ask an admin to certify a route under Setup → Routes (or seed
                route templates), then reopen this wizard.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'profile' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-erp-text">
              The manufacturing profile ties the item to warehouses, consumption rules, and the BOM /
              route defaults used when you create work orders.
            </p>
            <dl className="grid gap-2 rounded-lg border border-erp-border bg-slate-50/80 p-3 text-[12px] sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Item</dt>
                <dd className="font-medium text-erp-text">{itemTitle}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Action</dt>
                <dd className="font-medium text-erp-text">
                  {existingProfile ? `Update ${existingProfile.code}` : 'Create new profile'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">BOM</dt>
                <dd className="font-medium text-erp-text">
                  {bomStatus === 'active' ? 'Active version ready' : 'Will activate on finish'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Route</dt>
                <dd className="font-medium text-erp-text">
                  {routeChoices.find((r) => r.id === routingVersionId)?.label ?? 'Selected route'}
                </dd>
              </div>
            </dl>
            <FormField label="Plant code" hint="Optional. Stored on the profile and work order.">
              <Input
                value={profilePlantCode}
                onChange={(e) => setProfilePlantCode(e.target.value)}
                placeholder="e.g. PLANT-01"
              />
            </FormField>
          </div>
        ) : null}

        {step === 'done' && result ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <p className="text-[15px] font-semibold text-erp-text">Setup complete</p>
            <p className="text-[13px] text-erp-muted">
              Profile, BOM and route are ready for this item. Click <strong>Use this setup</strong> to
              fill the work order form, then create the work order.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
