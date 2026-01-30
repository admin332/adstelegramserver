import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, CheckCircle, Clock, Trash2, Loader2, BadgeCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useChannelStats, useUpdateChannelSettings, ChannelSettings } from '@/hooks/useChannelSettings';
import { UserChannel } from '@/hooks/useUserChannels';
import { cn } from '@/lib/utils';

interface ChannelSettingsDialogProps {
  channel: UserChannel | null;
  isOpen: boolean;
  onClose: () => void;
}

const campaignTypeLabels: Record<string, string> = {
  prompt: 'Промпт',
  ready_post: 'Готовый',
  both: 'Любой',
};

export const ChannelSettingsDialog: React.FC<ChannelSettingsDialogProps> = ({
  channel,
  isOpen,
  onClose,
}) => {
  const { data, isLoading } = useChannelStats(channel?.id || null);
  const updateSettings = useUpdateChannelSettings();

  const [localSettings, setLocalSettings] = useState<Partial<ChannelSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setLocalSettings({
        price_1_24: data.settings.price_1_24,
        price_2_48: data.settings.price_2_48,
        accepted_campaign_types: data.settings.accepted_campaign_types,
        min_hours_before_post: data.settings.min_hours_before_post,
        auto_delete_posts: data.settings.auto_delete_posts,
      });
      setHasChanges(false);
    }
  }, [data?.settings]);

  const handleSettingChange = <K extends keyof ChannelSettings>(
    key: K,
    value: ChannelSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!channel?.id || !hasChanges) return;
    
    await updateSettings.mutateAsync({
      channelId: channel.id,
      settings: localSettings,
    });
    
    setHasChanges(false);
  };

  const formatMinHours = (hours: number) => {
    if (hours === 0) return "Без ограничений";
    if (hours < 24) return `+${hours} ч`;
    return `+${Math.floor(hours / 24)} д`;
  };

  if (!channel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden p-0 bg-background border-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col max-h-[90vh]">
            {/* Hero Section */}
            <div className="relative shrink-0">
              <div className="h-24 overflow-hidden">
                <img
                  src={channel.avatar_url || '/placeholder.svg'}
                  alt={channel.title || ''}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
              </div>

              <div className="relative -mt-10 flex flex-col items-center pb-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    <AvatarImage src={channel.avatar_url || ''} alt={channel.title || ''} />
                    <AvatarFallback className="text-xl font-bold">
                      {channel.title?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-2 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{channel.title}</h2>
                    {channel.verified && (
                      <BadgeCheck className="h-5 w-5 text-primary fill-primary/20" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{channel.username}</p>
                </motion.div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-secondary/50 rounded-2xl p-4 text-center"
                >
                  <Heart className="h-5 w-5 mx-auto mb-2 text-red-400" />
                  <p className="text-2xl font-bold text-foreground">{data?.stats.favorites_count || 0}</p>
                  <p className="text-xs text-muted-foreground">В избранном</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-secondary/50 rounded-2xl p-4 text-center"
                >
                  <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-400" />
                  <p className="text-2xl font-bold text-foreground">{data?.stats.completed_deals_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Сделок</p>
                </motion.div>
              </div>

              {/* Prices Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4"
              >
                <h3 className="text-lg font-semibold text-foreground mb-2">Цены</h3>
                <div className="bg-secondary/50 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">24 часа</span>
                    <div className="relative w-32">
                      <Input
                        type="number"
                        value={localSettings.price_1_24 || ''}
                        onChange={(e) => handleSettingChange('price_1_24', parseFloat(e.target.value) || null)}
                        placeholder="0.00"
                        className="pr-12 text-right bg-background/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        TON
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">48 часов</span>
                    <div className="relative w-32">
                      <Input
                        type="number"
                        value={localSettings.price_2_48 || ''}
                        onChange={(e) => handleSettingChange('price_2_48', parseFloat(e.target.value) || null)}
                        placeholder="0.00"
                        className="pr-12 text-right bg-background/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        TON
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Campaign Types Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mt-4"
              >
                <h3 className="text-lg font-semibold text-foreground mb-2">Типы кампаний</h3>
                <div className="bg-secondary/50 rounded-2xl p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(['prompt', 'ready_post', 'both'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleSettingChange('accepted_campaign_types', type)}
                        className={cn(
                          "p-3 rounded-xl text-center transition-all",
                          localSettings.accepted_campaign_types === type
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : "bg-background/50 hover:bg-background text-foreground"
                        )}
                      >
                        <span className="text-sm font-medium">{campaignTypeLabels[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Minimum Time Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Минимальное время</h3>
                </div>
                <div className="bg-secondary/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">До публикации</span>
                    <span className="font-semibold text-primary">
                      {formatMinHours(localSettings.min_hours_before_post || 0)}
                    </span>
                  </div>
                  <Slider
                    value={[localSettings.min_hours_before_post || 0]}
                    onValueChange={([value]) => handleSettingChange('min_hours_before_post', value)}
                    max={72}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-3">
                    {[0, 6, 12, 24, 48, 72].map((h) => (
                      <span
                        key={h}
                        className={cn(
                          "text-xs transition-colors",
                          localSettings.min_hours_before_post === h
                            ? "text-primary font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {h}ч
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Auto Delete Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mt-4"
              >
                <div className="bg-secondary/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trash2 className="h-5 w-5 text-primary" />
                      <span className="font-medium text-foreground">Автоудаление</span>
                    </div>
                    <Switch
                      checked={localSettings.auto_delete_posts || false}
                      onCheckedChange={(checked) => handleSettingChange('auto_delete_posts', checked)}
                    />
                  </div>

                  {localSettings.auto_delete_posts && (
                    <div className="mt-3 p-3 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/10">
                      <p className="text-xs text-amber-400">
                        Пост будет удалён автоматически после окончания срока размещения
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Fixed Save Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || updateSettings.isPending}
                  className="w-full h-12 text-base font-semibold rounded-2xl"
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    'Сохранить изменения'
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
