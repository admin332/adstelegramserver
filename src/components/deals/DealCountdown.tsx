import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealCountdownProps {
  targetDate: string;
  label: string;
  colorClass?: string;
}

export function DealCountdown({ targetDate, label, colorClass = "text-primary" }: DealCountdownProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();

      if (diff <= 0) {
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        setTimeLeft(`${days}д ${remainingHours}ч`);
      } else {
        setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (isExpired) return null;

  return (
    <div className="flex flex-col items-end">
      <span className={cn("flex items-center gap-1 text-sm font-medium", colorClass)}>
        <Clock className="w-3.5 h-3.5" />
        {timeLeft}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
