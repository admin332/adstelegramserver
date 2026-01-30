import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TonIcon from '@/assets/ton-icon.svg';
import { useTonPrice } from '@/hooks/useTonPrice';

interface PostQuantitySelectorProps {
  quantity: number;
  pricePerPost: number;
  price1Post: number;
  price2Plus: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  maxQuantity?: number;
}

const PostQuantitySelector: React.FC<PostQuantitySelectorProps> = ({
  quantity,
  pricePerPost,
  price1Post,
  price2Plus,
  onQuantityChange,
  minQuantity = 1,
  maxQuantity = 10,
}) => {
  const totalPrice = quantity * pricePerPost;
  const { tonPrice } = useTonPrice();

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
            variant="ghost"
            size="icon"
            onClick={handleDecrease}
            disabled={quantity <= minQuantity}
            className="h-12 w-12 rounded-full bg-secondary hover:bg-secondary/80"
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
            variant="ghost"
            size="icon"
            onClick={handleIncrease}
            disabled={quantity >= maxQuantity}
            className="h-12 w-12 rounded-full bg-secondary hover:bg-secondary/80"
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
              <img src={TonIcon} alt="TON" className="w-5 h-5" />
              <span className="text-foreground">{totalPrice}</span>
            </motion.div>
          </AnimatePresence>
          {tonPrice && (
            <span className="text-sm text-muted-foreground">
              ≈ ${(totalPrice * tonPrice).toFixed(2)}
            </span>
          )}
        </div>
        
        {/* Savings indicator */}
        {quantity >= 2 && price2Plus < price1Post && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-3 text-sm font-medium text-green-500"
          >
            💰 Экономия: {(price1Post - price2Plus) * quantity} TON
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PostQuantitySelector;
