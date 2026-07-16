import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { ValidationError } from '../utils/errors.js'

function assignRequestField<K extends 'body' | 'query' | 'params'>(req: Request, key: K, value: Request[K]): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }))
      next(new ValidationError('Validation failed', errors))
      return
    }
    assignRequestField(req, 'body', result.data)
    next()
  }
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }))
      next(new ValidationError('Validation failed', errors))
      return
    }
    assignRequestField(req, 'query', result.data as Request['query'])
    next()
  }
}

export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params)
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'params',
        message: issue.message,
      }))
      next(new ValidationError('Validation failed', errors))
      return
    }
    assignRequestField(req, 'params', result.data as Request['params'])
    next()
  }
}
