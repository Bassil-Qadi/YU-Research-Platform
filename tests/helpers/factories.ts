import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import type { MemberRole } from '@/lib/db/models/Project'
import type { UserRole, UserStatus } from '@/types'

let counter = 0
const unique = () => `${Date.now()}-${counter++}`

export const TEST_PASSWORD = 'correct-horse-battery'

export async function makeUser(overrides: Partial<{
  name:         string
  email:        string
  role:         UserRole
  status:       UserStatus
  department:   string
  isPublic:     boolean
  password:     string | null
  avatarUrl:    string
}> = {}) {
  const id = unique()
  const { password = TEST_PASSWORD, ...rest } = overrides

  return User.create({
    name:         rest.name  ?? `User ${id}`,
    email:        rest.email ?? `user-${id}@university.edu`,
    universityId: `U-${id}`,
    role:         rest.role   ?? 'Student',
    status:       rest.status ?? 'active',
    department:   rest.department ?? 'Computer Science',
    ...(rest.isPublic  === undefined ? {} : { isPublic: rest.isPublic }),
    ...(rest.avatarUrl === undefined ? {} : { avatarUrl: rest.avatarUrl }),
    ...(password ? { passwordHash: await bcrypt.hash(password, 4) } : {}),
  })
}

export async function makeProject(
  pi: { _id: mongoose.Types.ObjectId },
  overrides: Partial<{
    title:      string
    status:     'active' | 'completed' | 'seeking' | 'paused'
    visibility: 'public' | 'university' | 'private'
    members:    { userId: mongoose.Types.ObjectId; role: MemberRole }[]
    openPositions: string[]
  }> = {}
) {
  const id = unique()

  return Project.create({
    title:      overrides.title ?? `Project ${id}`,
    abstract:   'An abstract long enough to satisfy the fifty character minimum imposed by the validation schema.',
    tags:       ['testing'],
    department: 'Computer Science',
    startDate:  new Date('2026-01-01'),
    status:     overrides.status     ?? 'active',
    visibility: overrides.visibility ?? 'university',
    openPositions: overrides.openPositions ?? [],
    createdBy:  pi._id,
    members: [
      { userId: pi._id, role: 'pi' as MemberRole, joinedAt: new Date() },
      ...(overrides.members ?? []).map((m) => ({ ...m, joinedAt: new Date() })),
    ],
  })
}

/** A NextRequest a route handler will accept, with optional JSON body. */
export function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = init

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

/** A multipart request carrying one file, as the upload routes expect. */
export function fileRequest(
  url: string,
  file: { name: string; type: string; content: Buffer | string },
  headers: Record<string, string> = {}
): NextRequest {
  const form = new FormData()
  const bytes = typeof file.content === 'string' ? Buffer.from(file.content) : file.content
  // Copy into a plain Uint8Array: Buffer's backing store is typed as possibly
  // shared, which BlobPart does not accept.
  const part = new Uint8Array(bytes)
  form.append('file', new Blob([part], { type: file.type }), file.name)

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers,
    body: form,
  })
}
