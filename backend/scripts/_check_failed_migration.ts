import mariadb from 'mariadb'
import { env } from '../src/config/env.js'
const pool = mariadb.createPool({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME, connectionLimit: 2 })
const conn = await pool.getConnection()
const t: any[] = await conn.query(`SELECT TABLE_NAME tn FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE '%quality%'`)
console.log('quality tables:', t.map(r => r.tn).join(', '))
const qc: any[] = await conn.query(`SELECT COLUMN_NAME cn FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_inspections' ORDER BY ORDINAL_POSITION`)
console.log('quality_inspections cols:', qc.map(r => r.cn).join(', '))
const n: any[] = await conn.query(`SELECT COUNT(*) n FROM quality_inspections`)
console.log('quality_inspections rows:', n[0].n.toString())
await conn.release(); await pool.end()
