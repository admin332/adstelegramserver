import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, BarChart3, Globe, Crown, CheckCircle, AlertTriangle } from 'lucide-react';
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

interface ChannelAnalyticsProps {
  subscribers: number;
  avgViews: number;
  engagement: number;
  recentPosts?: PostStat[];
  languageStats?: LanguageStat[];
  premiumPercentage?: number;
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

const ChannelAnalytics: React.FC<ChannelAnalyticsProps> = ({
  subscribers,
  avgViews,
  engagement,
  recentPosts = [],
  languageStats,
  premiumPercentage,
}) => {
  const engagementLevel = getEngagementLevel(engagement);
  const maxViews = recentPosts.length > 0 ? Math.max(...recentPosts.map(p => p.views)) : 0;

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

      {/* Recent Posts Bar Chart */}
      {recentPosts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
