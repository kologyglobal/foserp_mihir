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

/** Never leak Prisma / SQL / stack / undefined-style noise to clients. */
function isTechnicalNoise(message: string): boolean {
  return /prisma|foreign.?key|constraint|sql\s|stack trace|at\s+\S+\s+\(|ECONNREFUSED|ENOTFOUND|P20\d{2}|undefined is not|cannot read propert|bad request|internal server/i.test(
    message,
  )
}

function safeClientMessage(err: unknown): string {
  if (!(err instanceof Error) || !err.message?.trim()) {
    return 'Something went wrong. Please try again.'
  }
  if (isTechnicalNoise(err.message)) {
    return 'Something went wrong. Please try again.'
  }
  // Still hide raw Error names that look like infra failures in non-prod
  if (!env.isProd && err.message.length > 280) {
    return 'Something went wrong. Please try again.'
  }
  if (env.isProd) return 'Internal server error'
  return err.message
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const message =
      err.message && !isTechnicalNoise(err.message)
        ? err.message
        : 'Something went wrong. Please try again.'
    sendError(res, err.statusCode, message, err.errors, err.code, err.details)
    return
  }

  if (isPayloadTooLargeError(err)) {
    const maxMb = Math.round(env.CRM_MAX_UPLOAD_BYTES / (1024 * 1024))
    sendError(res, 413, `Upload too large. Maximum file size is ${maxMb} MB.`)
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      logger.warn('Prisma unique constraint', { code: err.code, meta: err.meta })
      sendError(res, 409, 'A record with this value already exists', [
        { field: 'unique', message: 'A record with this value already exists' },
      ])
      return
    }
    if (err.code === 'P2025') {
      logger.warn('Prisma record not found', { code: err.code })
      sendError(res, 404, 'Resource not found')
      return
    }
    if (err.code === 'P2003') {
      logger.warn('Prisma foreign key', { code: err.code, meta: err.meta })
      sendError(res, 400, 'Related record not found or is inactive')
      return
    }
    if (err.code === 'P2034' || err.code === 'P2028') {
      logger.warn('Prisma transaction write conflict', { code: err.code })
      sendError(res, 409, 'This record was updated by another request. Please retry.', undefined, 'CONFLICT')
      return
    }
    logger.error('Prisma error', err)
    sendError(res, 500, 'Database operation failed')
    return
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', err)
    // Dev: surface a short, non-SQL hint so UI/API debugging is not a blank 400.
    const hint =
      !env.isProd && typeof err.message === 'string'
        ? err.message
            .split('\n')
            .map((l) => l.trim())
            .find((l) => /Unknown argument|Argument `|Invalid value|Missing required/i.test(l))
        : undefined
    sendError(
      res,
      400,
      hint ? `Invalid request data: ${hint.slice(0, 200)}` : 'Invalid request data',
      undefined,
      'PRISMA_VALIDATION',
    )
    return
  }

  logger.error('Unhandled error', err)
  sendError(res, 500, safeClientMessage(err))
}

export { AppError, ValidationError, NotFoundError, ConflictError, DatabaseError }
