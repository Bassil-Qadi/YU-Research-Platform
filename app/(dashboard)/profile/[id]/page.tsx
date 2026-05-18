import { auth } from "@/auth";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const isMe = params.id === "me";
  const title = isMe
    ? session?.user?.name ?? "Your profile"
    : `Profile ${params.id}`;

  return (
    <PagePlaceholder
      title={title}
      description="Academic profile, publications, and project history."
    />
  );
}
