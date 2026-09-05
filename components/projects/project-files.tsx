'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  Download, FileText, Image as ImageIcon,
  Loader2, Trash2, Upload,
} from 'lucide-react'
import { errorMessage } from '@/lib/api'
import { useProjectFiles, useDeleteProjectFile, type ProjectFile } from '@/hooks/useProjectFiles'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/layout/empty-state'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileRow({
  file,
  projectId,
  canDelete,
}: {
  file: ProjectFile
  projectId: string
  canDelete: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const remove = useDeleteProjectFile(projectId)
  const Icon = file.resourceType === 'image' ? ImageIcon : FileText

  async function handleDelete() {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    setError(null)
    try {
      await remove.mutateAsync(file._id)
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete this file'))
    }
  }

  return (
    <li className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserAvatar
            name={file.uploadedBy.name}
            src={file.uploadedBy.avatarUrl}
            className="h-4 w-4"
            fallbackClassName="text-[8px] from-slate-400 to-slate-500"
          />
          {file.uploadedBy.name} · {formatBytes(file.bytes)} ·{' '}
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs">
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" />
            Open
          </a>
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive"
            disabled={remove.isPending}
            onClick={handleDelete}
          >
            {remove.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </li>
  )
}

export function ProjectFiles({
  projectId,
  isMember,
  canManage,
}: {
  projectId: string
  isMember: boolean
  canManage: boolean
}) {
  const { data: session } = useSession()
  const { data, isLoading } = useProjectFiles(projectId, isMember)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const files = data?.files ?? []

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The limit is 10 MB.`)
      return
    }

    const body = new FormData()
    body.append('file', file)

    setUploading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Upload failed')
      }
      await queryClient.invalidateQueries({ queryKey: ['project-files', projectId] })
    } catch (err) {
      setError(errorMessage(err, 'Failed to upload the file'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="font-display text-base">Files</CardTitle>
          <CardDescription>Papers, data and documents shared with the team</CardDescription>
        </div>

        <div className="flex flex-col items-end gap-1">
          <input
            ref={inputRef}
            type="file"
            onChange={handleFile}
            className="hidden"
          />
          <Button
            className="gap-2 rounded-xl"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            Upload
          </Button>
          <span className="text-xs text-muted-foreground">Up to 10 MB</span>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No files yet"
            description="Upload papers, datasets or notes so the whole team can find them in one place."
            accent="teal"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((file) => (
              <FileRow
                key={file._id}
                file={file}
                projectId={projectId}
                canDelete={canManage || file.uploadedBy._id === session?.user?.id}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
