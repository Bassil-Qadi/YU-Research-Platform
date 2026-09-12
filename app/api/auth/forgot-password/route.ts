import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import PasswordResetToken from '@/lib/db/models/PasswordResetToken'
import {
  RESET_TOKEN_TTL_MS, generateResetToken, hashResetToken, resetTokenExpiry, resetUrl,
} from '@/lib/auth/password-reset'
import { appUrl, isEmailConfigured, sendEmail } from '@/lib/email/client'
import { passwordResetRequested } from '@/lib/email/templates'
import { RATE_LIMITS, clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
})

/**
 * The same answer whatever happens, so this cannot be used to find out which
 * addresses have accounts — or which of those are approved.
 */
const SAME_ANSWER = {
  message: 'If that address has an account, a reset link is on its way.',
}

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
  try {
    // Anyone can reach this and each call sends mail to an address the caller
    // chose, so it is throttled before any of that.
    const verdict = await rateLimit(`forgot-password:${clientIp(req)}`, RATE_LIMITS.passwordReset)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    const body   = await req.json().catch(() => ({}))
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    await connectDB()

    const user = await User.findOne({ email: parsed.data.email })
      .select('name email status')
      .lean()

    // Only an approved account can sign in, so only an approved account has a
    // password worth resetting. Everyone else gets the same reply.
    if (!user || user.status !== 'active') {
      return NextResponse.json(SAME_ANSWER)
    }

    // Any link sent earlier stops working: asking again should not leave a
    // trail of usable keys in an inbox.
    await PasswordResetToken.deleteMany({ userId: user._id })

    const token = generateResetToken()
    await PasswordResetToken.create({
      userId:    user._id,
      tokenHash: hashResetToken(token),
      expiresAt: resetTokenExpiry(),
    })

    const url  = resetUrl(appUrl(), token)
    const mail = passwordResetRequested(user.name, url, RESET_TOKEN_TTL_MS / 60000)

    if (isEmailConfigured()) {
      // Best-effort, like every other send: the token exists either way.
      await sendEmail({ to: user.email, ...mail })
    } else {
      // Without a mail provider the flow would be untestable, and a link nobody
      // can reach is worse than a loud one in the server log.
      console.warn(
        `[auth] email is not configured — password reset link for ${user.email}:\n  ${url}`
      )
    }

    return NextResponse.json(SAME_ANSWER)
  } catch (err) {
    console.error('[POST /api/auth/forgot-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
