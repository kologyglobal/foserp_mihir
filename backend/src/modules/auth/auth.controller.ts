import type { Request, Response } from 'express'
import { getContext } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import * as authService from './auth.service.js'
import type {
  AcceptInvitationInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginDirectoryQuery,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './auth.validation.js'

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: req.ip ?? null,
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput, requestMeta(req))
  sendSuccess(res, 'Login successful', result)
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(req.body as RefreshTokenInput, requestMeta(req))
  sendSuccess(res, 'Token refreshed', result)
}

export async function logout(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  await authService.logout(ctx.userId, ctx.tenantId, req.body as LogoutInput)
  sendSuccess(res, 'Logged out successfully', null)
}

export async function me(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const user = await authService.getMe(ctx.userId, ctx.tenantId)
  sendSuccess(res, 'Current user retrieved', user)
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.forgotPassword(req.body as ForgotPasswordInput)
  sendSuccess(res, result.message, envSafePayload(result))
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body as ResetPasswordInput)
  sendSuccess(res, 'Password reset successful', null)
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  await authService.acceptInvitation(req.body as AcceptInvitationInput)
  sendSuccess(res, 'Invitation accepted', null)
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  await authService.changePassword(ctx.userId, ctx.tenantId, req.body as ChangePasswordInput)
  sendSuccess(res, 'Password changed successfully', null)
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const user = await authService.updateProfile(ctx.userId, ctx.tenantId, req.body as UpdateProfileInput)
  sendSuccess(res, 'Profile updated', user)
}

export async function loginDirectory(req: Request, res: Response): Promise<void> {
  const result = await authService.listLoginDirectory(req.query as unknown as LoginDirectoryQuery)
  sendSuccess(res, 'Login directory retrieved', result)
}

function envSafePayload(result: { message: string; resetToken?: string }) {
  if (result.resetToken) {
    return { resetToken: result.resetToken }
  }
  return null
}
