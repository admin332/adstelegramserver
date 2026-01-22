import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChannelCardProps {
  id: string;
  name: string;
  username: string;
  avatar: string;
  subscribers: number;
  avgViews: number;
  category: string;
  price: number;
  rating: number;
  verified: boolean;
  premium?: boolean;
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

export const ChannelCard: React.FC<ChannelCardProps> = ({
  id,
  name,
  username,
  avatar,
  subscribers,
  avgViews,
  category,
  price,
  verified,
  premium,
}) => {
  const [isLiked, setIsLiked] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Blue Background - Left Side */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(217,91%,50%)] to-[hsl(224,76%,48%)]" />
      
      {/* Background Image - Right Side with diagonal clip and blue tint */}
      <div 
        className="absolute inset-0"
        style={{ clipPath: 'polygon(45% 0, 100% 0, 100% 100%, 55% 100%)' }}
      >
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
      </div>


      {/* Verified Badge */}
      {verified && (
        <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Verified
        </div>
      )}

      {/* Category Badge */}
      <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
        {category}
      </div>

      {/* Main Content */}
      <motion.div
        className="absolute inset-0 p-4 flex flex-col justify-end"
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

            {/* Stats Row */}
            <motion.div
              className="flex items-center gap-3 mt-2"
              variants={itemVariants}
            >
              <div className="flex items-center gap-1 text-white/80 text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{formatNumber(subscribers)}</span>
              </div>
              <div className="flex items-center gap-1 text-white/80 text-xs">
                <Eye className="w-3.5 h-3.5" />
                <span>{formatNumber(avgViews)}</span>
              </div>
              <span className="text-white/60 text-xs bg-white/10 px-2 py-0.5 rounded-full">
                {category}
              </span>
            </motion.div>
          </div>

          {/* Right: Price & Actions */}
          <div className="flex flex-col items-end gap-2">
            <motion.div
              className="bg-white/10 backdrop-blur-md rounded-2xl px-3 py-1.5 text-center"
              variants={itemVariants}
            >
              <span className="text-white font-bold text-lg">${price}</span>
              <p className="text-white/60 text-2xs">за пост</p>
            </motion.div>

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
                onClick={(e) => e.stopPropagation()}
              >
                Купить
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
