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
  LucideIcon
} from "lucide-react";

export interface ChannelCategory {
  id: string;
  name: string;
  icon: LucideIcon;
}

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
  { id: 'other', name: 'Другое', icon: MoreHorizontal },
];

export const getCategoryById = (id: string): ChannelCategory | undefined => {
  return channelCategories.find(cat => cat.id === id);
};
