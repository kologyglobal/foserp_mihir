import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface AccessTokenPayload {
  sub: string
  tenantId: string
  tokenType: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  tenantId: string
  tokenType: 'refresh'
  jti: string
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
  if (decoded.tokenType !== 'access') {
    throw new Error('Invalid token type')
  }
  return decoded
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
  if (decoded.tokenType !== 'refresh') {
    throw new Error('Invalid token type')
  }
  return decoded
}

export function parseExpiresInMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const amount = Number(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return amount * (multipliers[unit] ?? 86_400_000)
}
