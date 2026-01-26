export interface PostStat {
  messageId: number;
  views: number;
  date: string;
}

export interface LanguageStat {
  language: string;
  percentage: number;
}

export interface Channel {
  id: string;
  name: string;
  username: string;
  avatar: string;
  subscribers: number;
  avgViews: number;
  category: string;
  price: number;
  tonPrice: number;
  rating: number;
  verified: boolean;
  premium?: boolean;
  description?: string;
  language?: string;
  engagement?: number;
  successfulAds?: number;
  recentPostsStats?: PostStat[];
  languageStats?: LanguageStat[];
  premiumPercentage?: number;
  statsUpdatedAt?: string;
}

export const mockChannels: Channel[] = [
  {
    id: "1",
    name: "CryptoNews",
    username: "cryptonews_official",
    avatar: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=600&fit=crop&q=80",
    subscribers: 125000,
    avgViews: 45000,
    category: "Крипто",
    price: 350,
    tonPrice: 50,
    rating: 4.8,
    verified: true,
    premium: true,
    description: "Канал о криптовалютах и блокчейне. Ежедневные новости, аналитика рынка и обзоры перспективных проектов.",
    successfulAds: 156,
    engagement: 36,
  },
  {
    id: "2",
    name: "GameZone",
    username: "gamezone_pro",
    avatar: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop&q=80",
    subscribers: 89000,
    avgViews: 32000,
    category: "Игры",
    price: 200,
    tonPrice: 30,
    rating: 4.6,
    verified: true,
    description: "Всё о видеоиграх: обзоры, новости, стримы и гайды. Лучший контент для геймеров!",
    successfulAds: 89,
    engagement: 36,
  },
  {
    id: "3",
    name: "Daily Tech",
    username: "dailytech",
    avatar: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop&q=80",
    subscribers: 210000,
    avgViews: 78000,
    category: "Новости",
    price: 500,
    tonPrice: 80,
    rating: 4.9,
    verified: true,
    premium: true,
    description: "Технологические новости каждый день. Гаджеты, софт, стартапы и инновации.",
    successfulAds: 234,
    engagement: 37,
  },
  {
    id: "4",
    name: "FitLife",
    username: "fitlife_ru",
    avatar: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop&q=80",
    subscribers: 67000,
    avgViews: 25000,
    category: "Лайфстайл",
    price: 150,
    tonPrice: 25,
    rating: 4.5,
    verified: false,
    description: "Здоровый образ жизни, тренировки и питание. Мотивация и полезные советы каждый день.",
    successfulAds: 45,
    engagement: 37,
  },
  {
    id: "5",
    name: "StartupHub",
    username: "startup_hub",
    avatar: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=600&fit=crop&q=80",
    subscribers: 156000,
    avgViews: 52000,
    category: "Бизнес",
    price: 400,
    tonPrice: 60,
    rating: 4.7,
    verified: true,
    description: "Стартапы, инвестиции и бизнес-идеи. Истории успеха и практические советы для предпринимателей.",
    successfulAds: 178,
    engagement: 33,
  },
  {
    id: "6",
    name: "FoodieGram",
    username: "foodiegram",
    avatar: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&q=80",
    subscribers: 95000,
    avgViews: 41000,
    category: "Еда",
    price: 180,
    tonPrice: 35,
    rating: 4.4,
    verified: true,
    description: "Рецепты, обзоры ресторанов и кулинарные лайфхаки. Вкусный контент каждый день!",
    successfulAds: 67,
    engagement: 43,
  },
  {
    id: "7",
    name: "TravelWorld",
    username: "travel_world",
    avatar: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop&q=80",
    subscribers: 178000,
    avgViews: 65000,
    category: "Путешествия",
    price: 320,
    tonPrice: 55,
    rating: 4.8,
    verified: true,
    premium: true,
    description: "Путешествия по всему миру. Лайфхаки, маршруты и красивые фотографии из разных уголков планеты.",
    successfulAds: 198,
    engagement: 37,
  },
  {
    id: "8",
    name: "MusicVibes",
    username: "musicvibes",
    avatar: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=600&fit=crop&q=80",
    subscribers: 112000,
    avgViews: 48000,
    category: "Музыка",
    price: 250,
    tonPrice: 40,
    rating: 4.6,
    verified: false,
    description: "Музыкальные новинки, подборки треков и обзоры артистов. Для истинных меломанов.",
    successfulAds: 89,
    engagement: 43,
  },
];

export const mockDeals = [
  {
    id: "1",
    channelName: "CryptoNews",
    channelAvatar: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=600&fit=crop&q=80",
    advertiserName: "BlockchainApp",
    status: "escrow" as const,
    amount: 350,
    createdAt: "2 часа назад",
    adFormat: "Пост",
  },
  {
    id: "2",
    channelName: "GameZone",
    channelAvatar: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop&q=80",
    advertiserName: "GameStudio",
    status: "in_review" as const,
    amount: 200,
    createdAt: "5 часов назад",
    adFormat: "Сторис",
  },
  {
    id: "3",
    channelName: "Daily Tech",
    channelAvatar: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop&q=80",
    advertiserName: "TechCorp",
    status: "completed" as const,
    amount: 500,
    createdAt: "1 день назад",
    adFormat: "Пост",
  },
];
