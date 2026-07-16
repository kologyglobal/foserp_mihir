-- Vasant Trailer ERP — PostgreSQL 16 foundation schema
-- Source: DATABASE_SCHEMA.md v2.1 (with DDL fixes for PostgreSQL)

CREATE SCHEMA IF NOT EXISTS md;
CREATE SCHEMA IF NOT EXISTS tx;
CREATE SCHEMA IF NOT EXISTS inv;
CREATE SCHEMA IF NOT EXISTS sys;

-- ── ENUM types ─────────────────────────────────────────────────────────────

CREATE TYPE md.item_type AS ENUM ('raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good');
CREATE TYPE md.uom_type AS ENUM ('integer', 'weight', 'length', 'volume');
CREATE TYPE md.warehouse_type AS ENUM ('main', 'sub', 'wip', 'fg', 'quarantine');
CREATE TYPE md.product_type AS ENUM ('bulker', 'iso_tank', 'side_wall');
CREATE TYPE md.bom_status AS ENUM ('draft', 'submitted', 'approved', 'released', 'obsolete');
CREATE TYPE md.customer_type AS ENUM ('corporate', 'dealer', 'government');
CREATE TYPE md.vendor_type AS ENUM ('manufacturer', 'trader', 'service');

CREATE TYPE tx.inquiry_status AS ENUM ('open', 'quoted', 'converted', 'lost');
CREATE TYPE tx.quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE tx.so_status AS ENUM (
  'draft', 'confirmed', 'bom_validated', 'mrp_run', 'material_ready',
  'in_production', 'qc_hold', 'qc_passed', 'ready_dispatch', 'dispatched', 'closed'
);
CREATE TYPE tx.po_status AS ENUM ('draft', 'approved', 'sent', 'partial_received', 'closed', 'cancelled');
CREATE TYPE tx.grn_status AS ENUM ('draft', 'posted', 'cancelled');
CREATE TYPE tx.prod_status AS ENUM ('planned', 'released', 'in_progress', 'qc_pending', 'completed', 'on_hold');
CREATE TYPE tx.jc_status AS ENUM ('pending', 'active', 'completed', 'skipped');
CREATE TYPE tx.qc_status AS ENUM ('pending', 'in_progress', 'passed', 'failed', 'rework');
CREATE TYPE tx.ncr_severity AS ENUM ('minor', 'major', 'critical');
CREATE TYPE tx.ncr_status AS ENUM ('open', 'investigating', 'resolved', 'closed');
CREATE TYPE tx.dispatch_status AS ENUM ('ready', 'loaded', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE tx.priority_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE inv.movement_type AS ENUM ('opening', 'inward', 'issue', 'adjustment', 'transfer', 'scrap');

-- ── Master data ───────────────────────────────────────────────────────────

CREATE TABLE md.uom_master (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uom_code        VARCHAR(10)  NOT NULL UNIQUE,
  uom_name        VARCHAR(50)  NOT NULL,
  uom_type        md.uom_type  NOT NULL,
  decimal_places  SMALLINT     NOT NULL DEFAULT 0 CHECK (decimal_places BETWEEN 0 AND 3),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE md.item_categories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code         VARCHAR(20)  NOT NULL UNIQUE,
  category_name         VARCHAR(100) NOT NULL,
  parent_id             UUID REFERENCES md.item_categories(id),
  level                 SMALLINT     NOT NULL DEFAULT 1,
  default_warehouse_id  UUID,
  is_active             BOOLEAN      NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE md.items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code        VARCHAR(30)    NOT NULL UNIQUE,
  item_name        VARCHAR(200)   NOT NULL,
  item_description TEXT,
  category_id      UUID           NOT NULL REFERENCES md.item_categories(id),
  base_uom_id      UUID           NOT NULL REFERENCES md.uom_master(id),
  item_type        md.item_type   NOT NULL,
  material_grade   VARCHAR(50),
  hsn_code         VARCHAR(10),
  reorder_level    DECIMAL(12,3)  NOT NULL DEFAULT 0,
  reorder_qty      DECIMAL(12,3),
  standard_rate    DECIMAL(12,2),
  is_purchasable   BOOLEAN        NOT NULL DEFAULT true,
  is_stockable     BOOLEAN        NOT NULL DEFAULT true,
  is_active        BOOLEAN        NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_category ON md.items(category_id);
CREATE INDEX idx_items_type ON md.items(item_type);
CREATE INDEX idx_items_active ON md.items(is_active) WHERE is_active = true;

CREATE TABLE md.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code   VARCHAR(20)  NOT NULL UNIQUE,
  customer_name   VARCHAR(200) NOT NULL,
  customer_type   md.customer_type DEFAULT 'corporate',
  address_line1   VARCHAR(200),
  city            VARCHAR(50)  NOT NULL,
  state           VARCHAR(50),
  pincode         VARCHAR(10),
  gstin           VARCHAR(15)  UNIQUE,
  contact_person  VARCHAR(100),
  contact_phone   VARCHAR(20),
  contact_email   VARCHAR(100),
  credit_days     INTEGER      NOT NULL DEFAULT 30,
  sales_territory VARCHAR(50),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE md.vendors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code             VARCHAR(20)  NOT NULL UNIQUE,
  vendor_name             VARCHAR(200) NOT NULL,
  vendor_type             md.vendor_type DEFAULT 'manufacturer',
  city                    VARCHAR(50),
  state                   VARCHAR(50),
  gstin                   VARCHAR(15)  UNIQUE,
  contact_person          VARCHAR(100),
  contact_phone           VARCHAR(20),
  payment_terms_days      INTEGER      NOT NULL DEFAULT 30,
  default_lead_time_days  INTEGER      NOT NULL DEFAULT 7,
  supplied_categories     TEXT[],
  rating                  SMALLINT     CHECK (rating BETWEEN 1 AND 5),
  is_active               BOOLEAN      NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE md.item_vendor_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES md.items(id),
  vendor_id       UUID NOT NULL REFERENCES md.vendors(id),
  is_preferred    BOOLEAN NOT NULL DEFAULT false,
  lead_time_days  INTEGER,
  last_rate       DECIMAL(12,2),
  UNIQUE (item_id, vendor_id)
);

CREATE TABLE md.warehouses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code  VARCHAR(20)       NOT NULL UNIQUE,
  warehouse_name  VARCHAR(100)      NOT NULL,
  warehouse_type  md.warehouse_type NOT NULL,
  plant_code      VARCHAR(10)       NOT NULL DEFAULT 'PUNE',
  address         VARCHAR(200),
  is_active       BOOLEAN           NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

ALTER TABLE md.item_categories
  ADD CONSTRAINT fk_cat_default_wh
  FOREIGN KEY (default_warehouse_id) REFERENCES md.warehouses(id);

CREATE TABLE md.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code        VARCHAR(30)     NOT NULL UNIQUE,
  product_name        VARCHAR(200)    NOT NULL,
  product_type        md.product_type NOT NULL,
  fg_item_id          UUID            NOT NULL REFERENCES md.items(id),
  capacity            VARCHAR(30),
  axle_config         VARCHAR(50),
  tare_weight_kg      DECIMAL(8,2),
  gvw_kg              DECIMAL(8,2),
  standard_price      DECIMAL(12,2)   NOT NULL,
  standard_lead_days  INTEGER         NOT NULL,
  base_uom_id         UUID            NOT NULL REFERENCES md.uom_master(id),
  hsn_code            VARCHAR(10),
  specifications      TEXT,
  is_active           BOOLEAN         NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_products_fg_item ON md.products(fg_item_id);

CREATE TABLE md.bom_headers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_no                VARCHAR(30)    NOT NULL,
  product_id            UUID           NOT NULL REFERENCES md.products(id),
  revision              VARCHAR(10)    NOT NULL,
  description           VARCHAR(200),
  status                md.bom_status  NOT NULL DEFAULT 'draft',
  previous_revision_id  UUID           REFERENCES md.bom_headers(id),
  effective_from        DATE,
  submitted_at          TIMESTAMPTZ,
  submitted_by          UUID,
  approved_by           UUID,
  approved_at           TIMESTAMPTZ,
  total_cost            DECIMAL(14,2)  NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (product_id, revision)
);

