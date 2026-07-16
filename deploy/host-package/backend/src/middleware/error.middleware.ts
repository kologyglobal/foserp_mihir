import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { AppError, ConflictError, DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js'
import { sendError } from '../utils/response.js'

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.errors)
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
