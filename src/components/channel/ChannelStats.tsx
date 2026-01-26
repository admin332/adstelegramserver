import React from 'react';
import { motion } from 'framer-motion';
import { Users, Eye, Megaphone } from 'lucide-react';

interface ChannelStatsProps {
  subscribers: number;
  avgViews: number;
  successfulAds: number;
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

const ChannelStats: React.FC<ChannelStatsProps> = ({
  subscribers,
  avgViews,
  successfulAds,
}) => {
  const stats = [
    {
      icon: Users,
      value: formatNumber(subscribers),
      label: 'Подписчиков',
    },
    {
      icon: Eye,
      value: formatNumber(avgViews),
      label: 'Просмотров',
    },
    {
      icon: Megaphone,
      value: successfulAds.toString(),
      label: 'Реклам',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + index * 0.1 }}
          className="bg-secondary/50 rounded-2xl p-4 text-center"
        >
          <stat.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-lg font-bold text-foreground">{stat.value}</p>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default ChannelStats;
