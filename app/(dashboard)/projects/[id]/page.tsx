import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Settings,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const teamPlaceholders = [
  {
    name: "Dr. Sarah Chen",
    role: "Principal Investigator",
    initials: "SC",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    name: "Alex Rivera",
    role: "Research Assistant",
    initials: "AR",
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    name: "You",
    role: "Collaborator",
    initials: "YO",
    gradient: "from-blue-500 to-indigo-600",
  },
];

const milestones = [
  {
    title: "Literature review complete",
    date: "Jan 2026",
    status: "completed" as const,
  },
  {
    title: "Data collection phase",
    date: "Mar 2026",
    status: "completed" as const,
  },
  {
    title: "Model development & training",
    date: "May 2026",
    status: "current" as const,
  },
  {
    title: "Peer review & publication",
    date: "Aug 2026",
    status: "upcoming" as const,
  },
];

const projectTitles: Record<string, string> = {
  "ml-healthcare": "ML for Healthcare Diagnostics",
  "climate-modeling": "Regional Climate Impact Modeling",
  "policy-research": "Education Policy & Equity Study",
  "genomics-study": "Genomics & Precision Medicine",
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const title = projectTitles[params.id] ?? `Project ${params.id}`;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={title}
        description="Project workspace for team collaboration, documents, and discussion."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: params.id },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled className="gap-2 rounded-xl">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button disabled className="rounded-xl bg-blue-600 hover:bg-blue-700">
              Join project
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
          Active
        </Badge>
        <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Recruiting
        </Badge>
        <span className="text-sm text-muted-foreground">
          School of Engineering · Demo data
        </span>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-border/60 lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Project overview
                </CardTitle>
                <CardDescription>
                  Summary, objectives, and timeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This is a demo project workspace. Full project details will
                  load from the API in Phase 2. Explore tabs for team
                  management, document sharing, and project discussion.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { value: "8", label: "Team members" },
                    { value: "12", label: "Documents" },
                    { value: "47", label: "Messages" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-500/5 to-violet-500/5 p-4"
                    >
                      <p className="font-display text-2xl font-bold tabular-nums">
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Milestones
                </CardTitle>
                <CardDescription>Project timeline</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-0">
                  {milestones.map((milestone, i) => (
                    <li key={milestone.title} className="relative flex gap-3 pb-6 last:pb-0">
                      {i < milestones.length - 1 && (
                        <span
                          className={cn(
                            "absolute left-[11px] top-6 h-full w-0.5",
                            milestone.status === "completed"
                              ? "bg-blue-500"
                              : "bg-border"
                          )}
                          aria-hidden
                        />
                      )}
                      <div className="relative z-10 shrink-0">
                        {milestone.status === "completed" ? (
                          <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        ) : milestone.status === "current" ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-500/20">
                            <Circle className="h-2 w-2 fill-white text-white" />
                          </div>
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            milestone.status === "upcoming" &&
                              "text-muted-foreground"
                          )}
                        >
                          {milestone.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {milestone.date}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="font-display text-base">
                Team members
              </CardTitle>
              <CardDescription>
                Researchers collaborating on this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60">
                {teamPlaceholders.map((member) => (
                  <li
                    key={member.name}
                    className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={cn(
                          "bg-gradient-to-br text-xs font-semibold text-white",
                          member.gradient
                        )}
                      >
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Shared files and research documents will appear here once file storage is connected."
            accent="blue"
            className="border-solid bg-card"
          />
        </TabsContent>

        <TabsContent value="discussion">
          <EmptyState
            icon={MessageSquare}
            title="No discussion threads"
            description="Project-specific messaging and announcements will be available in Phase 2."
            accent="violet"
            action={
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/messages">Go to messages</Link>
              </Button>
            }
            className="border-solid bg-card"
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
