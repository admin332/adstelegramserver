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
  iconClassName?: string;
}

export const StatsCard = ({ 
  icon, 
  label, 
  value, 
  numericValue,
  trend, 
  className,
  iconClassName 
}: StatsCardProps) => {
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
    <div className={cn(
      "bg-secondary/80 backdrop-blur-sm rounded-2xl p-4 border border-border/50",
      className
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "p-2 rounded-xl",
          iconClassName || "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span 
          ref={valueRef} 
          className="text-3xl font-bold text-foreground tracking-tight"
        >
          {value}
        </span>
        {trend !== undefined && (
          <span className={cn(
            "text-sm font-medium",
            trend >= 0 ? "text-success" : "text-destructive"
          )}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </div>
  );
};
