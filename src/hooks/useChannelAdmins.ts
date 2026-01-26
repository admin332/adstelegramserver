import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

      const initData = getTelegramInitData();
      if (!initData) {
        console.log('[useChannelAdmins] No initData available');
        return [];
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, initData }),
        }
      );

      const data = await response.json();
      
      if (!data.success) {
        console.error('[useChannelAdmins] Error:', data.error);
        return [];
      }

      return (data.admins || []).map((admin: ChannelAdmin & { user: ChannelAdmin['user'] | null }) => ({
        ...admin,
        user: admin.user || undefined,
      }));
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

      const initData = getTelegramInitData();
      if (!initData) return null;

      // Use the same channel-team endpoint and find current user's entry
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, initData }),
        }
      );

      const data = await response.json();
      
      if (!data.success || !data.admins || data.admins.length === 0) {
        return null;
      }

      // The current user's entry will be in the list since the endpoint validates access
      // We return the first entry as a fallback (user's own entry)
      const admin = data.admins[0] as ChannelAdmin;
      return {
        ...admin,
        permissions: admin.permissions as ChannelAdmin['permissions'],
      };
    },
    enabled: !!channelId,
  });
}
