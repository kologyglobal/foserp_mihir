import { useEffect } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useSessionStore } from '@/store/sessionStore'
import * as crm from '@/api/crmApi'
import {
  enrichQuotation,
  enrichQuotations,
  enrichSalesOrder,
  enrichSalesOrders,
} from '@/features/crm/commercialMap'
import { syncOfflineDrafts } from '@/features/crm/offlineDrafts'
import type {
  CrmActivity,
  CrmAttachment,
  CrmCompany,
  CrmContact,
  CrmDashboardMetrics,
  CrmEntityNote,
  CrmFollowUp,
  CrmLead,
  CrmOpportunity,
  CrmQuotation,
  CrmSalesOrder,
  CrmSearchResults,
  PipelineDto,
} from '@/types/crm'

export const crmKeys = {
  all: ['crm'] as const,
  dashboard: () => [...crmKeys.all, 'dashboard'] as const,
  leads: (q?: string) => [...crmKeys.all, 'leads', q ?? ''] as const,
  lead: (id: string) => [...crmKeys.all, 'lead', id] as const,
  companies: (q?: string) => [...crmKeys.all, 'companies', q ?? ''] as const,
  company: (id: string) => [...crmKeys.all, 'company', id] as const,
  contacts: (q?: string) => [...crmKeys.all, 'contacts', q ?? ''] as const,
  opportunities: () => [...crmKeys.all, 'opportunities'] as const,
  pipelines: () => [...crmKeys.all, 'pipelines'] as const,
  followUps: (view?: string) => [...crmKeys.all, 'followUps', view ?? ''] as const,
  activities: (p?: string) => [...crmKeys.all, 'activities', p ?? ''] as const,
  quotations: () => [...crmKeys.all, 'quotations'] as const,
  quotation: (id: string) => [...crmKeys.all, 'quotation', id] as const,
  salesOrders: () => [...crmKeys.all, 'salesOrders'] as const,
  salesOrder: (id: string) => [...crmKeys.all, 'salesOrder', id] as const,
  search: (q: string) => [...crmKeys.all, 'search', q] as const,
  notes: (t: string, id: string) => [...crmKeys.all, 'notes', t, id] as const,
  attachments: (t: string, id: string) => [...crmKeys.all, 'files', t, id] as const,
}

export function useCrmDashboard(): UseQueryResult<CrmDashboardMetrics, Error> {
  return useQuery({
    queryKey: crmKeys.dashboard(),
    queryFn: async () => (await crm.fetchCrmDashboard()).data,
    staleTime: 30_000,
  })
}

