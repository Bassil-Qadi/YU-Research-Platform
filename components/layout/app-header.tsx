"use client";

import { MobileNav } from "@/components/layout/app-sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationBell } from '@/components/layout/notification-bell'

export function AppHeader() {
  return (
    <header className="glass-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 px-4 md:px-6">
      <MobileNav />

      <div className="flex flex-1 items-center gap-4">
        <GlobalSearch />
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <NotificationBell />
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          <ThemeToggle />
          <UserNav />
        </div>
      </TooltipProvider>
    </header>
  );
}
