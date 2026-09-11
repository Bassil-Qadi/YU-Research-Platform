/**
 * The one list of departments. Registration, profiles, projects and every
 * filter read from here; before this there were three copies that disagreed,
 * so people in half the departments could not be found by filtering.
 */
export const DEPARTMENTS = [
  'School of Engineering',
  'College of Natural Sciences',
  'School of Social Sciences',
  'School of Medicine',
  'School of Business',
  'College of Arts & Humanities',
  'School of Education',
  'Other',
] as const

export type Department = (typeof DEPARTMENTS)[number]

/**
 * Tidy a department before it is stored: trim, collapse inner whitespace, and
 * snap to the canonical spelling when it matches one case-insensitively — so
 * "school of engineering" and "School of Engineering" stop being two things.
 * Anything not on the list is kept as written rather than rejected, since
 * older records already hold free-text values.
 */
export function normaliseDepartment(value: string): string {
  const tidy = value.trim().replace(/\s+/g, ' ')
  return DEPARTMENTS.find((d) => d.toLowerCase() === tidy.toLowerCase()) ?? tidy
}

/**
 * Merge the canonical list with whatever is actually stored, treating values
 * that differ only by case as one. Canonical spellings win; values not on the
 * list are appended so an old record is still reachable from a filter.
 */
export function departmentOptions(inUse: (string | null | undefined)[]): string[] {
  const seen = new Set(DEPARTMENTS.map((d) => d.toLowerCase()))
  const extras = new Map<string, string>()

  for (const raw of inUse) {
    if (!raw) continue
    const tidy = raw.trim().replace(/\s+/g, ' ')
    const key = tidy.toLowerCase()
    if (!tidy || seen.has(key) || extras.has(key)) continue
    extras.set(key, tidy)
  }

  return [
    ...DEPARTMENTS,
    ...Array.from(extras.values()).sort((a, b) => a.localeCompare(b)),
  ]
}
