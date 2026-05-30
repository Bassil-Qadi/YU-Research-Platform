import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ResearcherCard } from "@/components/shells/researcher-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal } from "lucide-react";

const placeholderResearchers = [
  {
    id: "demo-faculty",
    name: "Dr. Sarah Chen",
    title: "Associate Professor, Computer Science",
    department: "School of Engineering",
    interests: ["Machine Learning", "Healthcare AI", "Data Ethics"],
  },
  {
    id: "demo-student",
    name: "Alex Rivera",
    title: "PhD Candidate, Biology",
    department: "College of Natural Sciences",
    interests: ["Genomics", "Bioinformatics", "CRISPR"],
  },
  {
    id: "demo-staff",
    name: "Prof. James Okonkwo",
    title: "Professor, Economics",
    department: "School of Social Sciences",
    interests: ["Development Economics", "Policy Research"],
  },
  {
    id: "demo-researcher-4",
    name: "Dr. Emily Nakamura",
    title: "Assistant Professor, Environmental Science",
    department: "College of Natural Sciences",
    interests: ["Climate Modeling", "Sustainability", "Remote Sensing"],
  },
  {
    id: "demo-researcher-5",
    name: "Marcus Williams",
    title: "Graduate Researcher, Physics",
    department: "School of Engineering",
    interests: ["Quantum Computing", "Materials Science"],
  },
  {
    id: "demo-researcher-6",
    name: "Dr. Priya Sharma",
    title: "Research Fellow, Public Health",
    department: "School of Medicine",
    interests: ["Epidemiology", "Health Policy", "Biostatistics"],
  },
];

export default function DirectoryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Researcher Directory"
        description="Search faculty, students, and staff by department and research interests."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Directory" },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name, department, or interest…"
          disabled
          className="max-w-lg rounded-xl"
          aria-label="Search researchers (coming soon)"
        />
        <Button variant="outline" disabled className="gap-2 rounded-xl sm:w-auto">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Sample profiles below — full search and filters arrive in Phase 2.
      </p>

      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderResearchers.map((researcher) => (
          <ResearcherCard key={researcher.id} {...researcher} />
        ))}
      </div>
    </PageContainer>
  );
}
