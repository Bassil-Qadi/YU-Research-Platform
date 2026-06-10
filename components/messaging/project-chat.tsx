'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send, Loader2 } from 'lucide-react'
import { useProjectMessages } from '@/hooks/useProjectMessages'
import { getSocket } from '@/lib/socket-client'
import { apiFetch } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function ProjectChat({ projectId }: { projectId: string }) {
  const { data: session }   = useSession()
  const { data, isLoading } = useProjectMessages(projectId)
  const queryClient         = useQueryClient()
  const [content, setContent]       = useState('')
  const [sending, setSending]       = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()

  const messages = data?.messages ?? []

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Typing indicator listeners
  useEffect(() => {
    const socket = getSocket()
    socket.on('user-typing', ({ userName }: { userName: string }) => {
      setTypingUser(userName)
    })
    socket.on('user-stop-typing', () => setTypingUser(null))
    return () => {
      socket.off('user-typing')
      socket.off('user-stop-typing')
    }
  }, [])

  function handleTyping() {
    const socket = getSocket()
    socket.emit('typing', {
      projectId,
      userName: session?.user?.name ?? 'Someone',
    })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('stop-typing', { projectId })
    }, 1500)
  }

  async function handleSend() {
    if (!content.trim() || sending) return
    setSending(true)
    try {
      await apiFetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        body:   JSON.stringify({ content: content.trim() }),
      })
      setContent('')
      // Socket.io will update the cache via 'new-message' event
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-border/60 bg-card shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
        <span className="text-sm font-medium">Project discussion</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-64 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start the conversation with your team
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId._id === session?.user?.id
            const initials = msg.senderId.name
              .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div
                key={msg._id}
                className={cn('flex items-start gap-3', isMe && 'flex-row-reverse')}
              >
                {!isMe && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-semibold text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn('max-w-[70%] space-y-1', isMe && 'items-end flex flex-col')}>
                  {!isMe && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {msg.senderId.name}
                    </p>
                  )}
                  <div className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    isMe
                      ? 'rounded-tr-sm bg-blue-600 text-white'
                      : 'rounded-tl-sm bg-muted/70'
                  )}>
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
            {typingUser} is typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/60 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); handleTyping() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm outline-none transition-shadow focus:shadow-[0_0_0_2px] focus:shadow-ring/30 focus:border-ring"
            style={{ maxHeight: '120px' }}
          />
          <Button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}