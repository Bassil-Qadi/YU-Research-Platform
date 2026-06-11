'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare } from 'lucide-react'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectChat } from '@/components/messaging/project-chat'
import { EmptyState } from '@/components/layout/empty-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversations } from '@/hooks/useConversations'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7)  return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function MessagesPage() {
  const { data: session }             = useSession()
  const { data, isLoading }           = useConversations()
  const [selectedId, setSelectedId]   = useState<string | null>(null)

  const conversations  = data?.conversations ?? []
  const activeConv     = conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null
  const activeId       = activeConv?.id ?? null

  return (
    <PageContainer className="!p-0 overflow-hidden">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-elevated backdrop-blur-sm">

        {/* ── Sidebar ── */}
        <aside className="flex w-full flex-col border-r border-border/60 md:w-80 lg:w-96">
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3.5">
            <h2 className="font-display text-sm font-semibold">Project conversations</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? '…' : `${conversations.length} project${conversations.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Join a project to start messaging
                </p>
                <Link
                  href="/projects"
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Browse projects →
                </Link>
              </div>
            ) : (
              <ul role="list">
                {conversations.map((conv, i) => {
                  const isActive  = activeId === conv.id
                  const gradient  = GRADIENTS[i % GRADIENTS.length]
                  const initials  = conv.title.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                  const lastMsg   = conv.lastMessage
                    ? `${conv.lastMessage.senderName === session?.user?.name ? 'You' : conv.lastMessage.senderName}: ${conv.lastMessage.content}`
                    : 'No messages yet'

                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(conv.id)}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-all duration-200 hover:bg-violet-500/5',
                          isActive && 'border-l-2 border-l-violet-500 bg-violet-500/10'
                        )}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className={cn('bg-gradient-to-br text-xs font-semibold text-white', gradient)}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{conv.title}</span>
                            {conv.lastMessage && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatTime(conv.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {lastMsg}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-violet-600 px-1.5 text-[10px]">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        {/* ── Chat pane ── */}
        <div className="hidden flex-1 flex-col md:flex">
          {!activeConv ? (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose a project from the sidebar to view messages."
              accent="violet"
              className="m-4 h-full border-none bg-transparent"
            />
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={cn(
                      'bg-gradient-to-br text-xs font-semibold text-white',
                      GRADIENTS[conversations.indexOf(activeConv) % GRADIENTS.length]
                    )}>
                      {activeConv.title.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{activeConv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeConv.department} · {activeConv.members.length} member{activeConv.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/projects/${activeConv.id}`}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  View project →
                </Link>
              </div>

              {/* Reuse the ProjectChat component we already built */}
              <div className="flex flex-1 flex-col overflow-hidden [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                <ProjectChat projectId={activeConv.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}