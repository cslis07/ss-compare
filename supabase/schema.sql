-- SS-Compare Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- CSO 업체 (CSO Companies)
-- =====================
create table if not exists cso_companies (
  id uuid primary key default uuid_generate_v4(),
  cso_code text unique,
  name text not null,
  custom_code text,
  contract_type text default '본사와 직접 계약',
  report_number text,
  business_number text,
  resident_number text,
  business_type text default '개인사업자',
  status text default '정상',
  representative text,
  postal_code text,
  road_address text,
  detail_address text,
  phone text,
  fax text,
  mobile text,
  contract_start_date date,
  contract_end_date date,
  email text,
  commission_email text,
  bank_name text,
  account_number text,
  note text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 부서 (Departments)
-- =====================
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references departments(id),
  name text not null,
  code text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =====================
-- 사용자 (Users)
-- =====================
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique,
  login_id text unique not null,
  name text not null,
  department1 text,
  department2 text,
  department3 text,
  department4 text,
  user_type text default '영업담당자',
  commission_type text,
  business_type text default '법인사업자',
  patient_number text,
  mobile text,
  fax text,
  email text,
  note text,
  is_active boolean default true,
  cso_company_id uuid references cso_companies(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 거래처 (Customers / 요양기관)
-- =====================
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  sc_code text,
  business_number text,
  custom_code text,
  name text not null,
  representative text,
  address text,
  postal_code text,
  customer_type text default '의원',
  prescription_start_date date,
  manufacturer_restriction text default '전체허용',
  department1 text,
  department2 text,
  department3 text,
  sales_manager_id uuid references users(id),
  cso_company_id uuid references cso_companies(id),
  cso2_company_id uuid references cso_companies(id),
  final_cso_company_id uuid references cso_companies(id),
  billing_type text default '처방',
  phone text,
  fax text,
  note text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 제품 (Products)
-- =====================
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  manufacturer_sc_code text,
  ingredient_code text,
  manufacturer_code text,
  manufacturer_name text not null,
  insurance_code text,
  product_name text not null,
  specification text,
  dosage_form text,
  is_internal boolean default true,
  has_insurance boolean default true,
  is_non_covered boolean default false,
  generic_availability text,
  final_price decimal(15,2),
  final_price_date date,
  product_group text,
  note text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 처방전 헤더 (Prescriptions)
-- =====================
create table if not exists prescriptions (
  id uuid primary key default uuid_generate_v4(),
  prescription_month text not null,
  settlement_month text not null,
  prescription_type text default '처방(EDI)',
  registration_status text default '등록',
  customer_id uuid references customers(id),
  customer_name text,
  business_number text,
  customer_type text,
  evidence_type text default '전체',
  sales_manager_id uuid references users(id),
  sales_manager_name text,
  cso_company_id uuid references cso_companies(id),
  cso_company_name text,
  cso2_company_id uuid references cso_companies(id),
  cso2_company_name text,
  department1 text,
  department2 text,
  department3 text,
  total_count integer default 0,
  total_amount decimal(15,2) default 0,
  total_contract_commission decimal(15,2) default 0,
  total_charge_commission decimal(15,2) default 0,
  is_settled boolean default false,
  settlement_date date,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 처방전 상세 (Prescription Items)
-- =====================
create table if not exists prescription_items (
  id uuid primary key default uuid_generate_v4(),
  prescription_id uuid references prescriptions(id) on delete cascade,
  manufacturer_name text,
  settlement_place text,
  insurance_code text,
  product_name text,
  specification text,
  product_group text,
  quantity integer default 1,
  unit_price decimal(15,2) default 0,
  amount decimal(15,2) default 0,
  contract_commission_rate decimal(8,4) default 0,
  additional_commission_rate decimal(8,4) default 0,
  total_contract_commission decimal(15,2) default 0,
  charge_commission_rate decimal(8,4) default 0,
  additional_charge_commission decimal(8,4) default 0,
  total_charge_commission decimal(15,2) default 0,
  sort_order integer default 0,
  is_deleted boolean default false
);

-- =====================
-- 수수료율 (Commission Rates)
-- =====================
create table if not exists commission_rates (
  id uuid primary key default uuid_generate_v4(),
  prescription_start_month text not null,
  prescription_end_month text not null,
  rate_type text default 'BASIC',
  sales_manager_id uuid references users(id),
  department1 text,
  department2 text,
  department3 text,
  customer_id uuid references customers(id),
  customer_seq integer,
  insurance_code text,
  product_name text,
  manufacturer_name text,
  contract_commission_rate decimal(8,4) default 0,
  additional_commission_rate decimal(8,4) default 0,
  charge_commission_rate decimal(8,4) default 0,
  additional_charge_commission decimal(8,4) default 0,
  note text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 공지사항 (Notices)
-- =====================
create table if not exists notices (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text,
  is_pinned boolean default false,
  author_id uuid references users(id),
  author_name text,
  view_count integer default 0,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- 프로그램 설정 (Settings)
-- =====================
create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  gcode text unique not null,
  description text,
  value text,
  updated_at timestamptz default now(),
  updated_by uuid references users(id)
);

-- =====================
-- 수정이력 (Audit Log)
-- =====================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references users(id),
  user_name text,
  created_at timestamptz default now()
);

-- =====================
-- Default Settings
-- =====================
insert into settings (gcode, description, value) values
('30050001', '처방전 등록시 거래처비교 표시여부 Y표시, N 빈칸표시', 'Y'),
('30050002', '처방전 등록시 동일한 처방월/거래처 등록 허용', 'Y'),
('30050003', '처방전 등록시 동일한 처방월/거래처/제품 등록 허용', 'Y'),
('30060001', '원외 처방만 입력 (원내 처방 비활성)', 'Y'),
('30070001', '확정 기능 사용 여부', 'Y'),
('30080001', '제약 수수료 관리', 'Y'),
('30080002', '추가 수수료 관리 (제약)', 'Y'),
('30080003', '담당 수수료 관리', 'Y'),
('30080004', '추가 수수료 관리 (담당)', 'Y'),
('30080011', '수수료를 수정 가능여부', 'Y'),
('30100001', '처방전 수신 가능 여부', 'Y'),
('40010001', '처방전 등록시 건월 대비 증감 수량 표시 비율', '100')
on conflict (gcode) do nothing;

-- =====================
-- Row Level Security
-- =====================
alter table customers enable row level security;
alter table products enable row level security;
alter table cso_companies enable row level security;
alter table departments enable row level security;
alter table users enable row level security;
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
alter table commission_rates enable row level security;
alter table notices enable row level security;
alter table settings enable row level security;

-- Allow all authenticated users to read/write (adjust per business rules)
drop policy if exists "authenticated_access" on customers;
drop policy if exists "authenticated_access" on products;
drop policy if exists "authenticated_access" on cso_companies;
drop policy if exists "authenticated_access" on departments;
drop policy if exists "authenticated_access" on users;
drop policy if exists "authenticated_access" on prescriptions;
drop policy if exists "authenticated_access" on prescription_items;
drop policy if exists "authenticated_access" on commission_rates;
drop policy if exists "authenticated_access" on notices;
drop policy if exists "authenticated_access" on settings;

create policy "authenticated_access" on customers for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on products for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on cso_companies for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on departments for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on users for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on prescriptions for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on prescription_items for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on commission_rates for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on notices for all using (auth.role() = 'authenticated');
create policy "authenticated_access" on settings for all using (auth.role() = 'authenticated');
