'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems, NavItem } from './nav-items'

function NavGroup({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false
  const hasChildren = item.children && item.children.length > 0
  const isChildActive = hasChildren && item.children!.some(
    (c) => c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))
  )
  const [open, setOpen] = useState(isChildActive || isActive)

  if (!hasChildren && item.href) {
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center px-3 py-1.5 text-sm rounded-md transition-colors',
          depth === 0 ? 'font-medium' : 'pl-6',
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        {item.title}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
          isChildActive
            ? 'text-blue-700 bg-blue-50'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <span>{item.title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
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
    <aside className="w-52 shrink-0 border-r border-gray-200 bg-white h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <Link href="/" className="text-lg font-bold text-blue-700">
          SS-Compare
        </Link>
        <p className="text-[10px] text-gray-400 mt-0.5">처방EDI 수수료 관리</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {navItems.map((item) => (
          <NavGroup key={item.href || item.title} item={item} />
        ))}
      </nav>
    </aside>
  )
}
