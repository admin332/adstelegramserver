import React from 'react';
import { motion } from 'framer-motion';
import { Plus, ExternalLink, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Campaign {
  id: string;
  name: string;
  imageUrl: string;
  text: string;
  buttonText: string;
  buttonUrl: string;
}

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaigns: string[];
  requiredCount: number;
  onSelectionChange: (ids: string[]) => void;
  onCreateNew: () => void;
  acceptedCampaignTypes?: string;
}

const CampaignSelector: React.FC<CampaignSelectorProps> = ({
  campaigns,
  selectedCampaigns,
  requiredCount,
  onSelectionChange,
  onCreateNew,
  acceptedCampaignTypes = 'both',
}) => {
  const getAcceptedTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'prompt':
        return 'промпт (нативная реклама)';
      case 'ready_post':
        return 'готовый пост';
      default:
        return null;
    }
  };
  const handleToggleCampaign = (campaignId: string) => {
    if (selectedCampaigns.includes(campaignId)) {
      onSelectionChange(selectedCampaigns.filter((id) => id !== campaignId));
    } else {
      if (requiredCount === 1) {
        onSelectionChange([campaignId]);
      } else if (selectedCampaigns.length < requiredCount) {
        onSelectionChange([...selectedCampaigns, campaignId]);
      }
    }
  };

  const isSelected = (campaignId: string) => selectedCampaigns.includes(campaignId);

  return (
    <div className="space-y-4">
      {/* Selection Info */}
      {requiredCount > 1 && (
        <p className="text-sm text-muted-foreground text-center">
          Выбрано {selectedCampaigns.length} из {requiredCount} кампаний
        </p>
      )}

      {/* Info about accepted types */}
      {acceptedCampaignTypes && acceptedCampaignTypes !== 'both' && campaigns.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-sm text-muted-foreground">
            Канал принимает только: <span className="font-medium text-primary">{getAcceptedTypeLabel(acceptedCampaignTypes)}</span>
          </p>
        </div>
      )}

      {/* Empty State - с учётом требований канала */}
      {campaigns.length === 0 && (
        <div className="text-center py-8">
          {acceptedCampaignTypes && acceptedCampaignTypes !== 'both' ? (
            <>
              <p className="text-muted-foreground">
                Нет подходящих кампаний
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Этот канал принимает только кампании типа: <br />
                <span className="font-medium text-primary">
                  {getAcceptedTypeLabel(acceptedCampaignTypes)}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">У вас пока нет кампаний</p>
              <p className="text-sm text-muted-foreground mt-1">Создайте первую кампанию</p>
            </>
          )}
        </div>
      )}

      {/* Campaign List */}
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <motion.div
            key={campaign.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleToggleCampaign(campaign.id)}
            className={cn(
              "relative bg-secondary/50 rounded-2xl p-4 cursor-pointer transition-all",
              isSelected(campaign.id) && "ring-2 ring-primary"
            )}
          >
            {/* Selection Indicator */}
            <div
              className={cn(
                "absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center transition-colors",
                isSelected(campaign.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary border-2 border-muted-foreground/30"
              )}
            >
              {isSelected(campaign.id) && <Check className="h-4 w-4" />}
            </div>

            {/* Campaign Preview */}
            <div className="flex gap-3">
              {/* Image */}
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                <img
                  src={campaign.imageUrl}
                  alt={campaign.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                <h4 className="font-semibold text-foreground truncate">
                  {campaign.name}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {campaign.text}
                </p>
              </div>
            </div>

            {/* Button Preview */}
            <div className="mt-3 flex items-center gap-2 text-sm text-primary">
              <ExternalLink className="h-4 w-4" />
              <span>{campaign.buttonText}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create New Campaign Button */}
      <Button
        variant="outline"
        onClick={onCreateNew}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
      >
        <Plus className="h-5 w-5 mr-2" />
        Создать новую кампанию
      </Button>
    </div>
  );
};

export default CampaignSelector;
