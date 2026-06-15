'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Customer, CustomerChangeHistory, User, CSOCompany } from '@/lib/types'
import { Search, Plus, Trash2, Save, FileSpreadsheet, X, MapPin, Upload, Download, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'
import { DataPagination } from '@/components/ui/data-pagination'

const CUST_PAGE_SIZE = 30

/* ────── 상수 ────── */
const CUSTOMER_TYPES_FILTER = ['전체선택','의원','병원','약국','한의원','치과의원','종합병원','상급종합병원','요양병원','보건소','기타']
const CUSTOMER_TYPES = ['의원','병원','약국','종합병원','상급종합병원','요양병원','치과병원','치과의원','한방병원','한의원','조산원','보건소','보건의료원','보건지소','보건진료소','모자보건센타','정신요양병원','제약회사','도매상','의료기·시약','편의점','현매','기타']
const BILLING_TYPES = ['처방(EDI)','약국조제','수기','공급내역','도매매출','거래명세서','기타']
const DISPLAY_SUBJECTS = ['가정의학과','결핵과','구강내과','구경병리과','구강악안면외과','기관단위','내과','마취통증의학과','방사선종양학과','병리과','보건','보건기관의과','보건기관치과','보건기관한방','비뇨기과','사상체질과','산부인과','산업의학과','성형외과','소아청소년과','소아치과','신경과','신경외과','안과','약국','영상의학과','영상치의학과','예방의학과','예방치과','외과','응급학과','이비인후과','일반','일반의','재활의학과','정신건강의학과','정형외과','직업환경의학과','진단검사의학과','진료과목코드오류','치콰','치과교정과','치과보존과','치과보철과','치과소계','치주과','침구과','통합치의학과','피부과','한방','한방내과','한방부인과','한방소계','한방소아과','한방신경정신과','한방안·이비인후·피부과','한방응급','한방재활의학과','핵의학과','흉부외과']
const BED_SCALES = ['병상없음','0~29병상','30~99병상','100~299병상','300병상이상']
const CLOSURE_TYPES = ['정상','휴업','폐업']
const RESTRICTION_TYPES = ['전체허용','제조사제한','제품제한']
const CUST_CATEGORIES = ['없음','일반','CSO1','CSO2','CSO3']

const EMPTY: Customer = {
  id:'',sc_code:'',business_number:'',custom_code:'',ykiho:'',name:'',representative:'',address:'',road_address:'',detail_address:'',postal_code:'',customer_type:'의원',display_subject:'',bed_scale:'병상없음',customer_category:'없음',prescription_start_date:null,business_category:'',business_item:'',manufacturer_restriction:'전체허용',department1:'',department2:'',department3:'',sales_manager_id:null,cso_company_id:null,cso2_company_id:null,final_cso_company_id:null,billing_type:'처방(EDI)',closure_type:'정상',closure_date:null,phone:'',fax:'',note:'',is_deleted:false,created_at:'',updated_at:'',
}

/* 주소검색 */
function openAddressSearch(cb:(z:string,r:string)=>void){
  const run=()=>new (window as any).daum.Postcode({oncomplete:(d:any)=>cb(d.zonecode,d.roadAddress||d.autoRoadAddress||'')}).open()
  if((window as any).daum?.Postcode){run();return}
  const s=document.createElement('script');s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.onload=run;document.head.appendChild(s)
}

/* ══════════════════ MAIN ══════════════════ */
export default function CustomersPage() {
  const supabase = createClient()
  const [customers,     setCustomers]     = useState<Customer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [custPage,      setCustPage]      = useState(0)
  const [custTotal,     setCustTotal]     = useState(0)
  const [selected,      setSelected]      = useState<Customer | null>(null)
  const [showPanel,     setShowPanel]     = useState(false)
  const [filters,       setFilters]       = useState({ name:'', businessNumber:'', customerType:'전체선택', isDeleted:false })
  const [saving,        setSaving]        = useState(false)
  const [users,         setUsers]         = useState<User[]>([])
  const [csoList,       setCsoList]       = useState<CSOCompany[]>([])
  const [changeHistory, setChangeHistory] = useState<CustomerChangeHistory[]>([])

  /* 체크박스 */
  const [checked, setChecked] = useState<Set<string>>(new Set())

  /* 제조사 검색 */
  const [showMfSearch,  setShowMfSearch]  = useState(false)
  const [mfQuery,       setMfQuery]       = useState('')
  const [manufacturers, setManufacturers] = useState<any[]>([])
  const [mfLoading,     setMfLoading]     = useState(false)
  const mfInputRef = useRef<HTMLInputElement>(null)

  /* 모달 */
  const [showChangeInfo,  setShowChangeInfo]  = useState(false)
  const [showBulkUpload,  setShowBulkUpload]  = useState(false)
  const [showBulkEdit,    setShowBulkEdit]    = useState(false)

  /* 거래처 변경정보 */
  const [changeInfoData,    setChangeInfoData]    = useState<CustomerChangeHistory[]>([])
  const [changeInfoLoading, setChangeInfoLoading] = useState(false)

  /* 엑셀 일괄등록 */
  const [uploadRows,    setUploadRows]    = useState<any[]>([])
  const [uploadSaving,  setUploadSaving]  = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* 일괄수정 */
  const [bulkEdit, setBulkEdit] = useState({ sales_manager_id:'', cso_company_id:'', billing_type:'', closure_type:'' })

  /* ── 데이터 로드 ── */
  const loadCustomers = useCallback(async (p = 0) => {
    setLoading(true)
    let q = supabase.from('customers')
      .select('*', { count: 'exact' })
      .eq('is_deleted', filters.isDeleted)
      .order('name')
    if (filters.name)           q = q.ilike('name',            `%${filters.name}%`)
    if (filters.businessNumber) q = q.ilike('business_number', `%${filters.businessNumber}%`)
    if (filters.customerType !== '전체선택') q = q.eq('customer_type', filters.customerType)
    const { data, count } = await (q as any).range(p * CUST_PAGE_SIZE, (p + 1) * CUST_PAGE_SIZE - 1)
    setCustomers(data || [])
    setCustTotal(count ?? 0)
    setChecked(new Set())
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { setCustPage(0); loadCustomers(0) }, [loadCustomers])

  useEffect(() => {
    supabase.from('users').select('id,name,login_id').eq('is_active',true).order('name').then(({data})=>setUsers((data as any)||[]))
    supabase.from('cso_companies').select('id,name,cso_code').eq('is_deleted',false).order('name').then(({data})=>setCsoList((data as any)||[]))
  }, [supabase])

  async function loadHistory(cId:string, scCode:string|null) {
    let q = supabase.from('customer_change_history').select('*').order('changed_at',{ascending:false}).limit(50)
    if(cId) q=q.eq('customer_id',cId); else if(scCode) q=q.eq('sc_code',scCode)
    const {data}=await q; setChangeHistory((data as CustomerChangeHistory[])||[])
  }

  async function loadChangeInfo() {
    setChangeInfoLoading(true)
    const {data}=await supabase.from('customer_change_history').select('*').order('sc_code').limit(1000)
    setChangeInfoData((data as CustomerChangeHistory[])||[])
    setChangeInfoLoading(false)
  }

  /* ── 저장/삭제 ── */
  function openNew()  { setSelected({...EMPTY}); setChangeHistory([]); setShowPanel(true) }
  function openEdit(c:Customer) { setSelected(c); setChangeHistory([]); setShowPanel(true); if(c.id) loadHistory(c.id,c.sc_code) }

  async function handleSave() {
    if (!selected||!selected.name) { alert('거래처명을 입력하세요.'); return }
    setSaving(true)
    try {
      const clean={...selected} as any; delete clean.sales_manager; delete clean.cso_company
      if (selected.id) {
        const {error}=await supabase.from('customers').update({...clean,updated_at:new Date().toISOString()}).eq('id',selected.id)
        if(error){alert('저장 실패: '+error.message);return}
      } else {
        const {id:_i,created_at:_c,updated_at:_u,...rest}=clean
        const {error}=await supabase.from('customers').insert(rest)
        if(error){alert('저장 실패: '+error.message);return}
      }
      alert('저장되었습니다.'); setShowPanel(false); loadCustomers()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!selected?.id||!confirm('삭제하시겠습니까?')) return
    await supabase.from('customers').update({is_deleted:true}).eq('id',selected.id)
    setShowPanel(false); loadCustomers()
  }

  /* ── 체크박스 ── */
  function toggleCheck(id:string) {
    setChecked(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  }
  function toggleAll() {
    if (checked.size===customers.length) setChecked(new Set())
    else setChecked(new Set(customers.map(c=>c.id)))
  }

  async function handleBulkDelete() {
    if (!checked.size||!confirm(`선택한 ${checked.size}건을 삭제하시겠습니까?`)) return
    await supabase.from('customers').update({is_deleted:true}).in('id',[...checked])
    setChecked(new Set()); loadCustomers()
  }

  async function handleBulkEditSave() {
    const upd:any={}
    if(bulkEdit.sales_manager_id) upd.sales_manager_id=bulkEdit.sales_manager_id||null
    if(bulkEdit.cso_company_id)   upd.cso_company_id=bulkEdit.cso_company_id||null
    if(bulkEdit.billing_type)     upd.billing_type=bulkEdit.billing_type
    if(bulkEdit.closure_type)     upd.closure_type=bulkEdit.closure_type
    if(!Object.keys(upd).length){alert('수정할 항목을 선택하세요.');return}
    await supabase.from('customers').update(upd).in('id',[...checked])
    alert(`${checked.size}건 수정 완료.`); setShowBulkEdit(false); setChecked(new Set()); loadCustomers()
  }

  /* ── Excel 내려받기 (체크 선택 시 선택건만, 아니면 전체) ── */
  function downloadExcel() {
    const target = checked.size > 0
      ? customers.filter(c => checked.has(c.id))
      : customers
    const label = checked.size > 0 ? `거래처_선택${checked.size}건` : '거래처관리'
    const hdrs=['SC코드','사업자번호','자체코드','거래처명','거래처종류','표시과목','대표자명','전화번호','도로명주소','우편번호','처방시작일','병상규모','처방/조제','CSO업체','상태']
    const rows=target.map(c=>[c.sc_code,c.business_number,c.custom_code,c.name,c.customer_type,c.display_subject,c.representative,c.phone,c.road_address||c.address,c.postal_code,c.prescription_start_date,c.bed_scale,c.billing_type,csoList.find(x=>x.id===c.cso_company_id)?.name||'',c.closure_type])
    const wb=XLSX.utils.book_new()
    const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows])
    ws['!cols']=hdrs.map((_,i)=>({wch:i===3||i===8?25:12}))
    XLSX.utils.book_append_sheet(wb,ws,'거래처')
    XLSX.writeFile(wb,`${label}.xlsx`)
  }

  /* ── 샘플양식 다운로드 ── */
  function downloadTemplate() {
    const hdrs=['사업자번호(필수)','자체코드(사용시필수)','거래처명','영업담당자ID','CSO업체코드','거래시작일자','요양기관기호','처방/조제','비고','거래처구분']
    const sample=[['206-82-01898','027090','한양대학교병원','histobio001','CSO001','2020-07-01','99999999','처방(EDI)','','일반']]
    const wb=XLSX.utils.book_new()
    const ws=XLSX.utils.aoa_to_sheet([hdrs,...sample])
    ws['!cols']=hdrs.map(()=>({wch:18}))
    XLSX.utils.book_append_sheet(wb,ws,'거래처일괄등록')
    XLSX.writeFile(wb,'엑셀일괄등록_거래처_양식.xlsx')
  }

  /* ── 엑셀 일괄등록 파일 읽기 ── */
  function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=async (ev)=>{
      const data=new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb=XLSX.read(data,{type:'array'})
      const ws=wb.Sheets[wb.SheetNames[0]]
      const raw:any[]=XLSX.utils.sheet_to_json(ws,{header:1})
      if(raw.length<2){alert('데이터가 없습니다.');return}
      const [hdr,...dataRows]=raw
      const col=(name:string)=>hdr.findIndex((h:string)=>String(h).includes(name))
      const isBizNum=col('사업자'); const isName=col('거래처명'); const isCustomCode=col('자체코드')
      const isMgrId=col('영업담당자'); const isCsoCode=col('CSO'); const isStartDate=col('거래시작일')
      const isYkiho=col('요양기관'); const isBilling=col('처방'); const isNote=col('비고'); const isCat=col('거래처구분')

      // 사업자번호→customer 매핑
      const bnList=[...new Set(dataRows.map(r=>String(r[isBizNum]||'').trim()).filter(Boolean))]
      const {data:existCusts}=await supabase.from('customers').select('id,sc_code,business_number,name').in('business_number',bnList)
      const bnMap:Record<string,{id:string,sc_code:string|null,name:string}>= {}
      ;(existCusts||[]).forEach((c:any)=>{ if(c.business_number) bnMap[c.business_number.trim()]=c })

      // 영업담당자ID→user 매핑
      const mgrMap:Record<string,string>={}
      ;(users as any[]).forEach(u=>{ if(u.login_id) mgrMap[u.login_id]=u.id })

      // CSO코드→cso 매핑
      const csoCodeMap:Record<string,string>={}
      ;(csoList as any[]).forEach(c=>{ if(c.cso_code) csoCodeMap[c.cso_code]=c.id })

      const parsed=dataRows.filter(r=>r.some((v:any)=>v)).map((r,i)=>{
        const bn=String(r[isBizNum]||'').trim()
        const match=bnMap[bn]
        return {
          _idx:i+1, _matched:!!match,
          id:match?.id||null, sc_code:match?.sc_code||'',
          business_number:bn,
          name:String(r[isName]||match?.name||'').trim(),
          custom_code:isCustomCode>=0?String(r[isCustomCode]||'').trim():'',
          sales_manager_id:isMgrId>=0?mgrMap[String(r[isMgrId]||'').trim()]||null:null,
          _mgr_id_raw:isMgrId>=0?String(r[isMgrId]||'').trim():'',
          cso_company_id:isCsoCode>=0?csoCodeMap[String(r[isCsoCode]||'').trim()]||null:null,
          _cso_code_raw:isCsoCode>=0?String(r[isCsoCode]||'').trim():'',
          prescription_start_date:isStartDate>=0?String(r[isStartDate]||'').trim()||null:null,
          ykiho:isYkiho>=0?String(r[isYkiho]||'').trim():'',
          billing_type:isBilling>=0?String(r[isBilling]||'처방(EDI)').trim():'처방(EDI)',
          note:isNote>=0?String(r[isNote]||'').trim():'',
          customer_category:isCat>=0?String(r[isCat]||'없음').trim():'없음',
        }
      })
      setUploadRows(parsed)
    }
    reader.readAsArrayBuffer(file)
    e.target.value=''
  }

  async function handleUploadSave() {
    if(!uploadRows.length){alert('등록할 데이터가 없습니다.');return}
    setUploadSaving(true)
    try {
      const toUpdate=uploadRows.filter(r=>r._matched&&r.id)
      const toInsert=uploadRows.filter(r=>!r._matched||!r.id)
      const clean=(r:any)=>{
        const {_idx,_matched,_mgr_id_raw,_cso_code_raw,...rest}=r
        return rest
      }
      if(toUpdate.length){
        await supabase.from('customers').upsert(toUpdate.map(clean),{onConflict:'id'})
      }
      if(toInsert.length){
        const rows=toInsert.map(r=>{ const c=clean(r); delete c.id; return c })
        await supabase.from('customers').insert(rows)
      }
      alert(`저장 완료: 수정 ${toUpdate.length}건, 신규 ${toInsert.length}건`)
      setShowBulkUpload(false); setUploadRows([]); loadCustomers()
    } finally { setUploadSaving(false) }
  }

  /* ── 제조사 검색 ── */
  async function openMfSearch() {
    setShowMfSearch(true)
    setMfQuery('')
    if (manufacturers.length === 0) {
      setMfLoading(true)
      const { data } = await supabase.from('manufacturers').select('*').eq('is_deleted', false).order('name').limit(2000)
      setManufacturers(data || [])
      setMfLoading(false)
    }
    setTimeout(() => mfInputRef.current?.focus(), 100)
  }

  function selectManufacturer(m: any) {
    setSelected(s => s ? {
      ...s,
      sc_code:         m.sc_code         || s.sc_code,
      name:            m.name,
      business_number: m.business_number || s.business_number,
      representative:  m.representative  || s.representative,
      customer_type:   '제약회사',
    } : s)
    setShowMfSearch(false)
    setMfQuery('')
  }

  function downloadUnmatched() {
    const unmatched=uploadRows.filter(r=>!r._matched)
    if(!unmatched.length){alert('미매칭 데이터가 없습니다.');return}
    const hdrs=['사업자번호','거래처명','자체코드','영업담당자ID','CSO업체코드','거래시작일자','요양기관기호','처방/조제','비고','거래처구분']
    const rows=unmatched.map(r=>[r.business_number,r.name,r.custom_code,r._mgr_id_raw,r._cso_code_raw,r.prescription_start_date,r.ykiho,r.billing_type,r.note,r.customer_category])
    const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows])
    XLSX.utils.book_append_sheet(wb,ws,'미매칭'); XLSX.writeFile(wb,'미매칭거래처.xlsx')
  }

  const upd=(f:keyof Customer)=>(e:React.ChangeEvent<HTMLInputElement>)=>setSelected(s=>s?{...s,[f]:e.target.value}:s)
  const setSel=(f:keyof Customer,v:string)=>setSelected(s=>s?{...s,[f]:v||null}:s)
  const clr=(f:keyof Customer)=>setSelected(s=>s?{...s,[f]:''}:s)

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <div className="flex h-full">

      {/* ═══ 목록 ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ─ 툴바 ─ */}
        <div className="bg-white border-b px-3 py-1.5 flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">거래처 관리</span>

          {/* 검색 */}
          <Input placeholder="거래처명" value={filters.name}
            onChange={e=>setFilters(f=>({...f,name:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&loadCustomers()} className="h-7 text-xs w-24"/>
          <Input placeholder="사업자번호" value={filters.businessNumber}
            onChange={e=>setFilters(f=>({...f,businessNumber:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&loadCustomers()} className="h-7 text-xs w-24"/>
          <Select value={filters.customerType} onValueChange={v=>setFilters(f=>({...f,customerType:v}))}>
            <SelectTrigger className="h-7 text-xs w-24"><SelectValue/></SelectTrigger>
            <SelectContent>{CUSTOMER_TYPES_FILTER.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={filters.isDeleted} onChange={e=>setFilters(f=>({...f,isDeleted:e.target.checked}))}/>삭제포함
          </label>
          <Button size="sm" onClick={() => { setCustPage(0); loadCustomers(0) }} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1"/>조회
          </Button>

          {/* 거래처 변경정보 */}
          <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-orange-400 text-orange-600 hover:bg-orange-50"
            onClick={()=>{setShowChangeInfo(true);loadChangeInfo()}}>
            <History className="h-3 w-3 mr-1"/>거래처 변경정보
          </Button>

          {/* 선택 일괄 */}
          {checked.size>0 && (
            <>
              <span className="text-xs text-blue-600 font-semibold">{checked.size}건 선택</span>
              <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={handleBulkDelete}>
                <Trash2 className="h-3 w-3 mr-1"/>선택삭제
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-blue-600 border-blue-400"
                onClick={()=>setShowBulkEdit(true)}>
                일괄수정
              </Button>
            </>
          )}

          <div className="ml-auto flex gap-1.5 items-center">
            {/* 전체선택 */}
            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
              onClick={toggleAll}>
              {checked.size===customers.length&&customers.length>0?'선택해제':'전체선택'}
            </Button>
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1"/>신규등록
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
              onClick={()=>setShowBulkUpload(true)}>
              <Upload className="h-3 w-3 mr-1"/>엑셀일괄등록
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={downloadExcel}>
              <Download className="h-3 w-3 mr-1"/>엑셀 내려받기{checked.size>0&&<span className="ml-1 text-blue-600">({checked.size})</span>}
            </Button>
          </div>
        </div>

        {/* ─ 테이블 ─ */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-2 py-1.5 w-8">
                  <input type="checkbox" checked={checked.size===customers.length&&customers.length>0}
                    onChange={toggleAll} className="cursor-pointer"/>
                </th>
                {['번','SC코드','사업자번호','자체코드','거래처명','종류','표시과목','대표자명','영업담당자','CSO업체','처방시작일','상태'].map(h=>(
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?(
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ):customers.length===0?(
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ):customers.map((c,i)=>(
                <tr key={c.id}
                  className={cn('border-b border-gray-100 hover:bg-blue-50',
                    checked.has(c.id)?'bg-blue-50':selected?.id===c.id?'bg-blue-100':i%2===0?'bg-white':'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={checked.has(c.id)}
                      onChange={()=>toggleCheck(c.id)} className="cursor-pointer"
                      onClick={e=>e.stopPropagation()}/>
                  </td>
                  <td className="px-2 py-1 text-gray-400 cursor-pointer" onClick={()=>openEdit(c)}>{i+1}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono text-[10px] cursor-pointer" onClick={()=>openEdit(c)}>{c.sc_code}</td>
                  <td className="px-2 py-1 text-gray-600 cursor-pointer" onClick={()=>openEdit(c)}>{c.business_number}</td>
                  <td className="px-2 py-1 text-gray-500 cursor-pointer" onClick={()=>openEdit(c)}>{c.custom_code}</td>
                  <td className="px-2 py-1 font-medium text-gray-800 cursor-pointer" onClick={()=>openEdit(c)}>{c.name}</td>
                  <td className="px-2 py-1 cursor-pointer" onClick={()=>openEdit(c)}>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{c.customer_type}</Badge>
                  </td>
                  <td className="px-2 py-1 text-gray-500 cursor-pointer" onClick={()=>openEdit(c)}>{c.display_subject}</td>
                  <td className="px-2 py-1 text-gray-600 cursor-pointer" onClick={()=>openEdit(c)}>{c.representative}</td>
                  <td className="px-2 py-1 text-gray-600 cursor-pointer" onClick={()=>openEdit(c)}>{users.find(u=>u.id===c.sales_manager_id)?.name||''}</td>
                  <td className="px-2 py-1 text-gray-500 cursor-pointer" onClick={()=>openEdit(c)}>{csoList.find(x=>x.id===c.cso_company_id)?.name||''}</td>
                  <td className="px-2 py-1 text-gray-500 cursor-pointer" onClick={()=>openEdit(c)}>{c.prescription_start_date}</td>
                  <td className="px-2 py-1 cursor-pointer" onClick={()=>openEdit(c)}>
                    {c.closure_type&&c.closure_type!=='정상'
                      ?<Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">{c.closure_type}</Badge>
                      :<span className="text-gray-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataPagination
          page={custPage}
          pageSize={CUST_PAGE_SIZE}
          total={custTotal}
          onChange={p => { setCustPage(p); loadCustomers(p) }}
        />
      </div>

      {/* ═══ 상세 패널 ═══ */}
      {showPanel&&selected&&(
        <div className="w-[500px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-xl">
          <div className="px-3 py-2 bg-blue-600 text-white flex items-center justify-between shrink-0">
            <span className="text-sm font-bold">거래처{selected.id?'수정':'입력'} [ 거래처 ]</span>
            <div className="flex items-center gap-2">
              <button onClick={openMfSearch}
                className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 font-semibold">
                <Search className="h-3 w-3"/>거래처 조회
              </button>
              <button onClick={()=>setShowPanel(false)} className="text-white/60 hover:text-white"><X className="h-4 w-4"/></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="grid gap-y-[5px]" style={{gridTemplateColumns:'72px 1fr 72px 1fr'}}>
              <FL>SC코드</FL><Input value={selected.sc_code||''} onChange={upd('sc_code')} className={I}/>
              <FL>자체코드</FL><Input value={selected.custom_code||''} onChange={upd('custom_code')} className={I}/>
              <FL>사업자번호</FL><Input value={selected.business_number||''} onChange={upd('business_number')} className={I}/>
              <FL>요양기관기호</FL><Input value={selected.ykiho||''} onChange={upd('ykiho')} className={I}/>
              <FL>거래처</FL>
              <div className="col-span-3 relative"><Input value={selected.name} onChange={upd('name')} className={cn(I,'pr-6 w-full')} placeholder="거래처명"/><CX onClick={()=>clr('name')}/></div>
              <FL>대표자명</FL>
              <div className="relative"><Input value={selected.representative||''} onChange={upd('representative')} className={cn(I,'pr-6 w-full')}/><CX onClick={()=>clr('representative')}/></div>
              <FL>거래시작일자</FL><Input type="date" value={selected.prescription_start_date||''} onChange={upd('prescription_start_date')} className={cn(I,'w-full')}/>
              <FL>업태</FL>
              <div className="relative"><Input value={selected.business_category||''} onChange={upd('business_category')} className={cn(I,'pr-6 w-full')}/><CX onClick={()=>clr('business_category')}/></div>
              <FL>종목</FL>
              <div className="relative"><Input value={selected.business_item||''} onChange={upd('business_item')} className={cn(I,'pr-6 w-full')}/><CX onClick={()=>clr('business_item')}/></div>
              <FL>전화번호</FL>
              <div className="relative"><Input value={selected.phone||''} onChange={upd('phone')} className={cn(I,'pr-6 w-full')}/><CX onClick={()=>clr('phone')}/></div>
              <FL>팩스번호</FL><Input value={selected.fax||''} onChange={upd('fax')} className={cn(I,'w-full')}/>
              <FL>우편번호</FL>
              <div className="flex items-center gap-1">
                <Input value={selected.postal_code||''} onChange={upd('postal_code')} className={cn(I,'flex-1')} placeholder="우편번호"/>
                <button onClick={()=>openAddressSearch((z,r)=>setSelected(s=>s?{...s,postal_code:z,road_address:r}:s))}
                  className="shrink-0 h-6 w-6 flex items-center justify-center border border-gray-300 rounded bg-gray-50 hover:bg-blue-50"><MapPin className="h-3 w-3 text-gray-500"/></button>
              </div>
              <FL>표시과목</FL><SelF value={selected.display_subject||''} onChange={v=>setSel('display_subject',v)} options={DISPLAY_SUBJECTS} placeholder="선택"/>
              <FL>도로명주소</FL><div className="col-span-3"><Input value={selected.road_address||selected.address||''} onChange={upd('road_address')} className={cn(I,'w-full')}/></div>
              <FL>상세주소</FL><div className="col-span-3"><Input value={selected.detail_address||''} onChange={upd('detail_address')} className={cn(I,'w-full')}/></div>
              <FL>거래처종류</FL><SelF value={selected.customer_type} onChange={v=>setSel('customer_type',v)} options={CUSTOMER_TYPES}/>
              <FL>병상규모</FL><SelF value={selected.bed_scale||''} onChange={v=>setSel('bed_scale',v)} options={BED_SCALES} placeholder="선택"/>
              <FL>영업담당자</FL>
              <Select value={selected.sales_manager_id||''} onValueChange={v=>setSelected(s=>s?{...s,sales_manager_id:v||null}:s)}>
                <SelectTrigger className={cn(I,'w-full')}><SelectValue placeholder="없음"/></SelectTrigger>
                <SelectContent><SelectItem value="" className="text-xs">없음</SelectItem>{users.map(u=><SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>)}</SelectContent>
              </Select>
              <FL>처방/조제</FL><SelF value={selected.billing_type||'처방(EDI)'} onChange={v=>setSel('billing_type',v)} options={BILLING_TYPES}/>
              <FL>휴폐업구분</FL><SelF value={selected.closure_type||'정상'} onChange={v=>setSel('closure_type',v)} options={CLOSURE_TYPES}/>
              <FL>휴폐업일자</FL><Input type="date" value={selected.closure_date||''} onChange={upd('closure_date')} className={cn(I,'w-full')}/>
              <FL>비고</FL><div className="col-span-3"><Input value={selected.note||''} onChange={upd('note')} className={cn(I,'w-full')}/></div>
              <FL>허용구분</FL><SelF value={selected.manufacturer_restriction||'전체허용'} onChange={v=>setSel('manufacturer_restriction',v)} options={RESTRICTION_TYPES}/>
              <FL>거래처구분</FL><SelF value={selected.customer_category||'없음'} onChange={v=>setSel('customer_category',v)} options={CUST_CATEGORIES}/>
              <FL>CSO업체</FL>
              <CSOSel value={selected.cso_company_id} list={csoList} onChange={v=>setSelected(s=>s?{...s,cso_company_id:v||null}:s)}/>
              <FL>최종CSO업체</FL>
              <CSOSel value={selected.final_cso_company_id} list={csoList} onChange={v=>setSelected(s=>s?{...s,final_cso_company_id:v||null}:s)}/>
              <FL>CSO2업체</FL>
              <CSOSel value={selected.cso2_company_id} list={csoList} onChange={v=>setSelected(s=>s?{...s,cso2_company_id:v||null}:s)}/>
              <div/><div/>
            </div>
            {/* 수정이력 */}
            <div className="mt-3 border-t border-gray-200 pt-2">
              <div className="text-[11px] font-bold text-gray-700 mb-1">수정이력</div>
              <table className="w-full text-[10px] border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50"><tr>{['수정일시','거래처','자체코드','영업담당자','CSO업체'].map(h=><th key={h} className="px-1.5 py-1 text-left text-gray-500 font-semibold border-b border-gray-200">{h}</th>)}</tr></thead>
                <tbody>
                  {changeHistory.length===0
                    ?<tr><td colSpan={5} className="px-2 py-3 text-center text-gray-400">이력 없음</td></tr>
                    :changeHistory.map(h=>(
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-1.5 py-1 text-gray-500 whitespace-nowrap">{h.changed_at?new Date(h.changed_at).toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'}):''}</td>
                      <td className="px-1.5 py-1">{h.old_name!==h.new_name?<><span className="line-through text-red-400">{h.old_name}</span>→<span className="text-green-600">{h.new_name}</span></>:<span>{h.new_name||h.sc_code}</span>}</td>
                      <td className="px-1.5 py-1 text-gray-500">{h.custom_code}</td>
                      <td className="px-1.5 py-1 text-gray-500">{h.changed_by}</td>
                      <td className="px-1.5 py-1 text-gray-500">{h.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between shrink-0 bg-gray-50">
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!selected.id} className="h-7 text-xs px-3"><Trash2 className="h-3 w-3 mr-1"/>삭제</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-4"><Save className="h-3 w-3 mr-1"/>{saving?'저장중...':'저장(F5)'}</Button>
          </div>
        </div>
      )}

      {/* ═══ 모달: 거래처 변경정보 ═══ */}
      {showChangeInfo&&(
        <Modal title="거래처 변경정보" width="max-w-6xl" onClose={()=>setShowChangeInfo(false)}>
          <div className="p-3">
            <div className="text-xs text-gray-500 mb-2">총 {changeInfoData.length}건</div>
            <div className="overflow-auto max-h-[60vh] border border-gray-200 rounded">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    {['순번','SC코드','자체코드','거래처(기존)','거래처(서버)','대표자명(기존)','대표자명(서버)','주소(기존)','주소(서버)','병상규모(기존)','병상규모(서버)','거래처종류(기존)','거래처종류(서버)','표시과목(기존)','표시과목(서버)','변경일시'].map(h=>(
                      <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {changeInfoLoading?(
                    <tr><td colSpan={16} className="text-center py-8 text-gray-400">로딩중...</td></tr>
                  ):changeInfoData.map((h,i)=>(
                    <tr key={h.id} className={cn('border-b border-gray-100',i%2===0?'bg-white':'bg-gray-50/50')}>
                      <td className="px-2 py-1 text-gray-400">{i+1}</td>
                      <td className="px-2 py-1 font-mono text-[10px]">{h.sc_code}</td>
                      <td className="px-2 py-1">{h.custom_code}</td>
                      <DiffCell a={h.old_name} b={h.new_name}/>
                      <DiffCell a={h.old_representative} b={h.new_representative}/>
                      <DiffCell a={h.old_address} b={h.new_address} wide/>
                      <DiffCell a={h.old_bed_scale} b={h.new_bed_scale}/>
                      <DiffCell a={h.old_customer_type} b={h.new_customer_type}/>
                      <DiffCell a={h.old_display_subject} b={h.new_display_subject}/>
                      <td className="px-2 py-1 text-gray-400 whitespace-nowrap text-[10px]">{h.changed_at?new Date(h.changed_at).toLocaleDateString('ko-KR'):''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t px-3 py-2 flex justify-end gap-2 bg-gray-50">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{
              const hdrs=['SC코드','자체코드','거래처(기존)','거래처(서버)','대표자명(기존)','대표자명(서버)','주소(기존)','주소(서버)','병상규모(기존)','병상규모(서버)','거래처종류(기존)','거래처종류(서버)','표시과목(기존)','표시과목(서버)','변경일시']
              const rows=changeInfoData.map(h=>[h.sc_code,h.custom_code,h.old_name,h.new_name,h.old_representative,h.new_representative,h.old_address,h.new_address,h.old_bed_scale,h.new_bed_scale,h.old_customer_type,h.new_customer_type,h.old_display_subject,h.new_display_subject,h.changed_at])
              const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows])
              XLSX.utils.book_append_sheet(wb,ws,'변경정보');XLSX.writeFile(wb,'거래처변경정보.xlsx')
            }}>
              <Download className="h-3 w-3 mr-1"/>Excel 내려받기
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setShowChangeInfo(false)}>닫기</Button>
          </div>
        </Modal>
      )}

      {/* ═══ 모달: 엑셀 일괄등록 ═══ */}
      {showBulkUpload&&(
        <Modal title="엑셀 일괄등록 (거래처)" width="max-w-6xl" onClose={()=>{setShowBulkUpload(false);setUploadRows([])}}>
          <div className="px-3 py-2 flex items-center gap-2 border-b bg-gray-50">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-3 w-3 mr-1"/>샘플양식
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1"/>불러오기
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadFile}/>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleUploadSave} disabled={uploadSaving||!uploadRows.length}>
              <Save className="h-3 w-3 mr-1"/>{uploadSaving?'저장중...':'저장(F5)'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadExcel}>
              <Download className="h-3 w-3 mr-1"/>Excel
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={downloadUnmatched}>
              미매칭엑셀
            </Button>
            <span className="text-xs text-gray-500 ml-2">
              총 {uploadRows.length}건 / 매칭 {uploadRows.filter(r=>r._matched).length}건 /
              <span className="text-red-500"> 미매칭 {uploadRows.filter(r=>!r._matched).length}건</span>
            </span>
          </div>
          <div className="overflow-auto" style={{maxHeight:'60vh'}}>
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  {['순번','SC코드','사업자번호','거래처명','자체코드','영업담당자ID','CSO업체코드','거래시작일자','요양기관기호','처방/조제','비고','거래처구분','상태'].map(h=>(
                    <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploadRows.length===0?(
                  <tr><td colSpan={13} className="text-center py-12 text-gray-400">불러오기 버튼을 클릭하여 Excel 파일을 선택하세요.</td></tr>
                ):uploadRows.map((r,i)=>(
                  <tr key={i} className={cn('border-b border-gray-100',!r._matched?'bg-red-50':i%2===0?'bg-white':'bg-gray-50/40')}>
                    <td className="px-2 py-1 text-gray-400">{r._idx}</td>
                    <td className="px-2 py-1 font-mono text-[10px] text-gray-500">{r.sc_code}</td>
                    <td className="px-2 py-1">{r.business_number}</td>
                    <td className="px-2 py-1 font-medium">{r.name}</td>
                    <td className="px-2 py-1">{r.custom_code}</td>
                    <td className="px-2 py-1">{r._mgr_id_raw}</td>
                    <td className="px-2 py-1">{r._cso_code_raw}</td>
                    <td className="px-2 py-1">{r.prescription_start_date}</td>
                    <td className="px-2 py-1">{r.ykiho}</td>
                    <td className="px-2 py-1">{r.billing_type}</td>
                    <td className="px-2 py-1">{r.note}</td>
                    <td className="px-2 py-1">{r.customer_category}</td>
                    <td className="px-2 py-1">
                      {r._matched
                        ?<Badge className="text-[10px] px-1 py-0 h-4 bg-green-100 text-green-700 border-green-300">매칭</Badge>
                        :<Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-600 border-red-300">미매칭</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-3 py-2 flex justify-end gap-2 bg-gray-50">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{setShowBulkUpload(false);setUploadRows([])}}>닫기</Button>
          </div>
        </Modal>
      )}

      {/* ═══ 모달: 제조사 검색 ═══ */}
      {showMfSearch&&(
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-2xl" style={{maxHeight:'80vh'}}>
            <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between rounded-t-lg shrink-0">
              <span className="text-sm font-bold">거래처 조회</span>
              <button onClick={()=>{setShowMfSearch(false);setMfQuery('')}} className="text-white/60 hover:text-white"><X className="h-4 w-4"/></button>
            </div>
            {/* 검색 입력 */}
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
                <input
                  ref={mfInputRef}
                  value={mfQuery}
                  onChange={e=>setMfQuery(e.target.value)}
                  placeholder="제조사명, SC코드, 사업자번호로 검색..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="mt-1 text-[10px] text-gray-400">
                {mfLoading ? '로딩 중...' : `${manufacturers.filter(m=>!mfQuery||(m.name?.includes(mfQuery)||m.sc_code?.includes(mfQuery)||m.business_number?.includes(mfQuery))).length}건`}
              </div>
            </div>
            {/* 목록 */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    {['SC코드','제조사명','사업자번호','대표자명'].map(h=>(
                      <th key={h} className="px-3 py-1.5 text-left text-gray-600 font-semibold border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mfLoading?(
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">로딩 중...</td></tr>
                  ):manufacturers
                    .filter(m=>!mfQuery||(m.name?.includes(mfQuery)||m.sc_code?.includes(mfQuery)||(m.business_number||'').includes(mfQuery)))
                    .slice(0,200)
                    .map((m,i)=>(
                    <tr key={m.id}
                      className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50 active:bg-blue-100',
                        i%2===0?'bg-white':'bg-gray-50/40')}
                      onClick={()=>selectManufacturer(m)}>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-gray-500">{m.sc_code}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{m.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.business_number}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.representative}</td>
                    </tr>
                  ))}
                  {!mfLoading && manufacturers.filter(m=>!mfQuery||(m.name?.includes(mfQuery)||m.sc_code?.includes(mfQuery)||(m.business_number||'').includes(mfQuery))).length===0&&(
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">검색 결과가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t px-3 py-2 flex justify-between items-center bg-gray-50 shrink-0">
              <span className="text-[10px] text-gray-400">클릭하면 SC코드·거래처명·사업자번호·대표자명이 자동 입력됩니다</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{setShowMfSearch(false);setMfQuery('')}}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 모달: 일괄수정 ═══ */}
      {showBulkEdit&&(
        <Modal title={`일괄수정 (${checked.size}건 선택)`} width="max-w-sm" onClose={()=>setShowBulkEdit(false)}>
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500">값을 입력한 항목만 일괄 수정됩니다.</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <label className="text-xs text-right text-gray-600">영업담당자</label>
                <Select value={bulkEdit.sales_manager_id||''} onValueChange={v=>setBulkEdit(b=>({...b,sales_manager_id:v}))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="변경 안함"/></SelectTrigger>
                  <SelectContent><SelectItem value="" className="text-xs">변경 안함</SelectItem>{users.map(u=><SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>)}</SelectContent>
                </Select>
                <label className="text-xs text-right text-gray-600">CSO업체</label>
                <Select value={bulkEdit.cso_company_id||''} onValueChange={v=>setBulkEdit(b=>({...b,cso_company_id:v}))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="변경 안함"/></SelectTrigger>
                  <SelectContent><SelectItem value="" className="text-xs">변경 안함</SelectItem>{csoList.map(c=><SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <label className="text-xs text-right text-gray-600">처방/조제</label>
                <Select value={bulkEdit.billing_type||''} onValueChange={v=>setBulkEdit(b=>({...b,billing_type:v}))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="변경 안함"/></SelectTrigger>
                  <SelectContent><SelectItem value="" className="text-xs">변경 안함</SelectItem>{BILLING_TYPES.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
                <label className="text-xs text-right text-gray-600">휴폐업구분</label>
                <Select value={bulkEdit.closure_type||''} onValueChange={v=>setBulkEdit(b=>({...b,closure_type:v}))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="변경 안함"/></SelectTrigger>
                  <SelectContent><SelectItem value="" className="text-xs">변경 안함</SelectItem>{CLOSURE_TYPES.map(v=><SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="border-t px-4 py-2 flex justify-between gap-2 bg-gray-50">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setShowBulkEdit(false)}>취소</Button>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleBulkEditSave}>
              <Save className="h-3 w-3 mr-1"/>일괄 저장
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ────── 공용 스타일 ────── */
const I = 'h-6 text-xs rounded border-gray-300'

/* ────── 공용 컴포넌트 ────── */
function FL({ children }:{ children?:React.ReactNode }) {
  return <label className="text-right text-[11px] text-gray-600 self-center pr-1 leading-none">{children}</label>
}
function CX({ onClick }:{ onClick:()=>void }) {
  return <button type="button" onClick={onClick} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 text-[10px] leading-none">✕</button>
}
function SelF({ value,onChange,options,placeholder }:{ value:string;onChange:(v:string)=>void;options:string[];placeholder?:string }) {
  return (
    <Select value={value||(placeholder?'':options[0])} onValueChange={onChange}>
      <SelectTrigger className={cn(I,'w-full')}><SelectValue placeholder={placeholder||options[0]}/></SelectTrigger>
      <SelectContent className="max-h-60">
        {placeholder&&<SelectItem value="" className="text-xs text-gray-400">{placeholder}</SelectItem>}
        {options.map(o=><SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
function CSOSel({ value,list,onChange }:{ value:string|null;list:CSOCompany[];onChange:(v:string)=>void }) {
  return (
    <Select value={value||''} onValueChange={onChange}>
      <SelectTrigger className={cn(I,'w-full')}><SelectValue placeholder="없음"/></SelectTrigger>
      <SelectContent><SelectItem value="" className="text-xs">없음</SelectItem>{list.map(c=><SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
    </Select>
  )
}
function Modal({ title,width='max-w-2xl',onClose,children }:{ title:string;width?:string;onClose:()=>void;children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={cn('bg-white rounded-lg shadow-2xl flex flex-col w-full',width)} style={{maxHeight:'90vh'}}>
        <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between rounded-t-lg shrink-0">
          <span className="text-sm font-bold">{title}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="h-4 w-4"/></button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  )
}
function DiffCell({ a,b,wide }:{ a:string|null;b:string|null;wide?:boolean }) {
  const same=a===b
  return (
    <>
      <td className={cn('px-2 py-1',same?'text-gray-500':' text-red-500',wide?'max-w-[120px] truncate':'')}>{a||''}</td>
      <td className={cn('px-2 py-1',same?'text-gray-500':'text-green-600',wide?'max-w-[120px] truncate':'')}>{b||''}</td>
    </>
  )
}
