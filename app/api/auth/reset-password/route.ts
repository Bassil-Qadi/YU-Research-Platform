import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import PasswordResetToken from '@/lib/db/models/PasswordResetToken'
import { hashResetToken } from '@/lib/auth/password-reset'
import { sendEmail } from '@/lib/email/client'
import { passwordChanged } from '@/lib/email/templates'
import { RATE_LIMITS, clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const resetPasswordSchema = z.object({
  token:    z.string().min(1, 'The reset link is incomplete'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

/** One message for every way a link can fail, since the fix is the same. */
const BAD_TOKEN = 'That reset link is invalid or has expired. Request a new one.'

// POST /api/auth/reset-password
export async function POST(req: NextRequest) {
  try {
    const verdict = await rateLimit(
      `reset-password:${clientIp(req)}`,
      RATE_LIMITS.passwordResetAttempt
    )
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    const body   = await req.json().catch(() => ({}))
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    await connectDB()

    const record = await PasswordResetToken.findOne({
      tokenHash: hashResetToken(parsed.data.token),
    })

    // Unknown, already spent, or past its hour. Mongo's TTL sweep is periodic,
    // so an expired row can still be sitting there — check the date too.
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: BAD_TOKEN }, { status: 400 })
    }

    const user = await User.findById(record.userId).select('name email status')
    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: BAD_TOKEN }, { status: 400 })
    }

    user.passwordHash      = await bcrypt.hash(parsed.data.password, 12)
    // Signs out every session issued before now — see lib/auth/revalidate.
    user.passwordChangedAt = new Date()
    await user.save()

    // Spend this link, and drop any other outstanding one for the account.
    record.usedAt = new Date()
    await record.save()
    await PasswordResetToken.deleteMany({ userId: user._id, _id: { $ne: record._id } })

    // Tells someone their account was taken over, so it is worth sending even
    // though it cannot fail the reset.
    await sendEmail({ to: user.email, ...passwordChanged(user.name) })

    return NextResponse.json({ message: 'Your password has been changed. You can sign in now.' })
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
