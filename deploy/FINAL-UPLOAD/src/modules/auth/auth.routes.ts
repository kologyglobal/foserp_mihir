import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { validateBody } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { env } from '../../config/env.js'
import * as authController from './auth.controller.js'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  resetPasswordSchema,
} from './auth.validation.js'

const router = Router()

const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDev || env.isTest ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts' },
})

router.post('/login', authAttemptLimiter, validateBody(loginSchema), asyncHandler(authController.login))
router.post('/refresh-token', validateBody(refreshTokenSchema), asyncHandler(authController.refreshToken))
router.post('/forgot-password', authAttemptLimiter, validateBody(forgotPasswordSchema), asyncHandler(authController.forgotPassword))
router.post('/reset-password', authAttemptLimiter, validateBody(resetPasswordSchema), asyncHandler(authController.resetPassword))

router.post(
  '/logout',
  authenticate,
  attachRequestContext,
  validateBody(logoutSchema),
  asyncHandler(authController.logout),
)

router.post(
  '/change-password',
  authenticate,
  attachRequestContext,
  validateBody(changePasswordSchema),
  asyncHandler(authController.changePassword),
)

router.get('/me', authenticate, attachRequestContext, asyncHandler(authController.me))

export default router
