import { decode } from 'next-auth/jwt'

export interface SocketUser {
  id: string
  name: string
}

/** What a connected socket carries once its handshake has been authenticated. */
export interface SocketData {
  user: SocketUser
}

/**
 * Auth.js adds the `__Secure-` prefix once the site is served over https, so
 * both names have to be tried. The cookie name doubles as the decryption salt,
 * which is why it is carried alongside the value rather than discarded.
 */
const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
]

function parseCookieHeader(header: string): Map<string, string> {
  const jar = new Map<string, string>()

  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name) jar.set(name, decodeURIComponent(part.slice(eq + 1).trim()))
  }

  return jar
}

/** Auth.js splits a session token over `.0`, `.1`, … cookies when it is large. */
function readSessionCookie(
  jar: Map<string, string>
): { name: string; value: string } | null {
  for (const name of SESSION_COOKIE_NAMES) {
    const whole = jar.get(name)
    if (whole) return { name, value: whole }

    const chunks: string[] = []
    for (let i = 0; jar.has(`${name}.${i}`); i++) {
      chunks.push(jar.get(`${name}.${i}`)!)
    }
    if (chunks.length) return { name, value: chunks.join('') }
  }

  return null
}

/**
 * Resolve the signed-in user from a Socket.io handshake's cookie header.
 * Returns null for anything that is not a valid, unexpired session — the
 * caller is expected to refuse the connection.
 */
export async function authenticateHandshake(
  cookieHeader: string | undefined
): Promise<SocketUser | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret || !cookieHeader) return null

  const cookie = readSessionCookie(parseCookieHeader(cookieHeader))
  if (!cookie) return null

  try {
    const token = await decode({
      token: cookie.value,
      secret,
      salt: cookie.name,
    })

    const id = (token?.id as string | undefined) ?? token?.sub
    if (!id) return null

    return { id, name: token?.name ?? 'Someone' }
  } catch {
    // Tampered, expired, or signed with a different secret — not a session.
    return null
  }
}
