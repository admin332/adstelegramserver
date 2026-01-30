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
  ExternalLink,
  Loader2,
  Users,
  BadgeCheck,
  AlertCircle,
  Radio
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTonPrice } from "@/hooks/useTonPrice";
import { getTelegramInitData } from "@/lib/telegram";

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

export const AddChannelWizard = ({ onBack, onComplete }: AddChannelWizardProps) => {
  const { user } = useAuth();
  const { tonPrice } = useTonPrice();
  const [step, setStep] = useState(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifiedChannel, setVerifiedChannel] = useState<VerifiedChannel | null>(null);
  
  // Preview state
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

  // Debounce effect for channel preview
  useEffect(() => {
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
  }, [channelData.username]);

  const handleVerifyChannel = async () => {
    const cleanUsername = extractUsername(channelData.username);
    
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

      {/* Step 2: Channel Data */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Введите данные канала</h2>
            <p className="text-muted-foreground">
              Укажите информацию о вашем канале
            </p>
          </div>

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
                        type="number"
                        placeholder="0"
                        value={channelData.price_1_24}
                        onChange={(e) => setChannelData({ ...channelData, price_1_24: e.target.value })}
                        className="bg-card border-0"
                      />
                      {channelData.price_1_24 && tonPrice && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ≈ ${(parseFloat(channelData.price_1_24) * tonPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">2+/24</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={channelData.price_2_48}
                        onChange={(e) => setChannelData({ ...channelData, price_2_48: e.target.value })}
                        className="bg-card border-0"
                      />
                      {channelData.price_2_48 && tonPrice && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ≈ ${(parseFloat(channelData.price_2_48) * tonPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {verificationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-0 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button 
              onClick={handleVerifyChannel} 
              className="flex-1"
              disabled={isVerifying || !channelData.username || (!isExistingChannel && !channelData.category)}
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
                  Проверить канал
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
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
