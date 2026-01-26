import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DealCard } from "@/components/DealCard";
import { FilterChip } from "@/components/FilterChip";
import { PaymentDialog } from "@/components/deals/PaymentDialog";
import { OwnerActionsDialog } from "@/components/deals/OwnerActionsDialog";
import { useUserDeals, type Deal } from "@/hooks/useUserDeals";
import { useDealAction } from "@/hooks/useDealAction";
import { useTonPrice } from "@/hooks/useTonPrice";
import { Inbox, Clock, CheckCircle2, Wallet, Loader2, Users, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DealFilter = "all" | "pending" | "active" | "completed";
type RoleFilter = "all" | "advertiser" | "channel_owner";

const Deals = () => {
  const { data: deals, isLoading, refetch } = useUserDeals();
  const { convertToUsd } = useTonPrice();
  const dealAction = useDealAction();
  
  const [filter, setFilter] = useState<DealFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [ownerActionDeal, setOwnerActionDeal] = useState<Deal | null>(null);

  const filters = [
    { id: "all" as const, label: "Все", icon: Inbox },
    { id: "pending" as const, label: "К оплате", icon: Wallet },
    { id: "active" as const, label: "Активные", icon: Clock },
    { id: "completed" as const, label: "Завершённые", icon: CheckCircle2 },
  ];

  const roleFilters = [
    { id: "all" as const, label: "Все", icon: Inbox },
    { id: "advertiser" as const, label: "Мои заказы", icon: ShoppingBag },
    { id: "channel_owner" as const, label: "На мои каналы", icon: Users },
  ];

  // Check if user has channel owner deals
  const hasChannelOwnerDeals = deals?.some(d => d.role === 'channel_owner');

  const filteredDeals = (deals || []).filter((deal) => {
    // Role filter
    if (roleFilter !== "all" && deal.role !== roleFilter) return false;
    
    // Status filter
    if (filter === "all") return true;
    if (filter === "pending") return deal.status === "pending";
    if (filter === "active") return ["escrow", "in_progress"].includes(deal.status);
    if (filter === "completed") return ["completed", "cancelled", "disputed", "expired"].includes(deal.status);
    return true;
  });

  const handlePayClick = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  const handlePaymentSuccess = () => {
    refetch();
  };

  const handleOwnerAction = (deal: Deal) => {
    setOwnerActionDeal(deal);
  };

  const handleApprove = () => {
    if (!ownerActionDeal) return;
    dealAction.mutate(
      { dealId: ownerActionDeal.id, action: 'approve' },
      { onSuccess: () => setOwnerActionDeal(null) }
    );
  };

  const handleReject = () => {
    if (!ownerActionDeal) return;
    dealAction.mutate(
      { dealId: ownerActionDeal.id, action: 'reject' },
      { onSuccess: () => setOwnerActionDeal(null) }
    );
  };

  const handleRequestChanges = () => {
    if (!ownerActionDeal) return;
    dealAction.mutate(
      { dealId: ownerActionDeal.id, action: 'request_changes' },
      { onSuccess: () => setOwnerActionDeal(null) }
    );
  };

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header px-4 pt-4 pb-2">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white mb-4 text-center">Мои сделки</h1>
        
        {/* Role filter (only show if user has channel owner deals) */}
        {hasChannelOwnerDeals && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 mb-2">
            {roleFilters.map((f) => {
              const Icon = f.icon;
              return (
                <FilterChip
                  key={f.id}
                  active={roleFilter === f.id}
                  onClick={() => setRoleFilter(f.id)}
                  icon={<Icon className="w-4 h-4" />}
                >
                  {f.label}
                </FilterChip>
              );
            })}
          </div>
        )}
        
        {/* Status filter */}
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
          // Loading skeletons
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
              usdEquivalent={convertToUsd(deal.total_price)}
              role={deal.role}
              onPayClick={() => handlePayClick(deal)}
              onOwnerAction={() => handleOwnerAction(deal)}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">Нет сделок</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "all" && roleFilter === "all"
                ? "Ваши сделки появятся здесь" 
                : "Нет сделок с такими фильтрами"}
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

      {/* Owner Actions Dialog */}
      {ownerActionDeal && (
        <OwnerActionsDialog
          open={!!ownerActionDeal}
          onOpenChange={(open) => !open && setOwnerActionDeal(null)}
          channelName={ownerActionDeal.channel?.title || ownerActionDeal.channel?.username || "Канал"}
          campaignName={ownerActionDeal.campaign?.name}
          onApprove={handleApprove}
          onReject={handleReject}
          onRequestChanges={handleRequestChanges}
          isLoading={dealAction.isPending}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default Deals;
