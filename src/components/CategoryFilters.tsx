import { useState } from "react";
import { FilterChip } from "./FilterChip";
import { 
  Sparkles, 
  Gamepad2, 
  Bitcoin, 
  Newspaper, 
  GraduationCap, 
  Heart, 
  Utensils,
  Plane,
  Briefcase,
  Music
} from "lucide-react";

const categories = [
  { id: "all", label: "Все", icon: Sparkles },
  { id: "crypto", label: "Крипто", icon: Bitcoin },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "gaming", label: "Игры", icon: Gamepad2 },
  { id: "education", label: "Обучение", icon: GraduationCap },
  { id: "lifestyle", label: "Лайфстайл", icon: Heart },
  { id: "food", label: "Еда", icon: Utensils },
  { id: "travel", label: "Путешествия", icon: Plane },
  { id: "business", label: "Бизнес", icon: Briefcase },
  { id: "music", label: "Музыка", icon: Music },
];

interface CategoryFiltersProps {
  onCategoryChange?: (category: string) => void;
}

export const CategoryFilters = ({ onCategoryChange }: CategoryFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    onCategoryChange?.(categoryId);
  };

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-2 px-4 -mx-4">
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <FilterChip
            key={category.id}
            active={activeCategory === category.id}
            onClick={() => handleCategoryClick(category.id)}
            icon={<Icon className="w-4 h-4" />}
          >
            {category.label}
          </FilterChip>
        );
      })}
    </div>
  );
};
