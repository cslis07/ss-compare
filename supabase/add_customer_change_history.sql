-- 거래처 추가 컬럼
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ykiho TEXT;                     -- 요양기관기호
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category TEXT;          -- 업태
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_item TEXT;              -- 종목
ALTER TABLE customers ADD COLUMN IF NOT EXISTS road_address TEXT;               -- 도로명주소
ALTER TABLE customers ADD COLUMN IF NOT EXISTS detail_address TEXT;             -- 상세주소
ALTER TABLE customers ADD COLUMN IF NOT EXISTS display_subject TEXT;            -- 표시과목
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bed_scale TEXT;                  -- 병상규모
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_category TEXT;          -- 거래처구분
ALTER TABLE customers ADD COLUMN IF NOT EXISTS closure_type TEXT DEFAULT '정상';  -- 휴폐업구분
ALTER TABLE customers ADD COLUMN IF NOT EXISTS closure_date DATE;               -- 휴폐업일자

-- 거래처 변경이력 테이블
CREATE TABLE IF NOT EXISTS customer_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sc_code TEXT,
  custom_code TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  old_name TEXT,
  new_name TEXT,
  old_representative TEXT,
  new_representative TEXT,
  old_address TEXT,
  new_address TEXT,
  old_bed_scale TEXT,
  new_bed_scale TEXT,
  old_customer_type TEXT,
  new_customer_type TEXT,
  old_display_subject TEXT,
  new_display_subject TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT,
  source TEXT DEFAULT '엑셀업로드',
  note TEXT
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_customer_change_history_sc_code ON customer_change_history(sc_code);
CREATE INDEX IF NOT EXISTS idx_customer_change_history_customer_id ON customer_change_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_change_history_changed_at ON customer_change_history(changed_at DESC);

-- RLS
ALTER TABLE customer_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_access ON customer_change_history;
CREATE POLICY authenticated_access ON customer_change_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
