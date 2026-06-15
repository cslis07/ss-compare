'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CSOCompany } from '@/lib/types'
import { Search, Plus, FileSpreadsheet, Folder, X as IconX, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── 파일 참조 ─────────────────────────────────────── */
const FILE_KEYS = ['신고증', '사업자등록증', '재위탁통보서', '재위탁계약서', '교육이수증'] as const
type FileKey = typeof FILE_KEYS[number]
type FileRefs = Record<FileKey, string>   // value = storage path ("companyId/type/name") or legacy filename

const EMPTY_FILES: FileRefs = { '신고증':'', '사업자등록증':'', '재위탁통보서':'', '재위탁계약서':'', '교육이수증':'' }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const BUCKET = 'cso-files'

/** storage 경로인지(슬래시 포함) 또는 레거시 파일명인지 구분 */
const isStoragePath = (v: string) => v.includes('/')
const displayName   = (v: string) => v ? (v.includes('/') ? v.split('/').pop()! : v) : ''
const publicUrl     = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`

function parseNote(note: string | null): { text: string; files: FileRefs } {
  if (!note) return { text: '', files: { ...EMPTY_FILES } }
  try {
    const obj = JSON.parse(note)
    if (obj && typeof obj === 'object' && ('text' in obj || 'files' in obj))
      return { text: obj.text ?? '', files: { ...EMPTY_FILES, ...obj.files } }
  } catch { /* plain text */ }
  return { text: note, files: { ...EMPTY_FILES } }
}

function serializeNote(text: string, files: FileRefs): string | null {
  const hasFiles = Object.values(files).some(v => v)
  if (!hasFiles) return text || null
  return JSON.stringify({ text, files })
}

/* ── 공통 Row 레이아웃 ─────────────────────────────── */
function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-gray-600 text-[11px] w-[76px] shrink-0 text-right leading-tight">{label}</span>
      {children}
    </div>
  )
}

function ClearInput({ value, onChange, className }: { value: string; onChange:(v:string)=>void; className?: string }) {
  return (
    <div className="relative flex-1">
      <Input value={value} onChange={e => onChange(e.target.value)}
        className={cn('h-6 text-xs pr-5', className)} />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700">
          <IconX className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/* ── 파일 행 (업로드/다운로드/삭제 실제 동작) ──────── */
function FileRow({ label, value, companyId, onChange }:
  { label: FileKey; value: string; companyId: string; onChange:(v:string)=>void }) {

  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const name = displayName(value)
  const stored = isStoragePath(value)

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!companyId) { alert('먼저 저장(F5)한 후 파일을 업로드하세요.'); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('companyId', companyId)
    fd.append('fileType', label)

    const res = await fetch('/api/cso/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) { alert('업로드 실패: ' + json.error); return }
    onChange(json.path)
  }

  async function handleDownload() {
    if (!value) return
    if (!stored) { alert('파일이 서버에 업로드되지 않았습니다.'); return }
    const a = document.createElement('a')
    a.href = publicUrl(value)
    a.download = name
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDelete() {
    if (!value) return
    if (!confirm(`"${name}" 파일을 삭제하시겠습니까?`)) return
    if (stored) {
      const res = await fetch('/api/cso/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: value }),
      })
      if (!res.ok) { alert('파일 삭제 실패'); return }
    }
    onChange('')
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-600 text-[11px] w-[76px] shrink-0 text-right">{label}</span>
      {/* 파일명 표시 */}
      <div className="relative flex-1">
        <div
          className={cn(
            'h-6 flex items-center px-2 text-xs border border-gray-300 rounded truncate',
            value ? 'text-blue-600 bg-white cursor-pointer hover:bg-blue-50' : 'text-gray-400 bg-gray-50'
          )}
          onClick={() => value && stored && window.open(publicUrl(value), '_blank')}
          title={value ? (stored ? '클릭하여 열기' : name) : ''}
        >
          {name || '파일명'}
        </div>
        {value && (
          <button onClick={() => onChange('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600">
            <IconX className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* 폴더(업로드) */}
      <button
        onClick={() => companyId ? ref.current?.click() : alert('먼저 저장(F5)한 후 파일을 업로드하세요.')}
        title="파일 선택·업로드" disabled={uploading}
        className="w-6 h-6 flex items-center justify-center bg-yellow-50 border border-yellow-400 rounded hover:bg-yellow-100 disabled:opacity-40">
        {uploading
          ? <span className="text-[8px] text-yellow-700">…</span>
          : <Folder className="h-3.5 w-3.5 text-yellow-600" />}
      </button>
      {/* 삭제(서버+상태) */}
      <button onClick={handleDelete} title="파일 삭제" disabled={!value}
        className="w-6 h-6 flex items-center justify-center bg-red-50 border border-red-300 rounded hover:bg-red-100 disabled:opacity-30">
        <IconX className="h-3 w-3 text-red-600" />
      </button>
      {/* 다운로드 */}
      <button onClick={handleDownload} title="파일 다운로드" disabled={!stored}
        className="w-6 h-6 flex items-center justify-center bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 disabled:opacity-30">
        <Download className="h-3.5 w-3.5 text-blue-600" />
      </button>
      <input ref={ref} type="file" className="hidden" onChange={handleSelect}
        accept=".jpg,.jpeg,.png,.gif,.pdf,.xlsx,.xls,.doc,.docx,.hwp" />
    </div>
  )
}

/* ════════════════════════════════════════════════════ */
export default function CSOCompaniesPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<CSOCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CSOCompany | null>(null)
  const [noteText, setNoteText] = useState('')
  const [files, setFiles] = useState<FileRefs>({ ...EMPTY_FILES })
  const [filters, setFilters] = useState({ name: '', businessNumber: '', isDeleted: false })

  const loadList = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('cso_companies').select('*').eq('is_deleted', filters.isDeleted).order('name')
    if (filters.name) q = q.ilike('name', `%${filters.name}%`)
    if (filters.businessNumber) q = q.ilike('business_number', `%${filters.businessNumber}%`)
    const { data } = await q.limit(300)
    setCompanies(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { loadList() }, [loadList])

  function openCompany(c: CSOCompany | null) {
    const blank: CSOCompany = {
      id:'', cso_code:null, name:'', custom_code:null,
      contract_type:'본사와 직접 계약', report_number:null,
      business_number:null, resident_number:null,
      business_type:'개인사업자', status:'정상',
      representative:null, postal_code:null, road_address:null,
      detail_address:null, phone:null, fax:null, mobile:null,
      contract_start_date:'2000-01-01', contract_end_date:'2999-12-31',
      email:null, commission_email:null, bank_name:null,
      account_number:null, note:null, is_deleted:false,
      created_at:'', updated_at:'',
    }
    const target = c ?? blank
    setSelected(target)
    const parsed = parseNote(target.note)
    setNoteText(parsed.text)
    setFiles(parsed.files)
  }

  function setField<K extends keyof CSOCompany>(key: K, val: CSOCompany[K]) {
    setSelected(s => s ? { ...s, [key]: val } : s)
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.name.trim()) { alert('CSO 업체명을 입력하세요.'); return }
    const payload = { ...selected, note: serializeNote(noteText, files), updated_at: new Date().toISOString() }
    if (selected.id) {
      const { error } = await supabase.from('cso_companies').update(payload).eq('id', selected.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { id:_i, created_at:_c, updated_at:_u, ...rest } = payload
      const { data, error } = await supabase.from('cso_companies').insert({ ...rest, name: rest.name||'' }).select().single()
      if (error) { alert('저장 실패: ' + error.message); return }
      if (data) {
        const p = parseNote((data as CSOCompany).note)
        setSelected(data as CSOCompany)
        setNoteText(p.text); setFiles(p.files)
      }
    }
    alert('저장되었습니다.')
    loadList()
  }

  async function handleDelete() {
    if (!selected?.id) { alert('선택된 항목이 없습니다.'); return }
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('cso_companies').update({ is_deleted:true, updated_at:new Date().toISOString() }).eq('id', selected.id)
    setSelected(null)
    loadList()
  }

  const str = (v: string | null | undefined) => v ?? ''

  return (
    <div className="flex h-full">
      {/* ── 목록 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">CSO업체 관리</span>
          <Input placeholder="CSO업체명" value={filters.name}
            onChange={e => setFilters(f=>({...f, name:e.target.value}))} className="h-7 text-xs w-32" />
          <Input placeholder="사업자번호" value={filters.businessNumber}
            onChange={e => setFilters(f=>({...f, businessNumber:e.target.value}))} className="h-7 text-xs w-28" />
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={filters.isDeleted}
              onChange={e => setFilters(f=>({...f, isDeleted:e.target.checked}))} />
            삭제건포함조회
          </label>
          <Button size="sm" onClick={loadList} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" />조회
          </Button>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={() => openCompany(null)}>
              <Plus className="h-3 w-3 mr-1" />신규입력
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" />Excel
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번','CSO업체명','사업자번호','사업자구분','휴폐업구분','대표자명','계약처여부','신고번호','계약시작일','계약종료일'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : companies.map((c, i) => (
                <tr key={c.id} onClick={() => openCompany(c)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id===c.id ? 'bg-yellow-50' : i%2===0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i+1}</td>
                  <td className="px-2 py-1 font-medium text-gray-800">{c.name}</td>
                  <td className="px-2 py-1 text-gray-600">{c.business_number}</td>
                  <td className="px-2 py-1 text-gray-500">{c.business_type}</td>
                  <td className="px-2 py-1 text-gray-500">{c.status}</td>
                  <td className="px-2 py-1 text-gray-600">{c.representative}</td>
                  <td className="px-2 py-1 text-gray-500">{c.contract_type}</td>
                  <td className="px-2 py-1 text-gray-500">{c.report_number}</td>
                  <td className="px-2 py-1 text-gray-500">{c.contract_start_date}</td>
                  <td className="px-2 py-1 text-gray-500">{c.contract_end_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{companies.length}건 조회</div>
      </div>

      {/* ── 거래처입력 [ CSO ] ── */}
      {selected && (
        <div className="w-[460px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg">
          <div className="px-3 py-1.5 bg-blue-700 text-white flex items-center justify-between shrink-0">
            <span className="text-xs font-bold tracking-wide">거래처입력 [ CSO ]</span>
            <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-sm font-bold">&gt;&gt;</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {/* CSO 업체 */}
            <Row label="CSO 업체">
              <ClearInput value={str(selected.name)} onChange={v => setField('name', v)} />
            </Row>

            {/* 사업자번호 + 자체코드 */}
            <div className="flex gap-1.5">
              <Row label="사업자번호" className="flex-1">
                <ClearInput value={str(selected.business_number)} onChange={v => setField('business_number', v)} />
              </Row>
              <Row label="자체 코드" className="flex-1">
                <Input value={str(selected.custom_code)} onChange={e => setField('custom_code', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
            </div>

            {/* 사업자구분 + 대표자명 */}
            <div className="flex gap-1.5">
              <Row label="사업자구분" className="flex-1">
                <select value={str(selected.business_type)} onChange={e => setField('business_type', e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-1 h-6 text-[11px] bg-white">
                  {['<구분없음>','개인사업자','법인사업자','프리랜서'].map(v=><option key={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="대표 자명" className="flex-1">
                <ClearInput value={str(selected.representative)} onChange={v => setField('representative', v)} />
              </Row>
            </div>

            {/* 우편번호 + 휴폐업구분 */}
            <div className="flex gap-1.5">
              <Row label="우편 번호" className="flex-1">
                <div className="relative flex-1">
                  <Input value={str(selected.postal_code)} onChange={e => setField('postal_code', e.target.value)}
                    className="h-6 text-xs pr-6" />
                  <button className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <Search className="h-3 w-3" />
                  </button>
                </div>
              </Row>
              <Row label="휴폐업구분" className="flex-1">
                <select value={str(selected.status)} onChange={e => setField('status', e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-1 h-6 text-[11px] bg-white">
                  {['정상','폐업','휴업'].map(v=><option key={v}>{v}</option>)}
                </select>
              </Row>
            </div>

            {/* 도로명주소 */}
            <Row label="도로명주소">
              <Input value={str(selected.road_address)} onChange={e => setField('road_address', e.target.value)}
                className="h-6 text-xs flex-1" />
            </Row>

            {/* 상세주소 */}
            <Row label="상세 주소">
              <Input value={str(selected.detail_address)} onChange={e => setField('detail_address', e.target.value)}
                className="h-6 text-xs flex-1" />
            </Row>

            {/* 전화 + 팩스 */}
            <div className="flex gap-1.5">
              <Row label="전화 번호" className="flex-1">
                <Input value={str(selected.phone)} onChange={e => setField('phone', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
              <Row label="팩스번호" className="flex-1">
                <Input value={str(selected.fax)} onChange={e => setField('fax', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
            </div>

            {/* 휴대폰 + 계약일자 */}
            <div className="flex gap-1.5">
              <Row label="휴대폰번호" className="flex-1">
                <Input value={str(selected.mobile)} onChange={e => setField('mobile', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
              <Row label="계약 일자" className="flex-1">
                <div className="flex items-center gap-0.5 flex-1">
                  <input type="date" value={str(selected.contract_start_date)}
                    onChange={e => setField('contract_start_date', e.target.value)}
                    className="border border-gray-300 rounded px-1 h-6 text-[10px] w-[90px]" />
                  <span className="text-gray-400 text-[10px]">~</span>
                  <input type="date" value={str(selected.contract_end_date)}
                    onChange={e => setField('contract_end_date', e.target.value)}
                    className="border border-gray-300 rounded px-1 h-6 text-[10px] w-[90px]" />
                </div>
              </Row>
            </div>

            <Row label="E-MAIL">
              <Input value={str(selected.email)} onChange={e => setField('email', e.target.value)}
                className="h-6 text-xs flex-1" />
            </Row>

            <Row label="수수료E-MAIL">
              <Input value={str(selected.commission_email)} onChange={e => setField('commission_email', e.target.value)}
                className="h-6 text-xs flex-1" />
            </Row>

            {/* 은행명 + 계좌번호 */}
            <div className="flex gap-1.5">
              <Row label="은행 명" className="flex-1">
                <Input value={str(selected.bank_name)} onChange={e => setField('bank_name', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
              <Row label="계좌번호" className="flex-1">
                <Input value={str(selected.account_number)} onChange={e => setField('account_number', e.target.value)}
                  className="h-6 text-xs flex-1" />
              </Row>
            </div>

            <Row label="비고">
              <Input value={noteText} onChange={e => setNoteText(e.target.value)}
                className="h-6 text-xs flex-1" />
            </Row>

            {/* 신고번호 + 계약처여부 */}
            <div className="flex gap-1.5">
              <Row label="신고 번호" className="flex-1">
                <ClearInput value={str(selected.report_number)} onChange={v => setField('report_number', v)} />
              </Row>
              <Row label="계약처여부" className="flex-1">
                <select value={str(selected.contract_type)} onChange={e => setField('contract_type', e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-1 h-6 text-[11px] bg-white">
                  {['본사와 직접 계약','CSO 재위탁'].map(v=><option key={v}>{v}</option>)}
                </select>
              </Row>
            </div>

            {/* 구분선 */}
            <div className="border-t border-gray-200 pt-1">
              {/* 파일 5종 */}
              {FILE_KEYS.map(k => (
                <div key={k} className="mb-1.5">
                  <FileRow
                    label={k}
                    value={files[k]}
                    companyId={selected.id}
                    onChange={v => setFiles(prev => ({ ...prev, [k]: v }))}
                  />
                </div>
              ))}
            </div>

            {!selected.id && (
              <p className="text-[10px] text-orange-500 text-center">
                ※ 파일 업로드는 저장(F5) 후 가능합니다.
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 px-3 py-2 flex justify-end gap-2 shrink-0 bg-gray-50">
            <Button size="sm" onClick={handleSave}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-4">저장(F5)</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}
              className="h-7 text-xs px-4">삭제</Button>
          </div>
        </div>
      )}
    </div>
  )
}
