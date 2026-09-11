/**
 * User input must never reach MongoDB's $regex as-is. Unescaped, "(a+)+$"
 * backtracks catastrophically and ties up the database, and "." or ".*"
 * silently match far more than was typed.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches the text anywhere, ignoring case. */
export function containsInsensitive(input: string): RegExp {
  return new RegExp(escapeRegex(input.trim()), 'i')
}

/** Matches the whole value, ignoring case — for filters over stored labels. */
export function equalsInsensitive(input: string): RegExp {
  return new RegExp(`^${escapeRegex(input.trim())}$`, 'i')
}
