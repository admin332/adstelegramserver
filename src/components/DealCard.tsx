import { Clock, CheckCircle2, Wallet, Shield, XCircle, AlertTriangle, ExternalLink, TimerOff, MoreVertical, ImageIcon, FileVideo, FileText, Edit3, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExpirationTimer } from "@/components/deals/ExpirationTimer";
import { DealCountdown } from "@/components/deals/DealCountdown";
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
  postedAt: string | null;
  authorDraft: string | null;
  isDraftApproved: boolean | null;
  revisionCount: number;
  channel: {
    title: string | null;
    avatar_url: string | null;
    username: string;
  } | null;
  campaign: { 
    name: string;
    campaign_type?: string;
    text?: string;
    media_urls?: string[];
    image_url?: string;
    button_text?: string;
    button_url?: string;
  } | null;
  usdEquivalent: number | null;
  role: 'advertiser' | 'channel_owner';
  onPayClick?: () => void;
  onOwnerAction?: () => void;
  onWriteDraft?: () => void;
  onReviewDraft?: () => void;
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

// Helper function to check if URL is a video
const isVideoUrl = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Helper function to get campaign media info for preview
const getCampaignMediaInfo = (campaign: DealCardProps['campaign']) => {
  if (!campaign) return { firstMedia: null, mediaCount: 0, isVideo: false };
  
  const mediaUrls = campaign.media_urls as string[] | undefined;
  const firstMedia = mediaUrls?.[0] || campaign.image_url || null;
  const mediaCount = mediaUrls?.length || (campaign.image_url ? 1 : 0);
  const isVideo = firstMedia ? isVideoUrl(firstMedia) : false;
  
  return { firstMedia, mediaCount, isVideo };
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
  postedAt,
  authorDraft,
  isDraftApproved,
  revisionCount,
  channel,
  campaign,
  usdEquivalent,
  role,
  onPayClick,
  onOwnerAction,
  onWriteDraft,
  onReviewDraft,
}: DealCardProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  // Check if this is a prompt campaign
  const isPromptCampaign = campaign?.campaign_type === "prompt";
  
  // Dynamic status label based on campaign type and draft status
  let dynamicStatusLabel = config.label;
  if (status === "escrow" && isPromptCampaign) {
    if (!authorDraft) {
      dynamicStatusLabel = "Ожидает черновик";
    } else if (isDraftApproved === null) {
      dynamicStatusLabel = "На проверке";
    } else if (isDraftApproved === false) {
      dynamicStatusLabel = `Доработка #${revisionCount}`;
    }
  } else if (status === "in_progress" && postedAt) {
    dynamicStatusLabel = "Опубликовано";
  }
  
  const isChannelOwner = role === 'channel_owner';
  
  // Get campaign media info for channel owner preview
  const campaignMedia = getCampaignMediaInfo(campaign);
  
  // For channel owner, show campaign info; for advertiser, show channel info
  const displayTitle = isChannelOwner 
    ? campaign?.name || "Кампания"
    : channel?.title || "Канал";
  const displaySubtitle = isChannelOwner 
    ? null  // Hide advertiser username for privacy
    : channel?.username ? `@${channel.username}` : null;
  const displayAvatar = channel?.avatar_url;
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

  // Calculate completion time (posted_at + duration_hours)
  const completionTime = postedAt 
    ? new Date(new Date(postedAt).getTime() + durationHours * 60 * 60 * 1000).toISOString()
    : null;

  // Determine which countdown to show
  const showPublicationCountdown = 
    (status === "escrow" || status === "in_progress") && 
    scheduledAt && 
    new Date(scheduledAt).getTime() > Date.now();

  const showCompletionCountdown = 
    status === "in_progress" && 
    postedAt && 
    completionTime &&
    new Date(completionTime).getTime() > Date.now();

  return (
    <div className="bg-card rounded-2xl p-4 animate-fade-in relative">
      {/* Timer in top right corner for pending status */}
      {status === "pending" && expiresAt && (
        <div className="absolute top-4 right-4">
          <ExpirationTimer expiresAt={expiresAt} />
        </div>
      )}

      {/* Countdown to publication */}
      {showPublicationCountdown && (
        <div className="absolute top-4 right-4">
          <DealCountdown 
            targetDate={scheduledAt!} 
            label="до публикации"
            colorClass="text-blue-500"
          />
        </div>
      )}

      {/* Countdown to completion */}
      {showCompletionCountdown && (
        <div className="absolute top-4 right-4">
          <DealCountdown 
            targetDate={completionTime!} 
            label="до завершения"
            colorClass="text-primary"
          />
        </div>
      )}

      {/* Top section: avatar and info */}
      <div className="flex items-start gap-3">
        {isChannelOwner ? (
          // Campaign preview for channel owner (square style like MyCampaignsList)
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 relative">
            {campaignMedia.firstMedia ? (
              campaignMedia.isVideo ? (
                <div className="w-full h-full flex items-center justify-center bg-card">
                  <FileVideo className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <img
                  src={campaignMedia.firstMedia}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            )}
            {campaignMedia.mediaCount > 1 && (
              <div className="absolute bottom-0.5 right-0.5 min-w-4 h-4 rounded-full bg-primary flex items-center justify-center px-0.5">
                <span className="text-[10px] font-medium text-primary-foreground">{campaignMedia.mediaCount}</span>
              </div>
            )}
          </div>
        ) : (
          // Standard Avatar for channel (for advertiser)
          <Avatar className="w-12 h-12">
            <AvatarImage src={displayAvatar || undefined} alt={displayTitle} />
            <AvatarFallback className="bg-secondary text-foreground">
              {displayInitial}
            </AvatarFallback>
          </Avatar>
        )}
        
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
          <span className={cn("text-sm font-medium", config.color)}>{dynamicStatusLabel}</span>
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

      {/* Action buttons for escrow status (channel owner) - prompt campaign */}
      {status === "escrow" && isChannelOwner && isPromptCampaign && (
        <div className="mt-3">
          {!authorDraft || isDraftApproved === false ? (
            <Button 
              onClick={onWriteDraft}
              className="w-full"
              size="sm"
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              {authorDraft ? "Редактировать черновик" : "Написать пост"}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Clock className="w-4 h-4" />
              Ожидает проверки рекламодателя
            </div>
          )}
        </div>
      )}

      {/* Action buttons for escrow status (advertiser) - prompt campaign with draft */}
      {status === "escrow" && !isChannelOwner && isPromptCampaign && authorDraft && isDraftApproved === null && (
        <div className="mt-3">
          <Button 
            onClick={onReviewDraft}
            className="w-full"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Проверить черновик
          </Button>
        </div>
      )}

      {/* Action buttons for escrow status (channel owner) - ready_post campaign */}
      {status === "escrow" && isChannelOwner && !isPromptCampaign && (
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
