import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { isToday } from 'date-fns';
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
import PaymentStep from './PaymentStep';
import { useUserCampaigns } from '@/hooks/useUserCampaigns';
import { useTonWallet } from '@/hooks/useTonWallet';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramInitData } from '@/lib/telegram';
import { toast } from 'sonner';

interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  pricePerPost: number;
  minHoursBeforePost?: number;
}

const OrderDrawer: React.FC<OrderDrawerProps> = ({
  isOpen,
  onClose,
  channelId,
  channelName,
  pricePerPost,
  minHoursBeforePost = 0,
}) => {
  const navigate = useNavigate();
  const { data: userCampaigns = [] } = useUserCampaigns();
  const { isConnected: isWalletConnected } = useTonWallet();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(() => {
    const now = new Date();
    const minHour = now.getHours() + Math.max(2, minHoursBeforePost);
    return minHour > 23 ? 0 : minHour;
  });
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  
  // Payment step state
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);

  const campaigns = userCampaigns.map(c => {
    const mediaUrls = (c as { media_urls?: string[] }).media_urls;
    const imageUrl = (mediaUrls && mediaUrls.length > 0) 
      ? mediaUrls[0] 
      : c.image_url || '/placeholder.svg';
    
    return {
      id: c.id,
      name: c.name,
      imageUrl,
      text: c.text,
      buttonText: c.button_text || '',
      buttonUrl: c.button_url || '',
    };
  });

  const totalSteps = 4;
  const progressValue = (currentStep / totalSteps) * 100;
  const totalPrice = quantity * pricePerPost;

  const stepTitles: Record<number, string> = {
    1: 'Выберите количество постов',
    2: 'Выберите дату и время',
    3: 'Выберите рекламную кампанию',
    4: 'Оплата',
  };

  const stepSubtitles: Record<number, string> = {
    1: `Реклама в канале ${channelName}`,
    2: `Реклама в канале ${channelName}`,
    3: quantity > 1 ? `Выберите ${quantity} кампании` : `Выберите кампанию`,
    4: `К оплате: ${totalPrice} TON`,
  };

  const createDeal = async () => {
    setIsCreatingDeal(true);
    
    try {
      const initData = getTelegramInitData();
      
      // Формируем дату и время публикации
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(selectedHour, 0, 0, 0);
      
      const { data, error } = await supabase.functions.invoke('create-deal', {
        body: {
          initData,
          channelId,
          postsCount: quantity,
          pricePerPost,
          totalPrice,
          scheduledAt: scheduledDate.toISOString(),
          campaignIds: selectedCampaigns,
        }
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create deal');
      }
      
      setDealId(data.deal.id);
      setEscrowAddress(data.deal.escrowAddress);
    } catch (err) {
      console.error('Error creating deal:', err);
      toast.error('Не удалось создать сделку');
      setCurrentStep(3); // Go back to campaign selection
    } finally {
      setIsCreatingDeal(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // If moving to payment step, create the deal
      if (nextStep === 4) {
        await createDeal();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Reset payment state when going back from payment
      if (currentStep === 4) {
        setEscrowAddress(null);
        setDealId(null);
      }
    }
  };

  const handlePaymentComplete = () => {
    toast.success('Заказ оформлен! Ожидайте подтверждения оплаты.');
    onClose();
    // Reset state
    setCurrentStep(1);
    setQuantity(1);
    setSelectedCampaigns([]);
    setEscrowAddress(null);
    setDealId(null);
  };

  const handleCreateNewCampaign = () => {
    onClose();
    navigate(`/create?role=advertiser&action=new-campaign&returnTo=/channel/${channelId}`);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    
    if (isToday(date)) {
      const minHour = new Date().getHours() + Math.max(2, minHoursBeforePost);
      if (selectedHour < minHour) {
        setSelectedHour(minHour > 23 ? 0 : minHour);
      }
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return quantity >= 1;
      case 2:
        return selectedDate && selectedHour !== undefined;
      case 3:
        return selectedCampaigns.length === quantity;
      case 4:
        return false; // Payment step has its own button
      default:
        return false;
    }
  };

  // Don't show "Next" button on payment step
  const showNextButton = currentStep < 4;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-0">
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
                  onDateChange={handleDateChange}
                  onHourChange={setSelectedHour}
                  minHoursBeforePost={minHoursBeforePost}
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
                  campaigns={campaigns}
                  selectedCampaigns={selectedCampaigns}
                  requiredCount={quantity}
                  onSelectionChange={setSelectedCampaigns}
                  onCreateNew={handleCreateNewCampaign}
                />
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <PaymentStep
                  totalPriceTon={totalPrice}
                  escrowAddress={escrowAddress}
                  isCreatingDeal={isCreatingDeal}
                  onPaymentComplete={handlePaymentComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="flex-row gap-2">
          {currentStep > 1 && currentStep < 4 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="h-12 px-4 rounded-xl"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Назад
            </Button>
          )}
          {showNextButton && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 h-12 text-base font-semibold rounded-xl"
            >
              Далее
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderDrawer;