export function useLeads(search?: string): UseQueryResult<CrmLead[], Error> {
  return useQuery({
    queryKey: crmKeys.leads(search),
    queryFn: async () => {
      const rows: CrmLead[] = (await crm.listLeads({ page: 1, limit: 100 })).data ?? []
      const q = (search ?? '').trim().toLowerCase()
      if (!q) return rows
      return rows.filter((l: CrmLead) => {
        const hay = [l.prospectName, l.companyName, l.customerName, l.mobile, l.email, l.leadNo, l.leadCode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    },
  })
}

export function useLead(id: string): UseQueryResult<CrmLead, Error> {
  return useQuery({
    queryKey: crmKeys.lead(id),
    enabled: !!id,
    queryFn: async () => (await crm.getLead(id)).data,
  })
}

export function useCompanies(search?: string): UseQueryResult<CrmCompany[], Error> {
  return useQuery({
    queryKey: crmKeys.companies(search),
    queryFn: async () => {
      const rows: CrmCompany[] =
        (await crm.listCompanies({ page: 1, limit: 100, search: search || undefined })).data ?? []
      const q = (search ?? '').trim().toLowerCase()
      if (!q) return rows
      return rows.filter((c: CrmCompany) => {
        const hay = [c.customerName, c.name, c.city, c.industry, c.phone].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    },
  })
}

export function useCompany(id: string): UseQueryResult<CrmCompany, Error> {
  return useQuery({
    queryKey: crmKeys.company(id),
    enabled: !!id,
    queryFn: async () => (await crm.getCompany(id)).data,
  })
}

export function useContacts(search?: string): UseQueryResult<CrmContact[], Error> {
  return useQuery({
    queryKey: crmKeys.contacts(search),
    queryFn: async () => {
      const rows: CrmContact[] =
        (await crm.listContacts({ page: 1, limit: 100, search: search || undefined })).data ?? []
      const q = (search ?? '').trim().toLowerCase()
      if (!q) return rows
      return rows.filter((ct: CrmContact) => {
        const hay = [ct.fullName, ct.firstName, ct.lastName, ct.mobile, ct.email, ct.companyName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    },
  })
}

export function useOpportunities(): UseQueryResult<CrmOpportunity[], Error> {
  return useQuery({
    queryKey: crmKeys.opportunities(),
    queryFn: async () => (await crm.listOpportunities({ page: '1', limit: '100' })).data ?? [],
  })
}

export function usePipelines(): UseQueryResult<PipelineDto[], Error> {
  return useQuery({
    queryKey: crmKeys.pipelines(),
    queryFn: async () => (await crm.listPipelines()).data ?? [],
    staleTime: 120_000,
  })
}

export function useFollowUps(view?: string): UseQueryResult<CrmFollowUp[], Error> {
  return useQuery({
    queryKey: crmKeys.followUps(view),
    queryFn: async () =>
      (await crm.listFollowUps({ page: '1', limit: '50', view: view || 'mine' })).data ?? [],
  })
}

export function useActivities(params?: {
  type?: string
  status?: string
}): UseQueryResult<CrmActivity[], Error> {
  const key = JSON.stringify(params ?? {})
  return useQuery({
    queryKey: crmKeys.activities(key),
    queryFn: async () =>
      (
        await crm.listActivities({
          page: '1',
          limit: '50',
          type: params?.type,
          status: params?.status,
        })
      ).data ?? [],
  })
}

export function useQuotations(): UseQueryResult<CrmQuotation[], Error> {
  return useQuery({
    queryKey: crmKeys.quotations(),
    queryFn: async () => {
      const res = await crm.listQuotations({ page: '1', limit: '50' })
      return enrichQuotations(res.data)
    },
  })
}

export function useQuotation(id: string): UseQueryResult<CrmQuotation, Error> {
  return useQuery({
    queryKey: crmKeys.quotation(id),
    enabled: !!id,
    queryFn: async () => enrichQuotation((await crm.getQuotation(id)).data),
  })
}

export function useSalesOrders(): UseQueryResult<CrmSalesOrder[], Error> {
  return useQuery({
    queryKey: crmKeys.salesOrders(),
    queryFn: async () => {
      const res = await crm.listSalesOrders({ page: '1', limit: '50' })
      return enrichSalesOrders(res.data)
    },
  })
}

export function useSalesOrder(id: string): UseQueryResult<CrmSalesOrder, Error> {
  return useQuery({
    queryKey: crmKeys.salesOrder(id),
    enabled: !!id,
    queryFn: async () => enrichSalesOrder((await crm.getSalesOrder(id)).data),
  })
}

export function useCrmSearch(q: string): UseQueryResult<CrmSearchResults, Error> {
  return useQuery({
    queryKey: crmKeys.search(q),
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const needle = q.trim()
      const main = (await crm.searchCrm(needle, 15)).data
      // Bounded fallback if older backends omit commercial rows
      if (main.quotations?.length || main.salesOrders?.length) {
        const [quotations, salesOrders] = await Promise.all([
          enrichQuotations((main.quotations as unknown as CrmQuotation[]) ?? []),
          enrichSalesOrders((main.salesOrders as unknown as CrmSalesOrder[]) ?? []),
        ])
        return {
          ...main,
          quotations: quotations as unknown as Array<Record<string, unknown>>,
          salesOrders: salesOrders as unknown as Array<Record<string, unknown>>,
        }
      }
      const [quotationsRes, salesOrdersRes] = await Promise.all([
        crm.listQuotations({ page: '1', limit: '10', search: needle }),
        crm.listSalesOrders({ page: '1', limit: '10', search: needle }),
      ])
      const [quotations, salesOrders] = await Promise.all([
        enrichQuotations(quotationsRes.data ?? []),
        enrichSalesOrders(salesOrdersRes.data ?? []),
      ])
      return {
        ...main,
        quotations: quotations as unknown as Array<Record<string, unknown>>,
        salesOrders: salesOrders as unknown as Array<Record<string, unknown>>,
      }
    },
  })
}

export function useEntityNotes(
  entityType: string,
  entityId: string,
): UseQueryResult<CrmEntityNote[], Error> {
  return useQuery({
    queryKey: crmKeys.notes(entityType, entityId),
    enabled: !!entityId,
    queryFn: async () => (await crm.listEntityNotes(entityType, entityId)).data ?? [],
  })
}

export function useEntityAttachments(
  entityType: string,
  entityId: string,
): UseQueryResult<CrmAttachment[], Error> {
  return useQuery({
    queryKey: crmKeys.attachments(entityType, entityId),
    enabled: !!entityId,
    queryFn: async () => (await crm.listEntityAttachments(entityType, entityId)).data ?? [],
  })
}

export function useOfflineDraftSync(): void {
  const isOnline = useSessionStore((s) => s.isOnline)
  const qc = useQueryClient()
  useEffect(() => {
    if (!isOnline) return
    void syncOfflineDrafts().then((r) => {
      if (r.synced > 0) void qc.invalidateQueries({ queryKey: crmKeys.all })
    })
  }, [isOnline, qc])
}

export function useInvalidateCrm(): () => void {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: crmKeys.all })
  }
}
