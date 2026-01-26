import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, BadgeCheck, ArrowLeft } from "lucide-react";
import { useUserChannels, useToggleChannelActive, UserChannel } from "@/hooks/useUserChannels";
import { channelCategories } from "@/data/channelCategories";

interface MyChannelsListProps {
  onAddChannel: () => void;
  onBack: () => void;
}

export const MyChannelsList = ({ onAddChannel, onBack }: MyChannelsListProps) => {
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

  const handleToggle = (channel: UserChannel) => {
    toggleActive.mutate({
      channelId: channel.id,
      isActive: !channel.is_active,
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
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-card rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
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
                <div className="flex items-center gap-2">
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
                onCheckedChange={() => handleToggle(channel)}
                disabled={toggleActive.isPending}
              />
            </div>
          ))}
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
        className="w-full border-0 text-white hover:bg-white/10"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>
    </div>
  );
};
