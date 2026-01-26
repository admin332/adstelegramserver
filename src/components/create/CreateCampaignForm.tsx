import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  ImagePlus, 
  Link as LinkIcon,
  Loader2,
  X
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: "",
    text: "",
    button_text: "",
    button_url: "",
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл слишком большой",
          description: "Максимальный размер изображения — 5 МБ",
          variant: "destructive",
        });
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
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
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("campaign-images")
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Continue without image if upload fails
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("campaign-images")
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      // Create campaign via edge function or direct insert
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
            image_url: imageUrl,
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

  const isValid = campaignData.name.trim() && campaignData.text.trim();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Создание рекламной кампании</h2>
        <p className="text-muted-foreground">
          Заполните данные для вашего рекламного поста
        </p>
      </div>

      <div className="space-y-4">
        {/* Image upload */}
        <div className="space-y-2">
          <Label>Изображение</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-full h-48 object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-secondary bg-card flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
            >
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Добавить изображение</span>
            </button>
          )}
        </div>

        {/* Campaign name */}
        <div className="space-y-2">
          <Label htmlFor="name">Название кампании *</Label>
          <Input
            id="name"
            placeholder="Например: Продвижение приложения"
            value={campaignData.name}
            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
            className="bg-card border-0"
          />
        </div>

        {/* Ad text */}
        <div className="space-y-2">
          <Label htmlFor="text">Текст рекламы *</Label>
          <Textarea
            id="text"
            placeholder="Напишите текст вашего рекламного поста..."
            value={campaignData.text}
            onChange={(e) => setCampaignData({ ...campaignData, text: e.target.value })}
            className="bg-card border-0 min-h-[120px] resize-none"
          />
        </div>

        {/* Button */}
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

      {/* Preview */}
      {(campaignData.text || imagePreview) && (
        <div className="space-y-2">
          <Label className="text-muted-foreground">Предпросмотр</Label>
          <div className="bg-card rounded-xl p-4 space-y-3">
            {imagePreview && (
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            {campaignData.text && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {campaignData.text}
              </p>
            )}
            {campaignData.button_text && campaignData.button_url && (
              <Button variant="outline" size="sm" className="w-full">
                <LinkIcon className="w-3 h-3 mr-2" />
                {campaignData.button_text}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <Button 
          onClick={handleSubmit} 
          className="flex-1"
          disabled={isSubmitting || !isValid}
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
  );
};
