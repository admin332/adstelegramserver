import { ReactNode, useRef, useEffect } from "react";
import { animate } from "motion";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  numericValue?: number;
  trend?: number;
  className?: string;
}

export const StatsCard = ({ icon, label, value, numericValue, trend, className }: StatsCardProps) => {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = valueRef.current;
    if (!node || numericValue === undefined) return;

    const controls = animate(0, numericValue, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(currentValue) {
        if (numericValue >= 1_000_000) {
          node.textContent = (currentValue / 1_000_000).toFixed(1) + 'M';
        } else if (numericValue >= 1_000) {
          node.textContent = (currentValue / 1_000).toFixed(1) + 'K';
        } else {
          node.textContent = Math.round(currentValue).toString();
        }
      },
    });

    return () => controls.stop();
  }, [numericValue]);

  return (
    <div className={cn("bg-secondary rounded-2xl p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-primary">{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span ref={valueRef} className="text-2xl font-bold text-foreground">{value}</span>
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
