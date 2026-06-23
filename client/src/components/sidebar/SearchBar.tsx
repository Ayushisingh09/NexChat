import React, { useState, useRef } from 'react';
import { Search, ArrowLeft, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    onSearch(val);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const isActive = isFocused || value;

  return (
    <div className="px-3 py-2.5 flex items-center">
      <div
        className={`relative flex-grow flex items-center rounded-2xl px-3 py-2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isActive
            ? 'bg-white/[0.07] ring-1 ring-wa-green/40 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)]'
            : 'bg-white/[0.035] ring-1 ring-white/10 hover:bg-white/[0.06] hover:ring-white/15'
        }`}
      >
        <div className="relative w-5 h-5 mr-3 shrink-0">
          {/* Search icon — fades/slides out when active */}
          <Search
            className={`w-5 h-5 text-wa-secondary absolute inset-0 transition-all duration-300 ${
              isActive ? 'opacity-0 -translate-x-1 scale-90' : 'opacity-100 translate-x-0 scale-100'
            }`}
          />
          {/* Back arrow — fades/slides in when active */}
          <button type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={`absolute inset-0 text-wa-green transition-all duration-300 ${
              isActive ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-1 scale-90'
            }`}
            tabIndex={isActive ? 0 : -1}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          data-search-input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => !value && setIsFocused(false)}
          placeholder="Search or start new chat (Cmd+K)"
          className="bg-transparent border-none text-sm text-wa-primary placeholder-wa-secondary/60 focus:outline-none w-full"
        />

        {/* Clear X button appears when text is entered */}
        <button type="button"
          onClick={handleClear}
          aria-label="Clear text"
          className={`p-0.5 text-wa-secondary hover:text-wa-primary rounded-full transition-all duration-200 shrink-0 ${
            value ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
