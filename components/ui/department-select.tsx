'use client'

import { DEPARTMENTS } from '@/lib/departments'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface DepartmentSelectProps {
  id?:          string
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  className?:   string
}

/**
 * Picks from the shared list. An existing record whose department is not on
 * it keeps that value as an extra option, so opening an old project or
 * profile to edit something else does not silently change its department.
 */
export function DepartmentSelect({
  id, value, onChange, placeholder = 'Select a department', className,
}: DepartmentSelectProps) {
  const legacy = value && !DEPARTMENTS.some((d) => d.toLowerCase() === value.toLowerCase())
    ? value
    : null

  // Show the canonical spelling of a value that differs only by case.
  const selected = DEPARTMENTS.find((d) => d.toLowerCase() === value.toLowerCase()) ?? value

  return (
    <Select value={selected || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className={className ?? 'rounded-xl'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {DEPARTMENTS.map((d) => (
          <SelectItem key={d} value={d}>{d}</SelectItem>
        ))}
        {legacy && <SelectItem value={legacy}>{legacy}</SelectItem>}
      </SelectContent>
    </Select>
  )
}
