'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, MessageSquare } from 'lucide-react'
import { errorMessage } from '@/lib/api'
import { useStartConversation } from '@/hooks/useDirectMessages'
import { Button } from '@/components/ui/button'

/**
 * Opens the thread with someone and navigates to it. The conversation is
 * created on demand, so there is nothing to set up beforehand.
 */
export function MessageUserButton({
  userId,
  className,
}: {
  userId: string
  className?: string
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const start = useStartConversation()
  const [error, setError] = useState<string | null>(null)

  // Nothing to do on your own profile.
  if (!session?.user?.id || session.user.id === userId) return null

  async function handleClick() {
    setError(null)
    try {
      const { id } = await start.mutateAsync(userId)
      router.push(`/messages?conversation=${id}`)
    } catch (err) {
      setError(errorMessage(err, 'Could not open the conversation'))
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        className={className ?? 'gap-2 rounded-xl'}
        disabled={start.isPending}
        onClick={handleClick}
      >
        {start.isPending
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <MessageSquare className="h-4 w-4" />}
        Message
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
