"use client";

import { MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/layout/empty-state";

export interface ConversationPreview {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread?: number;
  initials: string;
  online?: boolean;
  avatarGradient?: string;
}

interface ChatLayoutProps {
  conversations?: ConversationPreview[];
  selectedId?: string;
  children?: React.ReactNode;
  className?: string;
}

const avatarGradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-teal-500 to-emerald-600",
];

const demoMessages = [
  {
    id: "1",
    sender: "them",
    text: "Hi! I saw your profile in the directory — would you be interested in collaborating on the genomics study?",
    time: "10:32 AM",
  },
  {
    id: "2",
    sender: "me",
    text: "Absolutely! I've been looking for a project in that area. When can we meet to discuss?",
    time: "10:45 AM",
  },
  {
    id: "3",
    sender: "them",
    text: "How about Thursday at 2pm in the Science Building? I'll send a calendar invite.",
    time: "11:02 AM",
  },
];

export function ChatLayout({
  conversations = [],
  selectedId,
  children,
  className,
}: ChatLayoutProps) {
  const activeId = selectedId ?? conversations[0]?.id;
  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div
      className={cn(
        "flex h-[calc(100vh-8rem)] min-h-[480px] overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-elevated backdrop-blur-sm",
        className
      )}
    >
      {/* Conversation list */}
      <aside className="flex w-full flex-col border-r border-border/60 md:w-80 lg:w-96">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3.5">
          <h2 className="font-display text-sm font-semibold">Conversations</h2>
          <p className="text-xs text-muted-foreground">
            {conversations.length} thread
            {conversations.length !== 1 ? "s" : ""}
            {conversations.length > 0 && " · Demo preview"}
          </p>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-4">
              <p className="text-center text-sm text-muted-foreground">
                No conversations yet
              </p>
            </div>
          ) : (
            <ul role="list">
              {conversations.map((conv, i) => {
                const gradient =
                  conv.avatarGradient ??
                  avatarGradients[i % avatarGradients.length];
                const isActive = activeId === conv.id;

                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-all duration-200 hover:bg-violet-500/5",
                        isActive &&
                          "border-l-2 border-l-violet-500 bg-violet-500/10"
                      )}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback
                            className={cn(
                              "bg-gradient-to-br text-xs font-semibold text-white",
                              gradient
                            )}
                          >
                            {conv.initials}
                          </AvatarFallback>
                        </Avatar>
                        {conv.online && (
                          <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
                            aria-label="Online"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {conv.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {conv.timestamp}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {conv.lastMessage}
                        </p>
                      </div>
                      {conv.unread && conv.unread > 0 && (
                        <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-violet-600 px-1.5 text-[10px]">
                          {conv.unread}
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Main chat pane */}
      <div className="hidden flex-1 flex-col md:flex">
        {children ??
          (activeConv ? (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 bg-muted/20 px-5 py-3.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">
                    {activeConv.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{activeConv.name}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {activeConv.online ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-4">
                  {demoMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.sender === "me" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                          msg.sender === "me"
                            ? "rounded-br-md bg-gradient-to-br from-violet-600 to-purple-700 text-white"
                            : "rounded-bl-md border border-border/60 bg-muted/50"
                        )}
                      >
                        <p>{msg.text}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            msg.sender === "me"
                              ? "text-white/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                  <p className="text-center text-[10px] text-muted-foreground">
                    Demo messages — real-time chat arrives in Phase 2
                  </p>
                </div>
              </ScrollArea>
              <div className="border-t border-border/60 p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message…"
                    disabled
                    className="rounded-xl"
                    aria-label="Message input (coming soon)"
                  />
                  <Button
                    size="icon"
                    disabled
                    className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700"
                    aria-label="Send message (coming soon)"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose a thread from the sidebar to view messages, or start a new conversation from a project or profile."
              accent="violet"
              className="m-4 h-full border-none bg-transparent"
            />
          ))}
      </div>
    </div>
  );
}
