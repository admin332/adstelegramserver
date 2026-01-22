import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: number;
  className?: string;
}

export const StatsCard = ({ icon, label, value, trend, className }: StatsCardProps) => {
  return (
    <div className={cn("bg-secondary rounded-2xl p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-primary">{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend !== undefined && (
          <span
            className={cn(
              "text-sm font-medium mb-0.5",
              trend >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </div>
  );
};
