-- 제조사 테이블 생성
CREATE TABLE IF NOT EXISTS manufacturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sc_code TEXT UNIQUE,
  name TEXT NOT NULL,
  business_number TEXT,
  representative TEXT,
  note TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_sc_code ON manufacturers(sc_code);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_business_number ON manufacturers(business_number);

ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_access ON manufacturers;
CREATE POLICY authenticated_access ON manufacturers FOR ALL TO authenticated USING (true) WITH CHECK (true);
