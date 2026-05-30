import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ChatLayout } from "@/components/shells/chat-layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const mockConversations = [
  {
    id: "conv-1",
    name: "Dr. Sarah Chen",
    lastMessage: "How about Thursday at 2pm in the Science Building?",
    timestamp: "11:02 AM",
    unread: 2,
    initials: "SC",
    online: true,
  },
  {
    id: "conv-2",
    name: "ML Healthcare Study",
    lastMessage: "Alex: Updated the milestone timeline in the doc",
    timestamp: "Yesterday",
    initials: "ML",
    online: false,
  },
  {
    id: "conv-3",
    name: "Alex Rivera",
    lastMessage: "Thanks for sharing the genomics dataset!",
    timestamp: "Mon",
    initials: "AR",
    online: true,
  },
  {
    id: "conv-4",
    name: "Prof. James Okonkwo",
    lastMessage: "Looking forward to the policy review meeting",
    timestamp: "Last week",
    initials: "JO",
    online: false,
  },
];

export default function MessagesPage() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Messages"
        description="Real-time and async messaging between research teams."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Messages" },
        ]}
        actions={
          <Button disabled className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700">
            <Plus className="h-4 w-4" />
            New message
          </Button>
        }
      />

      <ChatLayout conversations={mockConversations} selectedId="conv-1" />
    </PageContainer>
  );
}
