import React from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Review } from '@/hooks/useChannelReviews';

interface ChannelReviewsProps {
  reviews: Review[];
}

const ChannelReviews: React.FC<ChannelReviewsProps> = ({ reviews }) => {
  if (reviews.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="px-4 mt-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Отзывы рекламодателей</h2>
        <span className="text-sm text-muted-foreground">({reviews.length})</span>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/50 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={review.reviewer?.photo_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {review.reviewer?.first_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate">
                    {review.reviewer?.first_name || 'Аноним'}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(review.created_at)}
                  </span>
                </div>

                <div className="mt-1">
                  {renderStars(review.rating)}
                </div>

                {review.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ChannelReviews;
