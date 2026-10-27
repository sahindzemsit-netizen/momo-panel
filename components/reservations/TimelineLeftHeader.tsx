'use client';

import React, { memo } from 'react';
import { motion } from 'motion/react';
import { Car, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FleetSearchInput } from './FleetSearchInput';

interface TimelineLeftHeaderProps {
  isDarkMode: boolean;
  showFocusBlur: boolean;
  fleetSearch: string;
  freeTodayOnly: boolean;
  returningTodayOnly: boolean;
  returningTomorrowOnly: boolean;
  onOpenAddCarModal: () => void;
  onToggleFocusBlur: () => void;
  onFleetSearchChange: (val: string) => void;
  onToggleFreeToday: () => void;
  onToggleReturningToday: () => void;
  onToggleReturningTomorrow: () => void;
}

export const TimelineLeftHeader = memo(({
  isDarkMode,
  showFocusBlur,
  fleetSearch,
  freeTodayOnly,
  returningTodayOnly,
  returningTomorrowOnly,
  onOpenAddCarModal,
  onToggleFocusBlur,
  onFleetSearchChange,
  onToggleFreeToday,
  onToggleReturningToday,
  onToggleReturningTomorrow
}: TimelineLeftHeaderProps) => {
  return (
    <div 
      className={cn(
        "w-[285px] px-2 border-r flex flex-col items-center justify-center gap-1.5 shadow-[inset_-2px_0_10px_rgba(0,0,0,0.02)] transition-colors h-[84.2px] mt-0 ml-0 mr-0 mb-0 sticky left-0 z-50",
        isDarkMode ? "bg-[#231F1D] border-[#231F1D]" : "bg-[#F5F1E9] border-[#F5F1E9]"
      )}
      style={{ marginTop: '0px', marginBottom: '-3px' }}
    >
      <div className={cn(
        "w-[275px] h-[32px] ml-0 mt-0 mr-0 rounded-[16px] pl-[6px] pr-[8px] flex items-center gap-2 border-2 shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(0,0,0,0.03)] transition-colors relative group",
        isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-[#EBE4D9] border-white"
      )}>
        <button 
          type="button"
          onClick={onOpenAddCarModal}
          className="w-5.5 h-5.5 bg-[#0E0C0B] rounded-md flex items-center justify-center shadow-xl border-b border-black/50 shrink-0 hover:scale-110 active:scale-95 transition-all cursor-pointer group"
          title="Add New Vehicle"
        >
          <Car className="w-3 h-3 text-[#FF5C35] group-hover:rotate-12 transition-transform" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className={cn(
            "font-black text-[9px] tracking-[0.05em] transition-colors whitespace-nowrap",
            isDarkMode ? "text-white" : "text-[#0E0C0B]"
          )}>ACTIVE FLEET</span>
        </div>

        {/* Focus Toggle */}
        <button
          type="button"
          onClick={onToggleFocusBlur}
          className={cn(
            "ml-auto w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer",
            showFocusBlur 
              ? (isDarkMode ? "bg-emerald-600/50" : "bg-emerald-500") 
              : (isDarkMode ? "bg-white/5" : "bg-black/10")
          )}
          title={showFocusBlur ? "Focus Blur ON" : "Focus Blur OFF"}
        >
          <motion.div 
            animate={{ x: showFocusBlur ? 14 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center",
              isDarkMode ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" : "bg-white shadow-md"
            )}
          />
        </button>
      </div>

      {/* Search layout: Search input + Bulb toggles */}
      <div 
        className="w-[275px] flex items-center gap-1 ml-0 mt-0 mr-0"
        style={{ height: '32px' }}
      >
        <FleetSearchInput isDarkMode={isDarkMode} value={fleetSearch} onChange={onFleetSearchChange} />

        {/* 1. Yellow Bulb: Free Today */}
        <button
          type="button"
          onClick={onToggleFreeToday}
          className={cn(
            "w-[29px] h-[29px] rounded-full flex items-center justify-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03)] transition-all shrink-0 hover:scale-110 active:scale-95 cursor-pointer relative",
            freeTodayOnly
              ? (isDarkMode 
                  ? "bg-[#FFE082]/20 border-[#FFE082]/40 text-[#FFE082] shadow-[0_0_10px_rgba(255,224,130,0.3)]" 
                  : "bg-[#FFD54F]/40 border-[#FFD54F] text-[#F57F17] shadow-[0_0_10px_rgba(251,192,45,0.3)]")
              : (isDarkMode 
                  ? "bg-[#1A1614] border-white/5 text-gray-600 hover:text-gray-400" 
                  : "bg-[#EBE4D9] border-white text-gray-400 hover:text-gray-600")
          )}
          title={freeTodayOnly ? "Showing Free Cars Today (Toggled ON)" : "Show Free Cars Today (Toggled OFF)"}
        >
          <Lightbulb 
            className={cn(
              "w-3.5 h-3.5 transition-all",
              freeTodayOnly ? "fill-current text-[#FFCA28]" : ""
            )} 
          />
        </button>

        {/* 2. Red Bulb: Returning Today */}
        <button
          type="button"
          onClick={onToggleReturningToday}
          className={cn(
            "w-[29px] h-[29px] rounded-full flex items-center justify-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03)] transition-all shrink-0 hover:scale-110 active:scale-95 cursor-pointer relative",
            returningTodayOnly
              ? (isDarkMode 
                  ? "bg-[#EF5350]/20 border-[#EF5350]/40 text-[#EF5350] shadow-[0_0_10px_rgba(239,83,80,0.3)]" 
                  : "bg-[#EF5350]/30 border-[#EF5350] text-[#D32F2F] shadow-[0_0_10px_rgba(239,83,80,0.3)]")
              : (isDarkMode 
                  ? "bg-[#1A1614] border-white/5 text-gray-600 hover:text-gray-400" 
                  : "bg-[#EBE4D9] border-white text-gray-400 hover:text-gray-600")
          )}
          title={returningTodayOnly ? "Showing Returning Cars Today (Toggled ON)" : "Show Returning Cars Today (Toggled OFF)"}
        >
          <Lightbulb 
            className={cn(
              "w-3.5 h-3.5 transition-all rotate-180",
              returningTodayOnly ? "fill-current text-[#EF5350]" : ""
            )} 
          />
        </button>

        {/* 3. Purple Bulb: Returning Tomorrow (Day After Today) */}
        <button
          type="button"
          onClick={onToggleReturningTomorrow}
          className={cn(
            "w-[29px] h-[29px] rounded-full flex items-center justify-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03)] transition-all shrink-0 hover:scale-110 active:scale-95 cursor-pointer relative",
            returningTomorrowOnly
              ? (isDarkMode 
                  ? "bg-[#AB47BC]/20 border-[#AB47BC]/40 text-[#CE93D8] shadow-[0_0_10px_rgba(171,71,188,0.3)]" 
                  : "bg-[#AB47BC]/25 border-[#AB47BC] text-[#8E24AA] shadow-[0_0_10px_rgba(171,71,188,0.3)]")
              : (isDarkMode 
                  ? "bg-[#1A1614] border-white/5 text-gray-600 hover:text-gray-400" 
                  : "bg-[#EBE4D9] border-white text-gray-400 hover:text-gray-600")
          )}
          title={returningTomorrowOnly ? "Showing Cars Returning Tomorrow (Toggled ON)" : "Show Cars Returning Tomorrow (Toggled OFF)"}
        >
          <Lightbulb 
            className={cn(
              "w-3.5 h-3.5 transition-all rotate-180",
              returningTomorrowOnly ? "fill-current text-[#AB47BC]" : ""
            )} 
          />
        </button>
      </div>
    </div>
  );
});

TimelineLeftHeader.displayName = 'TimelineLeftHeader';
