import { Bot, Mail, MessageCircle, Sparkles, TrendingUp } from 'lucide-react'
import type { RowActionItem } from '../enterprise/EnterpriseTablePrimitives'

/** Standard AI quick actions for CRM/Sales row ⋯ menus. */
export function buildAiRowActions(handlers: {
  onAiSummary?: () => void
  onSuggestNext?: () => void
  onDraftEmail?: () => void
  onDraftWhatsApp?: () => void
  onPredictWin?: () => void
}): RowActionItem[] {
  const items: RowActionItem[] = []
  if (handlers.onAiSummary) {
    items.push({ id: 'ai-summary', label: 'AI Summary', icon: Sparkles, onClick: handlers.onAiSummary })
  }
  if (handlers.onSuggestNext) {
    items.push({ id: 'ai-next', label: 'Suggest Next Action', icon: Bot, onClick: handlers.onSuggestNext })
  }
  if (handlers.onDraftEmail) {
    items.push({ id: 'ai-email', label: 'Draft Follow-up Email', icon: Mail, onClick: handlers.onDraftEmail })
  }
  if (handlers.onDraftWhatsApp) {
    items.push({ id: 'ai-wa', label: 'Draft WhatsApp', icon: MessageCircle, onClick: handlers.onDraftWhatsApp })
  }
  if (handlers.onPredictWin) {
    items.push({ id: 'ai-win', label: 'Predict Win Probability', icon: TrendingUp, onClick: handlers.onPredictWin })
  }
  if (items.length === 0) return []
  return items
}
