import React from 'react';
import { Crown, Shield, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useChannelAdmins, type ChannelAdmin } from '@/hooks/useChannelAdmins';

interface ChannelTeamCompactProps {
  channelId: string;
}

export const ChannelTeamCompact: React.FC<ChannelTeamCompactProps> = ({ channelId }) => {
  const { data: admins, isLoading } = useChannelAdmins(channelId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (!admins || admins.length === 0) {
    return null;
  }

  const getRoleIcon = (role: ChannelAdmin['role']) => {
    return role === 'owner' ? Crown : Shield;
  };

  const getRoleLabel = (role: ChannelAdmin['role']) => {
    return role === 'owner' ? 'Владелец' : 'Менеджер';
  };

  const getRoleColor = (role: ChannelAdmin['role']) => {
    return role === 'owner' ? 'text-amber-500' : 'text-blue-500';
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs text-muted-foreground mb-2">Команда:</p>
      <div className="space-y-1.5">
        {admins.map((admin) => {
          const RoleIcon = getRoleIcon(admin.role);
          const initials = admin.user
            ? `${admin.user.first_name?.[0] || ''}${admin.user.last_name?.[0] || ''}`
            : '?';

          return (
            <div key={admin.id} className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={admin.user?.photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials || <User className="h-3 w-3" />}
                </AvatarFallback>
              </Avatar>
              
              <span className="text-sm text-foreground truncate">
                {admin.user?.first_name || 'Пользователь'}
                {admin.user?.last_name && ` ${admin.user.last_name}`}
              </span>
              
              <div className={`flex items-center gap-1 text-xs ${getRoleColor(admin.role)}`}>
                <RoleIcon className="h-3 w-3" />
                <span>{getRoleLabel(admin.role)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
