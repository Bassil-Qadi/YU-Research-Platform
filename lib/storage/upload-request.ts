import type { NextRequest } from 'next/server'
import { MAX_UPLOAD_BYTES } from '@/lib/storage'

export interface ParsedUpload {
  buffer:      Buffer
  filename:    string
  contentType: string
  size:        number
}

export type ReadUploadResult =
  | { ok: true;  file: ParsedUpload }
  | { ok: false; error: string; status: number }

interface ReadUploadOptions {
  allowedTypes: string[]
  maxBytes?:    number
  /** Form field holding the file. */
  field?:       string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Pull a single uploaded file out of a multipart request and check it before
 * anything touches the storage provider. Every guard here is server-side —
 * the matching checks in the browser are only there for a faster message.
 */
export async function readUploadedFile(
  req: NextRequest,
  { allowedTypes, maxBytes = MAX_UPLOAD_BYTES, field = 'file' }: ReadUploadOptions
): Promise<ReadUploadResult> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return { ok: false, error: 'Expected a multipart form upload', status: 400 }
  }

  const entry = formData.get(field)
  if (!entry || typeof entry === 'string') {
    return { ok: false, error: `No file provided in "${field}"`, status: 400 }
  }

  const file = entry as File

  if (file.size === 0) {
    return { ok: false, error: 'The file is empty', status: 422 }
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(maxBytes)}.`,
      status: 413,
    }
  }

  // A browser can claim any type, so this is a filter rather than proof; the
  // storage provider is the one that ultimately decides what it will store.
  const contentType = file.type || 'application/octet-stream'
  if (!allowedTypes.includes(contentType)) {
    return { ok: false, error: `Files of type "${contentType}" are not accepted`, status: 415 }
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Trust the measured length over the declared one.
  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      error: `File is too large (${formatBytes(buffer.byteLength)}). The limit is ${formatBytes(maxBytes)}.`,
      status: 413,
    }
  }

  return {
    ok: true,
    file: {
      buffer,
      filename:    file.name || 'upload',
      contentType,
      size:        buffer.byteLength,
    },
  }
}
