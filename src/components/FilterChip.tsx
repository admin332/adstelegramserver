import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FilterChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}

export const FilterChip = ({ children, active, onClick, icon }: FilterChipProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-ios-gray3"
      )}
    >
      {icon}
      {children}
    </button>
  );
};
