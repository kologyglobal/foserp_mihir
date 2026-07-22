import { prisma } from '../src/config/database.js'

prisma.$queryRaw`SELECT 1`
  .then(() => {
    console.log('DB_OK')
    process.exit(0)
  })
  .catch((e) => {
    console.log('DB_FAIL', e.message)
    process.exit(1)
  })
