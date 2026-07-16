import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  FileText,
  Pencil,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  canApproveVoucher,
  canCancelVoucher,
  canEditVoucher,
  canPostVoucher,
  canReverseVoucher,
  canSubmitVoucher,
  VoucherApprovalDrawer,
  VoucherEntriesGrid,
  VoucherPostingPreviewModal,
  VoucherReversalModal,
  VoucherStatusBadge,
  VoucherTypeBadge,
  VoucherWorkflowStrip,
} from '@/components/accounting/vouchers'
import {
  addVoucherAttachmentMeta,
  addVoucherNote,
  approveVoucher,
  cancelVoucher,
  getCostCentreOptions,
  getVoucherById,
  postVoucher,
  rejectVoucher,
  reverseVoucher,
  sendBackVoucher,
  submitVoucher,
  VouchersServiceError,
} from '@/services/accounting/vouchersService'
import type { AccountingVoucher, VoucherCostCentreOption } from '@/types/vouchers'
import { VOUCHER_DOCUMENT_TYPE_LABELS, VOUCHER_PAYMENT_MODE_LABELS } from '@/types/vouchers'
import { useVoucherPermissions } from '@/utils/permissions/vouchers'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type SupportTab = 'notes' | 'attachments' | 'approval' | 'audit'

export function VoucherDetailPage() {
  const { voucherId } = useParams<{ voucherId: string }>()
  const navigate = useNavigate()
  const perms = useVoucherPermissions()
  const [voucher, setVoucher] = useState<AccountingVoucher | null>(null)
  const [costCentres, setCostCentres] = useState<VoucherCostCentreOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [supportTab, setSupportTab] = useState<SupportTab>('notes')
  const [noteBody, setNoteBody] = useState('')
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const reload = useCallback(async () => {
    if (!voucherId) return
    setLoading(true)
    try {
      const [v, cc] = await Promise.all([getVoucherById(voucherId), getCostCentreOptions()])
      setVoucher(v)
      setCostCentres(cc)
    } finally {
      setLoading(false)
    }
  }, [voucherId])

  useEffect(() => {
    void reload()
  }, [reload])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Vouchers', to: '/accounting/vouchers' },
    { label: voucher?.voucherNumber ?? 'Detail' },
  ]

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Voucher"
        breadcrumbs={breadcrumbs}
        autoBreadcrumbs={false}
        favoritePath="/accounting/vouchers"
      >
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (!voucher) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Not found"
        breadcrumbs={breadcrumbs}
        autoBreadcrumbs={false}
        favoritePath="/accounting/vouchers"
      >
        <EmptyState
          icon={FileText}
          title="Voucher not found"
          description="This demo voucher may have been deleted."
          action={
            <Link to="/accounting/vouchers" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">
              Back to register
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  const secondary = [
    ...(perms.canEdit && canEditVoucher(voucher.status)
      ? [{ id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/accounting/vouchers/${voucher.id}/edit`) }]
      : []),
    ...(perms.canSubmit && canSubmitVoucher(voucher.status)
      ? [
          {
            id: 'submit',
            label: 'Submit',
            icon: Send,
            onClick: async () => {
              setBusy(true)
              try {
                await submitVoucher(voucher.id)
                notify.success('Submitted for approval')
                await reload()
              } catch (e) {
                notify.error(e instanceof VouchersServiceError ? e.message : 'Submit failed')
              } finally {
                setBusy(false)
              }
            },
          },
        ]
      : []),
    ...(canApproveVoucher(voucher.status) && (perms.canApprove || perms.canReject || perms.canSendBack)
      ? [{ id: 'approve', label: 'Approval', icon: Check, onClick: () => setApprovalOpen(true) }]
      : []),
    ...(perms.canPost && canPostVoucher(voucher.status)
      ? [{ id: 'post', label: 'Post', icon: Check, onClick: () => setPostOpen(true) }]
      : []),
    ...(perms.canReverse && canReverseVoucher(voucher)
      ? [{ id: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: () => setReverseOpen(true) }]
      : []),
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={voucher.voucherNumber}
      description={voucher.narration}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/vouchers/${voucher.id}`}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={secondary} />}
    >
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <VoucherStatusBadge status={voucher.status} />
          <VoucherTypeBadge type={voucher.voucherType} />
          <span className="text-[12px] text-erp-muted">{voucher.voucherDate}</span>
          <span className="ml-auto text-[12px] tabular-nums">
            Dr {formatCurrency(voucher.totalDebit)} · Cr {formatCurrency(voucher.totalCredit)}
          </span>
        </div>
        <VoucherWorkflowStrip status={voucher.status} />
        {voucher.rejectedReason ? (
          <p className="rounded bg-red-50 px-3 py-2 text-[12px] text-red-800">Rejected: {voucher.rejectedReason}</p>
        ) : null}
        {voucher.sentBackReason ? (
          <p className="rounded bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Sent back: {voucher.sentBackReason}</p>
        ) : null}
        {voucher.reversalOfVoucherNumber ? (
          <p className="text-[12px] text-erp-muted">
            Reversal of{' '}
            <Link className="text-sky-800 underline" to={`/accounting/vouchers/${voucher.reversalOfVoucherId}`}>
              {voucher.reversalOfVoucherNumber}
            </Link>
          </p>
        ) : null}
        {voucher.reversedByVoucherNumber ? (
          <p className="text-[12px] text-erp-muted">
            Reversed by{' '}
            <Link className="text-sky-800 underline" to={`/accounting/vouchers/${voucher.reversedByVoucherId}`}>
              {voucher.reversedByVoucherNumber}
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-erp-border bg-erp-surface p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase text-erp-muted">Type</p>
          <p className="font-medium">{VOUCHER_DOCUMENT_TYPE_LABELS[voucher.voucherType]}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-erp-muted">Party</p>
          <p className="font-medium">{voucher.partyName ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-erp-muted">Reference</p>
          <p className="font-medium">{voucher.referenceNo ?? '—'}</p>
        </div>
        {voucher.paymentMode ? (
          <div>
            <p className="text-[11px] uppercase text-erp-muted">Payment mode</p>
            <p className="font-medium">{VOUCHER_PAYMENT_MODE_LABELS[voucher.paymentMode]}</p>
          </div>
        ) : null}
        {voucher.bankAccountName ? (
          <div>
            <p className="text-[11px] uppercase text-erp-muted">Bank / cash</p>
            <p className="font-medium">{voucher.bankAccountName}</p>
          </div>
        ) : null}
        <div>
          <p className="text-[11px] uppercase text-erp-muted">Created</p>
          <p className="font-medium">
            {voucher.createdBy} · {voucher.createdAt.slice(0, 10)}
          </p>
        </div>
      </div>

      <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Accounting entries</h2>
      <div className="mb-4 rounded-md border border-erp-border bg-erp-surface p-3">
        <VoucherEntriesGrid lines={voucher.lines} onChange={() => undefined} readOnly costCentres={costCentres} />
      </div>

      <div className="rounded-md border border-erp-border bg-erp-surface">
        <div className="flex flex-wrap gap-1 border-b border-erp-border p-2" role="tablist">
          {(
            [
              ['notes', 'Notes'],
              ['attachments', 'Attachments'],
              ['approval', 'Approval'],
              ['audit', 'Audit'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={supportTab === id}
              className={cn(
                'rounded px-2.5 py-1.5 text-[12px] font-medium',
                supportTab === id ? 'bg-sky-50 text-sky-900' : 'text-erp-muted hover:bg-erp-surface-alt',
              )}
              onClick={() => setSupportTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3">
          {supportTab === 'notes' ? (
            <div className="space-y-3">
              <ul className="space-y-2">
                {voucher.notes.length === 0 ? (
                  <li className="text-[13px] text-erp-muted">No notes yet.</li>
                ) : (
                  voucher.notes.map((n) => (
                    <li key={n.id} className="rounded border border-erp-border px-3 py-2 text-[13px]">
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-erp-muted">
                        {n.createdBy} · {n.createdAt.slice(0, 16).replace('T', ' ')}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-erp-border px-3 py-2 text-[13px]"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Add a note…"
                />
                <button
                  type="button"
                  className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                  disabled={!noteBody.trim() || busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await addVoucherNote(voucher.id, noteBody)
                      setNoteBody('')
                      await reload()
                    } catch (e) {
                      notify.error(e instanceof Error ? e.message : 'Failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ) : null}
          {supportTab === 'attachments' ? (
            <div className="space-y-3">
              <ul className="space-y-2">
                {voucher.attachments.length === 0 ? (
                  <li className="text-[13px] text-erp-muted">No attachments (demo metadata only).</li>
                ) : (
                  voucher.attachments.map((a) => (
                    <li key={a.id} className="flex justify-between rounded border px-3 py-2 text-[13px]">
                      <span>{a.name}</span>
                      <span className="text-[11px] text-erp-muted">
                        {a.sizeKb} KB · {a.uploadedBy}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]"
                onClick={async () => {
                  try {
                    await addVoucherAttachmentMeta(voucher.id, `supporting-doc-${Date.now()}.pdf`, 42)
                    notify.success('Attachment metadata added (demo)')
                    await reload()
                  } catch (e) {
                    notify.error(e instanceof Error ? e.message : 'Failed')
                  }
                }}
              >
                Add demo attachment
              </button>
            </div>
          ) : null}
          {supportTab === 'approval' ? (
            <ul className="space-y-2">
              {voucher.approvalTrail.length === 0 ? (
                <li className="text-[13px] text-erp-muted">No approval events.</li>
              ) : (
                voucher.approvalTrail.map((e) => (
                  <li key={e.id} className="rounded border px-3 py-2 text-[13px]">
                    <span className="font-medium capitalize">{e.action.replace('_', ' ')}</span> · {e.by}
                    <span className="ml-2 text-[11px] text-erp-muted">{e.at.slice(0, 16).replace('T', ' ')}</span>
                    {e.comment ? <p className="mt-1 text-erp-muted">{e.comment}</p> : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
          {supportTab === 'audit' ? (
            perms.canViewAudit ? (
              <ul className="space-y-2">
                {voucher.auditTrail.map((e) => (
                  <li key={e.id} className="rounded border px-3 py-2 text-[13px]">
                    <span className="font-medium">{e.action}</span> · {e.by}
                    <span className="ml-2 text-[11px] text-erp-muted">{e.at.slice(0, 16).replace('T', ' ')}</span>
                    {e.detail ? <p className="mt-1 text-erp-muted">{e.detail}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-erp-muted">Missing accounting.voucher.view_audit permission.</p>
            )
          ) : null}
        </div>
      </div>

      {perms.canCancel && canCancelVoucher(voucher.status) ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded border border-erp-border p-3">
          <label className="min-w-[200px] flex-1 text-[12px] font-medium">
            Cancel reason
            <input
              className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-[13px]"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="erp-btn erp-btn-ghost inline-flex h-9 items-center gap-1 px-3 text-[13px] text-red-700"
            disabled={!cancelReason.trim() || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await cancelVoucher(voucher.id, cancelReason)
                notify.success('Voucher cancelled')
                await reload()
              } catch (e) {
                notify.error(e instanceof VouchersServiceError ? e.message : 'Cancel failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            <XCircle className="h-4 w-4" />
            Cancel voucher
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] text-erp-muted">
        Demo only — Post / Reverse update voucher status in-session and do not create real ledger, bank, GST, or TDS
        postings. Backend must enforce accounting.voucher.* permissions.
      </p>

      <VoucherApprovalDrawer
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        voucher={voucher}
        canApprove={perms.canApprove}
        canReject={perms.canReject}
        canSendBack={perms.canSendBack}
        busy={busy}
        onApprove={async (comment) => {
          setBusy(true)
          try {
            await approveVoucher(voucher.id, comment)
            notify.success('Voucher approved')
            setApprovalOpen(false)
            await reload()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Approve failed')
          } finally {
            setBusy(false)
          }
        }}
        onReject={async (reason) => {
          setBusy(true)
          try {
            await rejectVoucher(voucher.id, reason)
            notify.success('Voucher rejected')
            setApprovalOpen(false)
            await reload()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Reject failed')
          } finally {
            setBusy(false)
          }
        }}
        onSendBack={async (reason) => {
          setBusy(true)
          try {
            await sendBackVoucher(voucher.id, reason)
            notify.success('Voucher sent back')
            setApprovalOpen(false)
            await reload()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Send back failed')
          } finally {
            setBusy(false)
          }
        }}
      />
      <VoucherPostingPreviewModal
        open={postOpen}
        voucher={voucher}
        busy={busy}
        onClose={() => setPostOpen(false)}
        onConfirmPost={async () => {
          if (!perms.canPost) return
          setBusy(true)
          try {
            await postVoucher(voucher.id)
            notify.success('Voucher marked Posted (demo) — no ledger entries were created.')
            setPostOpen(false)
            await reload()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Post failed')
          } finally {
            setBusy(false)
          }
        }}
      />
      <VoucherReversalModal
        open={reverseOpen}
        voucher={voucher}
        busy={busy}
        onClose={() => setReverseOpen(false)}
        onConfirm={async (reason) => {
          if (!perms.canReverse) return
          setBusy(true)
          try {
            const rev = await reverseVoucher(voucher.id, reason)
            notify.success(`Reversal ${rev.voucherNumber} created (demo)`)
            setReverseOpen(false)
            navigate(`/accounting/vouchers/${rev.id}`)
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Reverse failed')
          } finally {
            setBusy(false)
          }
        }}
      />
    </OperationalPageShell>
  )
}
