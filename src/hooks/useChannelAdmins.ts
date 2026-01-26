import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramInitData } from '@/lib/telegram';
import { toast } from 'sonner';

export interface ChannelAdmin {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'owner' | 'manager';
  permissions: {
    can_edit_posts: boolean;
    can_view_stats: boolean;
    can_view_finance: boolean;
    can_withdraw: boolean;
    can_manage_admins: boolean;
    can_approve_ads: boolean;
  };
  telegram_member_status: string | null;
  last_verified_at: string;
  created_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
  };
}

export function useChannelAdmins(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channel-admins', channelId],
    queryFn: async (): Promise<ChannelAdmin[]> => {
      if (!channelId) return [];

      // Note: This will only work via Edge Function since RLS blocks direct access
      // For now, we fetch what we can (service role handles via edge function)
      const { data, error } = await supabase
        .from('channel_admins')
        .select(`
          id,
          channel_id,
          user_id,
          role,
          permissions,
          telegram_member_status,
          last_verified_at,
          created_at,
          users:user_id (
            id,
            first_name,
            last_name,
            username,
            photo_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching channel admins:', error);
        return [];
      }

      return (data || []).map((item: unknown) => {
        const typedItem = item as {
          id: string;
          channel_id: string;
          user_id: string;
          role: 'owner' | 'manager';
          permissions: ChannelAdmin['permissions'];
          telegram_member_status: string | null;
          last_verified_at: string;
          created_at: string;
          users: ChannelAdmin['user'] | null;
        };
        return {
          ...typedItem,
          user: typedItem.users || undefined,
        };
      });
    },
    enabled: !!channelId,
  });
}

export function useJoinChannelAsAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const initData = getTelegramInitData();
      if (!initData) {
        throw new Error('Telegram authorization required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-channel-as-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel_id: channelId,
            initData,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to join channel');
      }

      return data;
    },
    onSuccess: (data, channelId) => {
      queryClient.invalidateQueries({ queryKey: ['channel-admins', channelId] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRecheckAdminStatus() {
  return useMutation({
    mutationFn: async ({ 
      channelId, 
      requiredPermission 
    }: { 
      channelId: string; 
      requiredPermission?: string;
    }) => {
      const initData = getTelegramInitData();
      if (!initData) {
        throw new Error('Telegram authorization required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recheck-admin-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel_id: channelId,
            initData,
            required_permission: requiredPermission,
          }),
        }
      );

      const data = await response.json();
      if (!data.valid) {
        throw new Error(data.error || 'Access denied');
      }

      return data;
    },
  });
}

export function useCurrentUserChannelRole(channelId: string | undefined) {
  return useQuery({
    queryKey: ['my-channel-role', channelId],
    queryFn: async (): Promise<ChannelAdmin | null> => {
      if (!channelId) return null;

      // This would require matching the current user to channel_admins
      // For now, return null - the full implementation would need user context
      const { data, error } = await supabase
        .from('channel_admins')
        .select('*')
        .eq('channel_id', channelId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching current user role:', error);
        return null;
      }

      if (!data) return null;

      return {
        ...data,
        permissions: data.permissions as unknown as ChannelAdmin['permissions'],
      } as ChannelAdmin;
    },
    enabled: !!channelId,
  });
}
