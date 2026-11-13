'use client';

import React, { memo } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineSlideNavigationProps {
  isDarkMode: boolean;
  escalatorOffsetDays: number;
  onReset: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  isMobileCompactView?: boolean;
}

export const TimelineSlideNavigation = memo(({
  isDarkMode,
  escalatorOffsetDays,
  onReset,
  onPrevDay,
  onNextDay,
  isMobileCompactView = false
}: TimelineSlideNavigationProps) => {
  return (
    <div className={cn(
      "flex shrink-0 relative z-30 select-none mt-2 rounded-[20px] border overflow-hidden shadow-lg transition-all duration-500",
      isDarkMode 
        ? "bg-[#2C2724] border-white/5 text-white" 
        : "bg-white border-[#F5F1E9] text-[#0E0C0B]",
      "h-11 items-center"
    )}>
      {/* Left Column: Spacer matching vehicle info width */}
      <div className={cn(
        isMobileCompactView ? "w-[160px] sm:w-[285px] px-2 sm:px-4" : "w-auto sm:w-[285px] px-3 sm:px-4",
        "border-r shrink-0 flex items-center justify-between transition-colors h-full gap-1 sm:gap-2",
        isDarkMode ? "border-white/5 bg-[#231F1D]" : "border-[#F5F1E9]/50 bg-[#F5F1E9]/30"
      )}>
        <span className={cn(
          "text-[8px] font-black tracking-widest uppercase whitespace-nowrap",
          isDarkMode ? "text-gray-500" : "text-gray-400"
        )}>
          CALENDAR SLIDE
        </span>
        <RotateCcw 
          className={cn(
            "w-3 h-3 cursor-pointer transition-all active:scale-90 shrink-0",
            escalatorOffsetDays === 0
              ? "text-gray-600/30 cursor-not-allowed"
              : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black")
          )}
          onClick={() => {
            if (escalatorOffsetDays !== 0) {
              onReset();
            }
          }}
          title="Reset slide to today"
        />
      </div>

      {/* Right Column: Left/Right Arrow Navigation */}
      <div className={cn(
        "flex-1 flex justify-between items-center px-2 sm:px-4 h-full relative z-30 gap-2",
        isDarkMode ? "bg-[#1A1614]/50" : "bg-white/50"
      )}>
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={onPrevDay}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border shadow-md hover:scale-105 active:scale-95",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 text-white hover:border-[#FF5C35]/50 hover:bg-[#FF5C35]/10" 
              : "bg-white border-black/10 text-black hover:border-[#FF5C35] hover:bg-[#FF5C35]/5"
          )}
          title="Slide calendar left by 1 day"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Middle Indicator */}
        <span className={cn(
          "text-[8px] font-black uppercase tracking-[0.3em] select-none",
          isDarkMode ? "text-gray-500" : "text-gray-400"
        )}>
          {escalatorOffsetDays !== 0 ? `SHIFTED ${Math.abs(escalatorOffsetDays)} DAY${Math.abs(escalatorOffsetDays) > 1 ? 'S' : ''} ${escalatorOffsetDays > 0 ? '▶' : '◀'}` : '◀ SLIDE TIMELINE ▶'}
        </span>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={onNextDay}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border shadow-md hover:scale-105 active:scale-95",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 text-white hover:border-[#FF5C35]/50 hover:bg-[#FF5C35]/10" 
              : "bg-white border-black/10 text-black hover:border-[#FF5C35] hover:bg-[#FF5C35]/5"
          )}
          title="Slide calendar right by 1 day"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

TimelineSlideNavigation.displayName = 'TimelineSlideNavigation';
