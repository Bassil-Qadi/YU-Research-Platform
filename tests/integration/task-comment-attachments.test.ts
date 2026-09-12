import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs } from '../helpers/session'

// Storage is stubbed so the tests never reach Cloudinary. Keeping a record of
// what was asked of it is the point: a rejected upload must not be sent, and a
// deleted comment must take its file with it.
const storage = vi.hoisted(() => ({
  uploaded: [] as { folder: string; filename: string; resourceType: string }[],
  deleted:  [] as { publicId: string; resourceType: string }[],
}))

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage')
  return {
    ...actual,
    isStorageConfigured: () => true,
    uploadFile: async (
      _buffer: Buffer,
      opts: { folder: string; filename: string; resourceType: string }
    ) => {
      storage.uploaded.push(opts)
      return {
        publicId: `stub/${opts.filename}`,
        url:      `https://cdn.test/${opts.filename}`,
        bytes:    123,
        format:   opts.filename.split('.').pop(),
      }
    },
    deleteFile: async (publicId: string, resourceType: string) => {
      storage.deleted.push({ publicId, resourceType })
    },
  }
})

useDatabase()

beforeEach(() => {
  storage.uploaded.length = 0
  storage.deleted.length  = 0
})

const body = (res: Response) => res.json()

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/** A comment and its attachment in one multipart request, as the browser sends it. */
function commentUpload(
  content: string,
  file?: { name: string; type: string; content: Buffer | string }
): NextRequest {
  const form = new FormData()
  form.append('content', content)

  if (file) {
    const bytes = typeof file.content === 'string' ? Buffer.from(file.content) : file.content
    form.append('file', new Blob([new Uint8Array(bytes)], { type: file.type }), file.name)
  }

  return new NextRequest(new URL('/x', 'http://localhost:3000'), { method: 'POST', body: form })
}

async function routes() {
  const list = await import('@/app/api/projects/[id]/tasks/[taskId]/comments/route')
  const one  = await import('@/app/api/projects/[id]/tasks/[taskId]/comments/[commentId]/route')
  return { add: list.POST, get: list.GET, remove: one.DELETE }
}

/** A project with a PI, a helper and one task, with the PI signed in. */
async function setup() {
  const pi       = await makeUser({ name: 'Priya PI' })
  const helper   = await makeUser({ name: 'Hana Helper' })
  const outsider = await makeUser({ name: 'Otto Outsider' })
  const project  = await makeProject(pi, {
    members: [{ userId: helper._id, role: 'contributor' }],
  })

  await signedInAs(pi)
  const { POST } = await import('@/app/api/projects/[id]/tasks/route')
  const task = await body(await POST(
    jsonRequest('/x', { method: 'POST', body: { title: 'Analyse the survey data' } }),
    { params: { id: project._id.toString() } }
  ))

  return {
    pi, helper, outsider,
    projectId: project._id.toString(),
    taskId:    task._id as string,
    params:    { params: { id: project._id.toString(), taskId: task._id as string } },
  }
}