CREATE TABLE md.bom_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_header_id       UUID           NOT NULL REFERENCES md.bom_headers(id) ON DELETE CASCADE,
  parent_line_id      UUID           REFERENCES md.bom_lines(id) ON DELETE CASCADE,
  item_id             UUID           NOT NULL REFERENCES md.items(id),
  node_level          VARCHAR(20)    NOT NULL,
  qty_per_parent      DECIMAL(12,3)  NOT NULL CHECK (qty_per_parent > 0),
  uom_id              UUID           NOT NULL REFERENCES md.uom_master(id),
  scrap_pct           DECIMAL(5,2)   NOT NULL DEFAULT 0,
  source_type         VARCHAR(20)    NOT NULL,
  lead_time_days      INTEGER        NOT NULL DEFAULT 7,
  standard_cost       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  sort_order          INTEGER        NOT NULL DEFAULT 10,
  issue_warehouse_id  UUID           NOT NULL REFERENCES md.warehouses(id),
  UNIQUE (bom_header_id, parent_line_id, item_id)
);

CREATE INDEX idx_bom_lines_parent ON md.bom_lines(parent_line_id);
CREATE INDEX idx_bom_lines_header ON md.bom_lines(bom_header_id);

CREATE TABLE md.product_routings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES md.products(id),
  operation_no    INTEGER NOT NULL,
  operation_name  VARCHAR(100) NOT NULL,
  work_center     VARCHAR(50),
  standard_hours  DECIMAL(6,2),
  requires_qc     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (product_id, operation_no)
);

