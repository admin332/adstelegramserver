import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, Crown, Activity, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  premiumUsers: number;
  recentUsers: Array<{
    id: string;
    username: string | null;
    first_name: string;
    created_at: string;
    is_premium: boolean;
  }>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    newUsersWeek: 0,
    premiumUsers: 0,
    recentUsers: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total users
        const { count: totalUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        // Get premium users
        const { count: premiumUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('is_premium', true);

        // Get new users today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: newUsersToday } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString());

        // Get new users this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: newUsersWeek } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString());

        // Get recent users
        const { data: recentUsers } = await supabase
          .from('users')
          .select('id, username, first_name, created_at, is_premium')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          totalUsers: totalUsers || 0,
          newUsersToday: newUsersToday || 0,
          newUsersWeek: newUsersWeek || 0,
          premiumUsers: premiumUsers || 0,
          recentUsers: recentUsers || [],
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Всего пользователей',
      value: stats.totalUsers,
      icon: Users,
      description: 'Зарегистрировано в системе',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Новые сегодня',
      value: stats.newUsersToday,
      icon: UserPlus,
      description: 'За последние 24 часа',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'За неделю',
      value: stats.newUsersWeek,
      icon: TrendingUp,
      description: 'Новых пользователей',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Premium',
      value: stats.premiumUsers,
      icon: Crown,
      description: 'Telegram Premium',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Users */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Последние пользователи
          </CardTitle>
          <CardDescription>Недавно зарегистрированные пользователи</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Пользователей пока нет</p>
          ) : (
            <div className="space-y-3">
              {stats.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">
                        {user.first_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {user.first_name}
                        {user.is_premium && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.username ? `@${user.username}` : 'Без username'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {format(new Date(user.created_at), 'dd MMM, HH:mm', { locale: ru })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">📢 Каналы</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Таблица каналов ещё не создана. Здесь будет статистика по каналам.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">💰 Сделки</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Таблица сделок ещё не создана. Здесь будет статистика по сделкам.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
