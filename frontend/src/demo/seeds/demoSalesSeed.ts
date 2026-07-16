/** Re-export sales pipeline builders — baseline loads 50 leads, 30 opportunities (CRM), 30 quotations */
export { buildDemoSalesPipeline } from '../../data/demo/salesPipelineSeed'
export { buildDemoMrpSalesOrders } from '../../data/demo/mrpOrdersSeed'

export function seedDemoSales(): void {
  /* Sales pipeline and MRP SOs are loaded in resetDemoBaseline via buildDemoSalesPipeline / buildDemoMrpSalesOrders */
}
