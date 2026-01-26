import { Clock, CheckCircle2, Wallet, Shield, XCircle, AlertTriangle, ExternalLink, TimerOff, MoreVertical } from "lucide-react";
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
  role: 'advertiser' | 'channel_owner';
  advertiser?: {
    first_name: string;
    username?: string;
    photo_url?: string;
  };
  onPayClick?: () => void;
  onOwnerAction?: () => void;
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
  role,
  advertiser,
  onPayClick,
  onOwnerAction,
}: DealCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  const isChannelOwner = role === 'channel_owner';
  
  // For channel owner, show advertiser info; for advertiser, show channel info
  const displayTitle = isChannelOwner 
    ? advertiser?.first_name || "Рекламодатель"
    : channel?.title || "Канал";
  const displaySubtitle = isChannelOwner 
    ? advertiser?.username ? `@${advertiser.username}` : null
    : channel?.username ? `@${channel.username}` : null;
  const displayAvatar = isChannelOwner 
    ? advertiser?.photo_url 
    : channel?.avatar_url;
  const displayInitial = displayTitle.charAt(0).toUpperCase();

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
      {/* Timer in top right corner for pending status */}
      {status === "pending" && expiresAt && (
        <div className="absolute top-4 right-4">
          <ExpirationTimer expiresAt={expiresAt} />
        </div>
      )}

      {/* Top section: avatar and info */}
      <div className="flex items-start gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={displayAvatar || undefined} alt={displayTitle} />
          <AvatarFallback className="bg-secondary text-foreground">
            {displayInitial}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{displayTitle}</h3>
            {isChannelOwner && (
              <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                входящий
              </span>
            )}
          </div>
          {displaySubtitle && (
            <p className="text-sm text-muted-foreground">{displaySubtitle}</p>
          )}
          {campaign && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Кампания: {campaign.name}
            </p>
          )}
          {isChannelOwner && channel && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Канал: {channel.title || channel.username}
            </p>
          )}
        </div>
      </div>

      {/* Deal details */}
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

      {/* Status and time */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full", config.bgColor)}>
          <StatusIcon className={cn("w-4 h-4", config.color)} />
          <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
        </div>
        <span className="text-sm text-muted-foreground">{timeAgo}</span>
      </div>

      {/* Action buttons for pending status (advertiser) */}
      {status === "pending" && !isChannelOwner && (
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

      {/* Action buttons for escrow status (channel owner) */}
      {status === "escrow" && isChannelOwner && (
        <div className="mt-3">
          <Button 
            onClick={onOwnerAction}
            className="w-full"
            size="sm"
          >
            <MoreVertical className="w-4 h-4 mr-1.5" />
            Действия
          </Button>
        </div>
      )}

      {/* Blockchain link for escrow status (advertiser) */}
      {status === "escrow" && !isChannelOwner && escrowAddress && (
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
