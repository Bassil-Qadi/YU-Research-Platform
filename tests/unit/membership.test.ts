import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import {
  canEditProject, findMember, isMember,
  isProjectPi, memberUserId,
} from '@/lib/projects/membership'
import { USER_ROLES } from '@/types'
import {
  canAccessAdmin, canManageProjects, canModerate,
  DEFAULT_ROLE, hasMinimumRole, isAdmin,
} from '@/lib/auth/rbac'

const alice = new Types.ObjectId()
const bob   = new Types.ObjectId()

describe('memberUserId', () => {
  it('reads a raw ObjectId reference', () => {
    expect(memberUserId({ userId: alice, role: 'pi' })).toBe(alice.toString())
  })

  it('reads a populated document reference', () => {
    expect(memberUserId({ userId: { _id: alice }, role: 'pi' })).toBe(alice.toString())
  })

  it('reads a plain string reference', () => {
    expect(memberUserId({ userId: alice.toString(), role: 'pi' })).toBe(alice.toString())
  })
})

describe('project membership', () => {
  const project = {
    members: [
      { userId: alice, role: 'pi' as const },
      { userId: { _id: bob }, role: 'contributor' as const },
    ],
  }

  it('finds members regardless of how the reference is shaped', () => {
    expect(findMember(project, alice.toString())?.role).toBe('pi')
    expect(findMember(project, bob.toString())?.role).toBe('contributor')
  })

  it('treats a stranger as not a member', () => {
    expect(isMember(project, new Types.ObjectId().toString())).toBe(false)
  })

  it('survives a missing project rather than throwing', () => {
    // The task routes used to read .members off a null project and 500.
    expect(isMember(null, alice.toString())).toBe(false)
    expect(isMember(undefined, alice.toString())).toBe(false)
    expect(canEditProject(null, alice.toString())).toBe(false)
  })

  it('lets only PI and co-PI edit', () => {
    expect(canEditProject(project, alice.toString())).toBe(true)
    expect(canEditProject(project, bob.toString())).toBe(false)

    const withCoPi = { members: [{ userId: bob, role: 'co-pi' as const }] }
    expect(canEditProject(withCoPi, bob.toString())).toBe(true)
  })

  it('reserves the PI check for the PI alone', () => {
    expect(isProjectPi(project, alice.toString())).toBe(true)
    expect(isProjectPi(project, bob.toString())).toBe(false)

    const coPi = { members: [{ userId: bob, role: 'co-pi' as const }] }
    expect(isProjectPi(coPi, bob.toString())).toBe(false)
  })
})

describe('role hierarchy', () => {
  it('covers every role the application defines', () => {
    // Regression: the table listed a non-existent "Guest" and omitted "Staff",
    // so every Staff user silently failed each hasMinimumRole check.
    for (const role of USER_ROLES) {
      expect(hasMinimumRole(role, 'Student')).toBe(true)
    }
  })

  it('orders roles so that admin outranks everyone', () => {
    for (const role of USER_ROLES.filter((r) => r !== 'Admin')) {
      expect(hasMinimumRole(role, 'Admin')).toBe(false)
    }
    expect(hasMinimumRole('Admin', 'Faculty')).toBe(true)
  })

  it('denies an unknown or absent role', () => {
    expect(hasMinimumRole(undefined, 'Student')).toBe(false)
  })

  it('uses the least privileged role as the default', () => {
    expect(USER_ROLES).toContain(DEFAULT_ROLE)
    for (const role of USER_ROLES) {
      if (role !== DEFAULT_ROLE) expect(hasMinimumRole(DEFAULT_ROLE, role)).toBe(false)
    }
  })

  it('gates the admin area on the Admin role only', () => {
    expect(isAdmin('Admin')).toBe(true)
    expect(canAccessAdmin('Admin')).toBe(true)
    expect(canAccessAdmin('Faculty')).toBe(false)
    expect(canAccessAdmin(undefined)).toBe(false)
  })

  it('keeps the other capability checks consistent with the hierarchy', () => {
    expect(canManageProjects('Researcher')).toBe(true)
    expect(canManageProjects('Student')).toBe(false)
    expect(canModerate('Faculty')).toBe(true)
    expect(canModerate('Researcher')).toBe(false)
  })
})
