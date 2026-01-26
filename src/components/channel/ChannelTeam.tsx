import React from 'react';
import { motion } from 'framer-motion';
import { Crown, User, Shield, Eye, Pencil, DollarSign, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChannelAdmins, type ChannelAdmin } from '@/hooks/useChannelAdmins';

interface ChannelTeamProps {
  channelId: string;
}

const ChannelTeam: React.FC<ChannelTeamProps> = ({ channelId }) => {
  const { data: admins, isLoading } = useChannelAdmins(channelId);

  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Команда канала</h2>
        <div className="bg-secondary/50 rounded-2xl p-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
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
    return role === 'owner' 
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
      : 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  const getPermissionIcons = (permissions: ChannelAdmin['permissions']) => {
    const icons = [];
    if (permissions.can_edit_posts) {
      icons.push({ icon: Pencil, label: 'Редактирование' });
    }
    if (permissions.can_view_stats) {
      icons.push({ icon: Eye, label: 'Статистика' });
    }
    if (permissions.can_view_finance) {
      icons.push({ icon: DollarSign, label: 'Финансы' });
    }
    if (permissions.can_manage_admins) {
      icons.push({ icon: Users, label: 'Управление' });
    }
    return icons;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="px-4 mt-6"
    >
      <h2 className="text-lg font-semibold text-foreground mb-3">Команда канала</h2>
      <div className="bg-secondary/50 rounded-2xl divide-y divide-border">
        {admins.map((admin) => {
          const RoleIcon = getRoleIcon(admin.role);
          const permissionIcons = getPermissionIcons(admin.permissions);
          const initials = admin.user
            ? `${admin.user.first_name?.[0] || ''}${admin.user.last_name?.[0] || ''}`
            : '?';

          return (
            <div key={admin.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={admin.user?.photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {admin.user?.first_name || 'Пользователь'}
                      {admin.user?.last_name && ` ${admin.user.last_name}`}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getRoleColor(admin.role)}`}
                    >
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {getRoleLabel(admin.role)}
                    </Badge>
                  </div>
                  
                  {admin.user?.username && (
                    <span className="text-sm text-muted-foreground">
                      @{admin.user.username}
                    </span>
                  )}
                </div>
              </div>

              {/* Permission icons */}
              <div className="flex items-center gap-2 mt-2 ml-13">
                {permissionIcons.slice(0, 4).map(({ icon: Icon, label }) => (
                  <div 
                    key={label}
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    title={label}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                ))}
                {admin.role === 'owner' && (
                  <span className="text-xs text-muted-foreground">Полный доступ</span>
                )}
                {admin.role === 'manager' && (
                  <span className="text-xs text-muted-foreground">Редактирование постов</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ChannelTeam;
