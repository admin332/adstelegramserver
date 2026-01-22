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
    <>
      {/* Градиентное затемнение снизу */}
      <div 
        className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-40"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%)'
        }}
      />
      
      <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="glass rounded-2xl shadow-lg backdrop-blur-xl">
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

          {/* Аватарка профиля */}
          <Link
            to="/profile"
            className={cn(
              "flex items-center justify-center p-2 rounded-xl transition-all duration-200",
              isProfileActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Avatar className={cn(
              "w-8 h-8 transition-transform duration-200",
              isProfileActive && "scale-110 ring-2 ring-primary"
            )}>
              <AvatarImage src="/placeholder.svg" alt="Profile" />
              <AvatarFallback className="bg-primary/20 text-primary font-medium text-xs">U</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </nav>
    </>
  );
};
