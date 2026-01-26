import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Tag, ShoppingCart, BadgeCheck } from 'lucide-react';
import { mockChannels } from '@/data/mockChannels';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ChannelHero from '@/components/channel/ChannelHero';
import ChannelStats from '@/components/channel/ChannelStats';
import ChannelAnalytics from '@/components/channel/ChannelAnalytics';
import OrderDrawer from '@/components/channel/OrderDrawer';
import { getTelegramWebApp, isTelegramMiniApp } from '@/lib/telegram';
import { useChannel } from '@/hooks/useChannels';
import { getCategoryById } from '@/data/channelCategories';

const Channel: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  
  const { data: dbChannel, isLoading, error } = useChannel(id);
  
  // Fallback to mock if not found in DB
  const mockChannel = mockChannels.find((c) => c.id === id);
  const channel = dbChannel || mockChannel;

  // Telegram BackButton integration
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    if (isTelegramMiniApp()) {
      const webapp = getTelegramWebApp();
      if (webapp?.BackButton) {
        webapp.BackButton.onClick(handleBack);
        webapp.BackButton.show();
        
        return () => {
          webapp.BackButton.offClick(handleBack);
          webapp.BackButton.hide();
        };
      }
    }
  }, [handleBack]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="relative h-48 bg-gradient-to-b from-primary/20 to-background">
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <Skeleton className="w-24 h-24 rounded-full" />
          </div>
        </div>
        <div className="mt-16 px-4 space-y-4">
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Канал не найден</h1>
          <Button onClick={() => navigate('/channels')}>
            Вернуться к каналам
          </Button>
        </div>
      </div>
    );
  }

  const detailedStats = [
    {
      icon: Star,
      label: 'Рейтинг',
      value: channel.rating.toString(),
    },
    {
      icon: Tag,
      label: 'Категория',
      value: getCategoryById(channel.category)?.name || channel.category,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Section */}
      <ChannelHero
        name={channel.name}
        username={channel.username}
        avatar={channel.avatar}
        verified={channel.verified}
        premium={channel.premium}
      />

      {/* Stats */}
      <div className="mt-6">
        <ChannelStats
          subscribers={channel.subscribers}
          avgViews={channel.avgViews}
          successfulAds={channel.successfulAds || 0}
        />
      </div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Описание</h2>
        <div className="bg-secondary/50 rounded-2xl p-4 border-2 border-dashed border-primary">
          <p className="text-muted-foreground">
            {channel.description || 'Описание отсутствует'}
          </p>
        </div>
      </motion.div>

      {/* Detailed Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-2">Статистика</h2>
        <div className="bg-secondary/50 rounded-2xl divide-y divide-border">
          {detailedStats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-primary" />
                <span className="text-muted-foreground">{stat.label}</span>
              </div>
              <span className="font-semibold text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Verified Analytics Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="px-4 mt-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Verified Analytics</h2>
          <span className="text-xs text-muted-foreground">from Telegram</span>
        </div>
        <ChannelAnalytics
          subscribers={channel.subscribers}
          avgViews={channel.avgViews}
          engagement={channel.engagement || 0}
          recentPosts={channel.recentPostsStats}
          languageStats={channel.languageStats}
          premiumPercentage={channel.premiumPercentage}
        />
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={() => setIsOrderDrawerOpen(true)}
            className="w-full h-14 text-base font-semibold rounded-2xl gap-3"
          >
            <ShoppingCart className="h-5 w-5" />
            Заказать рекламу
            <span className="text-white/80 ml-2">
              {channel.tonPrice} TON
            </span>
          </Button>
        </motion.div>
      </div>

      {/* Order Drawer */}
      <OrderDrawer
        isOpen={isOrderDrawerOpen}
        onClose={() => setIsOrderDrawerOpen(false)}
        channelId={id!}
        channelName={channel.name}
        pricePerPost={channel.tonPrice}
      />
    </div>
  );
};

export default Channel;
