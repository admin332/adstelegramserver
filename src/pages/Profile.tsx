import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/StatsCard";
import { useAuth } from "@/contexts/AuthContext";
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
  Star,
  Crown,
  Loader2
} from "lucide-react";

const Profile = () => {
  const { user, isLoading, isAuthenticated, isTelegram, telegramUser, error, logout } = useAuth();

  const menuItems = [
    { icon: Wallet, label: "Кошелёк", description: "$1,250.00", action: true },
    { icon: CreditCard, label: "Способы оплаты", action: true },
    { icon: Bell, label: "Уведомления", action: true },
    { icon: Shield, label: "Безопасность", action: true },
    { icon: Settings, label: "Настройки", action: true },
    { icon: HelpCircle, label: "Помощь", action: true },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent safe-bottom flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-transparent safe-bottom">
        <header className="px-4 pt-4 pb-4 text-center">
          <h1 className="font-handwriting text-3xl md:text-4xl text-white">Профиль</h1>
        </header>
        
        <main className="px-4 space-y-6">
          <div className="bg-card rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Войдите в аккаунт</h2>
            <p className="text-sm text-muted-foreground">
              Откройте через Telegram Mini App или войдите через панель оператора
            </p>
          </div>
        </main>
        
        <BottomNav />
      </div>
    );
  }

  // Get display data from authenticated user or Telegram user
  const displayName = user?.first_name || telegramUser?.first_name || "Пользователь";
  const displayLastName = user?.last_name || telegramUser?.last_name;
  const displayUsername = user?.username || telegramUser?.username;
  const displayPhoto = user?.photo_url || telegramUser?.photo_url;
  const isPremium = user?.is_premium || telegramUser?.is_premium;

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="px-4 pt-4 pb-4 text-center">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white">Профиль</h1>
      </header>

      {/* Main Content */}
      <main className="px-4 space-y-6">
        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* User Card */}
        <div className="bg-card rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {displayPhoto ? (
              <img 
                src={displayPhoto} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {displayName} {displayLastName}
                </h2>
                {isPremium && (
                  <Crown className="w-5 h-5 text-warning fill-warning" />
                )}
              </div>
              {displayUsername && (
                <p className="text-sm text-muted-foreground">@{displayUsername}</p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-warning fill-warning" />
                <span className="text-sm text-foreground">4.9</span>
                {isAuthenticated && (
                  <span className="text-sm text-muted-foreground">• Проверен</span>
                )}
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
          {menuItems.map((item) => {
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
        <Button variant="destructive" className="w-full" onClick={logout}>
          <LogOut className="w-5 h-5" />
          Выйти
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
