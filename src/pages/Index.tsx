import { BottomNav } from "@/components/BottomNav";
import { ChannelCard } from "@/components/ChannelCard";
import { ChannelCardSkeleton } from "@/components/ChannelCardSkeleton";
import { CategoryFilters } from "@/components/CategoryFilters";
import { SearchBar } from "@/components/SearchBar";
import { StatsCard } from "@/components/StatsCard";
import { FilterChip } from "@/components/FilterChip";
import { PromoBannerCarousel } from "@/components/PromoBannerCarousel";
import { TgsSticker } from "@/components/TgsSticker";
import { mockChannels } from "@/data/mockChannels";
import { useFavorites } from "@/hooks/useFavorites";
import { useChannels } from "@/hooks/useChannels";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Heart, DollarSign, ArrowUpDown } from "lucide-react";
import animatedSticker from "@/assets/stickers/animated-sticker.tgs";
import { useState, useMemo } from "react";
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
  const { data: dbChannels, isLoading } = useChannels();
  
  // Use real channels if available, fallback to mock
  const channels = dbChannels && dbChannels.length > 0 ? dbChannels : mockChannels;

  // Вычисляем статистику из реальных данных
  const totalChannels = channels.length;
  const totalSubscribers = channels.reduce((sum, ch) => sum + ch.subscribers, 0);

  // Форматирование больших чисел
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const filteredChannels = useMemo(() => {
    return channels
      .filter((channel) => {
        const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          channel.username.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = activeCategory === "all" || 
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
          {isLoading ? (
            <>
              <div className="bg-secondary/50 rounded-2xl p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="bg-secondary/50 rounded-2xl p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-20" />
              </div>
            </>
          ) : (
            <>
              <StatsCard
                icon={<Users className="w-5 h-5" />}
                label="Каналов"
                value={formatNumber(totalChannels)}
              />
              <StatsCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Подписчиков"
                value={formatNumber(totalSubscribers)}
              />
            </>
          )}
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
            {isLoading ? (
              [1, 2, 3].map((i) => <ChannelCardSkeleton key={i} />)
            ) : filteredChannels.length > 0 ? (
              filteredChannels.map((channel, index) => (
                <div key={channel.id} className="relative">
                  {index === 0 && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                      <TgsSticker 
                        src={animatedSticker}
                        className="w-24 h-24"
                      />
                    </div>
                  )}
                  <ChannelCard 
                    {...channel} 
                    isLiked={isFavorite(channel.id)}
                    onLikeToggle={toggleFavorite}
                  />
                </div>
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
