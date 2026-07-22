import { Prisma } from '@prisma/client'
import { ValidationError } from '../../../utils/errors.js'

export function computeSampleQty(
  method: 'FULL_INSPECTION' | 'FIXED_SAMPLE' | 'PERCENTAGE' | 'MANUAL_SAMPLE',
  inspectionQty: Prisma.Decimal | number | string,
  fixedSampleSize?: Prisma.Decimal | number | string | null,
  percentage?: Prisma.Decimal | number | string | null,
  manualSampleSize?: Prisma.Decimal | number | string | null,
): Prisma.Decimal {
  const total = new Prisma.Decimal(inspectionQty)
  if (total.lessThanOrEqualTo(0)) throw new ValidationError('Inspection quantity must be positive')
  const bounded = (value: Prisma.Decimal) => {
    if (value.lessThan(0)) throw new ValidationError('Sample quantity cannot be negative')
    return Prisma.Decimal.min(value, total)
  }
  switch (method) {
    case 'FULL_INSPECTION': return total
    case 'FIXED_SAMPLE':
      if (fixedSampleSize == null) throw new ValidationError('fixedSampleSize is required for FIXED_SAMPLE')
      return bounded(new Prisma.Decimal(fixedSampleSize))
    case 'PERCENTAGE':
      if (percentage == null) throw new ValidationError('samplePercentage is required for PERCENTAGE')
      return bounded(total.mul(percentage).div(100).ceil())
    case 'MANUAL_SAMPLE':
      if (manualSampleSize == null) throw new ValidationError('manualSampleSize is required for MANUAL_SAMPLE')
      return bounded(new Prisma.Decimal(manualSampleSize))
  }
}
