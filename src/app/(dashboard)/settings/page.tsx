'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, ChevronUp, ChevronDown } from 'lucide-react'

/* ── 정적 데이터 ─────────────────────────── */
const SETTINGS_DEFS = [
  { no:1,  gcode:'30050001', desc:'처방전 등록시 거래처비교 표시여부 Y표시, N 빈칸표시',               type:'YN' },
  { no:2,  gcode:'30050002', desc:'처방전 등록시 동일한 처방월/거래처 등록 허용',                     type:'YN' },
  { no:3,  gcode:'30050003', desc:'처방전 등록시 동일한 처방월/거래처/제품 등록 허용(Y/N)',           type:'YN' },
  { no:4,  gcode:'30060001', desc:'처방전 복사시 제품만 복사되고 수량은 0으로 표시(클릭시 수량입력)', type:'YN' },
  { no:5,  gcode:'30060002', desc:'원외 처방만 입력 (원내 처방 비활성)',                              type:'YN' },
  { no:6,  gcode:'30070001', desc:'확정 기능 사용 여부',                                              type:'YN' },
  { no:7,  gcode:'30080001', desc:'제약 수수료 관리',                                                 type:'YN' },
  { no:8,  gcode:'30080002', desc:'추가 수수료 관리 (제약)',                                          type:'YN' },
  { no:9,  gcode:'30080003', desc:'담당 수수료 관리',                                                 type:'YN' },
  { no:10, gcode:'30080004', desc:'추가 수수료 관리 (담당)',                                          type:'YN' },
  { no:11, gcode:'30080011', desc:'수수료를 수정 가능여부',                                           type:'YN' },
  { no:12, gcode:'30080005', desc:'영업담당자 제약 수수료 표시',                                      type:'YN' },
  { no:13, gcode:'30080008', desc:'영업담당자 담당 수수료 표시',                                      type:'YN' },
  { no:14, gcode:'30080007', desc:'영업담당자 동기화(SS-CHART)',                                      type:'YN' },
  { no:15, gcode:'30090001', desc:'부가세 별도 합계금액 표시 여부',                                   type:'YN' },
  { no:16, gcode:'30080009', desc:'처방전등록시 단가 변경 가능',                                      type:'YN' },
  { no:17, gcode:'30100001', desc:'처방전 수신 가능 여부',                                            type:'YN' },
  { no:18, gcode:'30100002', desc:'처방전 수신 시 자체코드 매칭(Y/N)',                                type:'YN' },
  { no:19, gcode:'31100001', desc:'영업담당자 CSO업체 항목 숨김(Y/N)',                               type:'YN' },
  { no:20, gcode:'31100002', desc:'영업담당자 CSO2업체 항목 숨김(Y/N)',                              type:'YN' },
  { no:21, gcode:'31100003', desc:'처방전 등록시 제품 중복 등록 가능(Y/N)',                          type:'YN' },
  { no:22, gcode:'31110004', desc:'처방전 등록시 제품 최종 단가 고정(Y/N)',                          type:'YN' },
  { no:23, gcode:'31100005', desc:'처방전 복사시 비고 복사(Y/N)',                                    type:'YN' },
  { no:24, gcode:'31100006', desc:'거래처 등록 요청 시 기등록 거래처 요청 가능 여부(Y/N)',           type:'YN' },
  { no:25, gcode:'31100007', desc:'거래처 영업사원 맵핑기준 (1=담당자, 2=CSO, 3=CSC담당자)',        type:'TEXT' },
]

