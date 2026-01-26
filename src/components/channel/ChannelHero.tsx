import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Crown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ChannelHeroProps {
  name: string;
  username: string;
  avatar: string;
  verified: boolean;
  premium?: boolean;
}

const ChannelHero: React.FC<ChannelHeroProps> = ({
  name,
  username,
  avatar,
  verified,
  premium,
}) => {
  return (
    <div className="relative">
      {/* Background Image */}
      <div className="h-40 overflow-hidden">
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
      </div>

      {/* Avatar & Info */}
      <div className="relative -mt-12 flex flex-col items-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback className="text-2xl font-bold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-3 text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            {verified && (
              <CheckCircle2 className="h-5 w-5 text-primary fill-primary/20" />
            )}
            {premium && (
              <Crown className="h-5 w-5 text-yellow-500" />
            )}
          </div>
          <p className="text-muted-foreground">@{username}</p>
        </motion.div>
      </div>
    </div>
  );
};

export default ChannelHero;
