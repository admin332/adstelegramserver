import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { channelCategories } from "@/data/channelCategories";
import { 
  ArrowLeft, 
  ArrowRight, 
  Bot, 
  CheckCircle2, 
  Loader2,
  Users,
  BadgeCheck,
  AlertCircle,
  Radio,
  Sparkles,
  Eye,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTonPrice } from "@/hooks/useTonPrice";
import { getTelegramInitData } from "@/lib/telegram";

// Price validation: only integers 1-100000
const validatePriceInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  const num = parseInt(cleaned, 10);
  if (num > 100000) return '100000';
  return cleaned;
};

interface ChannelData {
  username: string;
  category: string;
  price_1_24: string;
  price_2_48: string;
  price_post: string;
}

interface VerifiedChannel {
  id: string;
  title: string;
  username: string;
  description: string;
  avatar_url: string;
  subscribers_count: number;
}

interface DetectedChannel {
  telegram_chat_id: number;
  title: string;
  username: string | null;
  avatar_url: string | null;
  subscribers_count: number;
  avg_views: number;
  engagement: number;
  recommended_price_24: number;
  recommended_price_48: number;
  has_analytics_admin: boolean;
}

interface ChannelPreview {
  avatar_url: string | null;
  title: string | null;
}

interface AddChannelWizardProps {
  onBack: () => void;
  onComplete: () => void;
}

// Extract username from URL or @username format
const extractUsername = (input: string): string => {
  const trimmed = input.trim();
  
  // Pattern for Telegram links: https://t.me/channel, t.me/channel, telegram.me/channel
  const urlPattern = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i;
  const match = trimmed.match(urlPattern);
  
  if (match) {
    return match[1];
  }
  
  // Remove @ if present
  return trimmed.replace(/^@/, '');
};

// Recommended price badge component
const RecommendedPriceBadge = ({ price, avgViews }: { price: number; avgViews: number }) => (
  <div className="bg-green-500/10 text-green-500 rounded-lg p-3">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4" />
      <span>Рекомендуемая цена: <b>{price} TON</b></span>
    </div>
    {avgViews > 0 && (
      <p className="text-xs text-muted-foreground mt-1">
        На основе {avgViews.toLocaleString()} просмотров/пост
      </p>
    )}
  </div>
);

