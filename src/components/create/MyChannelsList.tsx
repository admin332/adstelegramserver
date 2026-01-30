import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, BadgeCheck, ArrowLeft, EyeOff, Settings } from "lucide-react";
import { useUserChannels, useToggleChannelActive } from "@/hooks/useUserChannels";
import { channelCategories } from "@/data/channelCategories";
import { cn } from "@/lib/utils";
import { ChannelTeamCompact } from "./ChannelTeamCompact";

interface MyChannelsListProps {
  onAddChannel: () => void;
  onBack: () => void;
}

export const MyChannelsList = ({ onAddChannel, onBack }: MyChannelsListProps) => {
  const navigate = useNavigate();
  const { data: channels, isLoading } = useUserChannels();
  const toggleActive = useToggleChannelActive();

  const getCategoryName = (categoryId: string) => {
    return channelCategories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const formatSubscribers = (count: number | null) => {
    if (!count) return "0";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleToggle = (channelId: string, currentStatus: boolean | null) => {
    toggleActive.mutate({
      channelId,
      isActive: !currentStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Мои каналы</h2>
        <span className="text-sm text-muted-foreground">{channels?.length || 0} каналов</span>
      </div>

      {channels && channels.length > 0 ? (
        <div className="space-y-3">
          {channels.map((channel) => {
            const isHidden = channel.is_active === false;
            
            return (
              <div
                key={channel.id}
                className={cn(
                  "bg-card rounded-2xl p-4 transition-opacity",
                  isHidden && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0",
                    isHidden && "grayscale"
                  )}>
                    {channel.avatar_url ? (
                      <img
                        src={channel.avatar_url}
                        alt={channel.title || channel.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">
                        {(channel.title || channel.username)?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {channel.title || channel.username}
                      </h3>
                      {channel.verified && (
                        <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                      {channel.userRole === 'manager' && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          Менеджер
                        </Badge>
                      )}
                      {isHidden && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 border-destructive/50 text-destructive">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Скрыт
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">@{channel.username}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {formatSubscribers(channel.subscribers_count)}
                      </span>
                      <span>{getCategoryName(channel.category)}</span>
                    </div>
                  </div>

                  <Switch
                    checked={channel.is_active || false}
                    onCheckedChange={() => handleToggle(channel.id, channel.is_active)}
                    disabled={toggleActive.isPending}
                  />
                </div>
                
                {/* Bottom row: Team + Settings */}
                <div className="flex items-center justify-between mt-2">
                  <ChannelTeamCompact channelId={channel.id} />
                  <button
                    onClick={() => navigate(`/channel/${channel.id}/settings`)}
                    className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    title="Настройки канала"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>У вас пока нет каналов</p>
        </div>
      )}

      <Button onClick={onAddChannel} className="w-full" size="lg">
        <Plus className="w-5 h-5 mr-2" />
        Добавить канал
      </Button>

      <Button
        variant="outline"
        onClick={onBack}
        className="w-full border-0 text-foreground hover:bg-secondary"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>
    </div>
  );
};
