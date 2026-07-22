import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS } from '../src/constants/permissions.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  MANUFACTURING_PERMS,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

function base(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 1 — foundation', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p1')
    fx = await bootstrapManufacturingFixture(ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('permission constants include manufacturing setup/profile/work-centre/machine keys', () => {
    const required = [
      'manufacturing.setup.view',
      'manufacturing.profile.view',
      'manufacturing.profile.manage',
      'manufacturing.work_centre.view',
      'manufacturing.work_centre.manage',
      'manufacturing.machine.view',
      'manufacturing.machine.manage',
      'manufacturing.routes.view',
      'manufacturing.routes.create',
      'manufacturing.routes.edit',
      'manufacturing.routes.activate',
    ]
    for (const perm of required) {
      expect(PERMISSIONS).toContain(perm)
    }
  })

  // ─── Work centres ──────────────────────────────────────────────────────

  describe('work centres', () => {
    it('creates, lists, updates, deactivates and reactivates a work centre', async () => {
      const created = await request(app)
        .post(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `WC-${Date.now()}`, name: 'Fabrication Bay 1', capacityPerShift: '8', costRate: '500' })
      expect(created.status).toBe(201)
      const id = created.body.data.id as string
      expect(created.body.data.capacityPerShift).toBe('8')

      const list = await request(app)
        .get(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(list.status).toBe(200)
      expect(list.body.data.some((wc: { id: string }) => wc.id === id)).toBe(true)

      const updated = await request(app)
        .patch(`${base(fx.slug)}/work-centres/${id}`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ name: 'Fabrication Bay 1 (Renamed)' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.name).toBe('Fabrication Bay 1 (Renamed)')

      const deactivated = await request(app)
        .post(`${base(fx.slug)}/work-centres/${id}/deactivate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(deactivated.status).toBe(200)
      expect(deactivated.body.data.isActive).toBe(false)

      const reactivated = await request(app)
        .post(`${base(fx.slug)}/work-centres/${id}/activate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(reactivated.status).toBe(200)
      expect(reactivated.body.data.isActive).toBe(true)
    }, 30_000)

    it('rejects duplicate work centre code in the same tenant', async () => {
      const code = `WC-DUP-${Date.now()}`
      const first = await request(app)
        .post(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code, name: 'Dup WC 1' })
      expect(first.status).toBe(201)

      const dup = await request(app)
        .post(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code, name: 'Dup WC 2' })
      expect(dup.status).toBe(409)
    }, 30_000)
  })

  // ─── Machines ──────────────────────────────────────────────────────────

  describe('machines', () => {
    it('creates a machine under a work centre and updates its status', async () => {
      const wc = await request(app)
        .post(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `WC-M-${Date.now()}`, name: 'Machining Bay' })
      expect(wc.status).toBe(201)
      const workCentreId = wc.body.data.id as string

      const machine = await request(app)
        .post(`${base(fx.slug)}/machines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `MC-${Date.now()}`, name: 'CNC Lathe 1', workCentreId, status: 'AVAILABLE' })
      expect(machine.status).toBe(201)
      const machineId = machine.body.data.id as string

      const statusUpdate = await request(app)
        .post(`${base(fx.slug)}/machines/${machineId}/status`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ status: 'UNDER_MAINTENANCE' })
      expect(statusUpdate.status).toBe(200)
      expect(statusUpdate.body.data.status).toBe('UNDER_MAINTENANCE')

      const deactivated = await request(app)
        .post(`${base(fx.slug)}/machines/${machineId}/deactivate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(deactivated.status).toBe(200)
      expect(deactivated.body.data.isActive).toBe(false)
    }, 30_000)
  })

  // ─── BOM: multilevel, activation, immutability, cycle rejection, revision, compare ──

  describe('bill of materials', () => {
    async function createDraftBomVersion() {
      const bom = await request(app)
        .post(`${base(fx.slug)}/boms`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `BOM-${Date.now()}-${Math.floor(Math.random() * 10000)}`, name: 'Trailer BOM', productItemId: fx.itemId })
      expect(bom.status).toBe(201)
      const bomId = bom.body.data.id as string

      const version = await request(app)
        .post(`${base(fx.slug)}/boms/${bomId}/versions`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          revisionCode: 'REV-A',
          effectiveFrom: new Date().toISOString().slice(0, 10),
          baseQuantity: '1',
          baseUomId: fx.uomId,
          expectedYieldPercent: '100',
        })
      expect(version.status).toBe(201)
      return { bomId, versionId: version.body.data.id as string }
    }

    it('builds a multilevel BOM, validates and activates it, then rejects edits on the active version', async () => {
      const { versionId } = await createDraftBomVersion()

      const parentLine = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/lines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          itemId: fx.componentItemId,
          quantity: '2',
          uomId: fx.uomId,
          lineType: 'SUBASSEMBLY',
          makeOrBuy: 'MAKE',
        })
      expect(parentLine.status).toBe(201)
      const parentLineId = parentLine.body.data.id as string

      const childLine = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/lines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          parentLineId,
          itemId: fx.subComponentItemId,
          quantity: '4',
          uomId: fx.uomId,
          lineType: 'RAW_MATERIAL',
          makeOrBuy: 'BUY',
        })
      expect(childLine.status).toBe(201)
      expect(childLine.body.data.level).toBe(2)

      const tree = await request(app)
        .get(`${base(fx.slug)}/bom-versions/${versionId}/tree`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(tree.status).toBe(200)
      expect(tree.body.data.tree).toHaveLength(1)
      expect(tree.body.data.tree[0].children).toHaveLength(1)

      const validation = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/validate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(validation.status).toBe(200)
      expect(validation.body.data.valid).toBe(true)

      const activated = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/activate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(activated.status).toBe(200)
      expect(activated.body.data.status).toBe('ACTIVE')

      const blockedEdit = await request(app)
        .patch(`${base(fx.slug)}/bom-lines/${parentLineId}`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ quantity: '5' })
      expect(blockedEdit.status).toBe(422)
    }, 30_000)

    it('rejects a circular BOM line parent reference', async () => {
      const { versionId } = await createDraftBomVersion()

      const lineA = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/lines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ itemId: fx.componentItemId, quantity: '1', uomId: fx.uomId, lineType: 'SUBASSEMBLY' })
      expect(lineA.status).toBe(201)
      const lineAId = lineA.body.data.id as string

      const lineB = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/lines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ parentLineId: lineAId, itemId: fx.subComponentItemId, quantity: '1', uomId: fx.uomId, lineType: 'RAW_MATERIAL' })
      expect(lineB.status).toBe(201)
      const lineBId = lineB.body.data.id as string

      const cyclic = await request(app)
        .patch(`${base(fx.slug)}/bom-lines/${lineAId}`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ parentLineId: lineBId })
      expect(cyclic.status).toBe(400)
    }, 30_000)

    it('revises an active BOM version into a new draft and compares versions', async () => {
      const { versionId } = await createDraftBomVersion()
      await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/lines`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ itemId: fx.componentItemId, quantity: '3', uomId: fx.uomId, lineType: 'SUBASSEMBLY' })

      const activated = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/activate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(activated.status).toBe(200)

      const revised = await request(app)
        .post(`${base(fx.slug)}/bom-versions/${versionId}/revise`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(revised.status).toBe(201)
      expect(revised.body.data.status).toBe('DRAFT')
      const newVersionId = revised.body.data.id as string

      const newVersionLines = await request(app)
        .get(`${base(fx.slug)}/bom-versions/${newVersionId}/tree`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(newVersionLines.status).toBe(200)
      expect(newVersionLines.body.data.tree).toHaveLength(1)

      const compare = await request(app)
        .get(`${base(fx.slug)}/bom-versions/${newVersionId}/compare`)
        .query({ from: versionId, to: newVersionId })
        .set('Authorization', `Bearer ${fx.token}`)
      expect(compare.status).toBe(200)
      expect(compare.body.data.unchanged).toBeGreaterThanOrEqual(1)
    }, 30_000)
  })

  // ─── Routing: stages, operations, dependencies, cycle rejection, activate ──

  describe('routings', () => {
    async function createDraftRoutingVersion() {
      const routing = await request(app)
        .post(`${base(fx.slug)}/routings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `RT-${Date.now()}-${Math.floor(Math.random() * 10000)}`, name: 'Trailer Routing', productItemId: fx.itemId })
      expect(routing.status).toBe(201)
      const routingId = routing.body.data.id as string

      const version = await request(app)
        .post(`${base(fx.slug)}/routings/${routingId}/versions`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ revisionCode: 'REV-A', effectiveFrom: new Date().toISOString().slice(0, 10) })
      expect(version.status).toBe(201)
      return { routingId, versionId: version.body.data.id as string }
    }

    it('builds stages + operations + dependencies, validates and activates', async () => {
      const { versionId } = await createDraftRoutingVersion()

      const stage = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/stage-groups`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: 'ST-01', name: 'Cutting', displayOrder: 1 })
      expect(stage.status).toBe(201)
      const stageGroupId = stage.body.data.id as string

      const op1 = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/operations`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ stageGroupId, code: 'OP-10', name: 'Cut Steel Sheet', sequence: 10 })
      expect(op1.status).toBe(201)
      const op1Id = op1.body.data.id as string

      const op2 = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/operations`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ stageGroupId, code: 'OP-20', name: 'Weld Frame', sequence: 20 })
      expect(op2.status).toBe(201)
      const op2Id = op2.body.data.id as string

      const dep = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/dependencies`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ predecessorOperationId: op1Id, successorOperationId: op2Id })
      expect(dep.status).toBe(201)

      const validation = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/validate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(validation.status).toBe(200)
      expect(validation.body.data.valid).toBe(true)

      const activated = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/activate`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(activated.status).toBe(200)
      expect(activated.body.data.status).toBe('ACTIVE')
    }, 30_000)

    it('rejects a circular operation dependency', async () => {
      const { versionId } = await createDraftRoutingVersion()

      const stage = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/stage-groups`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: 'ST-01', name: 'Cutting', displayOrder: 1 })
      const stageGroupId = stage.body.data.id as string

      const opA = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/operations`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ stageGroupId, code: 'OP-A', name: 'Op A', sequence: 10 })
      const opAId = opA.body.data.id as string

      const opB = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/operations`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ stageGroupId, code: 'OP-B', name: 'Op B', sequence: 20 })
      const opBId = opB.body.data.id as string

      const depForward = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/dependencies`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ predecessorOperationId: opAId, successorOperationId: opBId })
      expect(depForward.status).toBe(201)

      const depBackward = await request(app)
        .post(`${base(fx.slug)}/routing-versions/${versionId}/dependencies`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ predecessorOperationId: opBId, successorOperationId: opAId })
      expect(depBackward.status).toBe(400)
    }, 30_000)
  })

  // ─── Manufacturing profiles ─────────────────────────────────────────────

  describe('manufacturing profiles', () => {
    it('creates a profile and reports readiness gaps, then satisfies them', async () => {
      const created = await request(app)
        .post(`${base(fx.slug)}/profiles`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          code: `PROF-${Date.now()}`,
          name: 'Trailer Production Profile',
          productItemId: fx.itemId,
          productionType: 'ASSEMBLY',
          executionMode: 'SIMPLE',
        })
      expect(created.status).toBe(201)
      const profileId = created.body.data.id as string

      const readiness = await request(app)
        .get(`${base(fx.slug)}/profiles/${profileId}/readiness`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(readiness.status).toBe(200)
      expect(readiness.body.data.ready).toBe(false)
      expect(readiness.body.data.missing.length).toBeGreaterThan(0)

      const updated = await request(app)
        .patch(`${base(fx.slug)}/profiles/${profileId}`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ productionWarehouseId: fx.warehouseId, finishedGoodsWarehouseId: fx.warehouseId })
      expect(updated.status).toBe(200)

      const readinessAfter = await request(app)
        .get(`${base(fx.slug)}/profiles/${profileId}/readiness`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(readinessAfter.status).toBe(200)
      expect(readinessAfter.body.data.checks.hasProductionWarehouse).toBe(true)
    }, 30_000)
  })

  // ─── Tenant isolation & permissions ────────────────────────────────────

  describe('tenant isolation and permissions', () => {
    it('returns 403 when creating a work centre without permission', async () => {
      const restrictedPerms = MANUFACTURING_PERMS.filter((p) => !p.startsWith('manufacturing.work_centre.'))
      const restricted = await createUserWithPerms(app, fx.tenantId, fx.slug, restrictedPerms, 'mfg-restricted')

      const res = await request(app)
        .post(`${base(fx.slug)}/work-centres`)
        .set('Authorization', `Bearer ${restricted.token}`)
        .send({ code: `WC-403-${Date.now()}`, name: 'Should Fail' })
      expect(res.status).toBe(403)
    }, 30_000)

    it('does not allow a different tenant to read another tenant BOM', async () => {
      const bom = await request(app)
        .post(`${base(fx.slug)}/boms`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ code: `BOM-ISO-${Date.now()}`, name: 'Isolation Test BOM', productItemId: fx.itemId })
      expect(bom.status).toBe(201)
      const bomId = bom.body.data.id as string

      const otherCtx = await createManufacturingAdminTenant(app, 'mfg-p1-other')
      const otherFx = await bootstrapManufacturingFixture(otherCtx)
      try {
        const res = await request(app)
          .get(`${base(otherFx.slug)}/boms/${bomId}`)
          .set('Authorization', `Bearer ${otherFx.token}`)
        expect(res.status).toBe(404)
      } finally {
        await cleanupTenant(otherFx.tenantId)
      }
    }, 30_000)
  })
})
