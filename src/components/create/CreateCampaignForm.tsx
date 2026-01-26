import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ImagePlus, 
  Link as LinkIcon,
  Loader2,
  X,
  FileVideo,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CampaignData {
  name: string;
  text: string;
  button_text: string;
  button_url: string;
}

interface CreateCampaignFormProps {
  onBack: () => void;
  onComplete: () => void;
}

export const CreateCampaignForm = ({ onBack, onComplete }: CreateCampaignFormProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: "",
    text: "",
    button_text: "",
    button_url: "",
  });

  const progress = (step / 3) * 100;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "Файл слишком большой",
          description: "Максимальный размер файла — 50 МБ",
          variant: "destructive",
        });
        return;
      }
      setMediaFile(file);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!campaignData.name || !campaignData.text) {
      toast({
        title: "Заполните обязательные поля",
        description: "Укажите название и текст кампании",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Ошибка авторизации",
        description: "Пожалуйста, войдите через Telegram",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrl = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("campaign-images")
          .upload(fileName, mediaFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("campaign-images")
            .getPublicUrl(fileName);
          mediaUrl = publicUrl;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            user_id: user.id,
            name: campaignData.name,
            text: campaignData.text,
            button_text: campaignData.button_text || null,
            button_url: campaignData.button_url || null,
            image_url: mediaUrl,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка создания кампании");
      }

      toast({
        title: "Кампания создана!",
        description: "Теперь вы можете выбрать каналы для размещения",
      });
      
      onComplete();
    } catch (error) {
      console.error("Create campaign error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось создать кампанию",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = campaignData.name.trim().length > 0;
  const canSubmit = campaignData.text.trim().length > 0;

  const isVideoFile = mediaFile?.type.startsWith("video/");

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Шаг {step} из 3</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step 1: Campaign Name */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Название кампании</h2>
            <p className="text-muted-foreground text-sm">
              Укажите название для вашей рекламной кампании
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              placeholder="Например: Продвижение приложения"
              value={campaignData.name}
              onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
              className="bg-card border-0"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1 border-0 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button 
              onClick={() => setStep(2)} 
              className="flex-1"
              disabled={!canProceedStep1}
            >
              Продолжить
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Media Upload */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Медиа</h2>
            <p className="text-muted-foreground text-sm">
              Добавьте изображение или видео (опционально)
            </p>
          </div>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaSelect}
              className="hidden"
            />
            
            {mediaFile ? (
              <div className="bg-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {isVideoFile ? (
                      <FileVideo className="w-5 h-5 text-primary" />
                    ) : (
                      <ImagePlus className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {mediaFile.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(mediaFile.size / (1024 * 1024)).toFixed(2)} МБ
                    </span>
                  </div>
                </div>
                <button
                  onClick={removeMedia}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-secondary bg-card flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Добавить медиа</span>
                <span className="text-xs text-muted-foreground">Изображение или видео</span>
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-0 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1">
              Продолжить
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Ad Text and Button */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Текст рекламы</h2>
            <p className="text-muted-foreground text-sm">
              Напишите текст и добавьте кнопку
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text">Текст рекламы *</Label>
              <Textarea
                id="text"
                placeholder="Напишите текст вашего рекламного поста..."
                value={campaignData.text}
                onChange={(e) => setCampaignData({ ...campaignData, text: e.target.value })}
                className="bg-card border-0 min-h-[120px] resize-none"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Кнопка (опционально)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Текст кнопки"
                  value={campaignData.button_text}
                  onChange={(e) => setCampaignData({ ...campaignData, button_text: e.target.value })}
                  className="bg-card border-0"
                />
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="https://..."
                    value={campaignData.button_url}
                    onChange={(e) => setCampaignData({ ...campaignData, button_url: e.target.value })}
                    className="bg-card border-0 pl-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-0 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="flex-1"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать кампанию"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
