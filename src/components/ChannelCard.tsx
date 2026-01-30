import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import TonIcon from '@/assets/ton-icon.svg';
import { getCategoryById } from '@/data/channelCategories';

interface ChannelCardProps {
  id: string;
  name: string;
  username: string;
  avatar: string;
  subscribers: number;
  avgViews: number;
  category: string;
  price: number;
  tonPrice: number;
  rating: number;
  verified: boolean;
  premium?: boolean;
  isLiked?: boolean;
  onLikeToggle?: (id: string) => void;
  acceptedCampaignTypes?: string;
}

const getCampaignTypeLabel = (type: string | undefined): string => {
  switch (type) {
    case 'prompt':
      return 'По промту';
    case 'ready_post':
      return 'Готовый пост';
    default:
      return 'Все кампании';
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

export const ChannelCard: React.FC<ChannelCardProps> = ({
  id,
  name,
  username,
  avatar,
  subscribers,
  avgViews,
  category,
  price,
  tonPrice,
  verified,
  premium,
  isLiked = false,
  onLikeToggle,
  acceptedCampaignTypes,
}) => {
  const navigate = useNavigate();

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLikeToggle?.(id);
  };

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://t.me/${username}`, '_blank');
  };

  const handleCardClick = () => {
    navigate(`/channel/${id}`);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className={cn(
        'relative w-full h-48 rounded-3xl overflow-hidden cursor-pointer group'
      )}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      onClick={handleCardClick}
    >
      {/* Blue Background - Left Side */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]" />
      
      {/* Background Image - Right Side */}
      <div className="absolute top-0 bottom-0 right-0 w-1/2">
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/30 to-black/70" />
      </div>


      {/* Top Left Badges */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>{formatNumber(avgViews)}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
            {getCampaignTypeLabel(acceptedCampaignTypes)}
          </div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full w-fit">
          {getCategoryById(category)?.name || category}
        </div>
      </div>

      {/* Top Right: TON Price */}
      <div className="absolute top-3 right-3 text-right leading-tight">
        <motion.div
          className="font-bold text-2xl flex items-center justify-end gap-1.5"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <img 
            src={TonIcon} 
            alt="TON" 
            className="w-5 h-5" 
          />
          <span className="text-white">
            {tonPrice}
          </span>
        </motion.div>
        <span className="text-white/60 text-xs -mt-0.5 block">за 24 часа</span>
      </div>

      {/* Center Left: Subscribers Count */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <motion.div
          className="text-white font-bold text-3xl flex items-center gap-2 pb-1 border-b-2 border-black"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <Users className="w-6 h-6" />
          {formatNumber(subscribers)}
        </motion.div>
      </div>

      {/* Bottom Content */}
      <motion.div
        className="absolute inset-x-0 bottom-0 p-4"
        variants={itemVariants}
      >
        <div className="flex items-end justify-between gap-3">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <motion.h3
              className="text-white font-bold text-lg truncate"
              variants={itemVariants}
            >
              {name}
            </motion.h3>
            <motion.p
              className="text-white/70 text-sm"
              variants={itemVariants}
            >
              @{username}
            </motion.p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleLikeClick}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLiked ? 'liked' : 'unliked'}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Heart
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isLiked ? 'fill-red-500 text-red-500' : 'text-white'
                    )}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.button>

            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold rounded-full"
              onClick={handleChannelClick}
            >
              Канал
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
