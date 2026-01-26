import { useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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

interface AddChannelWizardProps {
  onBack: () => void;
  onComplete: () => void;
}

export const AddChannelWizard = ({ onBack, onComplete }: AddChannelWizardProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifiedChannel, setVerifiedChannel] = useState<VerifiedChannel | null>(null);
  
  const [channelData, setChannelData] = useState<ChannelData>({
    username: "",
    category: "",
    price_1_24: "",
    price_2_48: "",
    price_post: "",
  });

  const progress = (step / 3) * 100;

  const handleVerifyChannel = async () => {
    if (!channelData.username || !channelData.category) {
      toast({
        title: "Заполните все поля",
        description: "Укажите username канала и категорию",
        variant: "destructive",
      });
      return;
    }

    if (!user?.telegram_id) {
      toast({
        title: "Ошибка авторизации",
        description: "Пожалуйста, войдите через Telegram",
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
            username: channelData.username.replace("@", ""),
            telegram_user_id: user.telegram_id,
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
                <span>Добавьте <span className="text-primary font-medium">@adsingo_bot</span> как администратора</span>
              </li>
            </ol>
          </div>

          <a
            href="https://t.me/adsingo_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-foreground"
          >
            <span>Открыть @adsingo_bot</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1 border-primary text-primary hover:bg-primary/10">
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
              <Label htmlFor="username">Username канала</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="username"
                  placeholder="your_channel"
                  value={channelData.username}
                  onChange={(e) => setChannelData({ ...channelData, username: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <Label>Стоимость размещения (TON за пост)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">1/24</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={channelData.price_1_24}
                    onChange={(e) => setChannelData({ ...channelData, price_1_24: e.target.value })}
                    className="bg-card border-0"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">2+/24</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={channelData.price_2_48}
                    onChange={(e) => setChannelData({ ...channelData, price_2_48: e.target.value })}
                    className="bg-card border-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {verificationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-primary text-primary hover:bg-primary/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button 
              onClick={handleVerifyChannel} 
              className="flex-1"
              disabled={isVerifying || !channelData.username || !channelData.category}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Проверка...
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
              "Вы подтверждены как владелец",
              "Статистика загружена",
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Button onClick={onComplete} className="w-full" size="lg">
            Перейти к моим каналам
          </Button>
        </div>
      )}
    </div>
  );
};
