import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/StatsCard";
import { 
  User, 
  Wallet, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Shield,
  Bell,
  CreditCard,
  Star
} from "lucide-react";

const Profile = () => {
  const menuItems = [
    { icon: Wallet, label: "Кошелёк", description: "$1,250.00", action: true },
    { icon: CreditCard, label: "Способы оплаты", action: true },
    { icon: Bell, label: "Уведомления", action: true },
    { icon: Shield, label: "Безопасность", action: true },
    { icon: Settings, label: "Настройки", action: true },
    { icon: HelpCircle, label: "Помощь", action: true },
  ];

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 text-center">
        <h1 className="text-2xl font-pacifico text-white">Профиль</h1>
      </header>

      {/* Main Content */}
      <main className="px-4 space-y-6">
        {/* User Card */}
        <div className="bg-card rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Пользователь</h2>
              <p className="text-sm text-muted-foreground">@username</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-warning fill-warning" />
                <span className="text-sm text-foreground">4.9</span>
                <span className="text-sm text-muted-foreground">• Проверен</span>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              Изменить
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            icon={<Wallet className="w-5 h-5" />}
            label="Баланс"
            value="$1,250"
          />
          <StatsCard
            icon={<Star className="w-5 h-5" />}
            label="Сделок"
            value="24"
            trend={15}
          />
        </div>

        {/* Menu */}
        <div className="bg-card rounded-2xl overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="w-full flex items-center gap-4 p-4 hover:bg-secondary transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  {item.description && (
                    <p className="text-sm text-primary">{item.description}</p>
                  )}
                </div>
                {item.action && (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <Button variant="destructive" className="w-full">
          <LogOut className="w-5 h-5" />
          Выйти
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
