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
  status?: "active" | "recruiting" | "completed" | "paused" | "draft";
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
    className: "bg-green-600/15 text-green-800 dark:text-green-300 border-green-600/20",
  },
  recruiting: {
    label: "Recruiting",
    className: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
};

// Cover art, picked deterministically per project. All four stay inside
// Yarmouk's green so a wall of cards reads as one palette.
const defaultGradients = [
  "from-green-600 via-emerald-600 to-teal-700",
  "from-emerald-500 via-teal-600 to-green-800",
  "from-teal-600 via-emerald-600 to-lime-700",
  "from-lime-600 via-green-600 to-emerald-800",
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
          "card-interactive h-full overflow-hidden border-border/60 shadow-sm hover:border-green-600/30 hover:shadow-glow-sm",
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
          <CardTitle className="line-clamp-1 text-base transition-colors group-hover:text-green-700 dark:group-hover:text-green-400">
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
