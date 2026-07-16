import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../utils/jwt.js'
import { AuthenticationError } from '../utils/errors.js'

export const AUTH_HEADER = 'authorization'

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers[AUTH_HEADER]
    if (!header?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header')
    }
    const token = header.slice(7)
    const payload = verifyAccessToken(token)
    req.context = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      roles: [],
      permissions: [],
      isSuperAdmin: false,
    }
    next()
  } catch {
    next(new AuthenticationError('Invalid or expired access token'))
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers[AUTH_HEADER]
  if (!header?.startsWith('Bearer ')) {
    next()
    return
  }
  void authenticate(req, _res, next)
}
