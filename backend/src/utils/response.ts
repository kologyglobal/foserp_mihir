import type { Response } from 'express'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200,
  meta: PaginationMeta | null = null,
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  })
}

export function sendCreated<T>(res: Response, message: string, data: T): Response {
  return sendSuccess(res, message, data, 201)
}

export function sendPaginated<T>(
  res: Response,
  message: string,
  data: T[],
  meta: PaginationMeta,
): Response {
  return sendSuccess(res, message, data, 200, meta)
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: Array<{ field: string; message: string }>,
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: errors ?? null,
  })
}
