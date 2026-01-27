import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Edit3, Loader2, FileVideo } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getTelegramInitData } from "@/lib/telegram";

interface DraftReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  channelName: string;
  draftText: string;
  draftMediaUrls: string[];
  buttonText?: string;
  buttonUrl?: string;
  revisionCount: number;
  onSuccess: () => void;
}

const isVideoUrl = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export const DraftReviewDialog = ({
  open,
  onOpenChange,
  dealId,
  channelName,
  draftText,
  draftMediaUrls,
  buttonText,
  buttonUrl,
  revisionCount,
  onSuccess,
}: DraftReviewDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");

  const handleAction = async (action: "approve" | "request_revision") => {
    const initData = getTelegramInitData();
    if (!initData) {
      toast({
        title: "Ошибка авторизации",
        description: "Откройте приложение через Telegram",
        variant: "destructive",
      });
      return;
    }

    if (action === "request_revision" && !revisionComment.trim()) {
      toast({
        title: "Укажите комментарий",
        description: "Опишите, что нужно изменить в черновике",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            initData,
            dealId,
            action,
            revisionComment: action === "request_revision" ? revisionComment.trim() : undefined,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: action === "approve" ? "Черновик одобрен" : "Отправлено на доработку",
        description: action === "approve" 
          ? "Пост будет опубликован по расписанию" 
          : "Автор канала получит ваш комментарий",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Review draft error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось обработать запрос",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Проверьте черновик</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel info */}
          <div className="text-sm text-muted-foreground">
            Канал: <span className="text-foreground font-medium">{channelName}</span>
            {revisionCount > 0 && (
              <span className="ml-2 text-yellow-500">
                (доработка #{revisionCount})
              </span>
            )}
          </div>

          {/* Post preview */}
          <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
            {/* Media preview */}
            {draftMediaUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {draftMediaUrls.slice(0, 3).map((url, index) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden bg-secondary relative">
                    {isVideoUrl(url) ? (
                      <div className="w-full h-full flex items-center justify-center bg-card">
                        <FileVideo className="w-6 h-6 text-primary" />
                      </div>
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    {index === 2 && draftMediaUrls.length > 3 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">
                          +{draftMediaUrls.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Text */}
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {draftText}
            </div>

            {/* Button preview */}
            {buttonText && buttonUrl && (
              <div className="pt-2">
                <div className="inline-block bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-medium">
                  {buttonText}
                </div>
              </div>
            )}
          </div>

          {/* Revision input */}
          {showRevisionInput && (
            <div className="space-y-2">
              <Label htmlFor="revision">Комментарий для автора *</Label>
              <Textarea
                id="revision"
                placeholder="Опишите, что нужно изменить..."
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                className="min-h-[80px] resize-none bg-card border-0"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {showRevisionInput ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRevisionInput(false);
                    setRevisionComment("");
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button
                  onClick={() => handleAction("request_revision")}
                  disabled={isSubmitting || !revisionComment.trim()}
                  variant="secondary"
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4 mr-1.5" />
                      Отправить
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowRevisionInput(true)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  <Edit3 className="w-4 h-4 mr-1.5" />
                  На доработку
                </Button>
                <Button
                  onClick={() => handleAction("approve")}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Принять
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
