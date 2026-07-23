import { prisma } from '../../../config/database.js'

export async function isTallyExportEnabled(tenantId: string, legalEntityId: string): Promise<boolean> {
  const row = await prisma.financeFeatureControl.findFirst({
    where: { tenantId, legalEntityId, featureKey: 'TALLY_EXPORT', isEnabled: true },
  })
  return row != null
}
