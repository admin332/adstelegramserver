import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpirationTimerProps {
  expiresAt: string;
  className?: string;
  showIcon?: boolean;
  onExpire?: () => void;
}

export function ExpirationTimer({ 
  expiresAt, 
  className,
  showIcon = true,
  onExpire 
}: ExpirationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      
      if (diff <= 0) {
        setTimeLeft("Истекло");
        setIsExpired(true);
        onExpire?.();
        return;
      }
      
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      setIsExpired(false);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <span className={cn(
      "flex items-center gap-1 text-sm font-medium",
      isExpired ? "text-muted-foreground" : "text-yellow-500",
      className
    )}>
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      {timeLeft}
    </span>
  );
}
