/**
 * Admin Panel Phase 9 — tenant module enablement flags + dependency rules.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as moduleService from '../src/modules/modules/module.service.js'
import { ValidationError } from '../src/utils/errors.js'

const TENANT_SLUG = 'vasant-trailers'
const TOUCHED = ['logistics', 'dispatch', 'quality', 'manufacturing', 'inventory', 'gate'] as const

describe('admin modules phase 9', () => {
  let tenantId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id
  })

  afterAll(async () => {
    await prisma.tenantModuleFlag.deleteMany({
      where: { tenantId, moduleKey: { in: [...TOUCHED] } },
    })
  })

  it('fail-open lists catalog enabled when no flags exist', async () => {
    await prisma.tenantModuleFlag.deleteMany({ where: { tenantId } })
    const status = await moduleService.listModuleStatus(tenantId)
    expect(status.modules.length).toBeGreaterThan(0)
    expect(status.enabledKeys).toContain('masters')
    expect(status.enabledKeys).toContain('inventory')
    expect(await moduleService.isModuleEnabled(tenantId, 'crm')).toBe(true)
  })

  it('enforces dependency order on enable/disable', async () => {
    await prisma.tenantModuleFlag.deleteMany({
      where: { tenantId, moduleKey: { in: [...TOUCHED] } },
    })

    // Disable leaves first (quality → manufacturing; logistics → dispatch → inventory)
    await moduleService.setModuleFlag(tenantId, 'quality', { isEnabled: false })
    await moduleService.setModuleFlag(tenantId, 'manufacturing', { isEnabled: false })
    await moduleService.setModuleFlag(tenantId, 'logistics', { isEnabled: false })
    await moduleService.setModuleFlag(tenantId, 'dispatch', { isEnabled: false })
    await moduleService.setModuleFlag(tenantId, 'inventory', { isEnabled: false })

    await expect(moduleService.setModuleFlag(tenantId, 'manufacturing', { isEnabled: true })).rejects.toBeInstanceOf(
      ValidationError,
    )

    await moduleService.setModuleFlag(tenantId, 'inventory', { isEnabled: true })
    await moduleService.setModuleFlag(tenantId, 'manufacturing', { isEnabled: true })
    await moduleService.setModuleFlag(tenantId, 'quality', { isEnabled: true })

    await expect(moduleService.setModuleFlag(tenantId, 'manufacturing', { isEnabled: false })).rejects.toBeInstanceOf(
      ValidationError,
    )

    await moduleService.setModuleFlag(tenantId, 'quality', { isEnabled: false })
    await moduleService.setModuleFlag(tenantId, 'manufacturing', { isEnabled: false })

    expect(await moduleService.isModuleEnabled(tenantId, 'manufacturing')).toBe(false)
    expect(await moduleService.isModuleEnabled(tenantId, 'quality')).toBe(false)

    await moduleService.setModuleFlag(tenantId, 'gate', { isEnabled: false })
    expect(await moduleService.isModuleEnabled(tenantId, 'gate')).toBe(false)
    await moduleService.setModuleFlag(tenantId, 'gate', { isEnabled: true })
  })
})
