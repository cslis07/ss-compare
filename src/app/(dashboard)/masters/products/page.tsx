'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/lib/types'
import { Search, Plus, Save, Trash2, FileSpreadsheet } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)
  const [filters, setFilters] = useState({ productName: '', insuranceCode: '', manufacturerName: '' })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('products').select('*').eq('is_deleted', false).order('product_name')
    if (filters.productName) q = q.ilike('product_name', `%${filters.productName}%`)
    if (filters.insuranceCode) q = q.ilike('insurance_code', `%${filters.insuranceCode}%`)
    if (filters.manufacturerName) q = q.ilike('manufacturer_name', `%${filters.manufacturerName}%`)
    const { data } = await q.limit(200)
    setProducts(data || [])
    setLoading(false)
  }, [filters, supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() {
    setSelected({
      id: '', manufacturer_sc_code: '', ingredient_code: '',
      manufacturer_code: '', manufacturer_name: '',
      insurance_code: '', product_name: '', specification: '',
      dosage_form: '', is_internal: true, has_insurance: true,
      is_non_covered: false, generic_availability: '',
      final_price: null, final_price_date: null,
      product_group: '', note: '', is_deleted: false,
      created_at: '', updated_at: '',
    })
  }

  async function handleSave() {
    if (!selected) return
    if (!selected.product_name) { alert('제품명을 입력하세요.'); return }
    if (!selected.manufacturer_name) { alert('제조사명을 입력하세요.'); return }
    if (selected.id) {
      await supabase.from('products').update({ ...selected, updated_at: new Date().toISOString() }).eq('id', selected.id)
    } else {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = selected
      await supabase.from('products').insert(rest)
    }
    fetch()
  }

  async function handleDelete() {
    if (!selected?.id) return
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('products').update({ is_deleted: true }).eq('id', selected.id)
    setSelected(null)
    fetch()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm font-semibold text-gray-700 mr-1">제품 관리</span>
          <Input placeholder="제품명" value={filters.productName} onChange={(e) => setFilters(f => ({ ...f, productName: e.target.value }))} className="h-7 text-xs w-36" />
          <Input placeholder="보험코드" value={filters.insuranceCode} onChange={(e) => setFilters(f => ({ ...f, insuranceCode: e.target.value }))} className="h-7 text-xs w-28" />
          <Input placeholder="제조사명" value={filters.manufacturerName} onChange={(e) => setFilters(f => ({ ...f, manufacturerName: e.target.value }))} className="h-7 text-xs w-28" />
          <Button size="sm" onClick={fetch} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
            <Search className="h-3 w-3 mr-1" /> 조회
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-3" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1" /> 신규등록
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel등록
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {['번', '제조사SC코드', '성분코드', '제조사', '보험코드', '제품명', '규격/단위', '제형', '내복', '보험', '비급여', '최종판매금액', '최종판매일자'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">조회 중...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-8 text-gray-400">데이터가 없습니다.</td></tr>
              ) : products.map((p, i) => (
                <tr key={p.id} onClick={() => setSelected(p)}
                  className={cn('border-b border-gray-100 cursor-pointer hover:bg-blue-50',
                    selected?.id === p.id ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono text-[10px]">{p.manufacturer_sc_code}</td>
                  <td className="px-2 py-1 text-gray-500 font-mono text-[10px]">{p.ingredient_code}</td>
                  <td className="px-2 py-1 text-gray-600">{p.manufacturer_name}</td>
                  <td className="px-2 py-1 text-gray-600 font-mono">{p.insurance_code}</td>
                  <td className="px-2 py-1 text-gray-800 font-medium">{p.product_name}</td>
                  <td className="px-2 py-1 text-gray-500">{p.specification}</td>
                  <td className="px-2 py-1 text-gray-500">{p.dosage_form}</td>
                  <td className="px-2 py-1 text-center">
                    <Badge className={cn('text-[10px] px-1 py-0 h-4', p.is_internal ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                      {p.is_internal ? '내복' : '외용'}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 text-center">
                    {p.has_insurance ? <span className="text-green-600">✓</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {p.is_non_covered ? <span className="text-orange-600">비급여</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700">{formatNumber(p.final_price)}</td>
                  <td className="px-2 py-1 text-gray-500">{p.final_price_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-1 text-xs text-gray-400">{products.length}건 조회</div>
      </div>

      {selected && (
        <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0">
          <div className="px-3 py-2 bg-gray-700 text-white">
            <span className="text-sm font-semibold">제품 정보</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-xs">
            {([
              ['제조사명', 'manufacturer_name'],
              ['보험코드', 'insurance_code'],
              ['제품명', 'product_name'],
              ['규격/단위', 'specification'],
              ['제형', 'dosage_form'],
              ['성분코드', 'ingredient_code'],
              ['제조사코드', 'manufacturer_code'],
              ['제품그룹', 'product_group'],
              ['비고', 'note'],
            ] as [string, keyof Product][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-2">
                <label className="text-gray-500 w-20 shrink-0 text-right">{label}</label>
                <Input value={(selected[field] as string) || ''} onChange={(e) => setSelected(s => s ? { ...s, [field]: e.target.value } : s)} className="h-7 text-xs flex-1" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">최종판매가</label>
              <Input type="number" value={selected.final_price ?? ''} onChange={(e) => setSelected(s => s ? { ...s, final_price: Number(e.target.value) } : s)} className="h-7 text-xs flex-1 text-right" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 w-20 shrink-0 text-right">판매일자</label>
              <Input type="date" value={selected.final_price_date || ''} onChange={(e) => setSelected(s => s ? { ...s, final_price_date: e.target.value } : s)} className="h-7 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-1 text-gray-500">
                <input type="checkbox" checked={selected.is_internal} onChange={(e) => setSelected(s => s ? { ...s, is_internal: e.target.checked } : s)} />
                내복약
              </label>
              <label className="flex items-center gap-1 text-gray-500">
                <input type="checkbox" checked={selected.has_insurance} onChange={(e) => setSelected(s => s ? { ...s, has_insurance: e.target.checked } : s)} />
                보험코드
              </label>
              <label className="flex items-center gap-1 text-gray-500">
                <input type="checkbox" checked={selected.is_non_covered} onChange={(e) => setSelected(s => s ? { ...s, is_non_covered: e.target.checked } : s)} />
                비급여
              </label>
            </div>
          </div>
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-xs px-3">
              <Trash2 className="h-3 w-3 mr-1" /> 삭제
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
              <Save className="h-3 w-3 mr-1" /> 저장(F5)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