const MENU_LIST_DEFAULT = [
  '거래처 기간내 인센티브 관리','거래처 등록 요청','거래처 제품별 인센티브 관리',
  '거래처 제품별 담당/재단 날짜 조회','거래처관리','거래처별 보건약관리',
  '거래처별 영업담당자별 처방집계현황','거래처별 인센티브 관리','거래처별 CSO업체 연결 관리',
  '관련품 제품','공지사항','구분별 처방집계현황','기초요인 제출 일람현황',
  '단기관 제품설명회','단일기간 제품설명회','부서관리','사용자관리',
  '성분별 거래처별 처방집계현황','수수료 정산 리포트','수정이력 조회','수금이력 조회',
  '영업담당자 목표 관리','영업담당자별 목표대비 실적 현황',
  '영업담당자별 제조사별 제품별 처방집계현황','영업담당자별 처방집계현황',
  '품절 수수료율 관리','제조사별 수수료율 항목 관리','제조사별 인센티브 금액 관리',
  '제조사별 제품별 처방집계현황','제품관리','제품별 단가단위 관리','제품별 처방집계현황',
  '제품수수료율 역설등록','재한관리(제조사/제품)','제한품목 관리','처방등록 현황',
  '처방건 전송처 관리','처방전 건별 재 제품 관리','처방전관리','처방전 진료과별 관리',
  '처방집계등록','처방집계설정등록','처방집계현황','프로그램 설정관리',
  '품출 라포트(판별)','품출 라포트(제품별)','품출 라포트(지역별)',
  'CSO업체 등록 요청','CSO업체관리','CSO업체별 인센티브 관리','CSO대외약처 관리',
]

const BIZ_CODES: Record<string, {code:string;name:string}[]> = {
  '사업자구분': [
    {code:'C',name:'법인사업자'},{code:'F',name:'프리랜서'},
    {code:'N',name:'<구분없음>'},{code:'S',name:'개인사업자'},
  ],
  '인센티브구간': [
    {code:'000001',name:'비적용'},{code:'000002',name:'적용'},
    {code:'000003',name:'적용(1%)'},{code:'000004',name:'적용(1.5%)'},
    {code:'000005',name:'적용(2%)'},{code:'000006',name:'적용(2.5%)'},
    {code:'000007',name:'적용(3%)'},
  ],
  'CSO업체 휴폐업구분': [
    {code:'C',name:'폐업'},{code:'H',name:'휴업'},{code:'N',name:'정상'},
  ],
}

type MenuPerm = { id:number; name:string; sv:boolean; sc:boolean; mv:boolean; mc:boolean }
type IncentItem = { name:string; priority:number }
type ProductGroup = { id:string; name:string; sort_order:number; is_deleted:boolean }

const TABS = ['프로그램 설정 관리','메뉴 관리','거래처종류 표시 관리','제품그룹관리','업무코드관리','수수료를 적용 방법','코드(자체코드)부여 방식','월별 마감 설정']

