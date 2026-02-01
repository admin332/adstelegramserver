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
  const suffixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = valueRef.current;
    const suffixNode = suffixRef.current;
    if (!node || numericValue === undefined) return;

    const controls = animate(0, numericValue, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(currentValue) {
        if (numericValue >= 1_000_000) {
          node.textContent = (currentValue / 1_000_000).toFixed(1);
          if (suffixNode) suffixNode.textContent = 'M';
        } else if (numericValue >= 1_000) {
          node.textContent = (currentValue / 1_000).toFixed(1);
          if (suffixNode) suffixNode.textContent = 'K';
        } else {
          node.textContent = Math.round(currentValue).toString();
          if (suffixNode) suffixNode.textContent = '';
        }
      },
    });

    return () => controls.stop();
  }, [numericValue]);

  // Determine initial suffix for non-animated display
  const getInitialSuffix = () => {
    if (numericValue === undefined) return '';
    if (numericValue >= 1_000_000) return 'M';
    if (numericValue >= 1_000) return 'K';
    return '';
  };

  return (
    <div className={cn("bg-secondary rounded-2xl p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-primary">{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="flex items-baseline">
          <span ref={valueRef} className="text-2xl font-bold text-foreground">{value}</span>
          <span ref={suffixRef} className="text-base font-bold text-muted-foreground ml-0.5">
            {getInitialSuffix()}
          </span>
        </span>
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
