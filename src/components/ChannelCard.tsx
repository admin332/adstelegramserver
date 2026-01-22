import { Users, Eye, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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

export const ChannelCard = ({
  name,
  username,
  avatar,
  subscribers,
  avgViews,
  category,
  price,
  rating,
  verified,
  premium,
}: ChannelCardProps) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="card-elevated rounded-2xl p-4 animate-scale-in hover:scale-[1.02] transition-transform duration-200 cursor-pointer">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative">
          <img
            src={avatar}
            alt={name}
            className="w-14 h-14 rounded-full object-cover"
          />
          {verified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">@{username}</p>
          <span className="inline-block mt-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {category}
          </span>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-lg font-bold text-primary">${price}</p>
          <p className="text-2xs text-muted-foreground">за пост</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground font-medium">{formatNumber(subscribers)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground font-medium">{formatNumber(avgViews)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-success font-medium">
            {((avgViews / subscribers) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm ml-auto">
          <Star className="w-4 h-4 text-warning fill-warning" />
          <span className="text-foreground font-medium">{rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
