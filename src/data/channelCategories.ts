import { 
  Bitcoin, 
  Cpu, 
  TrendingUp, 
  Briefcase, 
  Gamepad2, 
  Heart, 
  Newspaper, 
  Film, 
  GraduationCap, 
  MoreHorizontal,
  Sparkles,
  Utensils,
  Plane,
  Music,
  LucideIcon
} from "lucide-react";

export interface ChannelCategory {
  id: string;
  name: string;
  icon: LucideIcon;
}

// Категория "Все" для фильтров
export const allCategory: ChannelCategory = { id: 'all', name: 'Все', icon: Sparkles };

// Основные категории каналов (используются при добавлении канала)
export const channelCategories: ChannelCategory[] = [
  { id: 'crypto', name: 'Криптовалюты', icon: Bitcoin },
  { id: 'tech', name: 'Технологии', icon: Cpu },
  { id: 'marketing', name: 'Маркетинг', icon: TrendingUp },
  { id: 'business', name: 'Бизнес', icon: Briefcase },
  { id: 'games', name: 'Игры', icon: Gamepad2 },
  { id: 'lifestyle', name: 'Лайфстайл', icon: Heart },
  { id: 'news', name: 'Новости', icon: Newspaper },
  { id: 'entertainment', name: 'Развлечения', icon: Film },
  { id: 'education', name: 'Образование', icon: GraduationCap },
  { id: 'food', name: 'Еда', icon: Utensils },
  { id: 'travel', name: 'Путешествия', icon: Plane },
  { id: 'music', name: 'Музыка', icon: Music },
  { id: 'other', name: 'Другое', icon: MoreHorizontal },
];

// Категории для фильтров (включая "Все")
export const filterCategories: ChannelCategory[] = [allCategory, ...channelCategories];

export const getCategoryById = (id: string): ChannelCategory | undefined => {
  return channelCategories.find(cat => cat.id === id);
};
