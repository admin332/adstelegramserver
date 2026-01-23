import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crown, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface UserRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  is_premium: boolean;
  created_at: string;
  language_code: string | null;
}

export function AdminUsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.or(`username.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Пользователи</CardTitle>
            <CardDescription>
              Всего: {totalCount} пользователей
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            Найти
          </Button>
        </form>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Пользователи не найдены</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-muted-foreground">Пользователь</TableHead>
                  <TableHead className="text-muted-foreground">Telegram ID</TableHead>
                  <TableHead className="text-muted-foreground">Язык</TableHead>
                  <TableHead className="text-muted-foreground">Статус</TableHead>
                  <TableHead className="text-muted-foreground">Дата регистрации</TableHead>
                  <TableHead className="text-muted-foreground w-[80px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {user.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-1">
                            {user.first_name} {user.last_name || ''}
                            {user.is_premium && <Crown className="h-3 w-3 text-yellow-500" />}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.username ? `@${user.username}` : '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {user.telegram_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.language_code?.toUpperCase() || '—'}
                    </TableCell>
                    <TableCell>
                      {user.is_premium ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                          <Crown className="h-3 w-3" />
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                          Обычный
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell>
                      {user.username && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(`https://t.me/${user.username}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
