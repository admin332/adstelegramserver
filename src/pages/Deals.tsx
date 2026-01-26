import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DealCard } from "@/components/DealCard";
import { FilterChip } from "@/components/FilterChip";
import { PaymentDialog } from "@/components/deals/PaymentDialog";
import { useUserDeals, type Deal } from "@/hooks/useUserDeals";
import { Inbox, Clock, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DealFilter = "all" | "pending" | "active" | "completed";

const Deals = () => {
  const { data: deals, isLoading, refetch } = useUserDeals();
  const [filter, setFilter] = useState<DealFilter>("all");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const filters = [
    { id: "all" as const, label: "Все", icon: Inbox },
    { id: "pending" as const, label: "К оплате", icon: Wallet },
    { id: "active" as const, label: "Активные", icon: Clock },
    { id: "completed" as const, label: "Завершённые", icon: CheckCircle2 },
  ];

  const filteredDeals = (deals || []).filter((deal) => {
    if (filter === "all") return true;
    if (filter === "pending") return deal.status === "pending";
    if (filter === "active") return ["escrow", "in_progress"].includes(deal.status);
    if (filter === "completed") return ["completed", "cancelled", "disputed"].includes(deal.status);
    return true;
  });

  const handlePayClick = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  const handlePaymentSuccess = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header px-4 pt-4 pb-2">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white mb-4 text-center">Мои сделки</h1>
        
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4">
          {filters.map((f) => {
            const Icon = f.icon;
            return (
              <FilterChip
                key={f.id}
                active={filter === f.id}
                onClick={() => setFilter(f.id)}
                icon={<Icon className="w-4 h-4" />}
              >
                {f.label}
              </FilterChip>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-3">
        {isLoading ? (
          // Скелетоны загрузки
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </>
        ) : filteredDeals.length > 0 ? (
          filteredDeals.map((deal) => (
            <DealCard 
              key={deal.id} 
              id={deal.id}
              status={deal.status}
              totalPrice={deal.total_price}
              postsCount={deal.posts_count}
              durationHours={deal.duration_hours}
              escrowAddress={deal.escrow_address}
              scheduledAt={deal.scheduled_at}
              createdAt={deal.created_at}
              expiresAt={deal.expires_at}
              channel={deal.channel}
              campaign={deal.campaign}
              onPayClick={() => handlePayClick(deal)}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">Нет сделок</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "all" 
                ? "Ваши сделки появятся здесь" 
                : "Нет сделок с таким статусом"}
            </p>
          </div>
        )}
      </main>

      {/* Payment Dialog */}
      {selectedDeal && (
        <PaymentDialog
          open={!!selectedDeal}
          onOpenChange={(open) => !open && setSelectedDeal(null)}
          dealId={selectedDeal.id}
          totalPrice={selectedDeal.total_price}
          escrowAddress={selectedDeal.escrow_address}
          expiresAt={selectedDeal.expires_at}
          channelName={selectedDeal.channel?.title || "Канал"}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default Deals;
