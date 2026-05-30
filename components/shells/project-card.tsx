"use client";

import Link from "next/link";
import { Calendar, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  description: string;
  department?: string;
  status?: "active" | "recruiting" | "completed" | "draft";
  memberCount?: number;
  updatedAt?: string;
  thumbnailGradient?: string;
  className?: string;
}

const statusStyles: Record<
  NonNullable<ProjectCardProps["status"]>,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  recruiting: {
    label: "Recruiting",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
  draft: {
    label: "Draft",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
};

const defaultGradients = [
  "from-blue-600 via-indigo-600 to-violet-700",
  "from-teal-600 via-cyan-600 to-blue-700",
  "from-violet-600 via-purple-600 to-fuchsia-700",
  "from-amber-500 via-orange-500 to-rose-600",
];

export function ProjectCard({
  id,
  title,
  description,
  department,
  status = "active",
  memberCount = 0,
  updatedAt,
  thumbnailGradient,
  className,
}: ProjectCardProps) {
  const statusConfig = statusStyles[status];
  const gradient =
    thumbnailGradient ??
    defaultGradients[
      title.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
        defaultGradients.length
    ];

  return (
    <Link href={`/projects/${id}`} className="group block">
      <Card
        className={cn(
          "card-interactive h-full overflow-hidden border-border/60 shadow-sm hover:border-blue-500/30 hover:shadow-glow-sm",
          className
        )}
      >
        <div
          className={cn(
            "relative h-28 bg-gradient-to-br transition-transform duration-500 group-hover:scale-[1.02]",
            gradient
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="absolute bottom-3 left-4">
            <Badge
              variant="outline"
              className={cn("border backdrop-blur-sm", statusConfig.className)}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="line-clamp-1 text-base transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {title}
          </CardTitle>
          {department && (
            <CardDescription className="text-xs">{department}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {memberCount} members
            </span>
            {updatedAt && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                {updatedAt}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
