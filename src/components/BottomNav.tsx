import { Home, Search, PlusCircle, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { icon: Home, label: "Главная", path: "/" },
  { icon: Search, label: "Каналы", path: "/channels" },
  { icon: PlusCircle, label: "Создать", path: "/create" },
  { icon: MessageCircle, label: "Сделки", path: "/deals" },
];

export const BottomNav = () => {
  const location = useLocation();
  const isProfileActive = location.pathname === "/profile";

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="flex items-center gap-2">
        {/* Основное меню */}
        <div className="flex-1 glass rounded-2xl border border-white/10 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-transform duration-200",
                      isActive && "scale-110"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="text-2xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Аватарка профиля */}
        <Link
          to="/profile"
          className={cn(
            "glass rounded-full p-2 border border-white/10 shadow-lg backdrop-blur-xl transition-all duration-200",
            isProfileActive && "ring-2 ring-primary"
          )}
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src="/placeholder.svg" alt="Profile" />
            <AvatarFallback className="bg-primary/20 text-primary font-medium">U</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </nav>
  );
};
