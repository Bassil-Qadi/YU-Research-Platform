import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { normaliseDepartment } from '@/lib/departments'
import { sendEmail } from '@/lib/email/client'
import { RATE_LIMITS, clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { registrationReceived, registrationPendingForAdmins } from '@/lib/email/templates'

const registerSchema = z.object({
  name:       z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:      z.string().email('Invalid email address'),
  password:   z.string().min(8, 'Password must be at least 8 characters'),
  role:       z.enum(['Student', 'Faculty', 'Staff', 'Researcher']),
  department: z.string().trim().min(1, 'Department is required').transform(normaliseDepartment),
  position:   z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Anyone can reach this, and each call writes a user and sends mail to the
    // applicant and every admin — so it is throttled before any of that.
    const verdict = await rateLimit(`register:${clientIp(req)}`, RATE_LIMITS.register)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    await connectDB()

    const body   = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    const { name, email, password, role, department, position } = parsed.data

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json(
        { error: { email: ['This email is already registered'] } },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const universityId = `USR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    await User.create({
      name,
      email:      email.toLowerCase(),
      passwordHash,
      universityId,
      role,
      department,
      position:   position ?? '',
      isPublic:   true,
      status:     'pending',
    })

    // Best-effort: the account exists either way, so a mail failure must not
    // turn a successful registration into an error.
    const applicantMail = registrationReceived(name)
    await sendEmail({ to: email.toLowerCase(), ...applicantMail })

    const admins = await User.find({ role: 'Admin', status: 'active' })
      .select('email')
      .lean()
    const adminEmails = admins.map((a) => a.email).filter(Boolean)

    if (adminEmails.length > 0) {
      const adminMail = registrationPendingForAdmins(name, email.toLowerCase(), department, role)
      await sendEmail({ to: adminEmails, ...adminMail })
    }

    return NextResponse.json(
      { message: 'Registration submitted. Await admin approval.' },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}