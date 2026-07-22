import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
const base = (slug: string) => `/api/v1/t/${slug}/manufacturing/boms`

describe.skipIf(!dbAvailable)('Manufacturing BOM combined CSV import', () => {
  let fx: ManufacturingFixture
  let itemCode: string
  let componentCode: string
  let subComponentCode: string
  let uomCode: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const context = await createManufacturingAdminTenant(app, 'mfg-bom-import')
    fx = await bootstrapManufacturingFixture(context)
    const [item, component, subComponent, uom] = await Promise.all([
      prisma.masterItem.findUniqueOrThrow({ where: { id: fx.itemId } }),
      prisma.masterItem.findUniqueOrThrow({ where: { id: fx.componentItemId } }),
      prisma.masterItem.findUniqueOrThrow({ where: { id: fx.subComponentItemId } }),
      prisma.masterUom.findUniqueOrThrow({ where: { id: fx.uomId } }),
    ])
    itemCode = item.code
    componentCode = component.code
    subComponentCode = subComponent.code
    uomCode = uom.code
    viewOnlyToken = (await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.view', 'manufacturing.setup.view', 'manufacturing.bom.view'],
      'bom-import-viewer',
    )).token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  function rows(bomCode: string) {
    const header = {
      bom_code: bomCode,
      bom_name: 'Imported assembly',
      output_item_code: itemCode,
      output_quantity: '1',
      output_uom_code: uomCode,
      revision_note: 'CSV import test',
    }
    return [
      {
        ...header,
        line_ref: 'L10',
        parent_line_ref: '',
        component_item_code: componentCode,
        component_quantity: '1',
        component_uom_code: uomCode,
        sequence: '10',
        make_buy: 'MAKE',
        line_type: 'SUBASSEMBLY',
      },
      {
        ...header,
        line_ref: 'L11',
        parent_line_ref: 'L10',
        component_item_code: subComponentCode,
        component_quantity: '2.5',
        component_uom_code: uomCode,
        sequence: '10',
        scrap_percentage: '2',
        make_buy: 'BUY',
        line_type: 'RAW_MATERIAL',
      },
    ]
  }

  it('downloads the official combined template without UUID columns', async () => {
    const response = await request(app)
      .get(`${base(fx.slug)}/import/template`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(response.status).toBe(200)
    expect(response.text).toContain('bom_code,bom_name,output_item_code')
    expect(response.text).toContain('line_ref,parent_line_ref')
    expect(response.text.toLowerCase()).not.toContain('item_id')
  })

  it('requires the dedicated manufacturing.bom.import permission', async () => {
    const response = await request(app)
      .post(`${base(fx.slug)}/import/preview`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({ rows: rows(`DENIED-${Date.now()}`) })
    expect(response.status).toBe(403)
  })

  it('previews, resolves and transactionally creates a multilevel Draft BOM', async () => {
    const bomCode = `IMP-${Date.now()}`
    const preview = await request(app)
      .post(`${base(fx.slug)}/import/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: rows(bomCode) })
    expect(preview.status).toBe(200)
    expect(preview.body.data.ready).toBe(true)
    expect(preview.body.data.groups[0]).toMatchObject({
      bomCode,
      action: 'CREATE_BOM',
      nextVersionNumber: 1,
      lineCount: 2,
    })
    expect(preview.body.data.groups[0].rows[1].level).toBe(2)

    const confirmed = await request(app)
      .post(`${base(fx.slug)}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: rows(bomCode), idempotencyKey: randomUUID() })
    expect(confirmed.status).toBe(201)
    const created = confirmed.body.data.created[0]
    const version = await prisma.manufacturingBomVersion.findUniqueOrThrow({
      where: { id: created.versionId },
      include: { lines: { orderBy: { level: 'asc' } } },
    })
    expect(version.status).toBe('DRAFT')
    expect(version.versionNumber).toBe(1)
    expect(version.lines).toHaveLength(2)
    expect(version.lines[1].parentLineId).toBe(version.lines[0].id)
  })

  it('creates a separate next Draft revision for an existing BOM code', async () => {
    const bomCode = `REV-${Date.now()}`
    const firstKey = randomUUID()
    const first = await request(app)
      .post(`${base(fx.slug)}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: rows(bomCode), idempotencyKey: firstKey })
    const firstVersionId = first.body.data.created[0].versionId

    const replay = await request(app)
      .post(`${base(fx.slug)}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: rows(bomCode), idempotencyKey: firstKey })
    expect(replay.status).toBe(201)
    expect(replay.body.data.idempotentReplay).toBe(true)
    expect(replay.body.data.created[0].versionId).toBe(firstVersionId)

    const second = await request(app)
      .post(`${base(fx.slug)}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: rows(bomCode), idempotencyKey: randomUUID() })
    expect(second.status).toBe(201)
    expect(second.body.data.created[0]).toMatchObject({ action: 'CREATE_REVISION', versionNumber: 2 })
    expect(second.body.data.created[0].versionId).not.toBe(firstVersionId)
    expect(await prisma.manufacturingBomVersion.count({
      where: { tenantId: fx.tenantId, bom: { code: bomCode } },
    })).toBe(2)
  })

  it('blocks orphan parents and unresolved tenant item codes without persisting', async () => {
    const bomCode = `BAD-${Date.now()}`
    const invalidRows = rows(bomCode)
    invalidRows[1].parent_line_ref = 'OTHER-BOM-LINE'
    invalidRows[1].component_item_code = 'NOT-IN-TENANT'

    const preview = await request(app)
      .post(`${base(fx.slug)}/import/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: invalidRows })
    expect(preview.status).toBe(200)
    expect(preview.body.data.ready).toBe(false)
    expect(JSON.stringify(preview.body.data)).toContain('Parent line_ref')
    expect(JSON.stringify(preview.body.data)).toContain('Component item not found')

    const confirmed = await request(app)
      .post(`${base(fx.slug)}/import`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ rows: invalidRows, idempotencyKey: randomUUID() })
    expect(confirmed.status).toBe(400)
    expect(await prisma.manufacturingBom.count({ where: { tenantId: fx.tenantId, code: bomCode } })).toBe(0)
  })
})
