import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/StatsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAdvertiserStats } from "@/hooks/useAdvertiserStats";
import WalletSection from "@/components/profile/WalletSection";
import { 
  User, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Shield,
  Star,
  Crown,
  Loader2,
  Wallet
} from "lucide-react";

const Profile = () => {
  const { user, isLoading, isAuthenticated, isTelegram, telegramUser, error } = useAuth();
  const { testModeEnabled, isLoading: settingsLoading } = useAppSettings();
  const { stats: advertiserStats, isLoading: statsLoading } = useAdvertiserStats();

  // Демо-данные для тестового режима
  const demoUser = {
    first_name: "Тестовый",
    last_name: "Пользователь",
    username: "test_user",
    photo_url: null as string | null,
    is_premium: true,
  };
  
  const demoStats = {
    completedDeals: 12,
    totalTurnover: 150,
  };

  const menuItems = [
    { icon: Shield, label: "Безопасность" },
    { icon: Settings, label: "Настройки" },
    { icon: HelpCircle, label: "Помощь" },
  ];

  // Loading state
  if (isLoading || settingsLoading) {
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

  // Определяем, используем ли тестовый режим
  const isTestMode = !isTelegram && testModeEnabled;

  // Not in Telegram warning (только если тестовый режим выключен)
  if (!isTelegram && !testModeEnabled) {
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
            <h2 className="text-lg font-semibold text-foreground mb-2">Откройте в Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Для авторизации откройте приложение через Telegram Mini App
            </p>
          </div>
        </main>
        
        <BottomNav />
      </div>
    );
  }

  // Get display data - используем демо-данные в тестовом режиме
  const displayName = isTestMode ? demoUser.first_name : (user?.first_name || telegramUser?.first_name || "Пользователь");
  const displayLastName = isTestMode ? demoUser.last_name : (user?.last_name || telegramUser?.last_name);
  const displayUsername = isTestMode ? demoUser.username : (user?.username || telegramUser?.username);
  const displayPhoto = isTestMode ? demoUser.photo_url : (user?.photo_url || telegramUser?.photo_url);
  const isPremium = isTestMode ? demoUser.is_premium : (user?.is_premium || telegramUser?.is_premium);

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="px-4 pt-4 pb-4 text-center">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white">Профиль</h1>
      </header>

      {/* Main Content */}
      <main className="px-4 space-y-6">

        {/* Error message */}
        {error && !isTestMode && (
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
                <span className="text-sm text-foreground">
                  {statsLoading ? "..." : (advertiserStats?.avgRating ?? 0)}
                </span>
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

        {/* TON Wallet Section */}
        <WalletSection />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            icon={<Star className="w-5 h-5" />}
            label="Сделок"
            value={statsLoading ? "..." : String(isTestMode ? demoStats.completedDeals : (advertiserStats?.completedDeals ?? 0))}
          />
          <StatsCard
            icon={<Wallet className="w-5 h-5" />}
            label="Оборот"
            value={statsLoading ? "..." : `${isTestMode ? demoStats.totalTurnover : (advertiserStats?.totalTurnover ?? 0)} TON`}
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
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>

      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
