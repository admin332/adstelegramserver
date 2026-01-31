import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, CheckCircle, Clock, Trash2, Loader2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getTelegramWebApp, isTelegramMiniApp } from '@/lib/telegram';
import { useChannelStats, useUpdateChannelSettings, ChannelSettings } from '@/hooks/useChannelSettings';
import { useUserChannels } from '@/hooks/useUserChannels';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Price validation: only integers 1-100000
const validatePriceInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  const num = parseInt(cleaned, 10);
  if (num > 100000) return '100000';
  return cleaned;
};

const typeLabels: Record<string, string> = {
  prompt: 'Промпт',
  ready_post: 'Готовый',
  both: 'Любой',
};

const ChannelSettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: channels, isLoading: channelsLoading } = useUserChannels();
  const channel = channels?.find(c => c.id === id);
  const { data, isLoading: statsLoading } = useChannelStats(id || null);
  const updateSettings = useUpdateChannelSettings();
  
  const [localSettings, setLocalSettings] = useState<Partial<ChannelSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Telegram BackButton
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    if (isTelegramMiniApp()) {
      const webapp = getTelegramWebApp();
      if (webapp?.BackButton) {
        webapp.BackButton.onClick(handleBack);
        webapp.BackButton.show();
        return () => {
          webapp.BackButton.offClick(handleBack);
          webapp.BackButton.hide();
        };
      }
    }
  }, [handleBack]);

  // Sync settings from server
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

  const handleSave = () => {
    if (!id || !hasChanges) return;
    
    // Validate minimum price
    if (localSettings.price_1_24 !== null && localSettings.price_1_24 !== undefined && localSettings.price_1_24 < 1) {
      toast({
        title: "Ошибка",
        description: "Минимальная цена: 1 TON",
        variant: "destructive",
      });
      return;
    }
    if (localSettings.price_2_48 !== null && localSettings.price_2_48 !== undefined && localSettings.price_2_48 < 1) {
      toast({
        title: "Ошибка",
        description: "Минимальная цена: 1 TON",
        variant: "destructive",
      });
      return;
    }
    
    updateSettings.mutate(
      { channelId: id, settings: localSettings },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  const isLoading = channelsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="relative h-48 bg-gradient-to-b from-primary/20 to-background">
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <Skeleton className="w-24 h-24 rounded-full" />
          </div>
        </div>
        <div className="mt-16 px-4 space-y-4">
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-32 rounded-2xl mt-6" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Канал не найден</h1>
          <Button onClick={() => navigate('/create')}>
            Вернуться
          </Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { favorites_count: 0, completed_deals_count: 0 };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Section */}
      <div className="relative">
        <div className="h-40 overflow-hidden">
          <img
            src={channel.avatar_url || '/placeholder.svg'}
            alt={channel.title || channel.username}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
        </div>
        
        <div className="relative -mt-12 flex flex-col items-center px-4">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={channel.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {(channel.title || channel.username)?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex items-center gap-2 mt-3">
            <h1 className="text-xl font-bold text-foreground">
              {channel.title || channel.username}
            </h1>
            {channel.verified && <BadgeCheck className="w-5 h-5 text-primary" />}
          </div>
          <p className="text-muted-foreground">@{channel.username}</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary/50 rounded-2xl p-4 text-center"
        >
          <Heart className="h-5 w-5 mx-auto mb-2 text-red-400" />
          <p className="text-2xl font-bold text-foreground">{stats.favorites_count}</p>
          <p className="text-xs text-muted-foreground">В избранном</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary/50 rounded-2xl p-4 text-center"
        >
          <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-400" />
          <p className="text-2xl font-bold text-foreground">{stats.completed_deals_count}</p>
          <p className="text-xs text-muted-foreground">Сделок</p>
        </motion.div>
      </div>

      {/* Prices Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Цены</h2>
        <div className="bg-secondary/50 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">24 часа / 1 пост</span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={localSettings.price_1_24?.toString() ?? ''}
                onChange={(e) => {
                  const validated = validatePriceInput(e.target.value);
                  handleSettingChange('price_1_24', validated ? parseInt(validated, 10) : null);
                }}
                className="w-24 text-right bg-background"
                placeholder="1-100000"
              />
              <span className="text-sm text-muted-foreground w-8">TON</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">24 часа / 2+ поста</span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={localSettings.price_2_48?.toString() ?? ''}
                onChange={(e) => {
                  const validated = validatePriceInput(e.target.value);
                  handleSettingChange('price_2_48', validated ? parseInt(validated, 10) : null);
                }}
                className="w-24 text-right bg-background"
                placeholder="1-100000"
              />
              <span className="text-sm text-muted-foreground w-8">TON</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Campaign Types Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Типы кампаний</h2>
        <div className="bg-secondary/50 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2">
            {(['prompt', 'ready_post', 'both'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleSettingChange('accepted_campaign_types', type)}
                className={cn(
                  "p-3 rounded-xl text-center transition-all",
                  localSettings.accepted_campaign_types === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-secondary"
                )}
              >
                <span className="text-sm">{typeLabels[type]}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Lead Time Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Минимальное время до публикации</h2>
        <div className="bg-secondary/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">
              +{localSettings.min_hours_before_post || 2}ч
            </span>
          </div>
          
          <Slider
            value={[localSettings.min_hours_before_post || 2]}
            onValueChange={([value]) => handleSettingChange('min_hours_before_post', value)}
            max={72}
            min={2}
            step={1}
            className="w-full"
          />
          
          <div className="flex justify-between mt-3">
            {[2, 6, 12, 24, 48, 72].map((h) => (
              <span 
                key={h}
                className={cn(
                  "text-xs",
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

      {/* Auto-delete Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Автоудаление</h2>
        <div className="bg-secondary/50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Удалять посты автоматически</span>
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

      {/* Fixed Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
            className="w-full h-14 text-base font-semibold rounded-2xl"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить изменения'
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default ChannelSettingsPage;
