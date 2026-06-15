-- products 테이블 신규 필드 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_out_of_stock BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS settlement_place TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT '급여';
ALTER TABLE products ADD COLUMN IF NOT EXISTS drug_type TEXT DEFAULT '보험(일반)';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredient_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS note2 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_cost_incentive TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfg_commission_rate NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_mfg_commission_rate NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manager_commission_rate NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_manager_commission_rate NUMERIC;

-- 보험약가 변경이력 테이블
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  applied_date DATE,
  billing_type TEXT,
  price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_price_history_pid ON product_price_history(product_id);
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_access ON product_price_history;
CREATE POLICY authenticated_access ON product_price_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
