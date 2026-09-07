import { describe, expect, it } from 'vitest'
import { readUploadedFile } from '@/lib/storage/upload-request'
import {
  ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES, isStorageConfigured,
} from '@/lib/storage'
import { fileRequest } from '../helpers/factories'

const IMAGE_TYPES = [...ALLOWED_IMAGE_TYPES]

describe('readUploadedFile', () => {
  it('accepts a permitted file and reports its real size', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', { name: 'notes.txt', type: 'text/plain', content: 'hello' }),
      { allowedTypes: ALLOWED_DOCUMENT_TYPES }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.filename).toBe('notes.txt')
      expect(result.file.size).toBe(5)
      expect(result.file.buffer.toString()).toBe('hello')
    }
  })

  it('refuses a request that is not multipart', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    const result = await readUploadedFile(req as never, { allowedTypes: IMAGE_TYPES })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses a form with no file in it', async () => {
    const req = new Request('http://localhost/x', { method: 'POST', body: new FormData() })

    const result = await readUploadedFile(req as never, { allowedTypes: IMAGE_TYPES })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses an empty file', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', { name: 'empty.txt', type: 'text/plain', content: Buffer.alloc(0) }),
      { allowedTypes: ALLOWED_DOCUMENT_TYPES }
    )

    expect(result).toMatchObject({ ok: false, status: 422 })
  })

  it('refuses a file past the limit and says how big it was', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', {
        name: 'big.txt', type: 'text/plain', content: Buffer.alloc(MAX_UPLOAD_BYTES + 1),
      }),
      { allowedTypes: ALLOWED_DOCUMENT_TYPES }
    )

    expect(result).toMatchObject({ ok: false, status: 413 })
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it('honours a tighter per-route limit', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', { name: 'a.txt', type: 'text/plain', content: Buffer.alloc(2048) }),
      { allowedTypes: ALLOWED_DOCUMENT_TYPES, maxBytes: 1024 }
    )

    expect(result).toMatchObject({ ok: false, status: 413 })
  })

  it('refuses a type outside the allow-list', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', { name: 'evil.exe', type: 'application/x-msdownload', content: 'MZ' }),
      { allowedTypes: [...IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES] }
    )

    expect(result).toMatchObject({ ok: false, status: 415 })
  })

  it('does not accept a document where only images are allowed', async () => {
    const result = await readUploadedFile(
      fileRequest('/x', { name: 'notes.txt', type: 'text/plain', content: 'hi' }),
      { allowedTypes: IMAGE_TYPES }
    )

    expect(result).toMatchObject({ ok: false, status: 415 })
  })

  it('never lists an executable type as acceptable', () => {
    const all = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]
    for (const dangerous of [
      'application/x-msdownload',
      'application/x-sh',
      'text/html',
      'image/svg+xml', // scriptable, so deliberately excluded
    ]) {
      expect(all).not.toContain(dangerous)
    }
  })
})

describe('isStorageConfigured', () => {
  it('is false when nothing is set', () => {
    expect(isStorageConfigured()).toBe(false)
  })

  it('accepts either the URL form or the three separate variables', () => {
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloud'
    expect(isStorageConfigured()).toBe(true)
    delete process.env.CLOUDINARY_URL

    process.env.CLOUDINARY_CLOUD_NAME = 'cloud'
    process.env.CLOUDINARY_API_KEY = 'key'
    expect(isStorageConfigured()).toBe(false) // secret still missing

    process.env.CLOUDINARY_API_SECRET = 'secret'
    expect(isStorageConfigured()).toBe(true)

    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
  })
})
