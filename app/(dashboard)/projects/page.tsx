"use client";

import { useState } from "react";
import { Grid3X3, List, Plus, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/shells/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const mockProjects = [
  {
    id: "ml-healthcare",
    title: "ML for Healthcare Diagnostics",
    description:
      "Developing machine learning models to assist clinicians with early disease detection using multimodal patient data.",
    department: "School of Engineering · Computer Science",
    status: "recruiting" as const,
    memberCount: 8,
    updatedAt: "2 days ago",
  },
  {
    id: "climate-modeling",
    title: "Regional Climate Impact Modeling",
    description:
      "Building predictive models for climate change effects on agricultural yields across the Midwest region.",
    department: "College of Natural Sciences · Environmental Science",
    status: "active" as const,
    memberCount: 12,
    updatedAt: "1 week ago",
  },
  {
    id: "policy-research",
    title: "Education Policy & Equity Study",
    description:
      "Longitudinal study examining the impact of policy interventions on educational outcomes in underserved communities.",
    department: "School of Social Sciences · Economics",
    status: "active" as const,
    memberCount: 5,
    updatedAt: "3 days ago",
  },
  {
    id: "genomics-study",
    title: "Genomics & Precision Medicine",
    description:
      "Investigating genetic markers for personalized treatment protocols in oncology patients.",
    department: "College of Natural Sciences · Biology",
    status: "recruiting" as const,
    memberCount: 6,
    updatedAt: "5 days ago",
  },
];

const filterPills = ["All", "Recruiting", "Active", "My projects"];

export default function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Discover and join research projects across the university."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects" },
        ]}
        actions={
          <Button disabled className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Create project
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {filterPills.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => setActiveFilter(pill)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
                activeFilter === pill
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                  : "border border-border/60 bg-card/80 text-muted-foreground hover:border-blue-500/30 hover:text-foreground"
              )}
            >
              {pill}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="Search projects…"
              disabled
              className="max-w-sm rounded-xl"
              aria-label="Search projects (coming soon)"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled className="gap-2 rounded-xl">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem disabled>Department</DropdownMenuItem>
                <DropdownMenuItem disabled>Status</DropdownMenuItem>
                <DropdownMenuItem disabled>Recruiting</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/50 p-1">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-lg px-2"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-lg px-2"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Sample projects below — full search and filters arrive in Phase 2.
      </p>

      <div
        className={cn(
          "stagger-children gap-4",
          view === "grid"
            ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col"
        )}
      >
        {mockProjects.map((project) => (
          <ProjectCard key={project.id} {...project} />
        ))}
      </div>
    </PageContainer>
  );
}
