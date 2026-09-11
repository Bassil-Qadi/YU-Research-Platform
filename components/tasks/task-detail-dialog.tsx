'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { Calendar, Loader2, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react'
import { errorMessage } from '@/lib/api'
import { COLUMNS, type ITask } from '@/hooks/useProjectTasks'
import {
  useTaskComments, useTaskCommentActions, type TaskCommentItem,
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
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
            {comment.content}
          </p>
        )}

        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </li>
  )
}

export function TaskDetailDialog({
  task, projectId, open, onOpenChange,
}: {
  task:         ITask | null
  projectId:    string
  open:         boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = useSession()
  const { data, isLoading } = useTaskComments(projectId, open && task ? task._id : null)
  const { add } = useTaskCommentActions(projectId, task?._id ?? '')

  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const comments = data?.comments ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [comments.length])

  // A fresh task gets a fresh composer.
  useEffect(() => {
    setDraft('')
    setError(null)
  }, [task?._id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return

    setError(null)
    setDraft('')
    try {
      await add.mutateAsync(text)
    } catch (err) {
      setDraft(text) // keep what they wrote rather than losing it
      setError(errorMessage(err, 'Could not post your comment'))
    }
  }

  if (!task) return null
  const column = COLUMNS.find((c) => c.id === task.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="space-y-3 border-b border-border/60 p-6 pb-4">
          <DialogTitle className="pr-6 font-display text-lg leading-snug">{task.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 text-xs">
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
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border/60 p-4">
          {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
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
              placeholder="Add a comment… (Enter to post, Shift+Enter for a new line)"
              rows={2}
              maxLength={MAX_LENGTH}
              className="min-h-0 resize-none rounded-xl text-sm"
              aria-label="Add a comment"
            />
            <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={add.isPending || !draft.trim()} aria-label="Post comment">
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
