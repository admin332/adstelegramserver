import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onFilterClick?: () => void;
}

export const SearchBar = ({ onSearch, onFilterClick }: SearchBarProps) => {
  const [query, setQuery] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Поиск каналов..."
          value={query}
          onChange={handleChange}
          className="w-full bg-secondary rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>
      <button
        onClick={onFilterClick}
        className="p-3 bg-secondary rounded-xl text-muted-foreground hover:text-foreground hover:bg-ios-gray3 transition-colors"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>
    </div>
  );
};
