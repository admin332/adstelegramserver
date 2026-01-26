import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import PostQuantitySelector from './PostQuantitySelector';

interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  pricePerPost: number;
}

const OrderDrawer: React.FC<OrderDrawerProps> = ({
  isOpen,
  onClose,
  channelName,
  pricePerPost,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const totalSteps = 3;

  const progressValue = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    // Пока стоп на шаге 1
    console.log('Next step - TODO');
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-0">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-4">
            <Progress value={progressValue} className="flex-1 h-2" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Шаг {currentStep} из {totalSteps}
            </span>
          </div>

          <DrawerTitle className="text-center text-xl">
            Выберите количество постов
          </DrawerTitle>
          <p className="text-center text-muted-foreground text-sm mt-1">
            Реклама в канале {channelName}
          </p>
        </DrawerHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-6"
        >
          <PostQuantitySelector
            quantity={quantity}
            pricePerPost={pricePerPost}
            onQuantityChange={setQuantity}
          />
        </motion.div>

        <DrawerFooter>
          <Button 
            onClick={handleNext} 
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            Далее
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderDrawer;
