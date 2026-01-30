import React, { useState, useEffect } from 'react';
import { Settings, Heart, CheckCircle, Clock, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useChannelStats, useUpdateChannelSettings, ChannelSettings } from '@/hooks/useChannelSettings';
import { UserChannel } from '@/hooks/useUserChannels';

interface ChannelSettingsDialogProps {
  channel: UserChannel | null;
  isOpen: boolean;
  onClose: () => void;
}

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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Настройки канала
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                📊 Статистика
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <Heart className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{data?.stats.favorites_count || 0}</p>
                  <p className="text-xs text-muted-foreground">В избранном</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{data?.stats.completed_deals_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Сделок</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Prices Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                💰 Цены
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm">24 часа:</Label>
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      value={localSettings.price_1_24 || ''}
                      onChange={(e) => handleSettingChange('price_1_24', parseFloat(e.target.value) || null)}
                      placeholder="0.00"
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      TON
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm">48 часов:</Label>
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      value={localSettings.price_2_48 || ''}
                      onChange={(e) => handleSettingChange('price_2_48', parseFloat(e.target.value) || null)}
                      placeholder="0.00"
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      TON
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Campaign Types Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                📝 Типы кампаний
              </h3>
              <RadioGroup
                value={localSettings.accepted_campaign_types || 'both'}
                onValueChange={(value) => handleSettingChange('accepted_campaign_types', value)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="prompt" id="prompt" />
                  <Label htmlFor="prompt" className="flex-1 cursor-pointer">
                    Только промпт
                    <p className="text-xs text-muted-foreground">Рекламодатель отправляет описание</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="ready_post" id="ready_post" />
                  <Label htmlFor="ready_post" className="flex-1 cursor-pointer">
                    Только готовый пост
                    <p className="text-xs text-muted-foreground">Рекламодатель присылает готовый контент</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both" className="flex-1 cursor-pointer">
                    Любой тип
                    <p className="text-xs text-muted-foreground">Принимаются оба варианта</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Minimum Time Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Минимальное время до публикации
              </h3>
              <div className="space-y-4">
                <Slider
                  value={[localSettings.min_hours_before_post || 0]}
                  onValueChange={([value]) => handleSettingChange('min_hours_before_post', value)}
                  max={72}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">0ч</span>
                  <span className="font-medium text-primary">
                    {formatMinHours(localSettings.min_hours_before_post || 0)}
                  </span>
                  <span className="text-muted-foreground">72ч</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Рекламодатели смогут заказывать рекламу минимум за это время до публикации
                </p>
              </div>
            </div>

            <Separator />

            {/* Auto Delete Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Автоудаление постов
              </h3>
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Удалять после завершения</p>
                  <p className="text-xs text-muted-foreground">
                    Бот автоматически удалит рекламный пост
                  </p>
                </div>
                <Switch
                  checked={localSettings.auto_delete_posts || false}
                  onCheckedChange={(checked) => handleSettingChange('auto_delete_posts', checked)}
                />
              </div>
              {localSettings.auto_delete_posts && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  ⚠️ Пост будет удалён сразу после окончания срока размещения
                </p>
              )}
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateSettings.isPending}
              className="w-full"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
