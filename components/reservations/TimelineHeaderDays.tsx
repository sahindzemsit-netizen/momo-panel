'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { CalendarDay, BIRTHSTONE_COLORS } from './types';
import { MonthDivider } from './MonthDivider';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

export const getHeaderGradient = (days: CalendarDay[], isDark: boolean) => {
  if (!days || days.length === 0) return '';
  const baseColor = isDark ? '35, 31, 29' : '245, 241, 233'; // #231F1D vs #F5F1E9
  const baseHex = isDark ? '#231F1D' : '#F5F1E9';
  
  let stops = '';
  if (days.length === 1) {
    const m = days[0].date.getMonth();
    const info = BIRTHSTONE_COLORS[m];
    const rgb = info ? info.rgb : [245, 241, 239];
    const alpha = isDark ? 0.28 : 0.38;
    stops = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) 0%, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) 100%`;
  } else {
    stops = days.map((d, index) => {
      const pct = ((index / (days.length - 1)) * 100).toFixed(1);
      const m = d.date.getMonth();
      const info = BIRTHSTONE_COLORS[m];
      const rgb = info ? info.rgb : [245, 241, 239];
      const alpha = isDark ? 0.28 : 0.38;
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) ${pct}%`;
    }).join(', ');
  }
  
  const horizontalGradient = `linear-gradient(to right, ${stops})`;
  const verticalFade = `linear-gradient(to bottom, ${baseHex} 0%, rgba(${baseColor}, 0.2) 65%, transparent 100%)`;
  
  return `${verticalFade}, ${horizontalGradient}`;
};

interface TimelineHeaderDaysProps {
  calendarDays: CalendarDay[];
  isDarkMode: boolean;
  showFocusBlur: boolean;
}

export const TimelineHeaderDays = memo(({
  calendarDays,
  isDarkMode,
  showFocusBlur
}: TimelineHeaderDaysProps) => {
  return (
    <div 
      className={cn(
        "flex-1 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] transition-colors h-full flex flex-col justify-end py-2.5"
      )}
      style={{
        background: getHeaderGradient(calendarDays, isDarkMode)
      }}
    >
      <div className={cn(
        "flex w-full px-1 py-1 items-end pb-1",
        !showFocusBlur && "gap-0.5"
      )}>
        {calendarDays.map((day, idx) => {
          const isNewMonth = idx > 0 && day.date.getMonth() !== calendarDays[idx-1].date.getMonth();

          return (
            <React.Fragment key={day.date.getTime()}>
              {isNewMonth && (
                <MonthDivider 
                  monthName={MONTHS[day.date.getMonth()]} 
                  isDarkMode={isDarkMode} 
                  showFocusBlur={showFocusBlur} 
                  isHeader={true} 
                />
              )}
              <div 
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 min-w-0 h-[53.2px]"
                )}
                style={{ flex: '1 0 0%', marginBottom: '-10px' }}
              >
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tight">{day.weekday}</span>
                <div className="flex flex-col items-center gap-1">
                  <span className={cn(
                    "text-[11px] font-black transition-all",
                    day.isToday ? "text-[#FF5C35] scale-110" : (isDarkMode ? "text-white" : "text-[#0E0C0B]")
                  )}
                  style={{
                    opacity: showFocusBlur && day.isPast ? 0.4 : 1
                  }}>
                    {day.day}
                  </span>
                  <div className={cn(
                    "w-4 h-[2px] rounded-full transition-all",
                    day.isToday ? "bg-[#FF5C35]" : "opacity-75"
                  )}
                  style={{
                    backgroundColor: day.isToday 
                      ? undefined 
                      : `rgb(${BIRTHSTONE_COLORS[day.date.getMonth()]?.rgb.join(',') || '128,128,128'})`,
                    opacity: showFocusBlur && day.isPast ? 0.2 : 1
                  }} />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

TimelineHeaderDays.displayName = 'TimelineHeaderDays';
