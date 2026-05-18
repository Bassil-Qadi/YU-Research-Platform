import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <PagePlaceholder
      title={`Project ${params.id}`}
      description="Project details, team members, and documents will appear here."
    />
  );
}
