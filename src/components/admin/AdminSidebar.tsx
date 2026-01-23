import { LayoutDashboard, Users, Megaphone, Handshake, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminSection = 'dashboard' | 'users' | 'channels' | 'deals' | 'settings';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onLogout: () => void;
  userEmail?: string;
}

const menuItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'users', label: 'Пользователи', icon: Users },
  { id: 'channels', label: 'Каналы', icon: Megaphone },
  { id: 'deals', label: 'Сделки', icon: Handshake },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export function AdminSidebar({ activeSection, onSectionChange, onLogout, userEmail }: AdminSidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          Adsingo Admin
        </h1>
        {userEmail && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{userEmail}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
