import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, departmentOptions, normaliseDepartment } from '@/lib/departments'
import { containsInsensitive, equalsInsensitive, escapeRegex } from '@/lib/regex'

describe('normaliseDepartment', () => {
  it('snaps a case variant to the canonical spelling', () => {
    expect(normaliseDepartment('school of engineering')).toBe('School of Engineering')
    expect(normaliseDepartment('SCHOOL OF MEDICINE')).toBe('School of Medicine')
  })

  it('tidies whitespace before matching', () => {
    expect(normaliseDepartment('  School   of  Engineering ')).toBe('School of Engineering')
  })

  it('keeps an unlisted department as written rather than rejecting it', () => {
    expect(normaliseDepartment('  Computer Science ')).toBe('Computer Science')
  })
})

describe('departmentOptions', () => {
  it('always offers the whole canonical list first', () => {
    expect(departmentOptions([]).slice(0, DEPARTMENTS.length)).toEqual([...DEPARTMENTS])
  })

  it('adds departments in use that are not on the list', () => {
    expect(departmentOptions(['Computer Science'])).toContain('Computer Science')
  })

  it('does not list a case variant of a canonical department twice', () => {
    const options = departmentOptions(['school of engineering', 'School of Engineering'])
    expect(options.filter((o) => o.toLowerCase() === 'school of engineering')).toEqual(['School of Engineering'])
  })

  it('merges case variants of an unlisted department too', () => {
    const options = departmentOptions(['Computer Science', 'computer science', ' Computer  Science '])
    expect(options.filter((o) => o.toLowerCase().replace(/\s+/g, ' ') === 'computer science')).toHaveLength(1)
  })

  it('ignores blanks and missing values', () => {
    expect(departmentOptions(['', '   ', null, undefined])).toHaveLength(DEPARTMENTS.length)
  })
})

describe('regex helpers', () => {
  it('escapes every metacharacter', () => {
    const nasty = '.*+?^${}()|[]\\'
    expect(new RegExp(`^${escapeRegex(nasty)}$`).test(nasty)).toBe(true)
  })

  it('treats "." as a literal dot, not "anything"', () => {
    // Unescaped, a search for "." matched every account in the directory.
    expect(containsInsensitive('.').test('Ada Lovelace')).toBe(false)
    expect(containsInsensitive('.').test('A. Lovelace')).toBe(true)
  })

  it('defuses a catastrophic-backtracking pattern', () => {
    const start = Date.now()
    containsInsensitive('(a+)+$').test('a'.repeat(40) + '!')
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('matches a whole label regardless of case', () => {
    expect(equalsInsensitive('School of Engineering').test('school of engineering')).toBe(true)
    // Whole value only: a department is not "found" by a prefix of its name.
    expect(equalsInsensitive('School').test('School of Engineering')).toBe(false)
  })
})