export const AddChannelWizard = ({ onBack, onComplete }: AddChannelWizardProps) => {
  const { user } = useAuth();
  const { tonPrice } = useTonPrice();
  const [step, setStep] = useState(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifiedChannel, setVerifiedChannel] = useState<VerifiedChannel | null>(null);
  
  // Auto-detection state
  const [isSearching, setIsSearching] = useState(false);
  const [detectedChannels, setDetectedChannels] = useState<DetectedChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<DetectedChannel | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [useManualInput, setUseManualInput] = useState(false);
  
  // Preview state (for manual input)
  const [channelPreview, setChannelPreview] = useState<ChannelPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExistingChannel, setIsExistingChannel] = useState(false);
  
  const [channelData, setChannelData] = useState<ChannelData>({
    username: "",
    category: "",
    price_1_24: "",
    price_2_48: "",
    price_post: "",
  });

  const progress = (step / 3) * 100;

  // Auto-detect channels when entering step 2
  useEffect(() => {
    if (step === 2 && !useManualInput) {
      detectChannels();
    }
  }, [step]);

  const detectChannels = async () => {
    const initData = getTelegramInitData();
    if (!initData) {
      setSearchError("Откройте приложение через Telegram");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setDetectedChannels([]);
    setSelectedChannel(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-bot-channels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ initData }),
        }
      );

      const data = await response.json();

      if (data.channels && data.channels.length > 0) {
        setDetectedChannels(data.channels);
        setSelectedChannel(data.channels[0]);
        
        // Pre-fill price fields with recommended values
        const channel = data.channels[0];
        setChannelData(prev => ({
          ...prev,
          username: channel.username || "",
          price_1_24: channel.recommended_price_24?.toString() || "",
          price_2_48: channel.recommended_price_48?.toString() || "",
        }));
      } else {
        // No channels found - switch to manual input
        setUseManualInput(true);
      }
    } catch (error) {
      console.error("Error detecting channels:", error);
      setSearchError("Не удалось найти каналы. Попробуйте ввести вручную.");
      setUseManualInput(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce effect for channel preview (manual input mode)
  useEffect(() => {
    if (!useManualInput) return;
    
    const username = extractUsername(channelData.username);
    if (!username || username.length < 3) {
      setChannelPreview(null);
      setIsLoadingPreview(false);
      setIsExistingChannel(false);
      return;
    }
    
    setIsLoadingPreview(true);
    
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-channel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ username }),
          }
        );
        const data = await response.json();
        
        if (data.success) {
          setChannelPreview({
            avatar_url: data.avatar_url,
            title: data.title,
          });
          setIsExistingChannel(data.exists || false);
        } else {
          setChannelPreview(null);
          setIsExistingChannel(false);
        }
      } catch {
        setChannelPreview(null);
        setIsExistingChannel(false);
      } finally {
        setIsLoadingPreview(false);
      }
    }, 1500);
    
    return () => clearTimeout(timeoutId);
  }, [channelData.username, useManualInput]);

  const handleSelectChannel = (channel: DetectedChannel) => {
    setSelectedChannel(channel);
    setChannelData(prev => ({
      ...prev,
      username: channel.username || "",
      price_1_24: channel.recommended_price_24?.toString() || "",
      price_2_48: channel.recommended_price_48?.toString() || "",
    }));
  };

  const handleVerifyChannel = async () => {
    const cleanUsername = selectedChannel?.username || extractUsername(channelData.username);
    
    if (!cleanUsername) {
      toast({
        title: "Укажите канал",
        description: "Введите username канала",
        variant: "destructive",
      });
      return;
    }

    // Require category only for new channels
    if (!isExistingChannel && !channelData.category) {
      toast({
        title: "Выберите категорию",
        description: "Категория обязательна для нового канала",
        variant: "destructive",
      });
      return;
    }

    // Get initData for secure authentication
    const initData = getTelegramInitData();
    if (!initData) {
      toast({
        title: "Ошибка авторизации",
        description: "Пожалуйста, откройте приложение через Telegram",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-channel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            username: cleanUsername,
            initData, // Secure: send initData instead of telegram_user_id
            category: channelData.category,
            price_1_24: channelData.price_1_24 ? parseFloat(channelData.price_1_24) : null,
            price_2_48: channelData.price_2_48 ? parseFloat(channelData.price_2_48) : null,
            price_post: channelData.price_post ? parseFloat(channelData.price_post) : null,
            // Pass detected stats if available
            avg_views: selectedChannel?.avg_views || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка верификации");
      }

      if (result.success) {
        setVerifiedChannel(result.channel);
        
        // Show appropriate message based on result type
        if (result.isNewAdmin) {
          toast({
            title: `Вы добавлены как ${result.role === 'owner' ? 'владелец' : 'менеджер'}`,
            description: "Теперь вы можете управлять этим каналом",
          });
        } else if (result.isExistingAdmin) {
          toast({
            title: "Вы уже управляете этим каналом",
            description: `Ваша роль: ${result.role === 'owner' ? 'владелец' : 'менеджер'}`,
          });
        }
        
        setStep(3);
      } else {
        setVerificationError(result.error || "Не удалось верифицировать канал");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationError(
        error instanceof Error ? error.message : "Произошла ошибка при верификации"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSwitchToManual = () => {
    setUseManualInput(true);
    setSelectedChannel(null);
    setChannelData(prev => ({
      ...prev,
      username: "",
      price_1_24: "",
      price_2_48: "",
    }));
  };

  const handleRetrySearch = () => {
    setUseManualInput(false);
    detectChannels();
  };

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Шаг {step} из 3</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step 1: Instructions */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Добавьте бота в канал</h2>
            <p className="text-muted-foreground">
              Для верификации и автопостинга необходимо добавить нашего бота
            </p>
          </div>

          <div className="bg-card rounded-2xl p-4 space-y-4">
            <h3 className="font-medium text-foreground">Инструкция:</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</span>
                <span>Откройте настройки вашего канала в Telegram</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</span>
                <span>Перейдите в раздел «Администраторы»</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</span>
                <span>Добавьте <a href="https://t.me/adsingo_bot" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">@adsingo_bot</a> как администратора</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">4</span>
                <span>Добавьте <a href="https://t.me/kjeuz" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">@kjeuz</a> как администратора (для детальной аналитики)</span>
              </li>
            </ol>
          </div>


          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1 border-0 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button onClick={() => setStep(2)} className="flex-1">
              Готово, далее
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Channel Detection / Data */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Searching state */}
          {isSearching && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Ищем ваши каналы...</h2>
                <p className="text-muted-foreground mt-1">
                  Проверяем, где вы и бот являетесь администраторами
                </p>
              </div>
            </div>
          )}

          {/* Detected channel(s) */}
          {!isSearching && !useManualInput && selectedChannel && (
            <>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Канал найден!</h2>
                <p className="text-muted-foreground">
                  Подтвердите данные и установите цены
                </p>
              </div>

              {/* Channel card */}
              <div className="bg-card rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden">
                    {selectedChannel.avatar_url ? (
                      <img 
                        src={selectedChannel.avatar_url} 
                        alt={selectedChannel.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">
                        {selectedChannel.title?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{selectedChannel.title}</h3>
                    {selectedChannel.username && (
                      <p className="text-sm text-muted-foreground">@{selectedChannel.username}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{selectedChannel.subscribers_count?.toLocaleString()}</span>
                      </div>
                      {selectedChannel.avg_views > 0 && (
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{selectedChannel.avg_views?.toLocaleString()} / пост</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning if @kjeuz not added */}
              {!selectedChannel.has_analytics_admin && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-500 font-medium">
                        Добавьте @kjeuz для аналитики
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Для получения детальной статистики канала (просмотры по часам, рост аудитории) 
                        добавьте{" "}
                        <a 
                          href="https://t.me/kjeuz" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          @kjeuz
                        </a>
                        {" "}как администратора
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended price badge */}
              {selectedChannel.avg_views > 0 && (
                <RecommendedPriceBadge 
                  price={selectedChannel.recommended_price_24} 
                  avgViews={selectedChannel.avg_views} 
                />
              )}

              {/* Multiple channels selector */}
              {detectedChannels.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Выберите канал:</Label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {detectedChannels.map((channel) => (
                      <button
                        key={channel.telegram_chat_id}
                        onClick={() => handleSelectChannel(channel)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedChannel?.telegram_chat_id === channel.telegram_chat_id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {channel.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category selector */}
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={channelData.category}
                  onValueChange={(value) => setChannelData({ ...channelData, category: value })}
                >
                  <SelectTrigger className="bg-card border-0">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent className="z-[60] bg-card border-0">
                    {channelCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Prices */}
              <div className="space-y-2">
                <Label>Стоимость размещения (TON за пост)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      1/24 {selectedChannel.recommended_price_24 > 0 && `(рек: ${selectedChannel.recommended_price_24})`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={selectedChannel.recommended_price_24?.toString() || "1-100000"}
                        value={channelData.price_1_24}
                        onChange={(e) => setChannelData({ ...channelData, price_1_24: validatePriceInput(e.target.value) })}
                        className="bg-card border-0"
                      />
                      {channelData.price_1_24 && tonPrice && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ≈ ${(parseInt(channelData.price_1_24, 10) * tonPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      2+/24 {selectedChannel.recommended_price_48 > 0 && `(рек: ${selectedChannel.recommended_price_48})`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={selectedChannel.recommended_price_48?.toString() || "1-100000"}
                        value={channelData.price_2_48}
                        onChange={(e) => setChannelData({ ...channelData, price_2_48: validatePriceInput(e.target.value) })}
                        className="bg-card border-0"
                      />
                      {channelData.price_2_48 && tonPrice && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ≈ ${(parseInt(channelData.price_2_48, 10) * tonPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Switch to manual */}
              <button 
                onClick={handleSwitchToManual}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Ввести другой канал вручную
              </button>
            </>
          )}

          {/* Manual input mode */}
          {!isSearching && useManualInput && (
            <>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Введите данные канала</h2>
                <p className="text-muted-foreground">
                  Укажите информацию о вашем канале
                </p>
              </div>

              {searchError && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 text-yellow-500 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                  <button onClick={handleRetrySearch} className="p-1 hover:bg-yellow-500/20 rounded">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username или ссылка на канал</Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      id="username"
                      placeholder="@channel или https://t.me/channel"
                      value={channelData.username}
                      onChange={(e) => setChannelData({ ...channelData, username: e.target.value })}
                      className="flex-1"
                    />
                    {/* Channel preview avatar */}
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                      {isLoadingPreview ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : channelPreview?.avatar_url ? (
                        <img 
                          src={channelPreview.avatar_url} 
                          alt="Channel" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Radio className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {channelPreview?.title && (
                    <p className="text-sm text-muted-foreground">{channelPreview.title}</p>
                  )}
                </div>

                {/* Category - hide if channel exists */}
                {!isExistingChannel && (
                  <div className="space-y-2">
                    <Label>Категория</Label>
                    <Select
                      value={channelData.category}
                      onValueChange={(value) => setChannelData({ ...channelData, category: value })}
                    >
                      <SelectTrigger className="bg-card border-0">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent className="z-[60] bg-card border-0">
                        {channelCategories.map((category) => {
                          const Icon = category.icon;
                          return (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Price - hide if channel exists */}
                {!isExistingChannel && (
                  <div className="space-y-2">
                    <Label>Стоимость размещения (TON за пост)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">1/24</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1-100000"
                            value={channelData.price_1_24}
                            onChange={(e) => setChannelData({ ...channelData, price_1_24: validatePriceInput(e.target.value) })}
                            className="bg-card border-0"
                          />
                          {channelData.price_1_24 && tonPrice && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ≈ ${(parseInt(channelData.price_1_24, 10) * tonPrice).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">2+/24</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1-100000"
                            value={channelData.price_2_48}
                            onChange={(e) => setChannelData({ ...channelData, price_2_48: validatePriceInput(e.target.value) })}
                            className="bg-card border-0"
                          />
                          {channelData.price_2_48 && tonPrice && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ≈ ${(parseInt(channelData.price_2_48, 10) * tonPrice).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {verificationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}

          {!isSearching && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-0 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <Button 
                onClick={handleVerifyChannel} 
                className="flex-1"
                disabled={isVerifying || (!selectedChannel && !channelData.username) || (!isExistingChannel && !channelData.category)}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Проверка...
                  </>
                ) : isExistingChannel ? (
                  <>
                    Я менеджер
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Добавить канал
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && verifiedChannel && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Канал успешно добавлен!</h2>
            <p className="text-muted-foreground">
              Ваш канал теперь доступен для рекламодателей
            </p>
          </div>

          {/* Channel preview */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden">
                {verifiedChannel.avatar_url ? (
                  <img 
                    src={verifiedChannel.avatar_url} 
                    alt={verifiedChannel.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {verifiedChannel.title?.charAt(0) || "?"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{verifiedChannel.title}</h3>
                  <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground">@{verifiedChannel.username}</p>
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{verifiedChannel.subscribers_count?.toLocaleString()} подписчиков</span>
                </div>
              </div>
            </div>
          </div>

          {/* Success checklist */}
          <div className="space-y-2">
          {[
              "Бот добавлен как администратор",
              "Вы подтверждены как администратор",
              "Статистика загружена",
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Button onClick={onComplete} className="w-full">
            Готово
          </Button>
        </div>
      )}
    </div>
  );
};
