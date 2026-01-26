import { BottomNav } from "@/components/BottomNav";
import { ChannelCard } from "@/components/ChannelCard";
import { CategoryFilters } from "@/components/CategoryFilters";
import { SearchBar } from "@/components/SearchBar";
import { StatsCard } from "@/components/StatsCard";
import { FilterChip } from "@/components/FilterChip";
import { PromoBannerCarousel } from "@/components/PromoBannerCarousel";
import { mockChannels } from "@/data/mockChannels";
import { useFavorites } from "@/hooks/useFavorites";
import { TrendingUp, Users, Heart, DollarSign, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type SortOption = "subscribers" | "price" | "engagement" | "rating";

const Index = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("subscribers");
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const filteredChannels = mockChannels
    .filter((channel) => {
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.username.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === "all" || 
        channel.category.toLowerCase() === getCategoryName(activeCategory).toLowerCase();
      
      const matchesFavorites = !showFavoritesOnly || favorites.includes(channel.id);
      
      return matchesSearch && matchesCategory && matchesFavorites;
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
      <header className="sticky top-0 z-40 glass-header px-4 pt-4 pb-2">
        <div className="text-center mb-4">
          <h1 className="font-handwriting text-3xl md:text-4xl text-white">Adsingo</h1>
        </div>
        <SearchBar onSearch={setSearchQuery} onFilterClick={() => setShowFilters(!showFilters)} />
        
        {/* Filters */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar py-3 -mx-4 px-4 animate-slide-up">
            <FilterChip
              active={showFavoritesOnly}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              icon={<Heart className="w-4 h-4" />}
            >
              Избранное
            </FilterChip>
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
            icon={<TrendingUp className="w-5 h-5" />}
            label="Подписчиков"
            value="22M"
            trend={5}
          />
        </div>

        {/* Promo Banners */}
        <PromoBannerCarousel />

        {/* Categories */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-1.5">Категории</h2>
          <CategoryFilters onCategoryChange={setActiveCategory} />
        </section>

        {/* Featured Channels */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Популярные каналы</h2>
            <button 
              className="text-sm text-primary font-medium"
              onClick={() => navigate('/channels')}
            >
              Все
            </button>
          </div>
          <div className="space-y-3">
            {filteredChannels.length > 0 ? (
              filteredChannels.map((channel) => (
                <ChannelCard 
                  key={channel.id} 
                  {...channel} 
                  isLiked={isFavorite(channel.id)}
                  onLikeToggle={toggleFavorite}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {showFavoritesOnly ? "Нет избранных каналов" : "Каналы не найдены"}
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
