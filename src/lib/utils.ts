import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

export function formatMonth(ym: string): string {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}

// 한국 시간(UTC+9) 기준 'YYYY-MM' — 브라우저·서버 시간대와 무관
function kstYearMonth(offset: number): string {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + offset, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export function getThisMonth(): string { return kstYearMonth(0) }
export function getPrevMonth(): string { return kstYearMonth(-1) }
