import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AdminRegisterForm } from '@/components/admin/AdminRegisterForm';
import { AdminSidebar, AdminSection } from '@/components/admin/AdminSidebar';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { ShieldX, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Operator() {
  const { user, isAdmin, isLoading, error, signIn, signUp, signOut } = useAdminAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login/register
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {authMode === 'login' ? (
            <AdminLoginForm
              onSubmit={signIn}
              onSwitchToRegister={() => setAuthMode('register')}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            <AdminRegisterForm
              onSubmit={signUp}
              onSwitchToLogin={() => setAuthMode('login')}
              isLoading={isLoading}
              error={error}
            />
          )}
        </div>
      </div>
    );
  }

  // Authenticated but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Доступ запрещён</h2>
              <p className="text-muted-foreground text-sm">
                У вас нет прав администратора. Обратитесь к существующему админу для получения доступа.
              </p>
              <p className="text-xs text-muted-foreground">
                Текущий аккаунт: {user.email}
              </p>
              <Button onClick={signOut} variant="outline" className="w-full">
                Выйти
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin - show dashboard
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <AdminUsersTable />;
      case 'channels':
        return (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                📢 Раздел каналов будет доступен после создания таблицы channels
              </p>
            </CardContent>
          </Card>
        );
      case 'deals':
        return (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                💰 Раздел сделок будет доступен после создания таблицы deals
              </p>
            </CardContent>
          </Card>
        );
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={signOut}
        userEmail={user.email}
      />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
