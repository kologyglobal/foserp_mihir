/**
 * Re-add production_order_materials.purchaseRequisitionId FK after purchase UI
 * tables are recreated by 20260720120000.
 */
import mariadb from 'mariadb'

async function main() {
  const c = await mariadb.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'fos_erp',
    multipleStatements: true,
  })

  await c.query(`
    SET @fk_exists := (
      SELECT COUNT(*)
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'production_order_materials'
        AND CONSTRAINT_NAME = 'production_order_materials_purchaseRequisitionId_fkey'
    );
    SET @ddl := IF(
      @fk_exists = 0,
      'ALTER TABLE production_order_materials ADD CONSTRAINT production_order_materials_purchaseRequisitionId_fkey FOREIGN KEY (purchaseRequisitionId) REFERENCES purchase_requisitions(id) ON DELETE SET NULL ON UPDATE CASCADE',
      'SELECT 1'
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  `)

  const cols = await c.query("SHOW COLUMNS FROM purchase_requisitions LIKE 'requisitionNumber'")
  console.log('purchase_requisitions.requisitionNumber', cols.length ? 'OK' : 'MISSING')
  console.log('FK re-ensure complete')
  await c.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
