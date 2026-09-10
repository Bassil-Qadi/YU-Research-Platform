'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChipInputProps {
  id?:          string
  value:        string[]
  onChange:     (next: string[]) => void
  placeholder?: string
  max?:         number
  /** Applied to each entry before it is added, e.g. lower-casing tags. */
  normalise?:   (raw: string) => string
}

/**
 * A short list of free-text entries: type, press Enter or comma, and it
 * becomes a chip. Blank and duplicate entries are ignored rather than rejected.
 */
export function ChipInput({
  id, value, onChange, placeholder, max = 10, normalise = (s) => s.trim(),
}: ChipInputProps) {
  const [draft, setDraft] = useState('')
  const full = value.length >= max

  function add() {
    const entry = normalise(draft)
    setDraft('')
    if (!entry || full) return
    if (value.some((v) => v.toLowerCase() === entry.toLowerCase())) return
    onChange([...value, entry])
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault() // Enter would otherwise submit the form
              add()
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          placeholder={full ? `Limit of ${max} reached` : placeholder}
          className="rounded-xl"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-xl"
          disabled={full || !draft.trim()}
          onClick={add}
        >
          Add
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((entry) => (
            <Badge key={entry} variant="secondary" className="gap-1 rounded-full pr-1">
              {entry}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== entry))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${entry}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
