import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryAccents, type CategoryAccent } from "@/lib/accents";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: CategoryAccent;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "dashboard",
  trend,
  className,
}: StatCardProps) {
  const colors = categoryAccents[accent];

  return (
    <Card
      className={cn(
        "card-interactive group relative overflow-hidden border-border/60 shadow-sm hover:border-border",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          colors.gradient
        )}
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
              colors.iconBg,
              colors.icon
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-bold tabular-nums tracking-tight">
          {value}
        </div>
        {(description || trend) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trend.direction === "up" &&
                    "text-emerald-600 dark:text-emerald-400",
                  trend.direction === "down" &&
                    "text-red-600 dark:text-red-400"
                )}
              >
                {trend.direction === "up" && (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                )}
                {trend.direction === "down" && (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                {trend.value}
              </span>
            )}
            {description && <span>{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
