import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { IndiaMartError } from './indiamart.errors.js'
import { handleIndiaMartPushWebhook } from './indiamart.webhook.js'

/**
 * Public IndiaMART Push API webhook (no JWT).
 * URL shape (documented identifier pattern):
 *   POST /api/v1/webhooks/indiamart/:tenantSlug/:webhookToken
 *
 * Must return HTTP 200 when the lead is accepted — IndiaMART deactivates Push
 * after ~48h of continuous non-200 responses.
 */
const router = Router()

const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
})

router.post(
  '/:tenantSlug/:webhookToken',
  pushLimiter,
  asyncHandler(async (req, res) => {
    try {
      const result = await handleIndiaMartPushWebhook({
        tenantSlug: String(req.params.tenantSlug),
        webhookToken: String(req.params.webhookToken),
        body: req.body,
      })
      // IndiaMART requires HTTP 200 for successful delivery acknowledgement.
      return res.status(200).json({
        success: true,
        message: result.accepted ? 'Lead accepted' : 'Lead acknowledged',
        data: result,
      })
    } catch (err) {
      if (err instanceof IndiaMartError && (err.code === 'AUTHENTICATION' || err.statusCode === 401)) {
        return res.status(401).json({ success: false, message: err.message, error: { code: err.code } })
      }
      // Return 200 for transient processing issues so Push stays active; details logged via sync run.
      const message = (err as Error).message
      return res.status(200).json({
        success: true,
        message: 'Lead received with processing error',
        data: { accepted: false, error: message },
      })
    }
  }),
)

export default router
