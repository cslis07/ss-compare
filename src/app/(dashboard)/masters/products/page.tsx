'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/lib/types'
import { Search, Plus, Save, Download, X, Upload, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'

/* ─── 상수 ─── */
const DOSAGE_FORMS  = ['내복제','주사용제','외용제제','치과용제','진단용약','기타','한방제제']
const BILLING_TYPES = ['급여','비급여']
const DRUG_TYPES    = ['보험(일반)','보험(수입)','보험(전문)','비보험(일반)','비보험(수입)','비보험(전문)','소모품','의약부외품','건강식품']

const EMPTY: Product = {
  id:'', manufacturer_sc_code:'', ingredient_code:'', manufacturer_code:'',
  manufacturer_name:'', insurance_code:'', product_name:'', specification:'',
  dosage_form:'내복제', is_internal:true, has_insurance:true, is_non_covered:false,
  generic_availability:'', final_price:null, final_price_date:null,
  product_group:'', note:'', is_deleted:false, created_at:'', updated_at:'',
  custom_code:'', is_out_of_stock:false, settlement_place:'',
  billing_type:'급여', drug_type:'보험(일반)', sale_price:null,
  ingredient_category:'', ingredient_name:'', note2:'', low_cost_incentive:'',
  mfg_commission_rate:null, additional_mfg_commission_rate:null,
  manager_commission_rate:null, additional_manager_commission_rate:null,
}

const I = 'h-6 text-xs rounded border-gray-300'

function FL({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <label className={cn('text-right text-[10px] text-gray-700 self-center pr-1.5 leading-tight font-medium', className)}>
      {children}
    </label>
  )
}

/* ── 검색 필터 라벨 컴포넌트 ── */
function SL({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">{children}</span>
}

/* ════════════════════════════════════ */
export default function ProductsPage() {
  const supabase = createClient()

  /* ── 목록 ── */
  const [products,  setProducts]  = useState<Product[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Product | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)

  /* ── 체크박스 ── */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  /* ── 검색 필터 ── */
  const [filters, setFilters] = useState({
    productGroup:      '전체',
    insuranceCode:     '',
    ingredientCode:    '',
    mfSearchType:      'mf' as 'mf'|'settlement',   // 제조사명 or 정산처명
    mfSearchVal:       '',
    billingType:       '전체',
    productName:       '',
    customCode:        '',
    note:              '',
    salesManagerName:  '',
    commissionMonth:   '',
    includeDeleted:    false,
  })

  /* ── 제품그룹 드롭다운 ── */
  const [productGroups, setProductGroups] = useState<string[]>([])

  /* ── 폼용 제조사 검색 팝업 ── */
  const [manufacturers, setManufacturers] = useState<any[]>([])
  const [mfTarget, setMfTarget] = useState<'mf'|'settlement'|'filter'|null>(null)
  const [mfQuery,  setMfQuery]  = useState('')
  const [mfLoading,setMfLoading]= useState(false)
  const mfRef = useRef<HTMLInputElement>(null)

  /* ── 성분코드 검색 팝업 (폼 + 필터 공용) ── */
  const [showIngSearch, setShowIngSearch] = useState(false)
  const [ingTarget,  setIngTarget]  = useState<'form'|'filter'>('form')
  const [ingQuery,   setIngQuery]   = useState('')
  const [ingResults, setIngResults] = useState<any[]>([])
  const [ingLoading, setIngLoading] = useState(false)
  const ingRef = useRef<HTMLInputElement>(null)

  /* ── 영업담당자 검색 팝업 ── */
  const [showMgrSearch, setShowMgrSearch] = useState(false)
  const [mgrQuery,   setMgrQuery]   = useState('')
  const [mgrResults, setMgrResults] = useState<any[]>([])
  const [mgrLoading, setMgrLoading] = useState(false)
  const mgrRef = useRef<HTMLInputElement>(null)

  /* ── 보험약가 변경내역 ── */
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [newRow, setNewRow] = useState({ applied_date:'', billing_type:'급여', price:'' })

  /* ── 엑셀 일괄등록 ── */
  const [showBulk,  setShowBulk]  = useState(false)
  const [bulkMode,  setBulkMode]  = useState<'급여'|'비보험'>('급여')
  const [bulkRows,  setBulkRows]  = useState<any[]>([])
  const [bulkBusy,  setBulkBusy]  = useState(false)
  const bulkFileRef = useRef<HTMLInputElement>(null)

  /* ══════════════════════════════════
     데이터 로드
  ══════════════════════════════════ */
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setCheckedIds(new Set())

    let q = supabase.from('products').select('*')

    if (!filters.includeDeleted) q = q.eq('is_deleted', false)
    if (filters.productGroup && filters.productGroup !== '전체')
      q = q.eq('product_group', filters.productGroup)
    if (filters.insuranceCode)  q = q.ilike('insurance_code',  `%${filters.insuranceCode}%`)
    if (filters.ingredientCode) q = q.ilike('ingredient_code', `%${filters.ingredientCode}%`)
    if (filters.mfSearchVal) {
      if (filters.mfSearchType === 'mf')
        q = q.ilike('manufacturer_name', `%${filters.mfSearchVal}%`)
      else
        q = q.ilike('settlement_place', `%${filters.mfSearchVal}%`)
    }
    if (filters.billingType && filters.billingType !== '전체')
      q = q.eq('billing_type', filters.billingType)
    if (filters.productName)  q = q.ilike('product_name',  `%${filters.productName}%`)
    if (filters.customCode)   q = q.ilike('custom_code',   `%${filters.customCode}%`)
    if (filters.note)         q = q.ilike('note',          `%${filters.note}%`)

    /* 수수료적용월: commission_rates 테이블에서 해당 월에 활성 보험코드 필터 */
    if (filters.commissionMonth) {
      const { data: rates } = await supabase.from('commission_rates')
        .select('insurance_code')
        .lte('prescription_start_month', filters.commissionMonth)
        .gte('prescription_end_month',   filters.commissionMonth)
        .not('insurance_code', 'is', null)
        .eq('is_deleted', false)
      if (rates && rates.length > 0) {
        const codes = [...new Set(rates.map((r:any)=>r.insurance_code).filter(Boolean))]
        q = q.in('insurance_code', codes as string[])
      } else {
        setProducts([]); setLoading(false); return
      }
    }

    /* 영업담당자: users → commission_rates → insurance_code */
    if (filters.salesManagerName) {
      const { data: users } = await supabase.from('users')
        .select('id').ilike('name', `%${filters.salesManagerName}%`).eq('is_active', true)
      if (users && users.length > 0) {
        const uids = users.map((u:any)=>u.id)
        const { data: rates } = await supabase.from('commission_rates')
          .select('insurance_code').in('sales_manager_id', uids)
          .not('insurance_code','is',null).eq('is_deleted',false)
        if (rates && rates.length > 0) {
          const codes = [...new Set(rates.map((r:any)=>r.insurance_code).filter(Boolean))]
          q = q.in('insurance_code', codes as string[])
        } else { setProducts([]); setLoading(false); return }
      } else { setProducts([]); setLoading(false); return }
    }

    q = q.order('product_name').limit(1000)
    const { data } = await q
    setProducts((data as Product[]) || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { loadProducts() }, [loadProducts])

  /* 제품그룹 + 제조사 로드 */
  useEffect(() => {
    supabase.from('product_groups').select('name').eq('is_deleted',false)
      .order('sort_order').limit(200)
      .then(({data})=>setProductGroups((data||[]).map((d:any)=>d.name)))
    supabase.from('manufacturers').select('id,sc_code,name,business_number,representative')
      .eq('is_deleted',false).order('name').limit(500)
      .then(({data})=>setManufacturers(data||[]))
  }, [supabase])

  /* 모달 오픈 시 제품그룹 확인 로드 */
  useEffect(() => {
    if (!showModal) return
    if (productGroups.length === 0)
      supabase.from('product_groups').select('name').eq('is_deleted',false).order('sort_order').limit(200)
        .then(({data})=>setProductGroups((data||[]).map((d:any)=>d.name)))
  }, [showModal, supabase])

  /* 가격 이력 로드 */
  async function loadHistory(productId: string) {
    try {
      const { data } = await supabase.from('product_price_history')
        .select('*').eq('product_id',productId).order('applied_date',{ascending:false})
      setPriceHistory(data||[])
    } catch { setPriceHistory([]) }
  }

  /* ══════════════════════════════════
     체크박스
  ══════════════════════════════════ */
  const allChecked = products.length > 0 && checkedIds.size === products.length
  const someChecked = checkedIds.size > 0 && !allChecked

  function toggleAll(v: boolean) {
    setCheckedIds(v ? new Set(products.map(p=>p.id)) : new Set())
  }
  function toggleOne(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    if (!checkedIds.size) return
    if (!confirm(`선택한 ${checkedIds.size}건을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('products')
      .update({ is_deleted:true }).in('id', [...checkedIds])
    if (error) { alert('삭제 실패: '+error.message); return }
    alert(`${checkedIds.size}건 삭제 완료`)
    setCheckedIds(new Set())
    loadProducts()
  }

  /* ══════════════════════════════════
     모달 열기
  ══════════════════════════════════ */
  function openNew()  { setSelected({...EMPTY}); setPriceHistory([]); setShowModal(true) }
  function openEdit(p: Product) { setSelected(p); if(p.id) loadHistory(p.id); setShowModal(true) }

  async function checkDuplicate() {
    if (!selected?.custom_code) { alert('자체코드를 입력하세요.'); return }
    const { data } = await supabase.from('products').select('id')
      .eq('custom_code', selected.custom_code).eq('is_deleted',false)
    const dup = (data||[]).filter(d=>d.id!==selected.id)
    alert(dup.length > 0 ? '❌ 중복된 자체코드입니다.' : '✅ 사용 가능한 코드입니다.')
  }

  async function handleSave() {
    if (!selected?.product_name) { alert('제품명을 입력하세요.'); return }
    setSaving(true)
    try {
      const { id, created_at, updated_at, ...rest } = selected as any
      let productId = id
      if (id) {
        const { error } = await supabase.from('products')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id',id)
        if (error) { alert('저장 실패: '+error.message); return }
      } else {
        const { data, error } = await supabase.from('products').insert(rest).select().single()
        if (error) { alert('저장 실패: '+error.message); return }
        if (data) { setSelected(data as Product); productId = (data as any).id }
      }
      const newRows = priceHistory.filter(h=>!h.id)
      if (newRows.length && productId) {
        await supabase.from('product_price_history').insert(
          newRows.map(h=>({ product_id:productId, applied_date:h.applied_date||null, billing_type:h.billing_type, price:Number(h.price)||null }))
        )
        loadHistory(productId)
      }
      alert('저장되었습니다.'); loadProducts()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!selected?.id || !confirm('삭제하시겠습니까?')) return
    await supabase.from('products').update({is_deleted:true}).eq('id',selected.id)
    setShowModal(false); loadProducts()
  }

  /* ══════════════════════════════════
     팝업 — 제조사 (폼 + 필터 공용)
  ══════════════════════════════════ */
  function openMfSearch(target: 'mf'|'settlement'|'filter') {
    setMfTarget(target); setMfQuery('')
    setTimeout(()=>mfRef.current?.focus(), 100)
  }
  function selectMf(m: any) {
    if (mfTarget === 'filter') {
      setFilters(f=>({...f, mfSearchVal: m.name}))
    } else if (mfTarget === 'mf') {
      setSelected(s=>s?{...s, manufacturer_name:m.name, manufacturer_sc_code:m.sc_code||''}:s)
    } else if (mfTarget === 'settlement') {
      setSelected(s=>s?{...s, settlement_place:m.name}:s)
    }
    setMfTarget(null); setMfQuery('')
  }
  const filteredMf = manufacturers.filter(m=>
    !mfQuery||(m.name?.includes(mfQuery)||m.sc_code?.includes(mfQuery))
  )

  /* ══════════════════════════════════
     팝업 — 성분코드 (폼 + 필터 공용)
  ══════════════════════════════════ */
  function openIngSearch(target: 'form'|'filter') {
    setIngTarget(target); setShowIngSearch(true); setIngQuery(''); setIngResults([])
    setTimeout(()=>ingRef.current?.focus(), 100)
  }
  async function searchIngredients(q: string) {
    setIngQuery(q)
    if (!q) { setIngResults([]); return }
    setIngLoading(true)
    const { data } = await supabase.from('ingredients')
      .select('ingredient_code,form_code,form_name,ingredient_name,category_code')
      .or(`ingredient_name.ilike.%${q}%,ingredient_code.ilike.%${q}%`)
      .order('ingredient_name').limit(200)
    setIngResults(data||[]); setIngLoading(false)
  }
  async function loadAllIngredients() {
    setIngQuery(''); setIngLoading(true)
    const { data } = await supabase.from('ingredients')
      .select('ingredient_code,form_code,form_name,ingredient_name,category_code')
      .order('ingredient_name').limit(300)
    setIngResults(data||[]); setIngLoading(false)
  }
  function selectIng(item: any) {
    if (ingTarget === 'filter') {
      setFilters(f=>({...f, ingredientCode: item.ingredient_code||''}))
    } else {
      setSelected(s=>s?{...s,
        ingredient_code: item.ingredient_code||'',
        ingredient_name: item.ingredient_name||'',
        ingredient_category: item.category_code||s?.ingredient_category||'',
      }:s)
    }
    setShowIngSearch(false); setIngQuery(''); setIngResults([])
  }

  /* ══════════════════════════════════
     팝업 — 영업담당자
  ══════════════════════════════════ */
  async function openMgrSearch() {
    setShowMgrSearch(true); setMgrQuery(''); setMgrResults([])
    setMgrLoading(true)
    const { data } = await supabase.from('users')
      .select('id,name,department1,department2').eq('is_active',true)
      .order('name').limit(200)
    setMgrResults(data||[]); setMgrLoading(false)
    setTimeout(()=>mgrRef.current?.focus(), 100)
  }
  async function searchMgr(q: string) {
    setMgrQuery(q)
    setMgrLoading(true)
    let dq = supabase.from('users').select('id,name,department1,department2').eq('is_active',true)
    if (q) dq = dq.ilike('name', `%${q}%`)
    const { data } = await dq.order('name').limit(200)
    setMgrResults(data||[]); setMgrLoading(false)
  }
  function selectMgr(m: any) {
    setFilters(f=>({...f, salesManagerName: m.name}))
    setShowMgrSearch(false); setMgrQuery('')
  }

  /* ── 가격 이력 추가 ── */
  function addHistoryRow() {
    setPriceHistory(h=>[...h, {...newRow, price:Number(newRow.price)||0}])
    setNewRow({ applied_date:'', billing_type:'급여', price:'' })
  }

  /* ── Excel 내려받기 ── */
  function downloadExcel() {
    const hdrs=['보험코드','자체코드','제품명','규격/단위','제조사','정산처','제품그룹','제형구분','급여구분','약품구분','매출금액','최종보험금액','성분코드','대체조제가능','비고']
    const rows=products.map(p=>[p.insurance_code,p.custom_code,p.product_name,p.specification,p.manufacturer_name,p.settlement_place,p.product_group,p.dosage_form,p.billing_type,p.drug_type,p.sale_price,p.final_price,p.ingredient_code,p.generic_availability,p.note])
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows])
    XLSX.utils.book_append_sheet(wb,ws,'제품'); XLSX.writeFile(wb,'제품관리.xlsx')
  }

  /* ════════════ 엑셀 일괄등록 ════════════ */
  function openBulk(mode: '급여'|'비보험') { setBulkMode(mode); setBulkRows([]); setShowBulk(true) }

  async function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBulkBusy(true)
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type:'array' })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header:1, defval:'' }) as any[][]
    const dataRows = raw.slice(1).filter(r => r.some((c:any) => String(c).trim() !== ''))

    if (bulkMode === '급여') {
      const codes = dataRows.map(r=>String(r[0]||'')).filter(Boolean)
      const { data: dbProducts } = codes.length
        ? await supabase.from('products').select('*').in('insurance_code', codes).eq('is_deleted',false)
        : { data: [] }
      const pMap = new Map((dbProducts||[]).map((p:any)=>[p.insurance_code, p]))
      setBulkRows(dataRows.map(r=>({
        excelCode:    String(r[0]||''),
        excelName:    String(r[2]||''),
        customCode:   String(r[1]||''),
        startMonth:   String(r[3]||''),
        endMonth:     String(r[4]||''),
        mfgRate:      r[5]!==''?Number(r[5]):null,
        addMfgRate:   r[6]!==''?Number(r[6]):null,
        mgrRate:      r[7]!==''?Number(r[7]):null,
        addMgrRate:   r[8]!==''?Number(r[8]):null,
        note:         String(r[9]||''),
        note2:        String(r[10]||''),
        outOfStock:   String(r[11]||'').toUpperCase()==='Y',
        matched:      pMap.get(String(r[0]||'')) || null,
      })))
    } else {
      setBulkRows(dataRows.map(r=>({
        insuranceCode: String(r[0]||''),
        customCode:    String(r[1]||''),
        mfgCode:       String(r[2]||''),
        productName:   String(r[3]||''),
        specification: String(r[4]||''),
        dosageForm:    String(r[5]||'내복제'),
        salePrice:     r[6]!==''?Number(r[6]):null,
        startMonth:    String(r[7]||''),
        endMonth:      String(r[8]||''),
        mfgRate:       r[9]!==''?Number(r[9]):null,
        addMfgRate:    r[10]!==''?Number(r[10]):null,
        mgrRate:       r[11]!==''?Number(r[11]):null,
        addMgrRate:    r[12]!==''?Number(r[12]):null,
        note:          String(r[13]||''),
        note2:         String(r[14]||''),
        outOfStock:    String(r[15]||'').toUpperCase()==='Y',
      })))
    }
    setBulkBusy(false)
    if (bulkFileRef.current) bulkFileRef.current.value = ''
  }

  async function saveBulkRows() {
    if (!bulkRows.length) { alert('저장할 데이터가 없습니다.'); return }
    setBulkBusy(true)
    try {
      if (bulkMode === '급여') {
        const matched = bulkRows.filter(r=>r.matched)
        if (!matched.length) { alert('매칭된 제품이 없습니다.'); return }
        for (const row of matched) {
          const upd: any = { updated_at: new Date().toISOString(), is_out_of_stock: row.outOfStock }
          if (row.customCode) upd.custom_code = row.customCode
          if (row.note)       upd.note  = row.note
          if (row.note2)      upd.note2 = row.note2
          if (row.mfgRate    !== null) upd.mfg_commission_rate                = row.mfgRate
          if (row.addMfgRate !== null) upd.additional_mfg_commission_rate     = row.addMfgRate
          if (row.mgrRate    !== null) upd.manager_commission_rate             = row.mgrRate
          if (row.addMgrRate !== null) upd.additional_manager_commission_rate  = row.addMgrRate
          await supabase.from('products').update(upd).eq('id', row.matched.id)
        }
        alert(`✅ ${matched.length}건 저장 완료 (미매칭 ${bulkRows.length-matched.length}건)`)
        loadProducts()
      } else {
        const toInsert = bulkRows.filter(r=>r.productName).map(r=>({
          insurance_code:   r.insuranceCode||null,
          custom_code:      r.customCode||null,
          manufacturer_code:r.mfgCode||null,
          manufacturer_sc_code: r.mfgCode||null,
          manufacturer_name: r.mfgCode||'',
          product_name:     r.productName,
          specification:    r.specification||null,
          dosage_form:      r.dosageForm||'내복제',
          billing_type:     '비급여',
          drug_type:        '비보험(일반)',
          sale_price:       r.salePrice||null,
          mfg_commission_rate:               r.mfgRate||null,
          additional_mfg_commission_rate:    r.addMfgRate||null,
          manager_commission_rate:           r.mgrRate||null,
          additional_manager_commission_rate:r.addMgrRate||null,
          note:r.note||null, note2:r.note2||null, is_out_of_stock:r.outOfStock,
          has_insurance:false, is_internal:true, is_non_covered:true, is_deleted:false,
        }))
        if (!toInsert.length) { alert('제품명이 있는 행이 없습니다.'); return }
        const { error } = await supabase.from('products').insert(toInsert)
        if (error) { alert('저장 실패: '+error.message); return }
        alert(`✅ ${toInsert.length}건 등록 완료`)
        loadProducts()
      }
      setShowBulk(false); setBulkRows([])
    } finally { setBulkBusy(false) }
  }

  function downloadBulkSample() {
    if (bulkMode === '급여') {
      const hdrs=['보험코드(필수)','자체코드(사용시필수)','제품명','적용시작월(사용시 필수)','적용종료월','제약 수수료율','추가수수료율 (제약)','담당 수수료율','추가수수료율 (담당)','비고','비고2','품절여부']
      const sample=[['624900250','A123','엑스비라정','2000-01','2999-12',0,0,0,0,'','','N']]
      const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...sample])
      XLSX.utils.book_append_sheet(wb,ws,'급여제품'); XLSX.writeFile(wb,'엑셀일괄등록_제품_sample.xlsx')
    } else {
      const hdrs=['보험코드','자체코드(사용시필수)','제조사코드','제품명(필수)','규격/단위','제형구분','매출금액','적용시작월(사용시 필수)','적용종료월','제약 수수료율','추가수수료율 (제약)','담당 수수료율','추가수수료율 (담당)','비고','비고2','품절여부']
      const sample=[['','a8000000','010108','판콜에이','1','내복제',1000,'','',0,0,0,0,'','','N']]
      const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...sample])
      XLSX.utils.book_append_sheet(wb,ws,'비보험제품'); XLSX.writeFile(wb,'엑셀일괄등록_비보험제품_sample.xlsx')
    }
  }
  function downloadBulkResult() {
    if (!bulkRows.length) return
    const hdrs=['보험코드(엑셀)','제품명(엑셀)','자체코드','보험코드(DB)','제품명(DB)','규격','제조사','정산처','매칭여부','적용시작월','적용종료월']
    const rows=bulkRows.map(r=>[r.excelCode,r.excelName,r.customCode,r.matched?.insurance_code||'',r.matched?.product_name||'',r.matched?.specification||'',r.matched?.manufacturer_name||'',r.matched?.settlement_place||'',r.matched?'매칭':'미매칭',r.startMonth,r.endMonth])
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows])
    XLSX.utils.book_append_sheet(wb,ws,'결과'); XLSX.writeFile(wb,'일괄등록_결과.xlsx')
  }
  function downloadUnmatched() {
    const rows=bulkRows.filter(r=>!r.matched)
    if (!rows.length) { alert('미매칭 데이터가 없습니다.'); return }
    const hdrs=['보험코드(필수)','자체코드(사용시필수)','제품명','적용시작월(사용시 필수)','적용종료월','제약 수수료율','추가수수료율 (제약)','담당 수수료율','추가수수료율 (담당)','비고','비고2','품절여부']
    const data=rows.map(r=>[r.excelCode,r.customCode,r.excelName,r.startMonth,r.endMonth,r.mfgRate??'',r.addMfgRate??'',r.mgrRate??'',r.addMgrRate??'',r.note,r.note2,r.outOfStock?'Y':'N'])
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...data])
    XLSX.utils.book_append_sheet(wb,ws,'미매칭'); XLSX.writeFile(wb,'미매칭_제품.xlsx')
  }

  const upd = (f:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>
    setSelected(s=>s?{...s,[f]:e.target.value}:s)
  const setSel = (f:string,v:any)=>setSelected(s=>s?{...s,[f]:v}:s)
  const setF   = (f:string,v:any)=>setFilters(p=>({...p,[f]:v}))

  const matchedCount   = bulkRows.filter(r=>r.matched).length
  const unmatchedCount = bulkRows.filter(r=>!r.matched).length

  /* 검색 핸들러 (Enter) */
  const handleSearch = (e: React.KeyboardEvent) => { if(e.key==='Enter') loadProducts() }

  /* ════════════════════════════════════
     RENDER
  ════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full">

      {/* ══ 타이틀 + 액션 버튼 ══ */}
      <div className="bg-white border-b px-3 py-1.5 flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-gray-800">제품 관리</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3"
            onClick={loadProducts}>
            <Search className="h-3 w-3 mr-1"/>조회(F1)
          </Button>
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
            <Plus className="h-3 w-3 mr-1"/>신규등록
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={()=>openBulk('급여')}>
            <Upload className="h-3 w-3 mr-1"/>엑셀 일괄등록
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={downloadExcel}>
            <Download className="h-3 w-3 mr-1"/>Excel
          </Button>
          {checkedIds.size > 0 && (
            <Button size="sm" variant="destructive" className="h-7 text-xs px-2.5" onClick={deleteSelected}>
              <Trash2 className="h-3 w-3 mr-1"/>선택삭제 ({checkedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* ══ 검색 필터 (2행) ══ */}
      <div className="bg-gray-50 border-b px-3 py-1.5 shrink-0 space-y-1.5">
        {/* 1행 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 제조그룹 */}
          <div className="flex items-center gap-1">
            <SL>제조그룹</SL>
            <Select value={filters.productGroup} onValueChange={v=>setF('productGroup',v)}>
              <SelectTrigger className="h-6 text-xs w-[110px] border-gray-300">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="전체" className="text-xs">전체선택</SelectItem>
                {productGroups.map(g=><SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 보험코드 */}
          <div className="flex items-center gap-1">
            <SL>보험코드</SL>
            <Input value={filters.insuranceCode} onChange={e=>setF('insuranceCode',e.target.value)}
              onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-28 border-gray-300"/>
          </div>

          {/* 성분코드 */}
          <div className="flex items-center gap-1">
            <SL>성분코드</SL>
            <div className="flex">
              <Input value={filters.ingredientCode} onChange={e=>setF('ingredientCode',e.target.value)}
                onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-24 rounded-r-none border-gray-300 border-r-0"/>
              <button onClick={()=>openIngSearch('filter')}
                className="h-6 w-6 border border-gray-300 rounded-r bg-white hover:bg-blue-50 flex items-center justify-center shrink-0">
                <Search className="h-3 w-3 text-gray-500"/>
              </button>
            </div>
          </div>

          {/* 제조사명 / 정산처명 */}
          <div className="flex items-center gap-1">
            <Select value={filters.mfSearchType} onValueChange={v=>setF('mfSearchType',v)}>
              <SelectTrigger className="h-6 text-xs w-[76px] border-gray-300 rounded-r-none border-r-0">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mf" className="text-xs">제조사명</SelectItem>
                <SelectItem value="settlement" className="text-xs">정산처명</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex">
              <Input value={filters.mfSearchVal} onChange={e=>setF('mfSearchVal',e.target.value)}
                onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-28 rounded-none border-gray-300 border-x-0"/>
              <button onClick={()=>openMfSearch('filter')}
                className="h-6 w-6 border border-gray-300 rounded-r bg-white hover:bg-blue-50 flex items-center justify-center shrink-0">
                <Search className="h-3 w-3 text-gray-500"/>
              </button>
            </div>
          </div>

          {/* 급여구분 */}
          <div className="flex items-center gap-1">
            <SL>급여구분</SL>
            <Select value={filters.billingType} onValueChange={v=>setF('billingType',v)}>
              <SelectTrigger className="h-6 text-xs w-[72px] border-gray-300">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체" className="text-xs">전체</SelectItem>
                <SelectItem value="급여" className="text-xs">급여</SelectItem>
                <SelectItem value="비급여" className="text-xs">비급여</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 삭제포함 */}
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={filters.includeDeleted}
              onChange={e=>setF('includeDeleted',e.target.checked)}
              className="w-3.5 h-3.5 border-gray-400"/>
            <SL>삭제관련포함조회</SL>
          </label>
        </div>

        {/* 2행 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 제품명 */}
          <div className="flex items-center gap-1">
            <SL>제&nbsp;&nbsp;품&nbsp;&nbsp;명</SL>
            <Input value={filters.productName} onChange={e=>setF('productName',e.target.value)}
              onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-32 border-gray-300"/>
          </div>

          {/* 자체코드 */}
          <div className="flex items-center gap-1">
            <SL>자체코드</SL>
            <Input value={filters.customCode} onChange={e=>setF('customCode',e.target.value)}
              onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-24 border-gray-300"/>
          </div>

          {/* 비고 */}
          <div className="flex items-center gap-1">
            <SL>비&nbsp;&nbsp;&nbsp;&nbsp;고</SL>
            <Input value={filters.note} onChange={e=>setF('note',e.target.value)}
              onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-28 border-gray-300"/>
          </div>

          {/* 영업담당자 */}
          <div className="flex items-center gap-1">
            <SL>영업담당자</SL>
            <div className="flex">
              <Input value={filters.salesManagerName} onChange={e=>setF('salesManagerName',e.target.value)}
                onKeyDown={handleSearch} placeholder="" className="h-6 text-xs w-24 rounded-r-none border-gray-300 border-r-0"/>
              <button onClick={openMgrSearch}
                className="h-6 w-6 border border-gray-300 rounded-r bg-white hover:bg-blue-50 flex items-center justify-center shrink-0">
                <Search className="h-3 w-3 text-gray-500"/>
              </button>
            </div>
          </div>

          {/* 수수료적용월 */}
          <div className="flex items-center gap-1">
            <SL>수수료적용월</SL>
            <Input type="month" value={filters.commissionMonth}
              onChange={e=>setF('commissionMonth',e.target.value)}
              className="h-6 text-xs w-32 border-gray-300"/>
          </div>

          {/* 빠른검색 초기화 */}
          {(filters.productGroup!=='전체'||filters.insuranceCode||filters.ingredientCode||filters.mfSearchVal||filters.billingType!=='전체'||filters.productName||filters.customCode||filters.note||filters.salesManagerName||filters.commissionMonth) && (
            <button onClick={()=>setFilters({productGroup:'전체',insuranceCode:'',ingredientCode:'',mfSearchType:'mf',mfSearchVal:'',billingType:'전체',productName:'',customCode:'',note:'',salesManagerName:'',commissionMonth:'',includeDeleted:false})}
              className="h-6 px-2 text-[10px] text-gray-400 hover:text-red-500 border border-gray-200 rounded bg-white">
              초기화
            </button>
          )}
        </div>
      </div>

      {/* ══ 목록 툴바 ══ */}
      <div className="bg-white border-b px-3 py-1 flex items-center gap-3 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox"
            checked={allChecked}
            ref={el=>{ if(el) el.indeterminate = someChecked }}
            onChange={e=>toggleAll(e.target.checked)}
            className="w-3.5 h-3.5"/>
          <span className="text-[10px] text-gray-500">전체선택</span>
        </label>
        <span className="text-[10px] text-gray-400">{loading ? '조회중...' : `${products.length}건`}</span>
        {checkedIds.size > 0 && (
          <span className="text-[10px] text-blue-600 font-medium">{checkedIds.size}건 선택됨</span>
        )}
      </div>

      {/* ══ 목록 테이블 ══ */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              <th className="w-8 px-2 py-1.5 text-center">
                <input type="checkbox"
                  checked={allChecked}
                  ref={el=>{ if(el) el.indeterminate = someChecked }}
                  onChange={e=>toggleAll(e.target.checked)}
                  className="w-3.5 h-3.5"/>
              </th>
              {['번','제조사','정산처','보험코드','제품명','규격/단위','제품그룹','제형','급여','제약수수료','담당수수료'].map(h=>(
                <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">조회 중...</td></tr>
            ) : products.length===0 ? (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
            ) : products.map((p,i)=>(
              <tr key={p.id}
                onClick={()=>openEdit(p)}
                className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors',
                  checkedIds.has(p.id)?'bg-blue-100':i%2===0?'bg-white':'bg-gray-50/40',
                  selected?.id===p.id&&!checkedIds.has(p.id)?'bg-blue-50':'')}>
                <td className="px-2 py-1 text-center" onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={checkedIds.has(p.id)} onChange={()=>toggleOne(p.id)}
                    className="w-3.5 h-3.5"/>
                </td>
                <td className="px-2 py-1 text-gray-400">{i+1}</td>
                <td className="px-2 py-1 text-gray-600 max-w-[100px] truncate">{p.manufacturer_name}</td>
                <td className="px-2 py-1 text-gray-500 max-w-[80px] truncate">{p.settlement_place}</td>
                <td className="px-2 py-1 font-mono text-gray-600 text-[10px]">{p.insurance_code}</td>
                <td className="px-2 py-1 font-medium text-gray-800 max-w-[160px] truncate">{p.product_name}</td>
                <td className="px-2 py-1 text-gray-500">{p.specification}</td>
                <td className="px-2 py-1 text-gray-500 max-w-[80px] truncate">{p.product_group}</td>
                <td className="px-2 py-1 text-gray-500">{p.dosage_form}</td>
                <td className="px-2 py-1">
                  <Badge className={cn('text-[10px] px-1 py-0 h-4',
                    p.billing_type==='비급여'?'bg-orange-100 text-orange-700 border-orange-200':'bg-green-100 text-green-700 border-green-200')}>
                    {p.billing_type||'급여'}
                  </Badge>
                </td>
                <td className="px-2 py-1 text-right text-gray-600 text-[10px]">
                  {p.mfg_commission_rate!=null?`${p.mfg_commission_rate}%`:''}
                </td>
                <td className="px-2 py-1 text-right text-gray-600 text-[10px]">
                  {p.manager_commission_rate!=null?`${p.manager_commission_rate}%`:''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════
          제품입력 모달
      ══════════════════════════════════ */}
      {showModal && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e=>{if(e.target===e.currentTarget)setShowModal(false)}}>
          <div className="bg-white border border-gray-500 shadow-2xl flex flex-col"
            style={{width:502, maxHeight:'92vh'}}>

            <div className="flex items-center justify-between px-3 py-1.5 bg-[#4472c4] text-white shrink-0">
              <span className="text-sm font-bold tracking-wider">제품입력</span>
              <button onClick={()=>setShowModal(false)} className="text-white/70 hover:text-white text-xs">&gt;&gt;</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="grid gap-y-[5px]" style={{gridTemplateColumns:'68px 1fr 68px 1fr'}}>

                <FL>보험 코드</FL>
                <div className="col-span-3"><Input value={selected.insurance_code||''} onChange={upd('insurance_code')} className={cn(I,'w-full')}/></div>

                <FL>자체 코드</FL>
                <div className="col-span-3 flex items-center gap-1.5">
                  <Input value={selected.custom_code||''} onChange={upd('custom_code')} className={cn(I,'flex-1')}/>
                  <button onClick={checkDuplicate}
                    className="text-[10px] px-2.5 h-6 border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 whitespace-nowrap font-medium">중복확인</button>
                </div>

                <FL>제&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;품</FL>
                <div className="col-span-3"><Input value={selected.product_name||''} onChange={upd('product_name')} className={cn(I,'w-full')}/></div>

                <FL>규격 / 단위</FL>
                <Input value={selected.specification||''} onChange={upd('specification')} className={cn(I,'w-full')}/>
                <FL>품절여부</FL>
                <div className="flex items-center pl-1">
                  <input type="checkbox" checked={!!selected.is_out_of_stock}
                    onChange={e=>setSel('is_out_of_stock',e.target.checked)} className="w-4 h-4 cursor-pointer"/>
                </div>

                <FL>제&nbsp; 조&nbsp; 사</FL>
                <div className="flex items-center gap-0.5">
                  <Input value={selected.manufacturer_name||''} onChange={upd('manufacturer_name')} className={cn(I,'flex-1 min-w-0')}/>
                  <button onClick={()=>openMfSearch('mf')}
                    className="shrink-0 h-6 w-6 border border-gray-300 rounded bg-gray-50 hover:bg-blue-50 flex items-center justify-center">
                    <Search className="h-3 w-3 text-gray-500"/></button>
                </div>
                <FL>정&nbsp; 산&nbsp; 처</FL>
                <div className="flex items-center gap-0.5">
                  <Input value={selected.settlement_place||''} onChange={upd('settlement_place')} className={cn(I,'flex-1 min-w-0')}/>
                  <button onClick={()=>openMfSearch('settlement')}
                    className="shrink-0 h-6 w-6 border border-gray-300 rounded bg-gray-50 hover:bg-blue-50 flex items-center justify-center">
                    <Search className="h-3 w-3 text-gray-500"/></button>
                </div>

                <FL>제 품 그 룹</FL>
                <Select value={selected.product_group||''} onValueChange={v=>setSel('product_group',v)}>
                  <SelectTrigger className={cn(I,'w-full')}><SelectValue placeholder="선택"/></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="" className="text-xs">없음</SelectItem>
                    {productGroups.map(g=><SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FL>제 형 구 분</FL>
                <Select value={selected.dosage_form||'내복제'} onValueChange={v=>setSel('dosage_form',v)}>
                  <SelectTrigger className={cn(I,'w-full')}><SelectValue/></SelectTrigger>
                  <SelectContent>{DOSAGE_FORMS.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>

                <FL>급 여 구 분</FL>
                <Select value={selected.billing_type||'급여'} onValueChange={v=>setSel('billing_type',v)}>
                  <SelectTrigger className={cn(I,'w-full')}><SelectValue/></SelectTrigger>
                  <SelectContent>{BILLING_TYPES.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
                <FL>약 품 구 분</FL>
                <Select value={selected.drug_type||'보험(일반)'} onValueChange={v=>setSel('drug_type',v)}>
                  <SelectTrigger className={cn(I,'w-full')}><SelectValue/></SelectTrigger>
                  <SelectContent>{DRUG_TYPES.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>

                <FL>매 출 금 액</FL>
                <Input type="number" value={selected.sale_price??''} onChange={e=>setSel('sale_price',e.target.value?Number(e.target.value):null)} className={cn(I,'w-full text-right')}/>
                <FL>최종보험금액</FL>
                <Input type="number" value={selected.final_price??''} onChange={e=>setSel('final_price',e.target.value?Number(e.target.value):null)} className={cn(I,'w-full text-right')}/>

                <FL>성 분 코 드</FL>
                <div className="flex items-center gap-0.5">
                  <Input value={selected.ingredient_code||''} onChange={upd('ingredient_code')} className={cn(I,'flex-1 min-w-0')}/>
                  <button onClick={()=>openIngSearch('form')}
                    className="shrink-0 h-6 w-6 border border-gray-300 rounded bg-gray-50 hover:bg-blue-50 flex items-center justify-center">
                    <Search className="h-3 w-3 text-gray-500"/></button>
                </div>
                <FL>성분분류명</FL>
                <Input value={selected.ingredient_category||''} onChange={upd('ingredient_category')} className={cn(I,'w-full')}/>

                <FL className="pt-1 self-start">성&nbsp; 분&nbsp; 명</FL>
                <div className="col-span-3">
                  <textarea value={selected.ingredient_name||''} onChange={upd('ingredient_name')}
                    className="w-full text-xs border border-gray-300 rounded p-1.5 resize-none focus:outline-none focus:border-blue-400 bg-white" rows={4}/>
                </div>

                <FL>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</FL>
                <Input value={selected.note||''} onChange={upd('note')} className={cn(I,'w-full')}/>
                <FL>비&nbsp;&nbsp;&nbsp;&nbsp;고 2</FL>
                <Input value={selected.note2||''} onChange={upd('note2')} className={cn(I,'w-full')}/>

                <FL>대체조제가능</FL>
                <Input value={selected.generic_availability||''} onChange={upd('generic_availability')} className={cn(I,'w-full')}/>
                <FL className="text-[9px]">저가대체인센티브</FL>
                <Input value={selected.low_cost_incentive||''} onChange={upd('low_cost_incentive')} className={cn(I,'w-full')}/>
              </div>

              {/* 보험약가 변경내역 */}
              <div className="mt-3 border border-gray-300">
                <div className="bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700 border-b border-gray-300">보험 약가 변경 내역</div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b border-gray-300">
                    <tr>
                      <th className="px-3 py-1 text-center border-r border-gray-200">적용일자</th>
                      <th className="px-3 py-1 text-center border-r border-gray-200">급여구분</th>
                      <th className="px-3 py-1 text-center">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.filter(h=>h.id).map(h=>(
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1 text-center border-r">{h.applied_date}</td>
                        <td className="px-3 py-1 text-center border-r">{h.billing_type}</td>
                        <td className="px-3 py-1 text-right">{Number(h.price||0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {priceHistory.filter(h=>!h.id).map((h,i)=>(
                      <tr key={`new-${i}`} className="border-b border-blue-100 bg-blue-50/30">
                        <td className="px-3 py-1 text-center text-blue-600 border-r">{h.applied_date}</td>
                        <td className="px-3 py-1 text-center text-blue-600 border-r">{h.billing_type}</td>
                        <td className="px-3 py-1 text-right text-blue-600">{Number(h.price||0).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200 bg-yellow-50/40">
                      <td className="px-1 py-0.5 border-r border-gray-200">
                        <input type="date" value={newRow.applied_date}
                          onChange={e=>setNewRow(r=>({...r,applied_date:e.target.value}))}
                          className="w-full text-[10px] bg-transparent outline-none"/>
                      </td>
                      <td className="px-1 py-0.5 border-r border-gray-200">
                        <select value={newRow.billing_type} onChange={e=>setNewRow(r=>({...r,billing_type:e.target.value}))}
                          className="w-full text-[10px] bg-transparent outline-none">
                          {BILLING_TYPES.map(v=><option key={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-0.5">
                        <div className="flex items-center gap-1">
                          <input type="number" value={newRow.price}
                            onChange={e=>setNewRow(r=>({...r,price:e.target.value}))}
                            className="flex-1 text-[10px] text-right bg-transparent outline-none"/>
                          <button onClick={addHistoryRow}
                            className="shrink-0 text-[9px] px-1.5 h-4 bg-blue-600 text-white rounded">추가</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 수수료 */}
              <div className="mt-3 space-y-[4px]">
                {([
                  ['제약 수수료를','mfg_commission_rate','추가수수료를','additional_mfg_commission_rate'],
                  ['담당 수수료를','manager_commission_rate','추가수수료를','additional_manager_commission_rate'],
                ] as const).map(([l1,f1,l2,f2])=>(
                  <div key={f1} className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-700 font-medium shrink-0 text-right" style={{width:68}}>{l1}</label>
                    <Input type="number" value={(selected as any)[f1]??''}
                      onChange={e=>setSel(f1,e.target.value?Number(e.target.value):null)} className={cn(I,'flex-1 text-right')}/>
                    <span className="text-gray-400 text-[10px] shrink-0 px-0.5">▶</span>
                    <label className="text-[10px] text-gray-700 font-medium shrink-0 text-right" style={{width:56}}>{l2}</label>
                    <Input type="number" value={(selected as any)[f2]??''}
                      onChange={e=>setSel(f2,e.target.value?Number(e.target.value):null)} className={cn(I,'flex-1 text-right')}/>
                  </div>
                ))}
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="border-t px-3 py-2 flex items-center justify-center gap-3 shrink-0 bg-gray-100">
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-6"
                onClick={handleSave} disabled={saving}>
                <Save className="h-3 w-3 mr-1"/>{saving?'저장중...':'저장(F5)'}
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs px-6"
                onClick={handleDelete} disabled={!selected.id}>삭제</Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          팝업 — 제조사/정산처 검색
      ══════════════════════════════════ */}
      {mfTarget && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-xl" style={{maxHeight:'75vh'}}>
            <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between rounded-t-lg shrink-0">
              <span className="text-sm font-bold">
                {mfTarget==='filter'
                  ? (filters.mfSearchType==='mf'?'제조사 조회':'정산처 조회')
                  : mfTarget==='mf'?'제조사 조회':'정산처 조회'}
              </span>
              <button onClick={()=>{setMfTarget(null);setMfQuery('')}}><X className="h-4 w-4 text-white/60 hover:text-white"/></button>
            </div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
                <input ref={mfRef} value={mfQuery} onChange={e=>setMfQuery(e.target.value)}
                  placeholder="제조사명 또는 SC코드로 검색..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"/>
              </div>
              <div className="mt-1 text-[10px] text-gray-400">{filteredMf.length}건</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>{['SC코드','제조사명','사업자번호','대표자명'].map(h=>(
                    <th key={h} className="px-3 py-1.5 text-left font-semibold border-b border-gray-200">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {mfLoading?(<tr><td colSpan={4} className="text-center py-8 text-gray-400">로딩 중...</td></tr>)
                  :filteredMf.slice(0,200).map((m,i)=>(
                    <tr key={m.id} onClick={()=>selectMf(m)}
                      className={cn('border-b cursor-pointer hover:bg-blue-50',i%2===0?'bg-white':'bg-gray-50/40')}>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-gray-500">{m.sc_code}</td>
                      <td className="px-3 py-1.5 font-medium">{m.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.business_number}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.representative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-3 py-2 flex justify-end bg-gray-50 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{setMfTarget(null);setMfQuery('')}}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          팝업 — 성분코드 검색
      ══════════════════════════════════ */}
      {showIngSearch && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-2xl" style={{maxHeight:'75vh'}}>
            <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between rounded-t-lg shrink-0">
              <span className="text-sm font-bold">성분 조회 (건강보험심사평가원)</span>
              <button onClick={()=>{setShowIngSearch(false);setIngQuery('');setIngResults([])}}><X className="h-4 w-4 text-white/60 hover:text-white"/></button>
            </div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
                  <input ref={ingRef} value={ingQuery} onChange={e=>searchIngredients(e.target.value)}
                    placeholder="성분명 또는 성분코드 검색..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"/>
                </div>
                <button onClick={loadAllIngredients}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 whitespace-nowrap">
                  전체조회
                </button>
              </div>
              <div className="mt-1 text-[10px] text-gray-400">
                {ingLoading?'조회 중...'
                  :ingResults.length>0?`${ingResults.length}건${!ingQuery?' (전체 처음 300건)':' (최대 200건)'}`
                  :'성분명·코드 검색 또는 전체조회 버튼을 누르세요'}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>{['성분코드','제형코드','제형','성분명(일반명)','분류번호'].map(h=>(
                    <th key={h} className="px-2 py-1.5 text-left font-semibold border-b border-gray-200">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {ingResults.map((item,i)=>(
                    <tr key={`${item.ingredient_code}-${i}`} onClick={()=>selectIng(item)}
                      className={cn('border-b cursor-pointer hover:bg-blue-50',i%2===0?'bg-white':'bg-gray-50/40')}>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-gray-600">{item.ingredient_code}</td>
                      <td className="px-2 py-1.5 text-[10px] text-gray-500">{item.form_code}</td>
                      <td className="px-2 py-1.5 text-[10px] text-gray-500">{item.form_name}</td>
                      <td className="px-2 py-1.5 font-medium">{item.ingredient_name}</td>
                      <td className="px-2 py-1.5 text-[10px] text-gray-500">{item.category_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-3 py-2 flex justify-end bg-gray-50 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={()=>{setShowIngSearch(false);setIngQuery('');setIngResults([])}}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          팝업 — 영업담당자 검색
      ══════════════════════════════════ */}
      {showMgrSearch && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-md" style={{maxHeight:'70vh'}}>
            <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between rounded-t-lg shrink-0">
              <span className="text-sm font-bold">영업담당자 조회</span>
              <button onClick={()=>{setShowMgrSearch(false);setMgrQuery('')}}><X className="h-4 w-4 text-white/60 hover:text-white"/></button>
            </div>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
                <input ref={mgrRef} value={mgrQuery} onChange={e=>searchMgr(e.target.value)}
                  placeholder="담당자명 검색..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"/>
              </div>
              <div className="mt-1 text-[10px] text-gray-400">{mgrLoading?'조회 중...':`${mgrResults.length}건`}</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>{['담당자명','부서1','부서2'].map(h=>(
                    <th key={h} className="px-3 py-1.5 text-left font-semibold border-b border-gray-200">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {mgrResults.map((m,i)=>(
                    <tr key={m.id} onClick={()=>selectMgr(m)}
                      className={cn('border-b cursor-pointer hover:bg-blue-50',i%2===0?'bg-white':'bg-gray-50/40')}>
                      <td className="px-3 py-1.5 font-medium">{m.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.department1}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.department2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-3 py-2 flex justify-end bg-gray-50 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{setShowMgrSearch(false);setMgrQuery('')}}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          엑셀 일괄등록 모달
      ══════════════════════════════════ */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{width:'95vw', maxWidth:1100, maxHeight:'90vh'}}>
            <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap shrink-0">
              <span className="text-sm font-bold text-gray-800 mr-2">
                엑셀 일괄등록({bulkMode==='급여'?'제품':'비보험제품'})
              </span>
              {bulkMode==='급여'
                ? <button onClick={()=>{setBulkMode('비보험');setBulkRows([])}} className="h-7 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50">비보험제품</button>
                : <button onClick={()=>{setBulkMode('급여');setBulkRows([])}}  className="h-7 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50">급여제품</button>
              }
              <button onClick={downloadBulkSample} className="h-7 px-3 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">샘플양식</button>
              <button onClick={()=>bulkFileRef.current?.click()}
                className="h-7 px-3 text-xs border border-blue-300 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium">불러오기</button>
              <input ref={bulkFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkFile}/>
              <button onClick={saveBulkRows} disabled={bulkBusy||bulkRows.length===0}
                className={cn('h-7 px-4 text-xs rounded font-medium text-white',
                  bulkRows.length>0&&!bulkBusy?'bg-blue-600 hover:bg-blue-700':'bg-gray-300 cursor-not-allowed')}>
                저장(F5)
              </button>
              {bulkMode==='급여' && <>
                <button onClick={downloadBulkResult} disabled={bulkRows.length===0}
                  className={cn('h-7 px-3 text-xs border rounded',bulkRows.length>0?'border-gray-300 hover:bg-gray-50':'border-gray-200 text-gray-300 cursor-not-allowed')}>Excel</button>
                <button onClick={downloadUnmatched} disabled={unmatchedCount===0}
                  className={cn('h-7 px-3 text-xs border rounded',unmatchedCount>0?'border-red-300 text-red-600 hover:bg-red-50':'border-gray-200 text-gray-300 cursor-not-allowed')}>
                  미매칭엑셀{unmatchedCount>0?` (${unmatchedCount})`:''}
                </button>
              </>}
              {bulkRows.length>0 && (
                <span className="text-xs text-gray-500 ml-1">
                  총 {bulkRows.length}건
                  {bulkMode==='급여' && <> · <span className="text-green-600">매칭 {matchedCount}</span> · <span className="text-red-500">미매칭 {unmatchedCount}</span></>}
                </span>
              )}
              <button onClick={()=>{setShowBulk(false);setBulkRows([])}} className="ml-auto">
                <X className="h-5 w-5 text-gray-400 hover:text-gray-700"/>
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {bulkBusy ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">처리 중...</div>
              ) : bulkRows.length===0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                  <Upload className="h-8 w-8 opacity-40"/>
                  <p className="text-sm">샘플양식을 다운로드 후 작성하여 <strong className="text-blue-600">불러오기</strong>를 눌러주세요</p>
                </div>
              ) : bulkMode==='급여' ? (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr className="border-b border-gray-300">
                      {['순번','보험코드(엑셀)','제품명(엑셀)','자체코드','보험코드(DB)','제품명(DB)','규격','제조사','정산처','적용시작월','적용종료월','제약수수료','추가(제약)','담당수수료','추가(담당)','비고','비고2','품절'].map((h,i)=>(
                        <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap border-r border-gray-200 last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r,i)=>(
                      <tr key={i} className={cn('border-b border-gray-100',r.matched?'bg-white hover:bg-blue-50':'bg-red-50/60 hover:bg-red-50')}>
                        <td className="px-2 py-1 text-gray-400 border-r">{i+1}</td>
                        <td className="px-2 py-1 font-mono text-gray-600 border-r">{r.excelCode}</td>
                        <td className="px-2 py-1 border-r">{r.excelName}</td>
                        <td className="px-2 py-1 border-r">{r.customCode}</td>
                        <td className="px-2 py-1 font-mono border-r">{r.matched?.insurance_code||<span className="text-red-400 text-[10px]">미매칭</span>}</td>
                        <td className="px-2 py-1 font-medium border-r">{r.matched?.product_name||''}</td>
                        <td className="px-2 py-1 text-gray-500 border-r">{r.matched?.specification||''}</td>
                        <td className="px-2 py-1 text-gray-500 border-r">{r.matched?.manufacturer_name||''}</td>
                        <td className="px-2 py-1 text-gray-500 border-r">{r.matched?.settlement_place||''}</td>
                        <td className="px-2 py-1 border-r">{r.startMonth}</td>
                        <td className="px-2 py-1 border-r">{r.endMonth}</td>
                        <td className="px-2 py-1 text-right border-r">{r.mfgRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.addMfgRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.mgrRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.addMgrRate??''}</td>
                        <td className="px-2 py-1 border-r">{r.note}</td>
                        <td className="px-2 py-1 border-r">{r.note2}</td>
                        <td className="px-2 py-1 text-center">{r.outOfStock?'Y':''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr className="border-b border-gray-300">
                      {['순번','보험코드','자체코드','제조사코드','제품명','규격/단위','제형','매출금액','적용시작월','적용종료월','제약수수료','추가(제약)','담당수수료','추가(담당)','비고','비고2','품절'].map((h,i)=>(
                        <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap border-r border-gray-200 last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r,i)=>(
                      <tr key={i} className={cn('border-b border-gray-100',i%2===0?'bg-white':'bg-gray-50/40','hover:bg-blue-50')}>
                        <td className="px-2 py-1 text-gray-400 border-r">{i+1}</td>
                        <td className="px-2 py-1 font-mono border-r">{r.insuranceCode}</td>
                        <td className="px-2 py-1 border-r">{r.customCode}</td>
                        <td className="px-2 py-1 font-mono border-r">{r.mfgCode}</td>
                        <td className="px-2 py-1 font-medium border-r">{r.productName}</td>
                        <td className="px-2 py-1 border-r">{r.specification}</td>
                        <td className="px-2 py-1 border-r">{r.dosageForm}</td>
                        <td className="px-2 py-1 text-right border-r">{r.salePrice??''}</td>
                        <td className="px-2 py-1 border-r">{r.startMonth}</td>
                        <td className="px-2 py-1 border-r">{r.endMonth}</td>
                        <td className="px-2 py-1 text-right border-r">{r.mfgRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.addMfgRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.mgrRate??''}</td>
                        <td className="px-2 py-1 text-right border-r">{r.addMgrRate??''}</td>
                        <td className="px-2 py-1 border-r">{r.note}</td>
                        <td className="px-2 py-1 border-r">{r.note2}</td>
                        <td className="px-2 py-1 text-center">{r.outOfStock?'Y':''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t px-4 py-1.5 bg-gray-50 text-[10px] text-gray-400 shrink-0">
              {bulkMode==='급여'
                ? '* 보험코드로 기존 제품을 매칭합니다. 매칭(흰색)은 수수료율·비고·품절여부를 업데이트합니다. 미매칭(분홍색)은 저장 제외됩니다.'
                : '* 비보험 신규 제품을 일괄 등록합니다. 제품명은 필수입니다.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
