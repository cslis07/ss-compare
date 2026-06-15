'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems, NavItem } from './nav-items'

function NavGroup({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + '/')
    : false
  const hasChildren = item.children && item.children.length > 0
  const isChildActive =
    hasChildren &&
    item.children!.some(
      (c) => c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))
    )
  const [open, setOpen] = useState(isChildActive || isActive)

  if (!hasChildren && item.href) {
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center py-1.5 pr-3 text-[12.5px] rounded-md transition-colors duration-100',
          depth === 0 ? 'pl-3' : 'pl-5',
          isActive
            ? 'bg-white/10 text-white font-medium border-l-2 border-blue-400'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-l-2 border-transparent'
        )}
      >
        {item.title}
      </Link>
    )
  }

  return (
    <div className="mt-1 first:mt-0">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-colors duration-100',
          'text-[10.5px] font-semibold uppercase tracking-[0.07em]',
          isChildActive || open
            ? 'text-slate-300'
            : 'text-slate-500 hover:text-slate-300'
        )}
      >
        <span>{item.title}</span>
        {open
          ? <ChevronDown className="h-3 w-3 opacity-60" />
          : <ChevronRight className="h-3 w-3 opacity-40" />}
      </button>
      {open && hasChildren && (
        <div className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <NavGroup key={child.href || child.title} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="w-52 shrink-0 h-full flex flex-col bg-[#0f172a]">
      {/* 로고 영역 */}
      <div className="px-4 py-4 border-b border-white/8 shrink-0">
        <Link href="/" className="block group">
          <div className="text-[17px] font-bold text-white tracking-tight group-hover:text-blue-300 transition-colors">
            SS-Compare
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-normal">
            처방EDI 수수료 관리
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-thin">
        {navItems.map((item) => (
          <NavGroup key={item.href || item.title} item={item} />
        ))}
      </nav>

      {/* 하단 버전 표시 */}
      <div className="px-4 py-2.5 border-t border-white/8 shrink-0">
        <span className="text-[10px] text-slate-600">v1.0.0</span>
      </div>
    </aside>
  )
}
