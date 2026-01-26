import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
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
import DateTimeSelector from './DateTimeSelector';
import CampaignSelector from './CampaignSelector';
import { mockCampaigns } from '@/data/mockCampaigns';

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(() => {
    const nextHour = new Date().getHours() + 1;
    return nextHour > 23 ? 0 : nextHour;
  });
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const totalSteps = 3;
  const progressValue = (currentStep / totalSteps) * 100;

  const stepTitles: Record<number, string> = {
    1: 'Выберите количество постов',
    2: 'Выберите дату и время',
    3: 'Выберите рекламную кампанию',
  };

  const stepSubtitles: Record<number, string> = {
    1: `Реклама в канале ${channelName}`,
    2: `Реклама в канале ${channelName}`,
    3: quantity > 1 ? `Выберите ${quantity} кампании` : `Выберите кампанию`,
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Финальный шаг — оформление заказа
      console.log('Order submitted', {
        quantity,
        selectedDate,
        selectedHour,
        selectedCampaigns,
      });
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateNewCampaign = () => {
    console.log('Create new campaign - TODO');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return quantity >= 1;
      case 2:
        return selectedDate && selectedHour !== undefined;
      case 3:
        return selectedCampaigns.length === quantity;
      default:
        return false;
    }
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
            {stepTitles[currentStep]}
          </DrawerTitle>
          <p className="text-center text-muted-foreground text-sm mt-1">
            {stepSubtitles[currentStep]}
          </p>
        </DrawerHeader>

        <div className="px-4 py-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <PostQuantitySelector
                  quantity={quantity}
                  pricePerPost={pricePerPost}
                  onQuantityChange={setQuantity}
                />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <DateTimeSelector
                  selectedDate={selectedDate}
                  selectedHour={selectedHour}
                  onDateChange={setSelectedDate}
                  onHourChange={setSelectedHour}
                />
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <CampaignSelector
                  campaigns={mockCampaigns}
                  selectedCampaigns={selectedCampaigns}
                  requiredCount={quantity}
                  onSelectionChange={setSelectedCampaigns}
                  onCreateNew={handleCreateNewCampaign}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="flex-row gap-2">
          {currentStep > 1 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="h-12 px-4 rounded-xl"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Назад
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1 h-12 text-base font-semibold rounded-xl"
          >
            {currentStep === totalSteps ? 'Оформить заказ' : 'Далее'}
            {currentStep !== totalSteps && <ArrowRight className="ml-2 h-5 w-5" />}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderDrawer;
