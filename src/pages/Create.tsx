import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Megaphone, Radio, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddChannelWizard } from "@/components/create/AddChannelWizard";
import { CreateCampaignForm } from "@/components/create/CreateCampaignForm";
import { MyChannelsList } from "@/components/create/MyChannelsList";
import { MyCampaignsList } from "@/components/create/MyCampaignsList";
import { useUserChannels } from "@/hooks/useUserChannels";
import { useUserCampaigns } from "@/hooks/useUserCampaigns";
import { useAuth } from "@/contexts/AuthContext";

type UserRole = "advertiser" | "channel_owner" | null;
type Step = "role" | "list" | "form";

const Create = () => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [currentStep, setCurrentStep] = useState<Step>("role");
  
  const { data: channels, isLoading: channelsLoading, refetch: refetchChannels } = useUserChannels();
  const { data: campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useUserCampaigns();

  const roles = [
    {
      id: "advertiser" as const,
      title: "Рекламодатель",
      description: "Создайте рекламную кампанию и найдите каналы для размещения",
      icon: Megaphone,
      features: ["Создание кампаний", "Выбор каналов", "Эскроу-оплата", "Аналитика"],
    },
    {
      id: "channel_owner" as const,
      title: "Владелец канала",
      description: "Добавьте свой канал и получайте предложения от рекламодателей",
      icon: Radio,
      features: ["Листинг канала", "Получение заявок", "Автопубликация", "Статистика"],
    },
  ];

  const handleContinue = () => {
    if (selectedRole === "channel_owner") {
      // Если есть каналы — показываем список, иначе — форму
      if (channels && channels.length > 0) {
        setCurrentStep("list");
      } else {
        setCurrentStep("form");
      }
    } else if (selectedRole === "advertiser") {
      // Если есть кампании — показываем список, иначе — форму
      if (campaigns && campaigns.length > 0) {
        setCurrentStep("list");
      } else {
        setCurrentStep("form");
      }
    }
  };

  const handleBack = () => {
    if (currentStep === "form") {
      // Из формы возвращаемся в список если есть данные, иначе — к выбору роли
      if (selectedRole === "channel_owner" && channels && channels.length > 0) {
        setCurrentStep("list");
      } else if (selectedRole === "advertiser" && campaigns && campaigns.length > 0) {
        setCurrentStep("list");
      } else {
        setCurrentStep("role");
      }
    } else if (currentStep === "list") {
      setCurrentStep("role");
    }
  };

  const handleComplete = async () => {
    // После успешного создания — обновляем данные и показываем список
    if (selectedRole === "channel_owner") {
      await refetchChannels();
    } else {
      await refetchCampaigns();
    }
    setCurrentStep("list");
  };

  const handleAddNew = () => {
    setCurrentStep("form");
  };

  const isLoading = (selectedRole === "channel_owner" && channelsLoading) || 
                    (selectedRole === "advertiser" && campaignsLoading);

  const getHeaderTitle = () => {
    if (currentStep === "role") {
      return "Начать";
    }
    if (selectedRole === "channel_owner") {
      return currentStep === "list" ? "Мои каналы" : "Добавить";
    }
    return currentStep === "list" ? "Кампании" : "Кампания";
  };

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="px-4 pt-4 pb-4 text-center">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white">{getHeaderTitle()}</h1>
        {currentStep === "role" && (
          <p className="text-muted-foreground mt-1">Выберите свою роль на платформе</p>
        )}
      </header>

      <main className="px-4 space-y-4 pb-24">
        {currentStep === "role" && (
          <>
            {/* Role Selection */}
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;

              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "w-full text-left p-5 rounded-2xl transition-all duration-200",
                    isSelected
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-card hover:bg-secondary"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        isSelected ? "bg-primary" : "bg-secondary"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-6 h-6",
                          isSelected ? "text-primary-foreground" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{role.title}</h3>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {role.features.map((feature) => (
                          <span
                            key={feature}
                            className="text-2xs font-medium px-2 py-1 rounded-full bg-secondary text-muted-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Continue Button */}
            <div className="pt-4">
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedRole || isLoading}
                onClick={handleContinue}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    Продолжить
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>

            {/* Info */}
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Вы сможете изменить роль в настройках профиля
              </p>
            </div>
          </>
        )}

        {currentStep === "list" && selectedRole === "channel_owner" && (
          <MyChannelsList onAddChannel={handleAddNew} onBack={handleBack} />
        )}

        {currentStep === "list" && selectedRole === "advertiser" && (
          <MyCampaignsList onAddCampaign={handleAddNew} onBack={handleBack} />
        )}

        {currentStep === "form" && selectedRole === "channel_owner" && (
          <AddChannelWizard onBack={handleBack} onComplete={handleComplete} />
        )}

        {currentStep === "form" && selectedRole === "advertiser" && (
          <CreateCampaignForm onBack={handleBack} onComplete={handleComplete} />
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Create;
