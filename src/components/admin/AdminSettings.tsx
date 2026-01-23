import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Shield, Bell, Database } from 'lucide-react';

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Общие настройки
          </CardTitle>
          <CardDescription>Основные настройки приложения</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Настройки приложения будут доступны после добавления соответствующей функциональности.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Безопасность
          </CardTitle>
          <CardDescription>Настройки безопасности и доступа</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
            <div>
              <p className="font-medium text-foreground">Управление ролями</p>
              <p className="text-sm text-muted-foreground">
                Назначайте роли пользователям через базу данных
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Скоро
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Уведомления
          </CardTitle>
          <CardDescription>Настройки уведомлений</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Система уведомлений будет добавлена в будущих обновлениях.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Database className="h-5 w-5" />
            База данных
          </CardTitle>
          <CardDescription>Информация о базе данных</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <p className="text-sm text-muted-foreground">Таблицы</p>
              <p className="text-2xl font-bold text-foreground">2</p>
              <p className="text-xs text-muted-foreground">users, user_roles</p>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <p className="text-sm text-muted-foreground">Статус</p>
              <p className="text-lg font-medium text-green-500">Активна</p>
              <p className="text-xs text-muted-foreground">RLS включён</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
