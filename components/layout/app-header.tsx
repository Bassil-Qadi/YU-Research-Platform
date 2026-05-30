"use client";

import { Bell, Search } from "lucide-react";
import { MobileNav } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppHeader() {
  return (
    <header className="glass-header sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 px-4 md:px-6">
      <MobileNav />

      <div className="flex flex-1 items-center gap-4">
        <div className="search-glow relative hidden max-w-md flex-1 rounded-xl transition-shadow duration-300 md:block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search projects, people, messages…"
            disabled
            aria-label="Search (coming soon)"
            className="h-10 w-full rounded-xl border border-input/80 bg-muted/40 pl-10 pr-4 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-xl transition-transform hover:scale-105 active:scale-95"
                disabled
                aria-label="Notifications (coming soon)"
              >
                <Bell className="h-4 w-4" />
                <span
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500 animate-pulse-dot"
                  aria-hidden
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications — Phase 2</TooltipContent>
          </Tooltip>

          <ThemeToggle />
          <UserNav />
        </div>
      </TooltipProvider>
    </header>
  );
}
