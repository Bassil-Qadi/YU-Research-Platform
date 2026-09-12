import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

/**
 * Cloudinary-backed file storage.
 *
 * Configuration is read lazily so that importing this module never throws —
 * routes call isStorageConfigured() and return a clear 503 instead.
 */

export type StorageResourceType = 'image' | 'raw'

export interface UploadResult {
  publicId:     string
  url:          string
  bytes:        number
  format?:      string
  resourceType: StorageResourceType
}

export interface UploadOptions {
  /** Folder within the Cloudinary account, e.g. 'research-platform/avatars'. */
  folder:        string
  /** Original filename; used for the stored name and the download filename. */
  filename:      string
  resourceType?: StorageResourceType
}

// Defined in lib/utils so client components can check a size before uploading
// without importing this module, which pulls in the Cloudinary SDK.
export { MAX_UPLOAD_BYTES } from '@/lib/utils'

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export function isStorageConfigured(): boolean {
  // cloudinary://<api_key>:<api_secret>@<cloud_name>
  if (process.env.CLOUDINARY_URL) return true

  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}

let configured = false

function configure() {
  if (configured) return

  if (!isStorageConfigured()) {
    throw new Error(
      'File storage is not configured. Set CLOUDINARY_URL, or ' +
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    )
  }

  if (process.env.CLOUDINARY_URL) {
    // The SDK parses CLOUDINARY_URL out of the environment itself.
    cloudinary.config({ secure: true })
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure:     true,
    })
  }

  configured = true
}

/** Strip anything that would be awkward in a URL or a stored public id. */
function sanitiseFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '')
  return base
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
}

export async function uploadFile(
  file: Buffer,
  { folder, filename, resourceType = 'image' }: UploadOptions
): Promise<UploadResult> {
  configure()

  const response = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type:   resourceType,
        public_id:       `${Date.now()}-${sanitiseFilename(filename)}`,
        use_filename:    false,
        unique_filename: false,
        overwrite:       false,
      },
      (error, result) => {
        if (error) return reject(error)
        if (!result) return reject(new Error('Upload returned no result'))
        resolve(result)
      }
    )

    stream.end(file)
  })

  return {
    publicId:     response.public_id,
    url:          response.secure_url,
    bytes:        response.bytes,
    format:       response.format,
    resourceType,
  }
}

/**
 * Remove a stored file. Deliberately forgiving: a file that is already gone
 * should not stop the caller from deleting the record that points at it.
 */
export async function deleteFile(
  publicId: string,
  resourceType: StorageResourceType = 'image'
): Promise<void> {
  if (!isStorageConfigured()) return

  try {
    configure()
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
  } catch (err) {
    console.error('[storage] failed to delete', publicId, err)
  }
}

/** A resized, face-cropped variant of an uploaded avatar. */
export function avatarUrl(publicId: string, size = 200): string {
  if (!isStorageConfigured()) return ''
  configure()

  return cloudinary.url(publicId, {
    secure:         true,
    transformation: [
      { width: size, height: size, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  })
}
