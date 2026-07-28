/**
 * Optional SMTP delivery for invitations and password resets.
 * When SMTP_HOST is unset, emails are logged and skipped (dev/UAT without mail).
 */
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../config/env.js'

export interface SendMailInput {
  to: string
  subject: string
  text: string
  html?: string
}

export interface SendMailResult {
  sent: boolean
  skippedReason?: string
  messageId?: string
}

let transporter: Transporter | null | undefined

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter
  if (!env.SMTP_HOST?.trim()) {
    transporter = null
    return null
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  })
  return transporter
}

export function isMailConfigured(): boolean {
  return Boolean(env.SMTP_HOST?.trim())
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transport = getTransporter()
  if (!transport) {
    if (env.isDev || env.isTest) {
      console.info(
        `[mail] skipped (SMTP not configured) → ${input.to}: ${input.subject}\n${input.text}`,
      )
    }
    return { sent: false, skippedReason: 'SMTP_NOT_CONFIGURED' }
  }

  const from = env.SMTP_FROM?.trim() || env.SMTP_USER || 'noreply@localhost'
  const info = await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? `<pre>${escapeHtml(input.text)}</pre>`,
  })
  return { sent: true, messageId: info.messageId }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function inviteAcceptUrl(rawToken: string): string {
  const base = env.FRONTEND_URL.replace(/\/$/, '')
  return `${base}/login?invite=${encodeURIComponent(rawToken)}`
}

export function passwordResetUrl(rawToken: string): string {
  const base = env.FRONTEND_URL.replace(/\/$/, '')
  return `${base}/login?reset=${encodeURIComponent(rawToken)}`
}

export async function sendInvitationEmail(params: {
  to: string
  firstName: string
  tenantName: string
  rawToken: string
  expiresAt: Date
}): Promise<SendMailResult> {
  const link = inviteAcceptUrl(params.rawToken)
  const subject = `You're invited to ${params.tenantName} on FOS ERP`
  const text = [
    `Hi ${params.firstName},`,
    '',
    `You have been invited to join ${params.tenantName} on FOS ERP.`,
    `Accept your invitation (expires ${params.expiresAt.toISOString()}):`,
    link,
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n')
  return sendMail({ to: params.to, subject, text })
}

export async function sendPasswordResetEmail(params: {
  to: string
  firstName: string
  rawToken: string
  expiresAt: Date
}): Promise<SendMailResult> {
  const link = passwordResetUrl(params.rawToken)
  const subject = 'Reset your FOS ERP password'
  const text = [
    `Hi ${params.firstName},`,
    '',
    'We received a request to reset your password.',
    `Use this link within the hour (expires ${params.expiresAt.toISOString()}):`,
    link,
    '',
    'If you did not request a reset, you can ignore this email.',
  ].join('\n')
  return sendMail({ to: params.to, subject, text })
}
