/**
 * Yarmouk University — the one place the institution and the platform are
 * named. Copy that mentions either should read from here, so a rename is one
 * edit rather than a hunt through thirty files.
 */
export const UNIVERSITY = {
  name:        'Yarmouk University',
  /** Rendered alongside the English name on the public pages. */
  nameArabic:  'جامعة اليرموك',
  short:       'Yarmouk',
  initials:    'YU',
  city:        'Irbid',
  country:     'Jordan',
  founded:     1976,
  website:     'https://www.yu.edu.jo',
  /** Staff and students sign in with an address at this domain. */
  emailDomain: 'yu.edu.jo',
} as const

export const PLATFORM = {
  /** Full name, for page titles, emails and footers. */
  name:    'Yarmouk University Research Platform',
  /** The second line under the logo, where space is tight. */
  short:   'Research Hub',
  tagline: 'Research collaboration across Yarmouk University',
} as const

/** e.g. "Irbid, Jordan" */
export const UNIVERSITY_LOCATION = `${UNIVERSITY.city}, ${UNIVERSITY.country}`

/** A sample address in the university's own domain, for input placeholders. */
export const EMAIL_PLACEHOLDER = `you@${UNIVERSITY.emailDomain}`
