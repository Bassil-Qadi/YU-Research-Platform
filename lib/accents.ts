/**
 * Category accent colors used consistently across nav, stat cards, and badges.
 *
 * Yarmouk's green leads, and the rest of the scale walks away from it far
 * enough to stay tellable apart — the point of these is that a section is
 * recognisable at a glance, so they are a code first and decoration second.
 */
export const categoryAccents = {
  dashboard: {
    label: "Dashboard",
    icon: "text-green-700 dark:text-green-400",
    iconBg: "bg-green-600/15",
    border: "border-green-600/30",
    glow: "shadow-green-600/20",
    gradient: "from-green-600 to-green-700",
    badge: "bg-green-600/15 text-green-800 dark:text-green-300",
  },
  projects: {
    label: "Projects",
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/20",
    gradient: "from-emerald-500 to-green-700",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  messages: {
    label: "Messages",
    icon: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-500/15",
    border: "border-teal-500/30",
    glow: "shadow-teal-500/20",
    gradient: "from-teal-500 to-emerald-600",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
  directory: {
    label: "Directory",
    icon: "text-lime-700 dark:text-lime-400",
    iconBg: "bg-lime-600/15",
    border: "border-lime-600/30",
    glow: "shadow-lime-600/20",
    gradient: "from-lime-600 to-green-700",
    badge: "bg-lime-600/15 text-lime-800 dark:text-lime-300",
  },
  profile: {
    label: "Profile",
    icon: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/15",
    border: "border-rose-500/30",
    glow: "shadow-rose-500/20",
    gradient: "from-rose-500 to-pink-600",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  admin: {
    label: "Admin",
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/15",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/20",
    gradient: "from-amber-500 to-orange-600",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
} as const;

export type CategoryAccent = keyof typeof categoryAccents;

export const navAccentMap: Record<string, CategoryAccent> = {
  "/dashboard": "dashboard",
  "/projects": "projects",
  "/messages": "messages",
  "/directory": "directory",
  "/profile": "profile",
  "/admin": "admin",
};

export function getNavAccent(href: string): CategoryAccent {
  if (href.startsWith("/admin")) return "admin";
  if (href.startsWith("/profile")) return "profile";
  for (const [prefix, accent] of Object.entries(navAccentMap)) {
    if (href === prefix || href.startsWith(`${prefix}/`)) return accent;
  }
  return "dashboard";
}