export default function SettingsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({})
  const [menuPerms, setMenuPerms] = useState<MenuPerm[]>([])
  const [incentOrder, setIncentOrder] = useState<IncentItem[]>([])
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [bizCategory, setBizCategory] = useState('사업자구분')

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('gcode,value')
    const map: Record<string, string> = {}
    data?.forEach(s => { map[s.gcode] = s.value ?? '' })
    setSettingsMap(map)

    try {
      const raw = map['MENU_PERMISSIONS']
      setMenuPerms(raw ? JSON.parse(raw) : MENU_LIST_DEFAULT.map((name, i) => ({ id:i+1, name, sv:false, sc:false, mv:true, mc:true })))
    } catch { setMenuPerms([]) }

    try {
      const raw = map['INCENT_ORDER']
      setIncentOrder(raw ? JSON.parse(raw) : [])
    } catch { setIncentOrder([]) }

    const { data: pg } = await supabase.from('product_groups').select('*').order('sort_order')
    setProductGroups(pg || [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  function setSetting(gcode: string, value: string) {
    setSettingsMap(prev => ({ ...prev, [gcode]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.entries(settingsMap).map(([gcode, value]) => ({
      gcode, value, updated_at: new Date().toISOString(),
    }))
    // save menu perms
    rows.push({ gcode: 'MENU_PERMISSIONS', value: JSON.stringify(menuPerms), updated_at: new Date().toISOString() })
    rows.push({ gcode: 'INCENT_ORDER', value: JSON.stringify(incentOrder), updated_at: new Date().toISOString() })

    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'gcode' })
    setSaving(false)
    if (error) alert('저장 오류: ' + error.message)
    else alert('저장되었습니다.')
  }

  function moveIncent(idx: number, dir: -1 | 1) {
    const arr = [...incentOrder]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setIncentOrder(arr)
  }

  async function addGroup() {
    if (!newGroupName.trim()) return
    const { data } = await supabase.from('product_groups')
      .insert({ name: newGroupName.trim(), sort_order: productGroups.length + 1 })
      .select().single()
    if (data) { setProductGroups(prev => [...prev, data]); setNewGroupName('') }
  }

  async function deleteGroup(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('product_groups').delete().eq('id', id)
    setProductGroups(prev => prev.filter(g => g.id !== id))
  }

  const yn = (v: string) => v === 'Y'
  const vnBool = (v: boolean) => v ? 'Y' : 'N'

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-gray-700">프로그램 설정</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-7 text-xs px-3">조회</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Save className="h-3 w-3 mr-1" />{saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200 px-2 shrink-0">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${tab===i ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-auto">
        {/* ── 1. 프로그램 설정 관리 ── */}
        {tab === 0 && (
          <div className="p-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 w-10">순번</th>
                  <th className="border border-gray-300 px-2 py-1 w-24">GCode</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">설정내용</th>
                  <th className="border border-gray-300 px-2 py-1 w-20">설정값</th>
                  <th className="border border-gray-300 px-2 py-1 w-24">변경이력</th>
                </tr>
              </thead>
              <tbody>
                {SETTINGS_DEFS.map(s => (
                  <tr key={s.gcode} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{s.no}</td>
                    <td className="border border-gray-300 px-2 py-1 font-mono text-gray-600">{s.gcode}</td>
                    <td className="border border-gray-300 px-2 py-1 text-gray-700">{s.desc}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {s.type === 'YN' ? (
                        <select value={settingsMap[s.gcode] ?? 'Y'}
                          onChange={e => setSetting(s.gcode, e.target.value)}
                          className="border border-gray-300 rounded px-1 py-0.5 text-xs w-14">
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      ) : (
                        <Input value={settingsMap[s.gcode] ?? ''}
                          onChange={e => setSetting(s.gcode, e.target.value)}
                          className="h-6 text-xs w-20 text-center" />
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-gray-400"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 2. 메뉴 관리 ── */}
        {tab === 1 && (
          <div className="p-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 w-8">순</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">화면명</th>
                  <th className="border border-gray-300 px-2 py-1 w-16" colSpan={2}>영업담당자</th>
                  <th className="border border-gray-300 px-2 py-1 w-16" colSpan={2}>중간관리자</th>
                  <th className="border border-gray-300 px-2 py-1 w-20" colSpan={3}>변경이력</th>
                </tr>
                <tr className="bg-gray-50 text-[10px]">
                  <th className="border border-gray-300 px-1 py-0.5"></th>
                  <th className="border border-gray-300 px-1 py-0.5"></th>
                  <th className="border border-gray-300 px-1 py-0.5">조회</th>
                  <th className="border border-gray-300 px-1 py-0.5">등록</th>
                  <th className="border border-gray-300 px-1 py-0.5">조회</th>
                  <th className="border border-gray-300 px-1 py-0.5">등록</th>
                  <th className="border border-gray-300 px-1 py-0.5">영업담당자</th>
                  <th className="border border-gray-300 px-1 py-0.5">중간관리자 조회</th>
                  <th className="border border-gray-300 px-1 py-0.5">중간관리자 등록</th>
                </tr>
              </thead>
              <tbody>
                {menuPerms.map((m, i) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-gray-500">{i+1}</td>
                    <td className="border border-gray-300 px-2 py-0.5">{m.name}</td>
                    {(['sv','sc','mv','mc'] as const).map(k => (
                      <td key={k} className="border border-gray-300 px-1 py-0.5 text-center">
                        <select value={m[k] ? 'Y' : 'N'}
                          onChange={e => setMenuPerms(prev => prev.map((p,j) => j===i ? {...p, [k]: e.target.value==='Y'} : p))}
                          className="border border-gray-300 rounded px-1 text-xs w-12">
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>
                    ))}
                    <td className="border border-gray-300 px-1 py-0.5"></td>
                    <td className="border border-gray-300 px-1 py-0.5"></td>
                    <td className="border border-gray-300 px-1 py-0.5"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 3. 거래처종류 표시 관리 ── */}
        {tab === 2 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            거래처종류 표시 관리 설정 (준비 중)
          </div>
        )}

        {/* ── 4. 제품그룹관리 ── */}
        {tab === 3 && (
          <div className="p-4">
            <div className="flex gap-2 mb-3">
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="새 제품그룹명" className="h-7 text-xs w-48"
                onKeyDown={e => e.key === 'Enter' && addGroup()} />
              <Button size="sm" onClick={addGroup} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">추가</Button>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 w-10">순번</th>
                  <th className="border border-gray-300 px-2 py-1 w-24">제품그룹코드</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">제품그룹명</th>
                  <th className="border border-gray-300 px-2 py-1 w-16">삭제</th>
                </tr>
              </thead>
              <tbody>
                {productGroups.filter(g => !g.is_deleted).map((g, i) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i+1}</td>
                    <td className="border border-gray-300 px-2 py-1 font-mono text-gray-600">
                      {String(i+1).padStart(6,'0')}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{g.name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <button onClick={() => deleteGroup(g.id)}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-0.5 border border-red-300 rounded">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 5. 업무코드관리 ── */}
        {tab === 4 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs text-gray-600 font-medium">대분류코드</label>
              <select value={bizCategory} onChange={e => setBizCategory(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs">
                {Object.keys(BIZ_CODES).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 w-10">순번</th>
                  <th className="border border-gray-300 px-2 py-1 w-24">업무코드</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">업무코드명</th>
                </tr>
              </thead>
              <tbody>
                {BIZ_CODES[bizCategory]?.map((c, i) => (
                  <tr key={c.code} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i+1}</td>
                    <td className="border border-gray-300 px-2 py-1 font-mono">{c.code}</td>
                    <td className="border border-gray-300 px-2 py-1">{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. 수수료를 적용 방법 ── */}
        {tab === 5 && (
          <div className="p-6 flex gap-8 flex-wrap">
            {/* 왼쪽 */}
            <div className="space-y-4 min-w-[360px]">
              <div className="border border-gray-200 rounded p-4 space-y-3">
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-gray-600 w-32">수수료를 적용 항목</span>
                  {['제품단가','합계금액'].map(v => (
                    <label key={v} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="comm_item" value={v}
                        checked={(settingsMap['COMM_ITEM']??'합계금액')===v}
                        onChange={() => setSetting('COMM_ITEM', v)} />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-gray-600 w-32">수수료 부가세포함여부</span>
                  {['부가세별도','부가세포함'].map(v => (
                    <label key={v} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="comm_tax" value={v}
                        checked={(settingsMap['COMM_TAX']??'부가세포함')===v}
                        onChange={() => setSetting('COMM_TAX', v)} />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-700">
                  {settingsMap['COMM_ITEM']==='제품단가'
                    ? '[수수료] = 소수점반올림( 제품단가 * 수수료율 * 판매수량 )'
                    : settingsMap['COMM_TAX']==='부가세별도'
                    ? '[수수료] = 소수점반올림( 합계금액 * 수수료율 / 1.1 )'
                    : '[수수료] = 소수점반올림( 합계금액 * 수수료율 )'}
                </div>
              </div>
              <div className="border border-gray-200 rounded p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 w-36">수수료를 적용 기준금액</span>
                  <Input value={settingsMap['COMM_BASE_AMOUNT']??''}
                    onChange={e => setSetting('COMM_BASE_AMOUNT', e.target.value)}
                    className="h-6 text-xs w-32 text-right" />
                  <span className="text-gray-500">원</span>
                </div>
                <p className="text-gray-500 text-[11px]">× 처방전 합계금액이 기준금액 이상일때 수수료 적용</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-600 w-36">기준금액 적용 유예기간</span>
                  <Input value={settingsMap['COMM_GRACE_MONTHS']??''}
                    onChange={e => setSetting('COMM_GRACE_MONTHS', e.target.value)}
                    className="h-6 text-xs w-16 text-right" />
                  <span className="text-gray-500">개월</span>
                </div>
                <p className="text-gray-500 text-[11px]">[거래처별 처방 시작월 포함 ( )개월]</p>
                <p className="text-gray-500 text-[11px]">× 신규 거래처 수수료를 적용 기준금액 유예 기간</p>
                <p className="text-gray-500 text-[11px]">[Ex, 3개월로 입력, 25.01 첫 처방 발생 = 처방월 25.01~25.03 기간에 적용]</p>
              </div>
            </div>

            {/* 오른쪽: 인센티브 */}
            <div className="border border-gray-200 rounded p-4 min-w-[380px] space-y-3">
              <p className="text-xs font-semibold text-gray-700">인센티브 우선순위 적용 설정</p>
              <div className="flex gap-4 text-xs mb-3">
                {['N','Y'].map((v,i) => (
                  <label key={v} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="incent_on" value={v}
                      checked={(settingsMap['INCENT_PRIORITY_ON']??'N')===v}
                      onChange={() => setSetting('INCENT_PRIORITY_ON', v)} />
                    <span>{i===0 ? '인센티브 우선 순위 미적용' : '인센티브 우선 순위 적용'}</span>
                  </label>
                ))}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 w-8">순번</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">인센티브 항목</th>
                    <th className="border border-gray-300 px-2 py-1 w-16">우선순위</th>
                    <th className="border border-gray-300 px-2 py-1 w-16">변경이력</th>
                  </tr>
                </thead>
                <tbody>
                  {incentOrder.map((item, i) => (
                    <tr key={item.name} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i+1}</td>
                      <td className="border border-gray-300 px-2 py-1">{item.name}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        <Input value={item.priority}
                          onChange={e => setIncentOrder(prev => prev.map((p,j) => j===i ? {...p, priority: Number(e.target.value)||p.priority} : p))}
                          className="h-5 text-xs w-12 text-center" />
                      </td>
                      <td className="border border-gray-300 px-1 py-1 text-center">
                        <div className="flex gap-0.5 justify-center">
                          <button onClick={() => moveIncent(i,-1)} disabled={i===0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronUp className="h-3 w-3"/></button>
                          <button onClick={() => moveIncent(i,1)} disabled={i===incentOrder.length-1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronDown className="h-3 w-3"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 7. 코드(자체코드)부여 방식 ── */}
        {tab === 6 && (
          <div className="p-6">
            <div className="border border-gray-200 rounded p-6 inline-block space-y-4 text-xs">
              <div className="flex items-center gap-6">
                <span className="text-gray-600 w-28">거래처 자체코드</span>
                {['자동부여','수동부여'].map(v => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="code_customer" value={v}
                      checked={(settingsMap['CODE_CUSTOMER']??'수동부여')===v}
                      onChange={() => setSetting('CODE_CUSTOMER', v)} />
                    <span>{v}</span>
                    {v==='자동부여' && (
                      <Input value={settingsMap['CODE_CUSTOMER']==='자동부여' ? (settingsMap['CODE_CUSTOMER_PREFIX']??'') : ''}
                        onChange={e => setSetting('CODE_CUSTOMER_PREFIX', e.target.value)}
                        className="h-6 text-xs w-24 ml-1" placeholder="접두사" />
                    )}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-6">
                <span className="text-gray-600 w-28">사용자 아이디</span>
                {['자동부여','수동부여'].map(v => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="code_user" value={v}
                      checked={(settingsMap['CODE_USER']??'자동부여')===v}
                      onChange={() => setSetting('CODE_USER', v)} />
                    <span>{v}</span>
                    {v==='자동부여' && settingsMap['CODE_USER']==='자동부여' && (
                      <div className="flex items-center gap-1 ml-1">
                        <Input value={settingsMap['CODE_USER_PREFIX']??''}
                          onChange={e => setSetting('CODE_USER_PREFIX', e.target.value)}
                          className="h-6 text-xs w-24" />
                        <button className="text-gray-400 hover:text-gray-600 text-xs px-1">×</button>
                      </div>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-gray-500 text-[11px] mt-2">
                거래처 자체코드를 사용자가 직접 입력하여 코드 부여
              </p>
            </div>
          </div>
        )}

        {/* ── 8. 월별 마감 설정 ── */}
        {tab === 7 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            월별 마감 설정 (준비 중)
          </div>
        )}
      </div>
    </div>
  )
}
