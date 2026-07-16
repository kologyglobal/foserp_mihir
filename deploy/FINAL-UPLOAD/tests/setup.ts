import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.test' })
loadEnv()

process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-minimum-32-characters-long'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-minimum-32-characters-long'
process.env.DB_NAME ??= 'fos_erp_test'