describe('attaching a file to a task comment', () => {
  it('stores the file alongside the text', async () => {
    const { params } = await setup()
    const { add } = await routes()

    const res = await add(commentUpload('Here is the raw data', {
      name: 'chart.png', type: 'image/png', content: PNG,
    }), params)
    const comment = await body(res)

    expect(res.status).toBe(201)
    expect(comment.content).toBe('Here is the raw data')
    expect(comment.attachment.name).toBe('chart.png')
    expect(comment.attachment.url).toBe('https://cdn.test/chart.png')
    expect(comment.attachment.resourceType).toBe('image')
  })

  it('accepts a file with nothing written', async () => {
    // Regression: a notification needs a body, so an empty comment would fail
    // Mongoose validation and 500 after the file had already been stored.
    const { params, pi, helper } = await setup()
    const { add } = await routes()
    await signedInAs(helper)

    const res = await add(commentUpload('', {
      name: 'notes.pdf', type: 'application/pdf', content: 'PDF',
    }), params)
    const comment = await body(res)

    expect(res.status).toBe(201)
    expect(comment.content).toBe('')
    expect(comment.attachment.name).toBe('notes.pdf')
    expect(comment.attachment.resourceType).toBe('raw')

    const Notification = (await import('@/lib/db/models/Notification')).default
    const note = await Notification.findOne({ userId: pi._id }).lean()
    expect(note?.body).toContain('notes.pdf')
  })

  it('refuses a comment that is neither text nor file', async () => {
    const { params } = await setup()
    const { add } = await routes()

    expect((await add(commentUpload(''), params)).status).toBe(400)
    expect(storage.uploaded).toHaveLength(0)
  })

  it('checks the file before sending it anywhere', async () => {
    const { params } = await setup()
    const { add } = await routes()

    const oversized = await add(commentUpload('big', {
      name: 'big.txt', type: 'text/plain', content: Buffer.alloc(11 * 1024 * 1024),
    }), params)
    expect(oversized.status).toBe(413)

    const wrongType = await add(commentUpload('nasty', {
      name: 'evil.exe', type: 'application/x-msdownload', content: 'MZ',
    }), params)
    expect(wrongType.status).toBe(415)

    const empty = await add(commentUpload('nothing', {
      name: 'empty.txt', type: 'text/plain', content: Buffer.alloc(0),
    }), params)
    expect(empty.status).toBe(422)

    // None of them should have reached storage.
    expect(storage.uploaded).toHaveLength(0)
  })

  it('refuses an outsider before it uploads anything', async () => {
    const { params, outsider } = await setup()
    const { add } = await routes()
    await signedInAs(outsider)

    const res = await add(commentUpload('let me in', {
      name: 'chart.png', type: 'image/png', content: PNG,
    }), params)

    expect(res.status).toBe(403)
    expect(storage.uploaded).toHaveLength(0)
  })

  it('files it under the project it belongs to', async () => {
    const { params, projectId } = await setup()
    const { add } = await routes()

    await add(commentUpload('', { name: 'chart.png', type: 'image/png', content: PNG }), params)

    expect(storage.uploaded[0].folder).toContain(projectId)
  })

  it('still takes a plain text comment as JSON', async () => {
    const { params } = await setup()
    const { add } = await routes()

    const res = await add(
      jsonRequest('/x', { method: 'POST', body: { content: 'Just words' } }),
      params
    )

    expect(res.status).toBe(201)
    expect((await body(res)).content).toBe('Just words')
    expect(storage.uploaded).toHaveLength(0)
  })
})

describe('removing a comment with an attachment', () => {
  it('deletes the stored file too', async () => {
    const { params } = await setup()
    const { add, remove } = await routes()

    const comment = await body(await add(commentUpload('', {
      name: 'chart.png', type: 'image/png', content: PNG,
    }), params))

    const res = await remove(jsonRequest('/x', { method: 'DELETE' }), {
      params: { ...params.params, commentId: comment._id },
    })

    expect(res.status).toBe(200)
    expect(storage.deleted).toEqual([{ publicId: 'stub/chart.png', resourceType: 'image' }])
  })

  it('sweeps attachments when the whole task goes', async () => {
    const { params } = await setup()
    const { add } = await routes()

    await add(commentUpload('', { name: 'one.png', type: 'image/png', content: PNG }), params)
    await add(commentUpload('no file here'), params)
    await add(commentUpload('', { name: 'two.pdf', type: 'application/pdf', content: 'PDF' }), params)

    const { DELETE } = await import('@/app/api/projects/[id]/tasks/[taskId]/route')
    await DELETE(jsonRequest('/x', { method: 'DELETE' }), params)

    expect(storage.deleted.map((d) => d.publicId).sort())
      .toEqual(['stub/one.png', 'stub/two.pdf'])
  })

  it('sweeps them when the whole project goes', async () => {
    const { params, projectId } = await setup()
    const { add } = await routes()

    await add(commentUpload('', { name: 'one.png', type: 'image/png', content: PNG }), params)

    const { DELETE } = await import('@/app/api/projects/[id]/route')
    await DELETE(jsonRequest('/x', { method: 'DELETE' }), { params: { id: projectId } })

    expect(storage.deleted.map((d) => d.publicId)).toContain('stub/one.png')
  })
})
