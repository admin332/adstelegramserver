import { BottomNav } from "@/components/BottomNav";
import { ChannelCard } from "@/components/ChannelCard";
import { ChannelCardSkeleton } from "@/components/ChannelCardSkeleton";
import { CategoryFilters } from "@/components/CategoryFilters";
import { SearchBar } from "@/components/SearchBar";
import { FilterChip } from "@/components/FilterChip";
import { mockChannels } from "@/data/mockChannels";
import { useFavorites } from "@/hooks/useFavorites";
import { useChannels } from "@/hooks/useChannels";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { ArrowUpDown, DollarSign, Users, TrendingUp, Heart } from "lucide-react";

type SortOption = "subscribers" | "price" | "engagement" | "rating";

const Channels = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("subscribers");
  const [showFilters, setShowFilters] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { data: dbChannels, isLoading } = useChannels();
  
  // Use real channels if available, fallback to mock
  const channels = dbChannels && dbChannels.length > 0 ? dbChannels : mockChannels;

  const filteredChannels = useMemo(() => {
    return channels
      .filter((channel) => {
        const matchesSearch = 
          channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          channel.username.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = 
          activeCategory === "all" ||
          channel.category === activeCategory;
        
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
  }, [channels, searchQuery, activeCategory, showFavoritesOnly, favorites, sortBy]);

  return (
    <div className="min-h-screen bg-transparent safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header px-4 pt-4 pb-2">
        <h1 className="font-handwriting text-3xl md:text-4xl text-white mb-4 text-center">Каталог</h1>
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
      <main className="px-4 py-4 space-y-4">
        <CategoryFilters onCategoryChange={setActiveCategory} />
        
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            `Найдено: ${filteredChannels.length} каналов`
          )}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => <ChannelCardSkeleton key={i} />)
          ) : filteredChannels.length > 0 ? (
            filteredChannels.map((channel) => (
              <ChannelCard 
                key={channel.id} 
                {...channel} 
                isLiked={isFavorite(channel.id)}
                onLikeToggle={toggleFavorite}
                acceptedCampaignTypes={channel.acceptedCampaignTypes}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {showFavoritesOnly ? "Нет избранных каналов" : "Каналы не найдены"}
              </p>
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
