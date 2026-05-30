import Link from "next/link";

import { auth } from "@/auth";

import {

  ArrowRight,

  FolderKanban,

  MessageSquare,

  Plus,

  UserCircle,

  Users,

} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";

import { PageHeader } from "@/components/layout/page-header";

import { StatCard } from "@/components/layout/stat-card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {

  Card,

  CardContent,

  CardDescription,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

import { categoryAccents } from "@/lib/accents";

import { cn } from "@/lib/utils";



const quickActions = [

  {

    href: "/projects",

    label: "Browse projects",

    description: "Discover open research opportunities",

    icon: FolderKanban,

    accent: "projects" as const,

  },

  {

    href: "/directory",

    label: "Find researchers",

    description: "Search by department and interests",

    icon: Users,

    accent: "directory" as const,

  },

  {

    href: "/messages",

    label: "Open messages",

    description: "Check your conversations",

    icon: MessageSquare,

    accent: "messages" as const,

  },

  {

    href: "/profile/me",

    label: "Edit profile",

    description: "Update your academic information",

    icon: UserCircle,

    accent: "profile" as const,

  },

];



const recentActivity = [

  {

    action: "New message",

    detail: "Dr. Sarah Chen sent you a collaboration request",

    time: "2m ago",

    type: "message" as const,

    initials: "SC",

    gradient: "from-violet-500 to-purple-600",

  },

  {

    action: "Project update",

    detail: "ML Healthcare Study posted a new milestone",

    time: "1h ago",

    type: "project" as const,

    initials: "ML",

    gradient: "from-blue-500 to-indigo-600",

  },

  {

    action: "Profile viewed",

    detail: "Alex Rivera viewed your researcher profile",

    time: "3h ago",

    type: "directory" as const,

    initials: "AR",

    gradient: "from-teal-500 to-emerald-600",

  },

  {

    action: "Welcome to the platform",

    detail: "Explore projects and connect with researchers",

    time: "Today",

    type: "system" as const,

    initials: "RP",

    gradient: "from-sky-500 to-blue-600",

  },

];



const typeBadge = {

  message: { label: "Message", className: categoryAccents.messages.badge },

  project: { label: "Project", className: categoryAccents.projects.badge },

  directory: { label: "Directory", className: categoryAccents.directory.badge },

  system: { label: "System", className: categoryAccents.dashboard.badge },

};



export default async function DashboardPage() {

  const session = await auth();

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (

    <PageContainer>

      <PageHeader

        title={`Welcome back, ${firstName}`}

        description="Here's an overview of your research activity and quick ways to get started."

        actions={

          <Button asChild className="btn-glow gap-2 rounded-xl shadow-md">

            <Link href="/projects">

              <Plus className="h-4 w-4" />

              New project

            </Link>

          </Button>

        }

      />



      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <StatCard

          title="Your role"

          value={session?.user?.role ?? "—"}

          description="University profile"

          icon={UserCircle}

          accent="profile"

        />

        <StatCard

          title="Active projects"

          value={3}

          description="2 recruiting"

          icon={FolderKanban}

          accent="projects"

          trend={{ value: "+1 this week", direction: "up" }}

        />

        <StatCard

          title="Unread messages"

          value={2}

          description="1 requires reply"

          icon={MessageSquare}

          accent="messages"

        />

        <StatCard

          title="Connections"

          value={12}

          description="Researchers in your network"

          icon={Users}

          accent="directory"

          trend={{ value: "+3 this month", direction: "up" }}

        />

      </div>



      <div className="grid gap-6 lg:grid-cols-3">

        <Card className="card-interactive border-border/60 shadow-sm lg:col-span-2">

          <CardHeader>

            <CardTitle className="font-display text-base">

              Recent activity

            </CardTitle>

            <CardDescription>

              Your latest updates across the platform

            </CardDescription>

          </CardHeader>

          <CardContent>

            <ul className="space-y-1">

              {recentActivity.map((item) => (

                <li

                  key={item.action}

                  className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50"

                >

                  <Avatar className="h-9 w-9 shrink-0">

                    <AvatarFallback

                      className={cn(

                        "bg-gradient-to-br text-xs font-semibold text-white",

                        item.gradient

                      )}

                    >

                      {item.initials}

                    </AvatarFallback>

                  </Avatar>

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <p className="text-sm font-medium">{item.action}</p>

                      <Badge

                        variant="secondary"

                        className={cn(

                          "rounded-full border-0 text-[10px]",

                          typeBadge[item.type].className

                        )}

                      >

                        {typeBadge[item.type].label}

                      </Badge>

                    </div>

                    <p className="text-sm text-muted-foreground">

                      {item.detail}

                    </p>

                  </div>

                  <span className="shrink-0 text-xs text-muted-foreground">

                    {item.time}

                  </span>

                </li>

              ))}

            </ul>

            <p className="mt-4 text-center text-[10px] text-muted-foreground">

              Demo activity feed — live updates arrive in Phase 2

            </p>

          </CardContent>

        </Card>



        <Card className="border-border/60 shadow-sm">

          <CardHeader>

            <CardTitle className="font-display text-base">

              Quick actions

            </CardTitle>

            <CardDescription>Jump to common tasks</CardDescription>

          </CardHeader>

          <CardContent className="space-y-2">

            {quickActions.map(({ href, label, description, icon: Icon, accent }) => {

              const colors = categoryAccents[accent];

              return (

                <Link

                  key={href}

                  href={href}

                  className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-muted/40 hover:shadow-sm"

                >

                  <div

                    className={cn(

                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",

                      colors.iconBg,

                      colors.icon

                    )}

                  >

                    <Icon className="h-4 w-4" aria-hidden />

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="text-sm font-medium">{label}</p>

                    <p className="truncate text-xs text-muted-foreground">

                      {description}

                    </p>

                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />

                </Link>

              );

            })}

          </CardContent>

        </Card>

      </div>

    </PageContainer>

  );

}

