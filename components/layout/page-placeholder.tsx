import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PagePlaceholderProps {
  title: string;
  description: string;
  phase?: string;
}

export function PagePlaceholder({
  title,
  description,
  phase = "Phase 2",
}: PagePlaceholderProps) {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This section will be implemented in {phase}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
