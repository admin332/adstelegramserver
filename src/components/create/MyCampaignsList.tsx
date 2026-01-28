import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ImageIcon, ArrowLeft, FileVideo } from "lucide-react";
import {
  useUserCampaigns,
  useDeleteCampaign,
} from "@/hooks/useUserCampaigns";

interface MyCampaignsListProps {
  onAddCampaign: () => void;
  onBack: () => void;
}

const isVideoUrl = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export const MyCampaignsList = ({ onAddCampaign, onBack }: MyCampaignsListProps) => {
  const { data: campaigns, isLoading } = useUserCampaigns();
  const deleteCampaign = useDeleteCampaign();

  const handleDelete = (campaignId: string) => {
    deleteCampaign.mutate(campaignId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Мои кампании</h2>
        <span className="text-sm text-muted-foreground">{campaigns?.length || 0} кампаний</span>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-card rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                {(() => {
                  const mediaUrls = campaign.media_urls as string[] | null;
                  const firstMedia = mediaUrls?.[0] || campaign.image_url;
                  const mediaCount = mediaUrls?.length || (campaign.image_url ? 1 : 0);
                  const isVideo = firstMedia ? isVideoUrl(firstMedia) : false;

                  return (
                    <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                      {firstMedia ? (
                        isVideo ? (
                          <div className="w-full h-full flex items-center justify-center bg-card">
                            <FileVideo className="w-6 h-6 text-primary" />
                          </div>
                        ) : (
                          <img
                            src={firstMedia}
                            alt={campaign.name}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                      {mediaCount > 1 && (
                        <div className="absolute bottom-0.5 right-0.5 min-w-5 h-5 rounded-full bg-primary flex items-center justify-center px-1">
                          <span className="text-xs font-medium text-primary-foreground">{mediaCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {campaign.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {campaign.text}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-secondary">
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {campaign.campaign_type === 'prompt' ? 'Промпт' : 'Готовый пост'}
                </span>
                {campaign.button_text && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                    Кнопка: {campaign.button_text}
                  </span>
                )}
                <div className="flex-1" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить кампанию?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие нельзя отменить. Кампания «{campaign.name}» будет
                        удалена навсегда.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(campaign.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>У вас пока нет кампаний</p>
        </div>
      )}

      <Button onClick={onAddCampaign} className="w-full" size="lg">
        <Plus className="w-5 h-5 mr-2" />
        Создать кампанию
      </Button>

      <Button
        variant="outline"
        onClick={onBack}
        className="w-full border-0 text-white hover:bg-white/10"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>
    </div>
  );
};
