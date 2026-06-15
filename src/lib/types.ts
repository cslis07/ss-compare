export type UserType = '시스템관리자' | '영업관리자' | '영업담당자' | 'CSO담당자'
export type CustomerType = '병원' | '의원' | '약국' | '한의원' | '치과' | '기타'
export type PrescriptionType = '처방(EDI)' | '조제(EDI)' | '직접입력'
export type CommissionRateType = 'BASIC' | '기본수수료' | '제품별'

export interface CSOCompany {
  id: string
  cso_code: string | null
  name: string
  custom_code: string | null
  contract_type: string
  report_number: string | null
  business_number: string | null
  resident_number: string | null
  business_type: string
  status: string
  representative: string | null
  postal_code: string | null
  road_address: string | null
  detail_address: string | null
  phone: string | null
  fax: string | null
  mobile: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  email: string | null
  commission_email: string | null
  bank_name: string | null
  account_number: string | null
  note: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  parent_id: string | null
  name: string
  code: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  children?: Department[]
}

export interface User {
  id: string
  auth_id: string | null
  login_id: string
  name: string
  department1: string | null
  department2: string | null
  department3: string | null
  department4: string | null
  user_type: string
  commission_type: string | null
  business_type: string
  patient_number: string | null
  mobile: string | null
  fax: string | null
  email: string | null
  note: string | null
  is_active: boolean
  cso_company_id: string | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  sc_code: string | null
  business_number: string | null
  custom_code: string | null
  ykiho: string | null
  name: string
  representative: string | null
  address: string | null
  road_address: string | null
  detail_address: string | null
  postal_code: string | null
  customer_type: string
  display_subject: string | null
  bed_scale: string | null
  customer_category: string | null
  prescription_start_date: string | null
  business_category: string | null
  business_item: string | null
  manufacturer_restriction: string
  department1: string | null
  department2: string | null
  department3: string | null
  sales_manager_id: string | null
  cso_company_id: string | null
  cso2_company_id: string | null
  final_cso_company_id: string | null
  billing_type: string
  closure_type: string | null
  closure_date: string | null
  phone: string | null
  fax: string | null
  note: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  sales_manager?: User
  cso_company?: CSOCompany
}

export interface CustomerChangeHistory {
  id: string
  sc_code: string | null
  custom_code: string | null
  customer_id: string | null
  old_name: string | null
  new_name: string | null
  old_representative: string | null
  new_representative: string | null
  old_address: string | null
  new_address: string | null
  old_bed_scale: string | null
  new_bed_scale: string | null
  old_customer_type: string | null
  new_customer_type: string | null
  old_display_subject: string | null
  new_display_subject: string | null
  changed_at: string
  changed_by: string | null
  source: string | null
  note: string | null
}

export interface Product {
  id: string
  manufacturer_sc_code: string | null
  ingredient_code: string | null
  manufacturer_code: string | null
  manufacturer_name: string
  insurance_code: string | null
  product_name: string
  specification: string | null
  dosage_form: string | null
  is_internal: boolean
  has_insurance: boolean
  is_non_covered: boolean
  generic_availability: string | null
  final_price: number | null
  final_price_date: string | null
  product_group: string | null
  note: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  // 추가 필드
  custom_code: string | null
  is_out_of_stock: boolean
  settlement_place: string | null
  billing_type: string | null
  drug_type: string | null
  sale_price: number | null
  ingredient_category: string | null
  ingredient_name: string | null
  note2: string | null
  low_cost_incentive: string | null
  mfg_commission_rate: number | null
  additional_mfg_commission_rate: number | null
  manager_commission_rate: number | null
  additional_manager_commission_rate: number | null
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  manufacturer_name: string | null
  settlement_place: string | null
  insurance_code: string | null
  product_name: string | null
  specification: string | null
  product_group: string | null
  quantity: number
  unit_price: number
  amount: number
  contract_commission_rate: number
  additional_commission_rate: number
  total_contract_commission: number
  charge_commission_rate: number
  additional_charge_commission: number
  total_charge_commission: number
  sort_order: number
  is_deleted: boolean
}

export interface Prescription {
  id: string
  prescription_month: string
  settlement_month: string
  prescription_type: string
  registration_status: string
  customer_id: string | null
  customer_name: string | null
  business_number: string | null
  customer_type: string | null
  evidence_type: string
  sales_manager_id: string | null
  sales_manager_name: string | null
  cso_company_id: string | null
  cso_company_name: string | null
  cso2_company_id: string | null
  cso2_company_name: string | null
  department1: string | null
  department2: string | null
  department3: string | null
  total_count: number
  total_amount: number
  total_contract_commission: number
  total_charge_commission: number
  is_settled: boolean
  settlement_date: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  items?: PrescriptionItem[]
}

export interface CommissionRate {
  id: string
  prescription_start_month: string
  prescription_end_month: string
  rate_type: string | null
  sales_manager_id: string | null
  department1: string | null
  department2: string | null
  department3: string | null
  customer_id: string | null
  customer_seq: number | null
  insurance_code: string | null
  product_name: string | null
  manufacturer_name: string | null
  contract_commission_rate: number
  additional_commission_rate: number
  charge_commission_rate: number
  additional_charge_commission: number
  note: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  sales_manager?: User
  customer?: Customer
}

export interface Notice {
  id: string
  title: string
  content: string | null
  is_pinned: boolean
  author_id: string | null
  author_name: string | null
  view_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  gcode: string
  description: string | null
  value: string | null
  updated_at: string
  updated_by: string | null
}

export interface PrescriptionStats {
  customer_name: string
  business_number: string
  custom_code: string
  sales_manager_name: string
  cso_company_name: string
  prescription_count: number
  total_amount: number
  contract_commission: number
  charge_commission: number
}

export interface MonthlyStats {
  month: string
  prescription_count: number
  total_amount: number
  contract_commission: number
  charge_commission: number
}
