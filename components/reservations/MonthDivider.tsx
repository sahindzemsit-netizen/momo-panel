import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { BIRTHSTONE_COLORS } from './types';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

interface MonthDividerProps {
  monthName: string;
  isDarkMode: boolean;
  showFocusBlur?: boolean;
  isHeader?: boolean;
}

export const MonthDivider = memo(({ monthName, isDarkMode, showFocusBlur, isHeader }: MonthDividerProps) => {
  const mIndex = MONTHS.indexOf(monthName.toUpperCase());
  const info = mIndex !== -1 ? BIRTHSTONE_COLORS[mIndex] : null;
  const rgb = info ? info.rgb : null;

  const bgStyle = rgb ? {
    background: `linear-gradient(to bottom, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isDarkMode ? 0.28 : 0.32}) 0%, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isDarkMode ? 0.01 : 0.03}) 100%)`
  } : {};

  return (
    <div 
      className={cn(
        "flex items-center justify-center relative shrink-0",
        isHeader ? "h-[53.2px]" : "h-full",
        showFocusBlur ? "px-0 mx-0" : "px-0 mx-0",
        isDarkMode ? "border-x border-white/5" : "border-x border-black/5"
      )}
      style={{ 
        flex: '0.5 0 0%',
        ...bgStyle,
        ...(isHeader ? { marginBottom: '-10px' } : {})
      }}
    >
      <span 
        className={cn(
          "text-[8px] font-black tracking-[0.3em] uppercase whitespace-nowrap z-10",
          isDarkMode ? "text-white/50" : "text-black/60"
        )} 
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {monthName}
      </span>
    </div>
  );
});

MonthDivider.displayName = 'MonthDivider';
