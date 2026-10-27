'use client';

import React, { memo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FleetSearchInputProps {
  isDarkMode: boolean;
  value: string;
  onChange: (val: string) => void;
}

export const FleetSearchInput = memo(({ isDarkMode, value, onChange }: FleetSearchInputProps) => {
  return (
    <div 
      className={cn(
        "flex-1 h-full rounded-[16px] flex items-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(0,0,0,0.03)] transition-colors relative group",
        isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-[#EBE4D9] border-white"
      )}
    >
      <Search 
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 transition-colors z-10",
          isDarkMode ? "text-gray-500" : "text-gray-400"
        )} 
      />
      <input
        type="text"
        placeholder="SEARCH CARS..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-full bg-transparent pl-8 pr-7 text-[10px] font-extrabold tracking-wide uppercase transition-all duration-300 outline-none border-none",
          isDarkMode ? "text-white placeholder:text-gray-600" : "text-[#0E0C0B] placeholder:text-gray-400"
        )}
        style={{ height: '28px' }}
      />
      {value && (
        <button 
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-[#FF5C35] cursor-pointer z-10 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});

FleetSearchInput.displayName = 'FleetSearchInput';
