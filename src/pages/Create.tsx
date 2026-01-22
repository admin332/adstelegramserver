import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Megaphone, Radio, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "advertiser" | "channel_owner" | null;

const Create = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

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

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 text-center">
        <h1 className="text-2xl font-bold text-white">Начать работу</h1>
        <p className="text-muted-foreground mt-1">Выберите свою роль на платформе</p>
      </header>

      {/* Role Selection */}
      <main className="px-4 space-y-4">
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
            disabled={!selectedRole}
          >
            Продолжить
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Info */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Вы сможете изменить роль в настройках профиля
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Create;
