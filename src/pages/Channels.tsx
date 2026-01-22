import { BottomNav } from "@/components/BottomNav";
import { ChannelCard } from "@/components/ChannelCard";
import { CategoryFilters } from "@/components/CategoryFilters";
import { SearchBar } from "@/components/SearchBar";
import { FilterChip } from "@/components/FilterChip";
import { mockChannels } from "@/data/mockChannels";
import { useState } from "react";
import { ArrowUpDown, DollarSign, Users, TrendingUp } from "lucide-react";

type SortOption = "subscribers" | "price" | "engagement" | "rating";

const Channels = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("subscribers");
  const [showFilters, setShowFilters] = useState(false);

  const getCategoryName = (id: string): string => {
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
  };

  const filteredChannels = mockChannels
    .filter((channel) => {
      const matchesSearch = 
        channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.username.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        activeCategory === "all" ||
        channel.category.toLowerCase() === getCategoryName(activeCategory).toLowerCase();
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "subscribers":
          return b.subscribers - a.subscribers;
        case "price":
          return a.price - b.price;
        case "engagement":
          return (b.avgViews / b.subscribers) - (a.avgViews / a.subscribers);
        case "rating":
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass px-4 pt-4 pb-2">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white mb-4 text-center">Каталог каналов</h1>
        <SearchBar onSearch={setSearchQuery} onFilterClick={() => setShowFilters(!showFilters)} />
        
        {/* Sort Options */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar py-3 -mx-4 px-4 animate-slide-up">
            <FilterChip
              active={sortBy === "subscribers"}
              onClick={() => setSortBy("subscribers")}
              icon={<Users className="w-4 h-4" />}
            >
              Подписчики
            </FilterChip>
            <FilterChip
              active={sortBy === "price"}
              onClick={() => setSortBy("price")}
              icon={<DollarSign className="w-4 h-4" />}
            >
              Цена
            </FilterChip>
            <FilterChip
              active={sortBy === "engagement"}
              onClick={() => setSortBy("engagement")}
              icon={<TrendingUp className="w-4 h-4" />}
            >
              Вовлечённость
            </FilterChip>
            <FilterChip
              active={sortBy === "rating"}
              onClick={() => setSortBy("rating")}
              icon={<ArrowUpDown className="w-4 h-4" />}
            >
              Рейтинг
            </FilterChip>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-4">
        <CategoryFilters onCategoryChange={setActiveCategory} />
        
        <div className="text-sm text-muted-foreground">
          Найдено: {filteredChannels.length} каналов
        </div>

        <div className="space-y-3">
          {filteredChannels.length > 0 ? (
            filteredChannels.map((channel) => (
              <ChannelCard key={channel.id} {...channel} />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Каналы не найдены</p>
              <p className="text-sm text-muted-foreground mt-1">Попробуйте изменить фильтры</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Channels;
