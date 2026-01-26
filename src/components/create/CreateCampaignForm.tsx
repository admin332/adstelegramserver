import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  Plus
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

const MAX_MEDIA_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 МБ

export const CreateCampaignForm = ({ onBack, onComplete }: CreateCampaignFormProps) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: "",
    text: "",
    button_text: "",
    button_url: "",
  });

  const progress = (step / 3) * 100;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Проверка количества
    const remainingSlots = MAX_MEDIA_FILES - mediaFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    // Проверка размера каждого файла
    const validFiles = filesToAdd.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Файл слишком большой",
          description: `${file.name} превышает лимит 50 МБ`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    
    setMediaFiles(prev => [...prev, ...validFiles]);
    
    // Сбрасываем input для повторного выбора тех же файлов
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
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
      const mediaUrls: string[] = [];

      // Загружаем все файлы
      for (const file of mediaFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("campaign-images")
          .upload(fileName, file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("campaign-images")
            .getPublicUrl(fileName);
          mediaUrls.push(publicUrl);
        } else {
          console.error("Upload error:", uploadError);
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
            media_urls: mediaUrls,
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
      
      // Если есть returnTo параметр — вернуться на страницу канала
      const returnTo = searchParams.get('returnTo');
      if (returnTo) {
        navigate(returnTo);
      } else {
        onComplete();
      }
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
              Добавьте до {MAX_MEDIA_FILES} фото или видео (опционально)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleMediaSelect}
            className="hidden"
          />

          {/* Сетка превью */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
                  {file.type.startsWith('video/') ? (
                    <div className="w-full h-full flex items-center justify-center bg-card">
                      <FileVideo className="w-8 h-8 text-primary" />
                    </div>
                  ) : (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {/* Кнопка удаления */}
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  {/* Размер файла */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-xs text-white">
                    {(file.size / (1024 * 1024)).toFixed(1)} МБ
                  </div>
                </div>
              ))}
              
              {/* Кнопка добавления (если меньше 10 файлов) */}
              {mediaFiles.length < MAX_MEDIA_FILES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-secondary bg-card flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors"
                >
                  <Plus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {mediaFiles.length}/{MAX_MEDIA_FILES}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Пустое состояние */}
          {mediaFiles.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-secondary bg-card flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Добавить медиа</span>
              <span className="text-xs text-muted-foreground">До {MAX_MEDIA_FILES} фото или видео</span>
            </button>
          )}

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
