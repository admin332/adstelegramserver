import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Eye, BarChart3, Globe, Crown, CheckCircle, AlertTriangle, Clock, Bell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PostStat {
  messageId: number;
  views: number;
  date: string;
}

interface LanguageStat {
  language: string;
  percentage: number;
}

interface TopHourStat {
  hour: number;
  value: number;
}

interface ChannelAnalyticsProps {
  subscribers: number;
  avgViews: number;
  engagement: number;
  recentPosts?: PostStat[];
  languageStats?: LanguageStat[];
  premiumPercentage?: number;
  growthRate?: number;
  notificationsEnabled?: number;
  topHours?: TopHourStat[];
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

// Get engagement level and color
const getEngagementLevel = (er: number): { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: React.ReactNode;
} => {
  if (er >= 20) {
    return {
      label: 'Отличный',
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      icon: <CheckCircle className="h-4 w-4" />,
    };
  }
  if (er >= 10) {
    return {
      label: 'Хороший',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      icon: <TrendingUp className="h-4 w-4" />,
    };
  }
  return {
    label: 'Низкий',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    icon: <AlertTriangle className="h-4 w-4" />,
  };
};

// Format hour for display
const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

const ChannelAnalytics: React.FC<ChannelAnalyticsProps> = ({
  subscribers,
  avgViews,
  engagement,
  recentPosts = [],
  languageStats,
  premiumPercentage,
  growthRate,
  notificationsEnabled,
  topHours,
}) => {
  const engagementLevel = getEngagementLevel(engagement);
  const maxViews = recentPosts.length > 0 ? Math.max(...recentPosts.map(p => p.views)) : 0;
  
  // Find max value for top hours heatmap
  const maxHourValue = topHours && topHours.length > 0 
    ? Math.max(...topHours.map(h => h.value)) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Engagement Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-secondary/50 rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Engagement Rate</span>
          </div>
          <div className={cn("flex items-center gap-1 text-sm", engagementLevel.color)}>
            {engagementLevel.icon}
            <span>{engagementLevel.label}</span>
          </div>
        </div>
        
        <div className="relative h-3 bg-secondary rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(engagement, 100)}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className={cn("h-full rounded-full", engagementLevel.bgColor)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-foreground">{engagement}%</span>
          <span className="text-xs text-muted-foreground">
            {formatNumber(avgViews)} просмотров / {formatNumber(subscribers)} подписчиков
          </span>
        </div>
      </motion.div>

      {/* Growth Rate Card */}
      {growthRate !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-secondary/50 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            {growthRate >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium text-foreground">Рост подписчиков</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-bold",
              growthRate >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(2)}%
            </span>
            <span className="text-sm text-muted-foreground">за последний период</span>
          </div>
        </motion.div>
      )}

      {/* Average Views Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-secondary/50 rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Средние просмотры</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{formatNumber(avgViews)}</span>
          <span className="text-sm text-muted-foreground">на пост</span>
        </div>
      </motion.div>

      {/* Notifications Enabled Card */}
      {notificationsEnabled !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-secondary/50 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Уведомления включены</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-secondary"
                />
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  className="text-primary"
                  initial={{ strokeDasharray: "0 176" }}
                  animate={{
                    strokeDasharray: `${(notificationsEnabled / 100) * 176} 176`,
                  }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">
                  {notificationsEnabled.toFixed(0)}%
                </span>
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {formatNumber(Math.round(subscribers * notificationsEnabled / 100))} подписчиков получают уведомления о новых постах
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top Hours Heatmap */}
      {topHours && topHours.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary/50 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Пиковая активность</span>
          </div>
          
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {topHours.slice(0, 12).map((hourStat, index) => {
              const intensity = maxHourValue > 0 ? hourStat.value / maxHourValue : 0;
              return (
                <motion.div
                  key={hourStat.hour}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: 0.35 + index * 0.02 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn(
                      "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors",
                      intensity >= 0.8 ? "bg-primary text-primary-foreground" :
                      intensity >= 0.5 ? "bg-primary/60 text-primary-foreground" :
                      intensity >= 0.3 ? "bg-primary/30 text-foreground" :
                      "bg-secondary text-muted-foreground"
                    )}
                    title={`${formatHour(hourStat.hour)}: ${hourStat.value} постов`}
                  >
                    {hourStat.value}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {hourStat.hour}h
                  </span>
                </motion.div>
              );
            })}
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-2">
            Часы с наибольшей активностью аудитории (UTC+3)
          </p>
        </motion.div>
      )}

      {/* Recent Posts Bar Chart */}
      {recentPosts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-secondary/50 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Просмотры постов</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Последние {recentPosts.length}
            </span>
          </div>
          
          {/* Bar Chart */}
          <div className="flex items-end gap-1 h-16 mb-2">
            {recentPosts.slice(0, 10).reverse().map((post, index) => {
              const height = maxViews > 0 ? (post.views / maxViews) * 100 : 0;
              return (
                <motion.div
                  key={post.messageId}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.05 }}
                  className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer"
                  title={`${formatNumber(post.views)} просмотров`}
                />
              );
            })}
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Старые</span>
            <span>Новые</span>
          </div>
        </motion.div>
      )}

      {/* Language Stats (placeholder if no data) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-secondary/50 rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Языки аудитории</span>
          {!languageStats && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              Примерно
            </span>
          )}
        </div>
        
        {languageStats && languageStats.length > 0 ? (
          <div className="space-y-2">
            {languageStats.map((lang) => (
              <div key={lang.language} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{lang.language}</span>
                  <span className="text-muted-foreground">{lang.percentage}%</span>
                </div>
                <Progress value={lang.percentage} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Русский</span>
                <span className="text-muted-foreground">~75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">English</span>
                <span className="text-muted-foreground">~18%</span>
              </div>
              <Progress value={18} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Другие</span>
                <span className="text-muted-foreground">~7%</span>
              </div>
              <Progress value={7} className="h-2" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Premium Users */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-secondary/50 rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-foreground">Telegram Premium</span>
          {premiumPercentage === undefined && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              Примерно
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-secondary"
              />
              <motion.circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                className="text-amber-500"
                initial={{ strokeDasharray: "0 176" }}
                animate={{
                  strokeDasharray: `${((premiumPercentage ?? 12) / 100) * 176} 176`,
                }}
                transition={{ duration: 0.8, delay: 0.6 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">
                {premiumPercentage ?? '~12'}%
              </span>
            </div>
          </div>
          
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Платежеспособная аудитория с подпиской Premium
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChannelAnalytics;
