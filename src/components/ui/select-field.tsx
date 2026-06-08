'use client'

import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

interface SelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[] | string[]
  placeholder?: string
  className?: string
  triggerClassName?: string
}

export function SelectField({ value, onValueChange, options, placeholder, triggerClassName }: SelectFieldProps) {
  const normalizedOptions = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? value)}>
      <SelectTrigger className={triggerClassName ?? 'h-7 text-xs'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {normalizedOptions.map(o => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
