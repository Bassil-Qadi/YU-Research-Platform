import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "page-enter mx-auto w-full max-w-7xl space-y-8 p-4 md:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