-- ── Transactional ───────────────────────────────────────────────────────────

CREATE TABLE tx.inquiries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_no          VARCHAR(20) NOT NULL UNIQUE,
  customer_id         UUID REFERENCES md.customers(id),
  product_id          UUID REFERENCES md.products(id),
  quantity            INTEGER NOT NULL,
  required_delivery   DATE,
  status              tx.inquiry_status NOT NULL DEFAULT 'open',
  sales_person_id     UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.quotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no    VARCHAR(20) NOT NULL UNIQUE,
  inquiry_id      UUID REFERENCES tx.inquiries(id),
  customer_id     UUID NOT NULL REFERENCES md.customers(id),
  product_id      UUID NOT NULL REFERENCES md.products(id),
  quantity        INTEGER NOT NULL,
  unit_price      DECIMAL(12,2) NOT NULL,
  validity_days   INTEGER NOT NULL DEFAULT 30,
  valid_until     DATE,
  status          tx.quotation_status NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.sales_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_no           VARCHAR(20) NOT NULL UNIQUE,
  quotation_id    UUID REFERENCES tx.quotations(id),
  customer_id     UUID NOT NULL REFERENCES md.customers(id),
  product_id      UUID NOT NULL REFERENCES md.products(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price      DECIMAL(12,2) NOT NULL,
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE NOT NULL,
  delivered_qty   INTEGER NOT NULL DEFAULT 0,
  status          tx.so_status NOT NULL DEFAULT 'draft',
  priority        tx.priority_level NOT NULL DEFAULT 'medium',
  sales_person_id UUID,
  bom_header_id   UUID REFERENCES md.bom_headers(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_so_status ON tx.sales_orders(status);
CREATE INDEX idx_so_customer ON tx.sales_orders(customer_id);
CREATE INDEX idx_so_delivery ON tx.sales_orders(delivery_date);

CREATE TABLE tx.mrp_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no          VARCHAR(20) NOT NULL UNIQUE,
  planning_week   VARCHAR(10),
  run_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_by          UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'completed'
);

CREATE TABLE tx.mrp_plan_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrp_run_id          UUID NOT NULL REFERENCES tx.mrp_runs(id),
  item_id             UUID NOT NULL REFERENCES md.items(id),
  so_id               UUID REFERENCES tx.sales_orders(id),
  gross_requirement   DECIMAL(12,3) NOT NULL,
  scheduled_receipts  DECIMAL(12,3) NOT NULL DEFAULT 0,
  projected_on_hand   DECIMAL(12,3) NOT NULL,
  net_requirement     DECIMAL(12,3) NOT NULL,
  planned_order_qty   DECIMAL(12,3) NOT NULL DEFAULT 0,
  planned_order_date  DATE,
  vendor_id           UUID REFERENCES md.vendors(id),
  po_created          BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE tx.purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no           VARCHAR(20) NOT NULL UNIQUE,
  vendor_id       UUID NOT NULL REFERENCES md.vendors(id),
  po_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  status          tx.po_status NOT NULL DEFAULT 'draft',
  total_amount    DECIMAL(14,2),
  approved_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.po_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            UUID NOT NULL REFERENCES tx.purchase_orders(id) ON DELETE CASCADE,
  line_no          INTEGER NOT NULL,
  item_id          UUID NOT NULL REFERENCES md.items(id),
  quantity         DECIMAL(12,3) NOT NULL,
  received_qty     DECIMAL(12,3) NOT NULL DEFAULT 0,
  rate             DECIMAL(12,2) NOT NULL,
  uom_id           UUID NOT NULL REFERENCES md.uom_master(id),
  mrp_plan_line_id UUID REFERENCES tx.mrp_plan_lines(id),
  UNIQUE (po_id, line_no)
);

