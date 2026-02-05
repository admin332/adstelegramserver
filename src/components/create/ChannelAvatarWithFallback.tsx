import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ChannelAvatarWithFallbackProps {
  src: string | null;
  name: string;
  className?: string;
  isHidden?: boolean;
}

export const ChannelAvatarWithFallback = ({
  src,
  name,
  className,
  isHidden = false,
}: ChannelAvatarWithFallbackProps) => {
  const [imgError, setImgError] = useState(false);
  
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;
  const displayAvatar = imgError || !src ? null : src;

  return (
    <div className={cn(
      "w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0",
      isHidden && "grayscale",
      className
    )}>
      {displayAvatar ? (
        <img
          src={displayAvatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : imgError && src ? (
        <img
          src={fallbackAvatar}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl font-bold text-muted-foreground">
          {name?.charAt(0) || "?"}
        </span>
      )}
    </div>
  );
};
