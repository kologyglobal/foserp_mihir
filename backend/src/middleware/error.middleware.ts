import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { AppError, ConflictError, DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js'
import { sendError } from '../utils/response.js'

function isPayloadTooLargeError(err: unknown): err is Error & { status: number; type?: string; limit?: number } {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; type?: string; message?: string }
  return e.status === 413 || e.type === 'entity.too.large' || /request entity too large/i.test(e.message ?? '')
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.errors, err.code, err.details)
    return
  }

  if (isPayloadTooLargeError(err)) {
    const maxMb = Math.round(env.CRM_MAX_UPLOAD_BYTES / (1024 * 1024))
    sendError(res, 413, `Upload too large. Maximum file size is ${maxMb} MB.`)
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, 409, 'Duplicate record', [{ field: 'unique', message: 'A record with this value already exists' }])
      return
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'Resource not found')
      return
    }
    if (err.code === 'P2003') {
      sendError(res, 400, 'Related record not found')
      return
    }
    logger.error('Prisma error', err)
    sendError(res, 500, 'Database operation failed')
    return
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'Invalid database query')
    return
  }

  logger.error('Unhandled error', err)
  const message = env.isProd ? 'Internal server error' : err instanceof Error ? err.message : 'Internal server error'
  sendError(res, 500, message)
}

export { AppError, ValidationError, NotFoundError, ConflictError, DatabaseError }
