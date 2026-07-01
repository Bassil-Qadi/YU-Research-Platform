'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Loader2, CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/layout/theme-toggle'

const registerSchema = z.object({
  name:       z.string().min(2, 'Name must be at least 2 characters'),
  email:      z.string().email('Invalid email address'),
  password:   z.string().min(8, 'Password must be at least 8 characters'),
  confirm:    z.string(),
  role:       z.enum(['Student', 'Faculty', 'Staff', 'Researcher']),
  department: z.string().min(1, 'Department is required'),
  position:   z.string().optional(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path:    ['confirm'],
})

type RegisterInput = z.infer<typeof registerSchema>

const DEPARTMENTS = [
  'School of Engineering',
  'College of Natural Sciences',
  'School of Social Sciences',
  'School of Medicine',
  'School of Business',
  'College of Arts & Humanities',
  'School of Education',
  'Other',
]

export default function RegisterPage() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })

      const body = await res.json()

      if (!res.ok) {
        const firstError = Object.values(body.error ?? {})[0]
        setServerError(
          Array.isArray(firstError) ? firstError[0] : 'Registration failed.'
        )
        return
      }

      setSubmitted(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  // Success state
  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-border/60 shadow-elevated">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <CardTitle className="font-display text-xl">
              Registration submitted!
            </CardTitle>
            <CardDescription>
              Your account is pending admin approval. You'll be able to log in
              once an administrator reviews your request. This usually takes
              1–2 business days.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full rounded-xl">
              <Link href="/login">Back to login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 animate-gradient" />
        <div className="mesh-bg-animated absolute inset-0 opacity-40" aria-hidden />

        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Research Platform</span>
        </Link>

        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Join your university research community
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-white/80">
            Create your account to discover projects, connect with researchers,
            and collaborate across departments.
          </p>
          <div className="space-y-3">
            {[
              'Discover research projects across all departments',
              'Connect with faculty, students, and researchers',
              'Collaborate in real time with your team',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-white/80">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/50">
          © Research Collaboration Platform
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <div className="mesh-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute right-4 top-4 z-10">
          <ThemeToggle />
        </div>

        <Card className="relative z-10 w-full max-w-md border-border/60 shadow-elevated backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="font-display font-semibold">Research Platform</span>
            </div>
            <CardTitle className="font-display text-2xl">Create account</CardTitle>
            <CardDescription>
              Fill in your details to request access to the platform.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4 pt-2">
              {serverError && (
                <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Dr. Jane Smith"
                  className="h-11 rounded-xl"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">University email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="you@university.edu"
                  className="h-11 rounded-xl"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Role + Department */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select onValueChange={(v) => setValue('role', v as any)}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Student', 'Faculty', 'Staff', 'Researcher'].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-xs text-destructive">{errors.role.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select onValueChange={(v) => setValue('department', v)}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select dept." />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <p className="text-xs text-destructive">{errors.department.message}</p>
                  )}
                </div>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <Label htmlFor="position">
                  Position <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="position"
                  {...register('position')}
                  placeholder="e.g. PhD Student, Assistant Professor"
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="Min. 8 characters"
                  className="h-11 rounded-xl"
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  {...register('confirm')}
                  placeholder="Repeat your password"
                  className="h-11 rounded-xl"
                />
                {errors.confirm && (
                  <p className="text-xs text-destructive">{errors.confirm.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="btn-glow h-11 w-full rounded-xl shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                ) : (
                  'Request access'
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}