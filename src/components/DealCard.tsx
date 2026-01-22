import { Clock, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type DealStatus = "pending" | "in_review" | "approved" | "escrow" | "published" | "completed" | "cancelled";

interface DealCardProps {
  id: string;
  channelName: string;
  channelAvatar: string;
  advertiserName: string;
  status: DealStatus;
  amount: number;
  createdAt: string;
  adFormat: string;
}

const statusConfig: Record<DealStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Ожидание", color: "text-warning", icon: Clock },
  in_review: { label: "На проверке", color: "text-primary", icon: AlertCircle },
  approved: { label: "Одобрено", color: "text-success", icon: CheckCircle2 },
  escrow: { label: "Эскроу", color: "text-primary", icon: Wallet },
  published: { label: "Опубликовано", color: "text-success", icon: CheckCircle2 },
  completed: { label: "Завершено", color: "text-success", icon: CheckCircle2 },
  cancelled: { label: "Отменено", color: "text-destructive", icon: AlertCircle },
};

export const DealCard = ({
  channelName,
  channelAvatar,
  advertiserName,
  status,
  amount,
  createdAt,
  adFormat,
}: DealCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="bg-card rounded-2xl p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <img
          src={channelAvatar}
          alt={channelName}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{channelName}</h3>
          <p className="text-sm text-muted-foreground">от {advertiserName}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-foreground">${amount}</p>
          <span className="text-2xs text-muted-foreground">{adFormat}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className={cn("flex items-center gap-1.5", config.color)}>
          <StatusIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <span className="text-sm text-muted-foreground">{createdAt}</span>
      </div>
    </div>
  );
};
