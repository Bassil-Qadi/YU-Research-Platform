import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="mesh-bg relative flex-1 overflow-auto bg-muted/30">
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
