import { useState } from "react";
import { FilterChip } from "./FilterChip";
import { filterCategories } from "@/data/channelCategories";

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
      {filterCategories.map((category) => {
        const Icon = category.icon;
        return (
          <FilterChip
            key={category.id}
            active={activeCategory === category.id}
            onClick={() => handleCategoryClick(category.id)}
            icon={<Icon className="w-4 h-4" />}
          >
            {category.name}
          </FilterChip>
        );
      })}
    </div>
  );
};
