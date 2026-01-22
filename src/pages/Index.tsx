import { BottomNav } from "@/components/BottomNav";
import { ChannelCard } from "@/components/ChannelCard";
import { CategoryFilters } from "@/components/CategoryFilters";
import { SearchBar } from "@/components/SearchBar";
import { StatsCard } from "@/components/StatsCard";
import { mockChannels } from "@/data/mockChannels";
import { TrendingUp, Users, Wallet, Zap } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredChannels = mockChannels.filter((channel) => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === "all" || 
      channel.category.toLowerCase() === getCategoryName(activeCategory).toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  function getCategoryName(id: string): string {
    const map: Record<string, string> = {
      crypto: "Крипто",
      news: "Новости",
      gaming: "Игры",
      education: "Обучение",
      lifestyle: "Лайфстайл",
      food: "Еда",
      travel: "Путешествия",
      business: "Бизнес",
      music: "Музыка",
    };
    return map[id] || "";
  }

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gradient">Adsingo</h1>
            <p className="text-sm text-muted-foreground">Рекламная площадка</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
        </div>
        <SearchBar onSearch={setSearchQuery} />
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            icon={<Users className="w-5 h-5" />}
            label="Каналов"
            value="2,450"
            trend={12}
          />
          <StatsCard
            icon={<Wallet className="w-5 h-5" />}
            label="Сделок"
            value="$1.2M"
            trend={8}
          />
        </div>

        {/* Categories */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Категории</h2>
          <CategoryFilters onCategoryChange={setActiveCategory} />
        </section>

        {/* Featured Channels */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Популярные каналы</h2>
            <button className="text-sm text-primary font-medium">Все</button>
          </div>
          <div className="space-y-3">
            {filteredChannels.length > 0 ? (
              filteredChannels.map((channel) => (
                <ChannelCard key={channel.id} {...channel} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Каналы не найдены
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
