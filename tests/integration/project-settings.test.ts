import { describe, expect, it } from 'vitest'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs } from '../helpers/session'

useDatabase()

async function edit(projectId: string, changes: Record<string, unknown>) {
  const { PATCH } = await import('@/app/api/projects/[id]/route')
  return PATCH(jsonRequest('/x', { method: 'PATCH', body: changes }), { params: { id: projectId } })
}

async function stored(projectId: string) {
  const Project = (await import('@/lib/db/models/Project')).default
  return Project.findById(projectId).lean()
}

describe('who may edit a project', () => {
  it('lets the PI and a co-PI, and nobody else', async () => {
    const pi          = await makeUser({})
    const coPi        = await makeUser({})
    const contributor = await makeUser({})
    const outsider    = await makeUser({})
    const project = await makeProject(pi, {
      members: [
        { userId: coPi._id, role: 'co-pi' },
        { userId: contributor._id, role: 'contributor' },
      ],
    })
    const id = project._id.toString()

    await signedInAs(pi)
    expect((await edit(id, { title: 'Renamed by the PI' })).status).toBe(200)

    await signedInAs(coPi)
    expect((await edit(id, { title: 'Renamed by a co-PI' })).status).toBe(200)

    await signedInAs(contributor)
    expect((await edit(id, { title: 'Not allowed' })).status).toBe(403)

    await signedInAs(outsider)
    expect((await edit(id, { title: 'Not allowed' })).status).toBe(403)
  })

  it('400s on a malformed id instead of crashing', async () => {
    await signedInAs(await makeUser({}))
    expect((await edit('nonsense', { title: 'Whatever title' })).status).toBe(400)
  })
})

describe('what an edit changes', () => {
  it('changes only the fields that were sent', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi, {
      status: 'seeking',
      visibility: 'public',
      openPositions: ['PhD Student'],
    })

    await signedInAs(pi)
    await edit(project._id.toString(), { title: 'Only the title moves' })

    const after = await stored(project._id.toString())

    expect(after?.title).toBe('Only the title moves')
    // Regression guard: .partial() over a schema with .default()s must not
    // reset what was left out — status to 'active', positions to [].
    expect(after?.status).toBe('seeking')
    expect(after?.visibility).toBe('public')
    expect(after?.openPositions).toEqual(['PhD Student'])
  })

  it('sets open positions, which nothing in the app could do before', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    const res = await edit(project._id.toString(), {
      status: 'seeking',
      openPositions: ['PhD Student', 'Research Assistant'],
    })

    expect(res.status).toBe(200)
    const after = await stored(project._id.toString())
    expect(after?.status).toBe('seeking')
    expect(after?.openPositions).toEqual(['PhD Student', 'Research Assistant'])
  })

  it('clears an optional field when sent null, and leaves it when omitted', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)
    const id = project._id.toString()

    await signedInAs(pi)
    await edit(id, { fundingSource: 'NSF', fundingAmount: 50000, endDate: '2027-06-30' })

    let after = await stored(id)
    expect(after?.fundingSource).toBe('NSF')
    expect(after?.fundingAmount).toBe(50000)

    // Omitted: untouched.
    await edit(id, { title: 'Something else entirely' })
    after = await stored(id)
    expect(after?.fundingSource).toBe('NSF')

    // null: removed.
    await edit(id, { fundingSource: null, fundingAmount: null, endDate: null })
    after = await stored(id)
    expect(after?.fundingSource).toBeUndefined()
    expect(after?.fundingAmount).toBeUndefined()
    expect(after?.endDate).toBeUndefined()
  })
})

describe('validation', () => {
  it('refuses an end date before the start date', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi) // starts 2026-01-01

    await signedInAs(pi)
    expect((await edit(project._id.toString(), { endDate: '2025-12-31' })).status).toBe(422)
  })

  it('judges dates against what is already stored, not only what was sent', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)
    const id = project._id.toString()

    await signedInAs(pi)
    await edit(id, { endDate: '2026-06-30' })

    // Moving just the start past the stored end must still be caught.
    expect((await edit(id, { startDate: '2026-09-01' })).status).toBe(422)
  })

  it('refuses titles and abstracts that are only long because of whitespace', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)
    const id = project._id.toString()

    await signedInAs(pi)
    expect((await edit(id, { title: '   ab   ' })).status).toBe(422)
    expect((await edit(id, { abstract: `short${' '.repeat(60)}` })).status).toBe(422)
  })

  it('refuses blank tags and positions rather than storing empty strings', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)
    const id = project._id.toString()

    await signedInAs(pi)
    expect((await edit(id, { tags: ['valid', '   '] })).status).toBe(422)
    expect((await edit(id, { openPositions: [''] })).status).toBe(422)
  })

  it('normalises tags to trimmed lower case', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    await edit(project._id.toString(), { tags: ['  Machine Learning ', 'NLP'] })

    expect((await stored(project._id.toString()))?.tags).toEqual(['machine learning', 'nlp'])
  })

  it('caps both lists at ten entries', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)
    const eleven = Array.from({ length: 11 }, (_, i) => `entry ${i}`)

    await signedInAs(pi)
    expect((await edit(project._id.toString(), { tags: eleven })).status).toBe(422)
    expect((await edit(project._id.toString(), { openPositions: eleven })).status).toBe(422)
  })

  it('refuses an unknown status', async () => {
    const pi = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    expect((await edit(project._id.toString(), { status: 'abandoned' })).status).toBe(422)
  })
})

describe('the join-request position picker', () => {
  it('can now offer the positions a PI has set', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi)
    const id = project._id.toString()

    await signedInAs(pi)
    await edit(id, { status: 'seeking', openPositions: ['Research Assistant'] })

    await signedInAs(applicant)
    const { POST } = await import('@/app/api/projects/[id]/join-requests/route')
    const res = await POST(
      jsonRequest('/x', { method: 'POST', body: { position: 'Research Assistant', message: 'Keen' } }),
      { params: { id } }
    )

    expect(res.status).toBe(201)
    expect((await res.json()).position).toBe('Research Assistant')
  })
})
