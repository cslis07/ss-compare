-- ① 제품그룹 테이블
CREATE TABLE IF NOT EXISTS product_groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_access ON product_groups;
CREATE POLICY authenticated_access ON product_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ② 성분(의약품주성분) 테이블
CREATE TABLE IF NOT EXISTS ingredients (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_code    TEXT NOT NULL,   -- 일반명코드 (예: 100101AGN)
  form_code          TEXT,            -- 제형구분코드 (예: GN)
  form_name          TEXT,            -- 제형 (예: 과립제)
  ingredient_name    TEXT,            -- 일반명
  category_code      TEXT,            -- 분류번호
  administration     TEXT,            -- 투여
  amount             TEXT,            -- 함량
  unit               TEXT,            -- 단위
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_code ON ingredients(ingredient_code);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(ingredient_name text_pattern_ops);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_access ON ingredients;
CREATE POLICY authenticated_access ON ingredients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
