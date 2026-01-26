import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostQuantitySelectorProps {
  quantity: number;
  pricePerPost: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  maxQuantity?: number;
}

const PostQuantitySelector: React.FC<PostQuantitySelectorProps> = ({
  quantity,
  pricePerPost,
  onQuantityChange,
  minQuantity = 1,
  maxQuantity = 10,
}) => {
  const totalPrice = quantity * pricePerPost;

  const handleDecrease = () => {
    if (quantity > minQuantity) {
      onQuantityChange(quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (quantity < maxQuantity) {
      onQuantityChange(quantity + 1);
    }
  };

  const getPluralForm = (n: number): string => {
    if (n === 1) return 'пост';
    if (n >= 2 && n <= 4) return 'поста';
    return 'постов';
  };

  return (
    <div className="space-y-6">
      {/* Quantity Selector */}
      <div className="bg-secondary/50 rounded-2xl p-6">
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrease}
            disabled={quantity <= minQuantity}
            className="h-12 w-12 rounded-full"
          >
            <Minus className="h-5 w-5" />
          </Button>

          <div className="text-center min-w-[80px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={quantity}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-4xl font-bold text-foreground block"
              >
                {quantity}
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-muted-foreground">
              {getPluralForm(quantity)} на 24 часа
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrease}
            disabled={quantity >= maxQuantity}
            className="h-12 w-12 rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Price Calculation */}
      <div className="bg-secondary/50 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground text-center mb-2">
          Стоимость заказа
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground">
            {quantity} × {pricePerPost} TON =
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={totalPrice}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 font-bold text-xl"
            >
              <span className="text-foreground">{totalPrice} TON</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PostQuantitySelector;
