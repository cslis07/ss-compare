'use client'

import { cn } from '@/lib/utils'

interface Props {
  page: number        // 0-indexed
  pageSize: number
  total: number
  onChange: (page: number) => void
  className?: string
}

export function DataPagination({ page, pageSize, total, onChange, className }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  const windowStart = Math.max(0, Math.min(page - 2, totalPages - 5))
  const windowEnd   = Math.min(totalPages - 1, windowStart + 4)
  const pageNums: number[] = []
  for (let i = windowStart; i <= windowEnd; i++) pageNums.push(i)

  const btn = (label: string, target: number, disabled: boolean) => (
    <button
      key={label}
      onClick={() => onChange(target)}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center h-6 min-w-6 px-2 rounded text-[11px] border transition-colors select-none',
        disabled
          ? 'border-gray-100 text-gray-300 cursor-default'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer'
      )}
    >
      {label}
    </button>
  )

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-1.5 border-t border-gray-200 bg-white shrink-0',
      className
    )}>
      <span className="text-[11px] text-gray-500">
        전체 <strong className="text-gray-700">{total.toLocaleString()}</strong>건
        {total > 0 && (
          <span className="text-gray-400 ml-1.5">{from.toLocaleString()}–{to.toLocaleString()}</span>
        )}
      </span>

      <div className="flex items-center gap-1">
        {btn('«', 0, page === 0)}
        {btn('‹', page - 1, page === 0)}
        {windowStart > 0 && <span className="text-gray-300 text-xs px-0.5">…</span>}
        {pageNums.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              'inline-flex items-center justify-center h-6 min-w-6 px-2 rounded text-[11px] border transition-colors select-none',
              p === page
                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer'
            )}
          >
            {p + 1}
          </button>
        ))}
        {windowEnd < totalPages - 1 && <span className="text-gray-300 text-xs px-0.5">…</span>}
        {btn('›', page + 1, page >= totalPages - 1)}
        {btn('»', totalPages - 1, page >= totalPages - 1)}
      </div>

      <span className="text-[11px] text-gray-400">
        {page + 1} / {totalPages} 페이지
      </span>
    </div>
  )
}
