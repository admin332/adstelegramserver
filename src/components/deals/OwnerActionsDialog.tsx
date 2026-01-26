import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from "lucide-react";

interface OwnerActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  campaignName?: string;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  isLoading?: boolean;
}

export const OwnerActionsDialog = ({
  open,
  onOpenChange,
  channelName,
  campaignName,
  onApprove,
  onReject,
  onRequestChanges,
  isLoading,
}: OwnerActionsDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Действия с заказом</AlertDialogTitle>
          <AlertDialogDescription>
            Канал: <span className="font-medium text-foreground">{channelName}</span>
            {campaignName && (
              <>
                <br />
                Кампания: <span className="font-medium text-foreground">{campaignName}</span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 py-4">
          <Button
            onClick={onApprove}
            disabled={isLoading}
            className="w-full justify-start gap-2"
            variant="default"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Одобрить публикацию
          </Button>

          <Button
            onClick={onRequestChanges}
            disabled={isLoading}
            className="w-full justify-start gap-2"
            variant="secondary"
          >
            <MessageSquare className="h-4 w-4" />
            Предложить изменения
          </Button>

          <Button
            onClick={onReject}
            disabled={isLoading}
            className="w-full justify-start gap-2"
            variant="destructive"
          >
            <XCircle className="h-4 w-4" />
            Отклонить с возвратом
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Отмена</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
