import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import { sendEmail } from '@/lib/email/client'
import {
  accountReinstated, accountSuspended,
  registrationApproved, registrationRejected,
} from '@/lib/email/templates'
import { USER_ROLES, USER_STATUSES } from '@/types'

type Params = { params: { id: string } }

const updateSchema = z
  .object({
    status: z.enum(USER_STATUSES).optional(),
    role:   z.enum(USER_ROLES).optional(),
    /** Shown to the person when they are turned down or suspended. */
    reason: z.string().max(500).trim().optional(),
  })
  .refine((v) => v.status !== undefined || v.role !== undefined, {
    message: 'Nothing to change',
  })

/** Whether this account is the last one that can still administer the platform. */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const others = await User.countDocuments({
    _id:    { $ne: userId },
    role:   'Admin',
    status: 'active',
  })

  return others === 0
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    await connectDB()

    const body   = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { status, role, reason } = parsed.data

    // Changing your own role or status is how an administrator locks themselves
    // out of the platform, so it is simply not offered.
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role or status' },
        { status: 409 }
      )
    }

    const target = await User.findById(params.id).select('name email role status')
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Losing every administrator would leave nobody able to restore one.
    const losesAdmin =
      (role !== undefined && role !== 'Admin' && target.role === 'Admin') ||
      (status !== undefined && status !== 'active' && target.role === 'Admin')

    if (losesAdmin && (await isLastActiveAdmin(params.id))) {
      return NextResponse.json(
        { error: 'This is the last active administrator' },
        { status: 409 }
      )
    }

    const previousStatus = target.status

    const update: Record<string, unknown> = {}
    if (status !== undefined) update.status = status
    if (role   !== undefined) update.role   = role
    if (reason !== undefined && status === 'rejected') update.rejectionReason = reason

    const updated = await User.findByIdAndUpdate(
      params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('name email role status department position universityId createdAt')

    // Best-effort, as everywhere else: the change stands whether or not the
    // message goes out. Only status changes are worth an email.
    if (status && status !== previousStatus) {
      const mail =
        status === 'active'
          ? previousStatus === 'suspended'
            ? accountReinstated(target.name)
            : registrationApproved(target.name)
          : status === 'rejected'
            ? registrationRejected(target.name, reason)
            : status === 'suspended'
              ? accountSuspended(target.name, reason)
              : null

      if (mail) await sendEmail({ to: target.email, ...mail })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
