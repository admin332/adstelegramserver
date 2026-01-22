import { BottomNav } from "@/components/BottomNav";
import { DealCard } from "@/components/DealCard";
import { FilterChip } from "@/components/FilterChip";
import { mockDeals } from "@/data/mockChannels";
import { useState } from "react";
import { Inbox, Clock, CheckCircle2, XCircle } from "lucide-react";

type DealFilter = "all" | "active" | "completed" | "cancelled";

const Deals = () => {
  const [filter, setFilter] = useState<DealFilter>("all");

  const filters = [
    { id: "all" as const, label: "Все", icon: Inbox },
    { id: "active" as const, label: "Активные", icon: Clock },
    { id: "completed" as const, label: "Завершённые", icon: CheckCircle2 },
    { id: "cancelled" as const, label: "Отменённые", icon: XCircle },
  ];

  const filteredDeals = mockDeals.filter((deal) => {
    if (filter === "all") return true;
    if (filter === "active") return ["pending", "in_review", "approved", "escrow", "published"].includes(deal.status);
    if (filter === "completed") return deal.status === "completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass px-4 pt-6 pb-4">
        <h1 className="text-2xl font-pacifico text-white mb-4 text-center">Мои сделки</h1>
        
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
        {filteredDeals.length > 0 ? (
          filteredDeals.map((deal) => <DealCard key={deal.id} {...deal} />)
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">Нет сделок</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ваши сделки появятся здесь
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Deals;