CREATE TABLE inv.stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_no     VARCHAR(20)    NOT NULL,
  movement_date   DATE           NOT NULL DEFAULT CURRENT_DATE,
  movement_type   inv.movement_type NOT NULL,
  item_id         UUID           NOT NULL REFERENCES md.items(id),
  warehouse_id    UUID           NOT NULL REFERENCES md.warehouses(id),
  qty             DECIMAL(12,3)  NOT NULL,
  rate            DECIMAL(12,2),
  value           DECIMAL(14,2),
  balance_after   DECIMAL(12,3)  NOT NULL,
  reference_type  VARCHAR(30)    NOT NULL,
  reference_no    VARCHAR(50)    NOT NULL,
  remarks         TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_item_wh ON inv.stock_movements(item_id, warehouse_id);
CREATE INDEX idx_movements_date ON inv.stock_movements(movement_date DESC);

CREATE TABLE inv.stock_balances (
  item_id       UUID NOT NULL REFERENCES md.items(id),
  warehouse_id  UUID NOT NULL REFERENCES md.warehouses(id),
  on_hand       DECIMAL(12,3) NOT NULL DEFAULT 0,
  reserved      DECIMAL(12,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, warehouse_id)
);

CREATE TABLE inv.stock_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES md.items(id),
  warehouse_id    UUID NOT NULL REFERENCES md.warehouses(id),
  qty             DECIMAL(12,3) NOT NULL CHECK (qty > 0),
  demand_type     VARCHAR(2)   NOT NULL CHECK (demand_type IN ('SO', 'WO')),
  demand_id       VARCHAR(50)  NOT NULL,
  reference_no    VARCHAR(50)  NOT NULL,
  remarks         TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tx.grn_headers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_no          VARCHAR(20) NOT NULL UNIQUE,
  po_id           UUID NOT NULL REFERENCES tx.purchase_orders(id),
  vendor_id       UUID NOT NULL REFERENCES md.vendors(id),
  grn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id    UUID NOT NULL REFERENCES md.warehouses(id),
  status          tx.grn_status NOT NULL DEFAULT 'draft',
  posted_at       TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.grn_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id          UUID NOT NULL REFERENCES tx.grn_headers(id) ON DELETE CASCADE,
  po_line_id      UUID NOT NULL REFERENCES tx.po_lines(id),
  item_id         UUID NOT NULL REFERENCES md.items(id),
  received_qty    DECIMAL(12,3) NOT NULL CHECK (received_qty > 0),
  accepted_qty    DECIMAL(12,3) NOT NULL,
  rejected_qty    DECIMAL(12,3) NOT NULL DEFAULT 0,
  mtc_ref         VARCHAR(50),
  batch_no        VARCHAR(30)
);

