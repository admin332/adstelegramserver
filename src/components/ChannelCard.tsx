import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  name,
  username,
  avatar,
  subscribers,
  price,
}) => {
  const [likes, setLikes] = useState(subscribers);
  const [isLiked, setIsLiked] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
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
      {/* Background Image & Overlay */}
      <div className="absolute inset-0">
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Main Content Grid */}
      <motion.div
        className="absolute inset-0 p-4 flex flex-col justify-end"
        variants={itemVariants}
      >
        <div className="flex items-end justify-between">
          {/* Left Section: Info & Likes */}
          <div className="flex flex-col gap-2">
            <div>
              <motion.h3
                className="text-white font-bold text-lg"
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

            {/* Likes */}
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleLikeClick}
                whileTap={{ scale: 0.9 }}
                className="flex items-center justify-center"
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
              <motion.span
                className="text-white text-sm font-medium"
                variants={itemVariants}
              >
                {formatNumber(likes)}
              </motion.span>
            </div>
          </div>

          {/* Right Section: Price */}
          <div>
            <motion.div
              className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 text-center"
              variants={itemVariants}
            >
              <span className="text-white font-bold text-lg">${price}</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
