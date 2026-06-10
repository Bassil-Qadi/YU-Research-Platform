import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const { name, email, password, role, department, position } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await User.findOne({ email })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash  = await bcrypt.hash(password, 12)
    const universityId  = `USR-${Date.now()}`

    const user = await User.create({
      name,
      email,
      passwordHash,
      universityId,
      role:       role       ?? 'Student',
      department: department ?? '',
      position:   position   ?? '',
      isPublic:   true,
    })

    return NextResponse.json({
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}