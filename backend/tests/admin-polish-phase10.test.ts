/**
 * Admin Panel Phase 10 — polish: audit list, security policy, requireModule proof.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import { createAuditLog, listAuditLogs } from '../src/services/audit.service.js'
import { requireModule } from '../src/middleware/require-module.middleware.js'
import * as moduleService from '../src/modules/modules/module.service.js'
import {
  MAX_FAILED_LOGINS,
  PASSWORD_MIN_LENGTH,
} from '../src/modules/security/security.constants.js'
import { UnprocessableEntityError } from '../src/utils/errors.js'
import type { Request, Response } from 'express'

const TENANT_SLUG = 'vasant-trailers'

describe('admin polish phase 10', () => {
  let tenantId = ''
  let auditId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id
  })

  afterAll(async () => {
    if (auditId) {
      await prisma.auditLog.deleteMany({ where: { id: auditId } })
    }
    await prisma.tenantModuleFlag.deleteMany({
      where: { tenantId, moduleKey: { in: ['purchase', 'gate'] } },
    })
  })

  it('lists audit logs written for the tenant', async () => {
    await createAuditLog({
      tenantId,
      module: 'security',
      entity: 'Phase10Test',
      entityId: null,
      action: 'TEST',
      newValues: { phase: 10 },
    })
    const row = await prisma.auditLog.findFirst({
      where: { tenantId, module: 'security', entity: 'Phase10Test', action: 'TEST' },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).toBeTruthy()
    auditId = row!.id

    const listed = await listAuditLogs(tenantId, {
      page: 1,
      limit: 20,
      sortOrder: 'desc',
      module: 'security',
    })
    expect(listed.items.some((i) => i.id === auditId)).toBe(true)
  })

  it('exposes read-only security policy constants', () => {
    expect(MAX_FAILED_LOGINS).toBe(5)
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('requireModule rejects when purchase is disabled', async () => {
    // Disable dependents of purchase? purchase depends on masters only — can disable purchase after disabling nothing that depends on it
    // logistics/dispatch don't depend on purchase. manufacturing doesn't. quality doesn't.
    await moduleService.setModuleFlag(tenantId, 'purchase', { isEnabled: false })

    const mw = requireModule('purchase')
    const req = { tenantId, context: { tenantId, userId: 'x', roles: [], permissions: [], isSuperAdmin: false } } as unknown as Request
    let err: unknown
    await new Promise<void>((resolve) => {
      void mw(req, {} as Response, (e?: unknown) => {
        err = e
        resolve()
      })
    })
    expect(err).toBeInstanceOf(UnprocessableEntityError)
    expect((err as UnprocessableEntityError).code).toBe('MODULE_DISABLED')

    await moduleService.setModuleFlag(tenantId, 'purchase', { isEnabled: true })
  })
})
