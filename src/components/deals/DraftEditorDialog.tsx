import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, X, FileVideo, Plus, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getTelegramInitData } from "@/lib/telegram";

const MAX_MEDIA_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface DraftEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  briefText: string;
  channelName: string;
  existingDraft?: string;
  existingMedia?: string[];
  onSuccess: () => void;
}

export const DraftEditorDialog = ({
  open,
  onOpenChange,
  dealId,
  briefText,
  channelName,
  existingDraft,
  existingMedia,
  onSuccess,
}: DraftEditorDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftText, setDraftText] = useState(existingDraft || "");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>(existingMedia || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalMedia = mediaFiles.length + existingMediaUrls.length;
    const remainingSlots = MAX_MEDIA_FILES - totalMedia;
    const filesToAdd = files.slice(0, remainingSlots);

    const validFiles = filesToAdd.filter((file) => {
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

    setMediaFiles((prev) => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeNewMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = (index: number) => {
    setExistingMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!draftText.trim()) {
      toast({
        title: "Введите текст",
        description: "Напишите текст поста для рекламодателя",
        variant: "destructive",
      });
      return;
    }

    const initData = getTelegramInitData();
    if (!initData) {
      toast({
        title: "Ошибка авторизации",
        description: "Откройте приложение через Telegram",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload new media files
      const uploadedUrls: string[] = [];
      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("initData", initData);

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-campaign-media`,
          {
            method: "POST",
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: formData,
          }
        );

        const uploadResult = await uploadResponse.json();
        if (uploadResult.success && uploadResult.url) {
          uploadedUrls.push(uploadResult.url);
        }
      }

      // Combine existing and new media
      const allMediaUrls = [...existingMediaUrls, ...uploadedUrls];

      // Submit draft
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            initData,
            dealId,
            draftText: draftText.trim(),
            draftMediaUrls: allMediaUrls,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "Черновик отправлен",
        description: "Рекламодатель получит уведомление для проверки",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Submit draft error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить черновик",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalMediaCount = mediaFiles.length + existingMediaUrls.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Напишите пост</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Brief from advertiser */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">📋 Бриф от рекламодателя:</Label>
            <div className="bg-secondary/50 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap">
              {briefText}
            </div>
          </div>

          {/* Media upload */}
          <div className="space-y-2">
            <Label>🖼️ Медиа (до {MAX_MEDIA_FILES} файлов)</Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaSelect}
              className="hidden"
            />

            {(totalMediaCount > 0) && (
              <div className="grid grid-cols-4 gap-2">
                {/* Existing media */}
                {existingMediaUrls.map((url, index) => (
                  <div key={`existing-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                
                {/* New media */}
                {mediaFiles.map((file, index) => (
                  <div key={`new-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                    {file.type.startsWith("video/") ? (
                      <div className="w-full h-full flex items-center justify-center bg-card">
                        <FileVideo className="w-6 h-6 text-primary" />
                      </div>
                    ) : (
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeNewMedia(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}

                {/* Add button */}
                {totalMediaCount < MAX_MEDIA_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-secondary bg-card flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{totalMediaCount}/{MAX_MEDIA_FILES}</span>
                  </button>
                )}
              </div>
            )}

            {totalMediaCount === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 rounded-xl border-2 border-dashed border-secondary bg-card flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Добавить медиа</span>
              </button>
            )}
          </div>

          {/* Draft text */}
          <div className="space-y-2">
            <Label htmlFor="draft">📝 Текст поста *</Label>
            <Textarea
              id="draft"
              placeholder="Напишите текст, который увидит аудитория канала..."
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="min-h-[120px] resize-none bg-card border-0"
            />
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !draftText.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Отправить на проверку
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
