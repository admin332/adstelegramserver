import { Clock, CheckCircle2, AlertCircle, Wallet, Shield, XCircle, AlertTriangle, ExternalLink, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExpirationTimer } from "@/components/deals/ExpirationTimer";
import TonIcon from "@/assets/ton-icon.svg";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type DealStatus = Database['public']['Enums']['deal_status'];

interface DealCardProps {
  id: string;
  status: DealStatus;
  totalPrice: number;
  postsCount: number;
  durationHours: number;
  escrowAddress: string | null;
  scheduledAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  channel: {
    title: string | null;
    avatar_url: string | null;
    username: string;
  } | null;
  campaign: { name: string } | null;
  usdEquivalent: number | null;
  onPayClick?: () => void;
}

const statusConfig: Record<DealStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: typeof Clock 
}> = {
  pending: { 
    label: "Ожидает оплаты", 
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500/10",
    icon: Wallet 
  },
  escrow: { 
    label: "Оплачено", 
    color: "text-blue-500", 
    bgColor: "bg-blue-500/10",
    icon: Shield 
  },
  in_progress: { 
    label: "Публикуется", 
    color: "text-primary", 
    bgColor: "bg-primary/10",
    icon: Clock 
  },
  completed: { 
    label: "Завершено", 
    color: "text-green-500", 
    bgColor: "bg-green-500/10",
    icon: CheckCircle2 
  },
  cancelled: { 
    label: "Отменено", 
    color: "text-red-500", 
    bgColor: "bg-red-500/10",
    icon: XCircle 
  },
  disputed: { 
    label: "Спор", 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    icon: AlertTriangle 
  },
  expired: { 
    label: "Истекло", 
    color: "text-muted-foreground", 
    bgColor: "bg-secondary",
    icon: TimerOff 
  },
};

export const DealCard = ({
  id,
  status,
  totalPrice,
  postsCount,
  durationHours,
  escrowAddress,
  scheduledAt,
  createdAt,
  expiresAt,
  channel,
  campaign,
  usdEquivalent,
  onPayClick,
}: DealCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  const channelTitle = channel?.title || "Канал";
  const channelInitial = channelTitle.charAt(0).toUpperCase();

  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ru,
  });

  const handleViewBlockchain = () => {
    if (!escrowAddress) return;
    window.open(`https://tonviewer.com/${escrowAddress}`, "_blank");
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours}ч`;
    const days = Math.floor(hours / 24);
    return `${days}д`;
  };

  return (
    <div className="bg-card rounded-2xl p-4 animate-fade-in relative">
      {/* Таймер в правом верхнем углу */}
      {status === "pending" && expiresAt && (
        <div className="absolute top-4 right-4">
          <ExpirationTimer expiresAt={expiresAt} />
        </div>
      )}

      {/* Верхняя часть: информация о канале */}
      <div className="flex items-start gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={channel?.avatar_url || undefined} alt={channelTitle} />
          <AvatarFallback className="bg-secondary text-foreground">
            {channelInitial}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{channelTitle}</h3>
          {channel?.username && (
            <p className="text-sm text-muted-foreground">@{channel.username}</p>
          )}
          {campaign && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Кампания: {campaign.name}
            </p>
          )}
        </div>
      </div>

      {/* Детали сделки */}
      <div className="flex items-center gap-3 mt-3 text-sm">
        <div className="flex items-center gap-1.5">
          <img src={TonIcon} alt="TON" className="w-4 h-4" />
          <span className="font-semibold text-foreground">{totalPrice} TON</span>
          {usdEquivalent && (
            <span className="text-muted-foreground">≈ ${usdEquivalent.toFixed(2)}</span>
          )}
        </div>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {postsCount} {postsCount === 1 ? "пост" : "поста"}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">{formatDuration(durationHours)}</span>
      </div>

      {/* Статус и время */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full", config.bgColor)}>
          <StatusIcon className={cn("w-4 h-4", config.color)} />
          <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
        </div>
        <span className="text-sm text-muted-foreground">{timeAgo}</span>
      </div>

      {/* Кнопки действий для pending статуса */}
      {status === "pending" && (
        <div className="flex gap-2 mt-3">
          <Button 
            onClick={onPayClick} 
            className="flex-1"
            size="sm"
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            Оплатить
          </Button>
          {escrowAddress && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleViewBlockchain}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Кнопка для escrow статуса */}
      {status === "escrow" && escrowAddress && (
        <div className="mt-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleViewBlockchain}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Посмотреть в блокчейне
          </Button>
        </div>
      )}
    </div>
  );
};