CREATE TABLE tx.production_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prod_order_no   VARCHAR(20) NOT NULL UNIQUE,
  so_id           UUID NOT NULL REFERENCES tx.sales_orders(id),
  product_id      UUID NOT NULL REFERENCES md.products(id),
  bom_header_id   UUID NOT NULL REFERENCES md.bom_headers(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  status          tx.prod_status NOT NULL DEFAULT 'planned',
  planned_start   DATE,
  planned_end     DATE,
  actual_start    DATE,
  actual_end      DATE,
  progress_pct    SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  supervisor_id   UUID,
  work_center     VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.material_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no        VARCHAR(20) NOT NULL UNIQUE,
  prod_order_id   UUID NOT NULL REFERENCES tx.production_orders(id),
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id    UUID NOT NULL REFERENCES md.warehouses(id),
  issued_by       UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'posted',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.material_issue_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        UUID NOT NULL REFERENCES tx.material_issues(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES md.items(id),
  bom_line_id     UUID REFERENCES md.bom_lines(id),
  issued_qty      DECIMAL(12,3) NOT NULL,
  uom_id          UUID NOT NULL REFERENCES md.uom_master(id)
);

CREATE TABLE tx.job_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_no         VARCHAR(30) NOT NULL UNIQUE,
  prod_order_id       UUID NOT NULL REFERENCES tx.production_orders(id),
  routing_id          UUID REFERENCES md.product_routings(id),
  operation_no        INTEGER NOT NULL,
  operation_name      VARCHAR(100) NOT NULL,
  work_center         VARCHAR(50),
  planned_hours       DECIMAL(6,2),
  status              tx.jc_status NOT NULL DEFAULT 'pending',
  requires_qc         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.job_works (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_work_no     VARCHAR(20) NOT NULL UNIQUE,
  job_card_id     UUID NOT NULL REFERENCES tx.job_cards(id),
  operator_id     UUID,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  qty_completed   INTEGER NOT NULL DEFAULT 0,
  labour_hours    DECIMAL(6,2),
  remarks         TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.qc_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no   VARCHAR(20) NOT NULL UNIQUE,
  prod_order_id   UUID REFERENCES tx.production_orders(id),
  job_card_id     UUID REFERENCES tx.job_cards(id),
  grn_id          UUID REFERENCES tx.grn_headers(id),
  inspection_type VARCHAR(50) NOT NULL,
  inspector_id    UUID,
  scheduled_date  DATE,
  completed_date  DATE,
  status          tx.qc_status NOT NULL DEFAULT 'pending',
  defects_found   INTEGER NOT NULL DEFAULT 0,
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.ncrs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_no          VARCHAR(20) NOT NULL UNIQUE,
  prod_order_id   UUID REFERENCES tx.production_orders(id),
  inspection_id   UUID REFERENCES tx.qc_inspections(id),
  defect_type     VARCHAR(50),
  severity        tx.ncr_severity NOT NULL,
  reported_by     UUID,
  reported_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status          tx.ncr_status NOT NULL DEFAULT 'open',
  disposition     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tx.dispatch_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no     VARCHAR(20) NOT NULL UNIQUE,
  so_id           UUID NOT NULL REFERENCES tx.sales_orders(id),
  prod_order_id   UUID REFERENCES tx.production_orders(id),
  quantity        INTEGER NOT NULL,
  vehicle_no      VARCHAR(20),
  driver_name     VARCHAR(100),
  driver_phone    VARCHAR(20),
  dispatch_date   DATE,
  destination     VARCHAR(200),
  status          tx.dispatch_status NOT NULL DEFAULT 'ready',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── System ──────────────────────────────────────────────────────────────────

CREATE TABLE sys.document_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type    VARCHAR(20) NOT NULL UNIQUE,
  prefix      VARCHAR(10) NOT NULL,
  year        SMALLINT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0
);

INSERT INTO sys.document_sequences (doc_type, prefix, year, last_number) VALUES
  ('INQUIRY',   'INQ',  2026, 0),
  ('QUOTATION', 'QUO',  2026, 0),
  ('SO',        'SO',   2026, 0),
  ('PO',        'PO',   2026, 0),
  ('GRN',       'GRN',  2026, 0),
  ('MI',        'MI',   2026, 0),
  ('PROD',      'PROD', 2026, 0),
  ('JC',        'JC',   2026, 0),
  ('JW',        'JW',   2026, 0),
  ('QC',        'QC',   2026, 0),
  ('NCR',       'NCR',  2026, 0),
  ('DISPATCH',  'DC',   2026, 0);

-- ── Views ───────────────────────────────────────────────────────────────────

CREATE VIEW inv.v_stock_available AS
SELECT
  i.item_code,
  i.item_name,
  w.warehouse_code,
  COALESCE(SUM(sm.qty), 0) AS on_hand,
  COALESCE(SUM(sr.qty) FILTER (WHERE sr.status = 'active'), 0) AS reserved,
  COALESCE(SUM(sm.qty), 0) - COALESCE(SUM(sr.qty) FILTER (WHERE sr.status = 'active'), 0) AS free_stock,
  i.reorder_level,
  CASE WHEN COALESCE(SUM(sm.qty), 0) <= i.reorder_level THEN true ELSE false END AS is_low_stock
FROM md.items i
CROSS JOIN md.warehouses w
LEFT JOIN inv.stock_movements sm ON sm.item_id = i.id AND sm.warehouse_id = w.id
LEFT JOIN inv.stock_reservations sr ON sr.item_id = i.id AND sr.warehouse_id = w.id
WHERE i.is_active = true AND i.is_stockable = true
GROUP BY i.id, i.item_code, i.item_name, w.id, w.warehouse_code, i.reorder_level;

CREATE VIEW md.v_bom_explosion AS
SELECT
  bh.product_id,
  p.product_code,
  bl.item_id,
  i.item_code,
  i.item_name,
  bl.qty_per_parent,
  bl.scrap_pct,
  bl.source_type,
  bl.node_level,
  bl.issue_warehouse_id
FROM md.bom_lines bl
JOIN md.bom_headers bh ON bh.id = bl.bom_header_id
JOIN md.products p ON p.id = bh.product_id
JOIN md.items i ON i.id = bl.item_id
WHERE bh.status = 'released';

CREATE VIEW inv.v_material_shortages AS
SELECT
  i.item_code,
  i.item_name,
  po.prod_order_no,
  bl.qty_per_parent * po.quantity AS required_qty,
  COALESCE(SUM(sb.on_hand - sb.reserved), 0) AS available_qty,
  GREATEST(0, bl.qty_per_parent * po.quantity - COALESCE(SUM(sb.on_hand - sb.reserved), 0)) AS shortage_qty
FROM tx.production_orders po
JOIN md.bom_lines bl ON bl.bom_header_id = po.bom_header_id
JOIN md.items i ON i.id = bl.item_id
LEFT JOIN inv.stock_balances sb ON sb.item_id = i.id
WHERE po.status IN ('planned', 'released', 'in_progress')
GROUP BY i.item_code, i.item_name, po.prod_order_no, bl.qty_per_parent, po.quantity
HAVING GREATEST(0, bl.qty_per_parent * po.quantity - COALESCE(SUM(sb.on_hand - sb.reserved), 0)) > 0;
