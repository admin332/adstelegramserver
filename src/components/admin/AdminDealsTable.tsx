import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Handshake,
  Clock,
  Wallet,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTonPrice } from '@/hooks/useTonPrice';
import { ScheduleEditDialog } from './ScheduleEditDialog';
import type { Database } from '@/integrations/supabase/types';

type DealStatus = Database['public']['Enums']['deal_status'];

interface AdminDeal {
  id: string;
  status: DealStatus;
  total_price: number;
  posts_count: number;
  duration_hours: number;
  escrow_address: string | null;
  created_at: string;
  expires_at: string | null;
  scheduled_at: string | null;
  channel: {
    title: string | null;
    username: string;
  } | null;
  advertiser: {
    first_name: string;
    username: string | null;
  } | null;
  campaign: {
    name: string;
  } | null;
}

const STATUS_CONFIG: Record<DealStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Ожидает оплаты', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  escrow: { label: 'Оплачено', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Wallet },
  in_progress: { label: 'Публикуется', color: 'bg-primary/20 text-primary border-primary/30', icon: PlayCircle },
  completed: { label: 'Завершено', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  cancelled: { label: 'Отменено', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
  disputed: { label: 'Спор', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  expired: { label: 'Истекло', color: 'bg-muted text-muted-foreground border-border', icon: Timer },
};

const ALL_STATUSES: DealStatus[] = ['pending', 'escrow', 'in_progress', 'completed', 'cancelled', 'disputed', 'expired'];

export function AdminDealsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingDealId, setUpdatingDealId] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<AdminDeal | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const queryClient = useQueryClient();
  const { tonPrice } = useTonPrice();

  const { data: deals, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id, status, total_price, posts_count, duration_hours,
          escrow_address, created_at, expires_at, scheduled_at,
          channel:channels(title, username),
          advertiser:users!deals_advertiser_id_fkey(first_name, username),
          campaign:campaigns(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdminDeal[];
    },
  });

  const updateStatus = async (dealId: string, newStatus: DealStatus) => {
    setUpdatingDealId(dealId);
    try {
      if (newStatus === 'completed') {
        // Force-complete with payout via Edge Function
        const { data, error } = await supabase.functions.invoke('admin-complete-deal', {
          body: { dealId }
        });

        if (error) throw error;

        toast({
          title: 'Сделка завершена',
          description: data?.transferSuccess 
            ? 'Средства переведены владельцу канала' 
            : 'Статус обновлён. Средства будут переведены позже.',
        });
      } else if (newStatus === 'cancelled') {
        // Cancel with refund via Edge Function
        const { data, error } = await supabase.functions.invoke('admin-cancel-deal', {
          body: { dealId }
        });

        if (error) throw error;

        toast({
          title: 'Сделка отменена',
          description: data?.refundSuccess 
            ? 'Средства возвращены рекламодателю' 
            : 'Статус обновлён',
        });
      } else if (newStatus === 'escrow') {
        // Update status first
        const { error } = await supabase
          .from('deals')
          .update({ status: newStatus })
          .eq('id', dealId);

        if (error) throw error;

        // Send notification to channel owner
        const { error: notifyError } = await supabase.functions.invoke('notify-deal-payment', {
          body: { dealId }
        });
        
        if (notifyError) {
          console.error('Error sending notification:', notifyError);
          toast({
            title: 'Статус обновлён',
            description: 'Но не удалось отправить уведомление владельцу канала',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Статус обновлён',
            description: 'Владелец канала получил уведомление с рекламой',
          });
        }
      } else {
        // Simple status update
        const { error } = await supabase
          .from('deals')
          .update({ status: newStatus })
          .eq('id', dealId);

        if (error) throw error;

        toast({
          title: 'Статус обновлён',
          description: `Сделка переведена в статус "${STATUS_CONFIG[newStatus].label}"`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить статус',
        variant: 'destructive',
      });
    } finally {
      setUpdatingDealId(null);
    }
  };

  const updateSchedule = async (dealId: string, newDate: Date) => {
    setIsSavingSchedule(true);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ scheduled_at: newDate.toISOString() })
        .eq('id', dealId);

      if (error) throw error;

      toast({
        title: 'Дата обновлена',
        description: `Публикация запланирована на ${format(newDate, "d MMMM yyyy 'в' HH:mm", { locale: ru })}`,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить дату',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const filteredDeals = deals?.filter((deal) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      deal.channel?.title?.toLowerCase().includes(query) ||
      deal.channel?.username?.toLowerCase().includes(query) ||
      deal.advertiser?.first_name?.toLowerCase().includes(query) ||
      deal.advertiser?.username?.toLowerCase().includes(query) ||
      deal.campaign?.name?.toLowerCase().includes(query)
    );
  });

  const formatUsd = (ton: number) => {
    if (!tonPrice) return '';
    return `≈ $${(ton * tonPrice).toFixed(2)}`;
  };

  const formatScheduledAt = (scheduledAt: string | null) => {
    if (!scheduledAt) return '—';
    return format(new Date(scheduledAt), "d MMM yyyy HH:mm", { locale: ru });
  };

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-destructive">Ошибка загрузки сделок: {error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              Попробовать снова
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Handshake className="h-5 w-5" />
            Сделки
            {deals && (
              <Badge variant="secondary" className="ml-2">
                {deals.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по каналу, рекламодателю или кампании..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDeals?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? 'Сделки не найдены' : 'Нет сделок'}
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-muted-foreground">Канал</TableHead>
                  <TableHead className="text-muted-foreground">Рекламодатель</TableHead>
                  <TableHead className="text-muted-foreground">Сумма</TableHead>
                  <TableHead className="text-muted-foreground">Статус</TableHead>
                  <TableHead className="text-muted-foreground">Публикация</TableHead>
                  <TableHead className="text-muted-foreground">Создано</TableHead>
                  <TableHead className="text-muted-foreground text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals?.map((deal) => {
                  const statusConfig = STATUS_CONFIG[deal.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow key={deal.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {deal.channel?.title || 'Без названия'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{deal.channel?.username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {deal.advertiser?.first_name || 'Неизвестно'}
                          </p>
                          {deal.advertiser?.username && (
                            <p className="text-sm text-muted-foreground">
                              @{deal.advertiser.username}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {deal.total_price} TON
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatUsd(deal.total_price)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.color} border`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">
                            {formatScheduledAt(deal.scheduled_at)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingDeal(deal)}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(deal.created_at), 'dd MMM yyyy', { locale: ru })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(deal.created_at), 'HH:mm', { locale: ru })}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={deal.status}
                          onValueChange={(value) => updateStatus(deal.id, value as DealStatus)}
                          disabled={updatingDealId === deal.id}
                        >
                          <SelectTrigger className="w-[160px] bg-background border-border">
                            {updatingDealId === deal.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            {ALL_STATUSES.map((status) => {
                              const config = STATUS_CONFIG[status];
                              const Icon = config.icon;
                              return (
                                <SelectItem key={status} value={status}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-3 w-3" />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {editingDeal && (
        <ScheduleEditDialog
          open={!!editingDeal}
          onOpenChange={(open) => !open && setEditingDeal(null)}
          currentScheduledAt={editingDeal.scheduled_at}
          dealId={editingDeal.id}
          onSave={updateSchedule}
          isSaving={isSavingSchedule}
        />
      )}
    </Card>
  );
}
