import { FileText, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type CampaignType = "ready_post" | "prompt";

interface CampaignTypeSelectorProps {
  value: CampaignType;
  onChange: (type: CampaignType) => void;
}

export const CampaignTypeSelector = ({ value, onChange }: CampaignTypeSelectorProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Prompt option */}
        <button
          type="button"
          onClick={() => onChange("prompt")}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all",
            value === "prompt"
              ? "border-primary bg-primary/10"
              : "border-secondary bg-card hover:border-primary/50"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            value === "prompt" ? "bg-primary" : "bg-secondary"
          )}>
            <FileText className={cn(
              "w-6 h-6",
              value === "prompt" ? "text-primary-foreground" : "text-muted-foreground"
            )} />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground text-sm">Промт</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Автор напишет пост сам
            </p>
          </div>
        </button>

        {/* Ready post option */}
        <button
          type="button"
          onClick={() => onChange("ready_post")}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all",
            value === "ready_post"
              ? "border-primary bg-primary/10"
              : "border-secondary bg-card hover:border-primary/50"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            value === "ready_post" ? "bg-primary" : "bg-secondary"
          )}>
            <Package className={cn(
              "w-6 h-6",
              value === "ready_post" ? "text-primary-foreground" : "text-muted-foreground"
            )} />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground text-sm">Готовый пост</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Вы загружаете контент
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
