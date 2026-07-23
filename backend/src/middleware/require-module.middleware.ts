import type { NextFunction, Request, Response } from 'express'
import { isModuleEnabled } from '../modules/modules/module.service.js'
import { getTenantId } from '../types/request-context.js'
import { UnprocessableEntityError } from '../utils/errors.js'

/**
 * Soft product gate: when a TenantModuleFlag explicitly disables the module, reject.
 * Missing flag = enabled (fail-open) — matches Module Access UX.
 */
export function requireModule(moduleKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = getTenantId(req)
      const enabled = await isModuleEnabled(tenantId, moduleKey)
      if (!enabled) {
        next(
          new UnprocessableEntityError(
            `Module "${moduleKey}" is disabled for this tenant`,
            'MODULE_DISABLED',
            [{ field: 'moduleKey', message: moduleKey }],
            { moduleKey },
          ),
        )
        return
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
