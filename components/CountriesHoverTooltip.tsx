'use client';

import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface CountriesTooltipDetail {
  countries: string[];
  x: number;
  y: number;
  isDarkMode?: boolean;
}

export const CountriesHoverTooltip = memo(() => {
  const [data, setData] = useState<CountriesTooltipDetail | null>(null);

  useEffect(() => {
    const handleShow = (e: CustomEvent<CountriesTooltipDetail>) => {
      setData(e.detail);
    };

    const handleHide = () => {
      setData(null);
    };

    window.addEventListener('show-countries-tooltip', handleShow as EventListener);
    window.addEventListener('hide-countries-tooltip', handleHide);

    return () => {
      window.removeEventListener('show-countries-tooltip', handleShow as EventListener);
      window.removeEventListener('hide-countries-tooltip', handleHide);
    };
  }, []);

  if (!data || !data.countries || !data.countries.length || typeof document === 'undefined') {
    return null;
  }

  const isDark = !!data.isDarkMode;

  return createPortal(
    <div 
      className="fixed z-[99999] pointer-events-none transition-none"
      style={{
        top: data.y,
        left: data.x,
        transform: 'translate(-50%, calc(-100% - 8px))'
      }}
    >
      <div className={cn(
        "p-2 rounded-xl border shadow-2xl min-w-[120px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150",
        isDark 
          ? "bg-[#2C2724]/95 border-white/10 text-white shadow-black/40" 
          : "bg-white/95 border-black/10 text-[#0E0C0B] shadow-black/10"
      )}>
        <p className="text-[8px] font-black tracking-widest uppercase mb-1 opacity-60">Authorized Countries</p>
        <div className="flex flex-wrap gap-1">
          {data.countries.map((country, idx) => (
            <span key={idx} className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
              isDark ? "bg-white/10 text-white" : "bg-black/5 text-[#0E0C0B]"
            )}>
              {country}
            </span>
          ))}
        </div>
        <div className={cn(
          "absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent",
          isDark ? "border-t-[#2C2724]/95" : "border-t-white/95"
        )} />
      </div>
    </div>,
    document.body
  );
});

CountriesHoverTooltip.displayName = 'CountriesHoverTooltip';
