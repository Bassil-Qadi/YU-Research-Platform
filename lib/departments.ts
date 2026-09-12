/**
 * Yarmouk University's faculties, as published at yu.edu.jo, in the university's
 * own grouping: health, scientific, then humanities.
 *
 * This is the one list. Registration, profiles, projects and every filter read
 * from here; before this there were three copies that disagreed, so people in
 * half the departments could not be found by filtering.
 *
 * The field is still called `department` throughout the API and the database —
 * only the values are Yarmouk's. Renaming the field would break stored records
 * for no gain.
 */
export const DEPARTMENTS = [
  // Health
  'Faculty of Medicine',
  'Faculty of Pharmacy',
  'Faculty of Nursing',
  // Scientific
  'Faculty of Science',
  'Hijjawi Faculty for Engineering Technology',
  'Faculty of Information Technology and Computer Science',
  'Faculty of Technology',
  // Humanities
  'Faculty of Arts',
  'Faculty of Business',
  "Faculty of Al-Shari'a and Islamic Studies",
  'Faculty of Educational Sciences',
  'Faculty of Law',
  'Faculty of Mass Communication',
  'Faculty of Physical Education and Sport Sciences',
  'Faculty of Archaeology and Anthropology',
  'Faculty of Tourism and Hotels',
  'Faculty of Fine Arts',
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
