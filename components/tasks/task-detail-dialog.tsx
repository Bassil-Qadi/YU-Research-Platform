'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import {
  Calendar, FileText, ImageIcon, Loader2, MessageSquare, Paperclip,
  Pencil, Send, Trash2, X,
} from 'lucide-react'
import { TaskEditForm } from '@/components/tasks/task-edit-form'
import { errorMessage } from '@/lib/api'
import { MAX_UPLOAD_BYTES, formatBytes } from '@/lib/utils'
import { COLUMNS, type ITask } from '@/hooks/useProjectTasks'
import {
  useTaskComments, useTaskCommentActions,
  type TaskCommentAttachment, type TaskCommentItem,
} from '@/hooks/useTaskComments'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const MAX_LENGTH = 2000

function Attachment({ attachment }: { attachment: TaskCommentAttachment }) {
  const isImage = attachment.resourceType === 'image'

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block w-fit overflow-hidden rounded-xl border border-border/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-56 w-auto max-w-full object-contain"
        />
      </a>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-muted"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatBytes(attachment.bytes)}
      </span>
    </a>
  )
}

function Comment({
  comment, projectId, taskId, mine, canModerate,
}: {
  comment:     TaskCommentItem
  projectId:   string
  taskId:      string
  mine:        boolean
  canModerate: boolean
}) {
  const { edit, remove } = useTaskCommentActions(projectId, taskId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(comment.content)
  const [error, setError]     = useState<string | null>(null)

  async function save() {
    const text = draft.trim()
    if (!text) return
    setError(null)
    try {
      await edit.mutateAsync({ commentId: comment._id, content: text })
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the edit'))
    }
  }

  async function handleDelete() {
    if (!confirm(mine ? 'Delete your comment?' : `Delete ${comment.authorId.name}'s comment?`)) return
    setError(null)
    try {
      await remove.mutateAsync(comment._id)
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the comment'))
    }
  }

  return (
    <li className="group flex gap-3">
      <UserAvatar name={comment.authorId.name} src={comment.authorId.avatarUrl} className="h-8 w-8 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{comment.authorId.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            {comment.editedAt && ' · edited'}
          </span>

          {!editing && (mine || canModerate) && (
            <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {/* Only the author edits: moderating is removing, not rewording. */}
              {mine && (
                <button
                  type="button"
                  onClick={() => { setDraft(comment.content); setEditing(true) }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Edit comment"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={remove.isPending}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={MAX_LENGTH}
              className="resize-none rounded-xl text-sm"
              autoFocus
              aria-label="Edit comment"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 rounded-lg text-xs" disabled={edit.isPending || !draft.trim()} onClick={save}>
                {edit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {comment.content && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
                {comment.content}
              </p>
            )}
            {comment.attachment && <Attachment attachment={comment.attachment} />}
          </>
        )}

        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </li>
  )
}

export function TaskDetailDialog({
  task, projectId, members, open, onOpenChange,
}: {
  task:         ITask | null
  projectId:    string
  members:      { _id: string; name: string }[]
  open:         boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = useSession()
  const { data, isLoading } = useTaskComments(projectId, open && task ? task._id : null)
  const { add } = useTaskCommentActions(projectId, task?._id ?? '')

  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const endRef   = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const comments = data?.comments ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [comments.length])

  // A fresh task gets a fresh composer, and never inherits an open editor.
  useEffect(() => {
    setDraft('')
    setError(null)
    setEditing(false)
    clearFile()
  }, [task?._id])

  function clearFile() {
    setFile(null)
    // Let the same file be picked again after removing it.
    if (fileRef.current) fileRef.current.value = ''
  }

  function pickFile(chosen: File | null) {
    if (!chosen) return
    if (chosen.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${formatBytes(chosen.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`)
      clearFile()
      return
    }
    setError(null)
    setFile(chosen)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    // A file on its own is a comment; so is text on its own.
    if (!text && !file) return

    const sent = file
    setError(null)
    setDraft('')
    clearFile()
    try {
      await add.mutateAsync({ content: text, file: sent })
    } catch (err) {
      setDraft(text) // keep what they wrote rather than losing it
      setFile(sent)  // and what they picked
      setError(errorMessage(err, 'Could not post your comment'))
    }
  }

  if (!task) return null
  const column = COLUMNS.find((c) => c.id === task.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="space-y-3 border-b border-border/60 p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="font-display text-lg leading-snug">{task.title}</DialogTitle>
            {!editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mr-6 h-8 shrink-0 gap-1.5 rounded-lg text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
          <DialogDescription asChild>
            <div className={editing ? 'hidden' : 'flex flex-wrap items-center gap-2 text-xs'}>
              {column && (
                <Badge variant="secondary" className="gap-1.5 rounded-full">
                  <span className={`h-1.5 w-1.5 rounded-full ${column.color}`} />
                  {column.label}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full capitalize">{task.priority} priority</Badge>
              {task.dueDate && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {task.assigneeId ? (
                  <>
                    <UserAvatar name={task.assigneeId.name} src={task.assigneeId.avatarUrl} className="h-4 w-4" fallbackClassName="text-[7px]" />
                    {task.assigneeId.name}
                  </>
                ) : 'Unassigned'}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {editing ? (
            <TaskEditForm
              task={task}
              projectId={projectId}
              members={members}
              onDone={() => setEditing(false)}
            />
          ) : (
          <>
          {task.description ? (
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{task.description}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground/70">No description.</p>
          )}

          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Comments
              {comments.length > 0 && <span className="font-normal text-muted-foreground">({comments.length})</span>}
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet. Start the discussion below.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <Comment
                    key={comment._id}
                    comment={comment}
                    projectId={projectId}
                    taskId={task._id}
                    mine={comment.authorId._id === session?.user?.id}
                    canModerate={data?.canModerate ?? false}
                  />
                ))}
              </ul>
            )}
            <div ref={endRef} />
          </div>
          </>
          )}
        </div>

        <form onSubmit={handleSubmit} className={editing ? 'hidden' : 'border-t border-border/60 p-4'}>
          {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}

          {file && (
            <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1.5">
              {file.type.startsWith('image/')
                ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                : <FileText  className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={clearFile}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0 rounded-xl"
              onClick={() => fileRef.current?.click()}
              disabled={add.isPending}
              aria-label="Attach a file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter posts, Shift+Enter breaks the line — like the chats.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Add a comment or attach a file… (Enter to post, Shift+Enter for a new line)"
              rows={2}
              maxLength={MAX_LENGTH}
              className="min-h-0 resize-none rounded-xl text-sm"
              aria-label="Add a comment"
            />
            <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={add.isPending || (!draft.trim() && !file)} aria-label="Post comment">
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
