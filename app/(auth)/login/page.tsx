"use client";

import { Suspense, useState } from "react";

import { signIn } from "next-auth/react";

import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import { BookOpen, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ThemeToggle } from "@/components/layout/theme-toggle";

function LoginForm() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Pre-check account status before attempting sign in
    try {
      const check = await fetch("/api/auth/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { status } = await check.json();

      if (status === "pending") {
        setError(
          "Your account is pending admin approval. You will be notified once approved.",
        );
        setLoading(false);
        return;
      }
      if (status === "rejected") {
        setError(
          "Your registration was not approved. Please contact the university admin.",
        );
        setLoading(false);
        return;
      }
    } catch {}

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4 pt-2">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in"
          >
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">University email</Label>

          <Input
            id="email"
            type="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-11 rounded-xl transition-shadow focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-violet-500/20"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            <span className="text-xs text-muted-foreground">
              Forgot password?
            </span>
          </div>

          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 rounded-xl transition-shadow focus-visible:shadow-[0_0_0_3px] focus-visible:shadow-violet-500/20"
          />
        </div>

        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          Development login: demo@university.edu / demo123456 (see .env.example)
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button
          type="submit"
          className="btn-glow h-11 w-full rounded-xl shadow-md"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <Link
          href="/"
          className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to home
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Request access
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop only */}

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 animate-gradient" />

        <div
          className="mesh-bg-animated absolute inset-0 opacity-40"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-blue-400/30 blur-3xl animate-float-slow"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute -right-10 bottom-1/4 h-64 w-64 rounded-full bg-violet-400/25 blur-3xl animate-float"
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>

          <span className="font-display text-lg font-bold">
            Research Platform
          </span>
        </Link>

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Trusted by 2,400+ researchers
          </div>

          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Your university research workspace
          </h2>

          <p className="max-w-md text-lg leading-relaxed text-white/80">
            Sign in to discover projects, connect with researchers, and
            collaborate across departments — all in one secure platform.
          </p>
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

        <Card className="relative z-10 w-full max-w-md animate-fade-up border-border/60 shadow-elevated backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
                <BookOpen className="h-4 w-4" aria-hidden />
              </div>

              <span className="font-display font-semibold">
                Research Platform
              </span>
            </div>

            <CardTitle className="font-display text-2xl">
              Welcome back
            </CardTitle>

            <CardDescription>
              Sign in with your university credentials to access your research
              workspace.
            </CardDescription>
          </CardHeader>

          <Suspense
            fallback={
              <CardContent className="space-y-4">
                <Skeleton className="h-11 w-full" />

                <Skeleton className="h-11 w-full" />

                <Skeleton className="h-11 w-full" />
              </CardContent>
            }
          >
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
