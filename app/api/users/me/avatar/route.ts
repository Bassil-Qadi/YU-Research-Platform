import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import {
  ALLOWED_IMAGE_TYPES, avatarUrl, deleteFile,
  isStorageConfigured, uploadFile,
} from '@/lib/storage'
import { readUploadedFile } from '@/lib/storage/upload-request'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

/** Avatars are displayed small; no need to accept the full 10MB. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

// POST /api/users/me/avatar — replace your profile picture
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verdict = await rateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'File uploads are not configured on this server' },
        { status: 503 }
      )
    }

    const parsed = await readUploadedFile(req, {
      allowedTypes: ALLOWED_IMAGE_TYPES,
      maxBytes:     MAX_AVATAR_BYTES,
    })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }

    await connectDB()

    const user = await User.findById(session.user.id).select('avatarPublicId')
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const uploaded = await uploadFile(parsed.file.buffer, {
      folder:       'research-platform/avatars',
      filename:     parsed.file.filename,
      resourceType: 'image',
    })

    const previousPublicId = user.avatarPublicId

    // Store the face-cropped variant so every consumer gets a square image.
    const displayUrl = avatarUrl(uploaded.publicId)

    const updated = await User.findByIdAndUpdate(
      session.user.id,
      {
        $set: {
          avatarUrl:      displayUrl,
          avatar:         displayUrl,
          avatarPublicId: uploaded.publicId,
        },
      },
      { new: true }
    ).select('name avatarUrl avatarPublicId')

    // Only once the new one is safely recorded.
    if (previousPublicId) await deleteFile(previousPublicId, 'image')

    return NextResponse.json({ user: updated }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/users/me/avatar]', err)
    return NextResponse.json({ error: 'Failed to upload the image' }, { status: 500 })
  }
}

// DELETE /api/users/me/avatar — go back to initials
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(session.user.id).select('avatarPublicId')
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await User.findByIdAndUpdate(session.user.id, {
      $unset: { avatarUrl: '', avatar: '', avatarPublicId: '' },
    })

    if (user.avatarPublicId) await deleteFile(user.avatarPublicId, 'image')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/users/me/avatar]', err)
    return NextResponse.json({ error: 'Failed to remove the image' }, { status: 500 })
  }
}
