import Link from "next/link";
import {
  BarChart3,
  Flag,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { categoryAccents } from "@/lib/accents";
import { cn } from "@/lib/utils";

const adminSections = [
  {
    icon: Users,
    title: "User Management",
    description: "Manage accounts, roles, and university affiliations",
    badge: "Phase 3",
    accent: "directory" as const,
  },
  {
    icon: BarChart3,
    title: "Platform Analytics",
    description: "Usage metrics, engagement, and growth trends",
    badge: "Phase 3",
    accent: "dashboard" as const,
  },
  {
    icon: Flag,
    title: "Moderation",
    description: "Review reported content and enforce community guidelines",
    badge: "Phase 3",
    accent: "messages" as const,
  },
  {
    icon: Settings,
    title: "System Settings",
    description: "Configure platform defaults and integrations",
    badge: "Phase 3",
    accent: "admin" as const,
  },
];

export default function AdminPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Administration"
        description="Platform analytics, user management, and moderation tools."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin" },
        ]}
      />

      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total users"
          value="2,412"
          description="Registered accounts"
          icon={Users}
          accent="directory"
          trend={{ value: "+48 this month", direction: "up" }}
        />
        <StatCard
          title="Active projects"
          value="186"
          description="Published this semester"
          icon={Shield}
          accent="projects"
          trend={{ value: "+12%", direction: "up" }}
        />
        <StatCard
          title="Messages sent"
          value="14.2k"
          description="Last 30 days"
          icon={BarChart3}
          accent="messages"
          trend={{ value: "+8%", direction: "up" }}
        />
        <StatCard
          title="Pending reports"
          value={3}
          description="Requires review"
          icon={Flag}
          accent="admin"
        />
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
          Admin sections
        </h2>
        <div className="stagger-children grid gap-4 sm:grid-cols-2">
          {adminSections.map(
            ({ icon: Icon, title, description, badge, accent }) => {
              const colors = categoryAccents[accent];
              return (
                <Card
                  key={title}
                  className="card-interactive group border-border/60 shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                          colors.iconBg,
                          colors.icon
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("rounded-full text-[10px]", colors.badge)}
                      >
                        {badge}
                      </Badge>
                    </div>
                    <CardTitle className="font-display text-base">
                      {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Available in a future release.{" "}
                      <Link
                        href="/dashboard"
                        className="text-primary hover:underline"
                      >
                        Return to dashboard
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      </div>

      <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="font-display text-base">
              Admin access
            </CardTitle>
          </div>
          <CardDescription>
            You have administrator privileges. Full admin tooling will be
            implemented in Phase 3.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageContainer>
  );
}
