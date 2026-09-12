'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const MIN_LENGTH = 8

function ResetPasswordForm() {
  const router = useRouter()
  const token  = useSearchParams().get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Caught here so nobody fills in a whole form before finding out.
  if (!token) {
    return (
      <CardContent className="space-y-4">
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This link is missing its token. Open the link from your email, or ask
          for a new one.
        </p>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </CardContent>
    )
  }

  if (done) {
    return (
      <>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Your password has been changed. Anyone signed in with the old one
              has been signed out.
            </p>
          </div>
          <Button className="w-full rounded-xl" onClick={() => router.push('/login')}>
            Sign in
          </Button>
        </CardContent>
      </>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`)
      return
    }
    if (password !== confirm) {
      setError('Those two passwords do not match')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        const message = typeof payload.error === 'string'
          ? payload.error
          : payload.error?.fieldErrors?.password?.[0] ?? 'Something went wrong'
        throw new Error(message)
      }

      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null) }}
            className="rounded-xl"
            autoComplete="new-password"
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            At least {MIN_LENGTH} characters.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null) }}
            className="rounded-xl"
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" className="w-full rounded-xl" disabled={saving || !password || !confirm}>
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            : 'Change password'}
        </Button>
      </CardContent>

      <CardFooter>
        <Link
          href="/login"
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to sign in
        </Link>
      </CardFooter>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you have not used here before."
      heroHeading="Almost there"
      heroBody="Once you set a new password, every session that used the old one is signed out."
    >
      {/* useSearchParams needs a boundary, the same as the login form. */}
      <Suspense
        fallback={
          <CardContent className="space-y-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
