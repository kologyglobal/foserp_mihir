import { useWorkOrderStore } from '../../store/workOrderStore'

/** Append WO activity events for live activity panels */
export function seedDemoActivity(): void {
  const ws = useWorkOrderStore.getState()
  let n = ws.activities.length
  for (const wo of ws.workOrders.slice(0, 40)) {
    if (n >= 100) break
    n++
    useWorkOrderStore.setState((s) => ({
      activities: [
        ...s.activities,
        {
          id: `act-sat-${n}`,
          workOrderId: wo.id,
          action: n % 2 === 0 ? 'status_change' : 'material_issue',
          details: `Demo activity on ${wo.woNo}`,
          createdBy: 'Demo Operator',
          createdAt: new Date(Date.now() - n * 3600000).toISOString(),
        },
      ],
    }))
  }
}
