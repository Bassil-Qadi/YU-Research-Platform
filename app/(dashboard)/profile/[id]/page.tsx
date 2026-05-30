import { auth } from "@/auth";
import Link from "next/link";
import {
  Building2,
  BookOpen,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  Pencil,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const isMe = params.id === "me";
  const name = isMe
    ? session?.user?.name ?? "Your Profile"
    : `Researcher ${params.id}`;
  const email = isMe ? session?.user?.email : undefined;
  const role = isMe ? session?.user?.role : "Researcher";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <PageContainer className="space-y-6">
      {/* Profile header */}
      <div className="animate-fade-up overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="relative h-28 bg-gradient-to-r from-rose-500 via-violet-600 to-blue-600 md:h-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="mesh-bg absolute inset-0 opacity-30" aria-hidden />
        </div>
        <div className="relative px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Avatar className="-mt-12 h-24 w-24 border-4 border-card shadow-lg md:-mt-14 md:h-28 md:w-28">
                <AvatarFallback className="bg-gradient-to-br from-rose-500 to-violet-600 text-2xl font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                    {name}
                  </h1>
                  {role && (
                    <Badge className="rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
                      {role}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {isMe
                    ? "Your academic profile on the research platform"
                    : "Faculty member — sample profile"}
                </p>
              </div>
            </div>
            {isMe && (
              <Button variant="outline" disabled className="gap-2 rounded-xl">
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" aria-hidden />
                {email}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4" aria-hidden />
              Department — Phase 2
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden />
              Campus location
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-4 w-4" aria-hidden />
              Personal website
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="about" className="space-y-6">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="publications">Publications</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="about">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="font-display text-base">About</CardTitle>
              <CardDescription>
                Biography, research interests, and academic background
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isMe
                  ? "Complete your profile to help collaborators discover your expertise. Add a bio, research interests, and links to your academic work."
                  : "Profile details will be loaded from the researcher directory in Phase 2."}
              </p>
              <div className="flex flex-wrap gap-2">
                {["Research Methods", "Collaboration", "Open Science"].map(
                  (tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    >
                      {tag}
                    </Badge>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publications">
          <EmptyState
            icon={BookOpen}
            title="No publications listed"
            description="Publications and academic outputs will be displayed here once profile data is connected."
            accent="rose"
            className="border-solid bg-card"
          />
        </TabsContent>

        <TabsContent value="projects">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects this researcher is involved in will appear here."
            accent="blue"
            action={
              isMe ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/projects">Browse projects</Link>
                </Button>
              ) : undefined
            }
            className="border-solid bg-card"
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
