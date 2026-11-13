'use client';

import React, { memo } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_COLORS, VEHICLE_COUNTRIES } from '@/lib/constants';

interface FilterHeaderProps {
  isDarkMode: boolean;
  isSelectionEnabled: boolean;
  setIsSelectionEnabled: (val: boolean) => void;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  setIsRelocationMode: (val: boolean) => void;
  setSelectionStart: (val: any) => void;
  setReservationToMove: (val: any) => void;
  setCarIdToMove: (id: any) => void;
  setReservationIdToSwap: (id: any) => void;
  activeCountry: string;
  setActiveCountry: (country: string) => void;
  countryCounts: Record<string, number>;
  incomingFleetCount: number;
  setIsIncomingFleetOpen: (val: boolean) => void;
  isMobileCompactView?: boolean;
  onToggleMobileCompact?: () => void;
}

export const FilterHeader = memo(({
  isDarkMode,
  isSelectionEnabled,
  setIsSelectionEnabled,
  isEditMode,
  setIsEditMode,
  setIsRelocationMode,
  setSelectionStart,
  setReservationToMove,
  setCarIdToMove,
  setReservationIdToSwap,
  activeCountry,
  setActiveCountry,
  countryCounts,
  incomingFleetCount,
  setIsIncomingFleetOpen,
  isMobileCompactView = false,
  onToggleMobileCompact,
}: FilterHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 mb-3 md:mb-4 px-1 md:px-0 shrink-0 w-full">
      {/* Mobile Top Controls: Selection & Edit Mode toggles + Incoming Fleet button */}
      <div className="flex md:hidden items-center justify-between gap-1 w-full">
        <div className={cn(
          "flex items-center gap-1.5 sm:gap-3 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full border shadow-sm",
          isDarkMode 
            ? "bg-black/40 border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]" 
            : "bg-gray-100/50 border-gray-200/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]"
        )}>
          {/* Selection Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className={cn(
              "text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider transition-colors select-none",
              isSelectionEnabled ? "text-[#FF5C35]" : "text-gray-400"
            )}>
              Selection
            </span>
            <button
              type="button"
              onClick={() => {
                const nextVal = !isSelectionEnabled;
                setIsSelectionEnabled(nextVal);
                if (nextVal) {
                  setIsRelocationMode(false);
                }
                setSelectionStart(null);
                setReservationToMove(null);
              }}
              className={cn(
                "w-6 sm:w-7 h-3 sm:h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer shrink-0",
                isSelectionEnabled 
                  ? (isDarkMode ? "bg-[#FF5C35]/50" : "bg-[#FF5C35]") 
                  : (isDarkMode ? "bg-white/5" : "bg-black/10")
              )}
            >
              <motion.div 
                animate={{ x: isSelectionEnabled ? 12 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "absolute top-0.5 left-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full",
                  isDarkMode ? "bg-white" : "bg-white shadow-sm"
                )}
              />
            </button>
          </div>

          {/* Edit Mode Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5 pl-1 sm:pl-1.5 border-l border-gray-400/20">
            <span className={cn(
              "text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider transition-colors select-none",
              isEditMode ? "text-blue-500" : "text-gray-400"
            )}>
              Edit
            </span>
            <button
              type="button"
              onClick={() => {
                setIsEditMode(!isEditMode);
                if (isEditMode) {
                  setCarIdToMove(null);
                  setReservationIdToSwap(null);
                }
              }}
              className={cn(
                "w-6 sm:w-7 h-3 sm:h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer shrink-0",
                isEditMode 
                  ? (isDarkMode ? "bg-blue-500/50" : "bg-blue-500") 
                  : (isDarkMode ? "bg-white/5" : "bg-black/10")
              )}
            >
              <motion.div 
                animate={{ x: isEditMode ? 12 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "absolute top-0.5 left-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full",
                  isDarkMode ? "bg-white" : "bg-white shadow-sm"
                )}
              />
            </button>
          </div>

          {/* Phone PWA Compact Grid Toggle (strictly mobile phones <640px) */}
          {onToggleMobileCompact && (
            <div className="flex sm:hidden items-center gap-1 pl-1 border-l border-gray-400/20">
              <span className={cn(
                "text-[7.5px] font-black uppercase tracking-wider transition-colors select-none",
                isMobileCompactView ? "text-emerald-500 font-extrabold" : "text-gray-400"
              )}>
                Compact
              </span>
              <button
                type="button"
                onClick={onToggleMobileCompact}
                className={cn(
                  "w-6 h-3 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer shrink-0",
                  isMobileCompactView 
                    ? (isDarkMode ? "bg-emerald-600/50" : "bg-emerald-500") 
                    : (isDarkMode ? "bg-white/5" : "bg-black/10")
                )}
                title="Toggle compact vehicle column to reveal more timeline date circles on mobile"
              >
                <motion.div 
                  animate={{ x: isMobileCompactView ? 12 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={cn(
                    "absolute top-0.5 left-0.5 w-2 h-2 rounded-full",
                    isDarkMode ? "bg-white" : "bg-white shadow-sm"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        {/* Incoming Fleet Quick Peek Button (Mobile) */}
        <button
          type="button"
          onClick={() => setIsIncomingFleetOpen(true)}
          className={cn(
            "flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border-2 transition-all hover:scale-105 active:scale-95 shadow-md group cursor-pointer shrink-0",
            isDarkMode 
              ? "bg-[#1A1614] border-[#FF5C35]/30 text-white hover:border-[#FF5C35]" 
              : "bg-white border-[#FF5C35]/20 text-[#0E0C0B] hover:border-[#FF5C35]"
          )}
        >
          <div className="relative">
            <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF5C35] group-hover:rotate-12 transition-transform" />
            {incomingFleetCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#FF5C35] rounded-full flex items-center justify-center border-2 border-white shadow-sm scale-75">
                <span className="text-[6.5px] font-black text-white leading-none">{incomingFleetCount}</span>
              </div>
            )}
          </div>
          <span className="font-black text-[8px] sm:text-[9px] tracking-wider sm:tracking-widest uppercase">Incoming</span>
        </button>
      </div>

      {/* Main Filter Bar: includes Mode Toggles on Desktop, and Country Pills on both Mobile & Desktop */}
      <div className={cn(
        "flex items-center gap-1.5 p-1.5 rounded-full border transition-all duration-500 overflow-x-auto max-w-full custom-scrollbar scrollbar-none",
        isDarkMode 
          ? "bg-black/40 border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]" 
          : "bg-gray-100/50 border-gray-200/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]"
      )}>
        {/* Desktop Mode Toggles */}
        <div className="hidden md:flex flex-col gap-1 items-start px-2 mr-1 border-r border-gray-400/20 shrink-0">
          <div className="flex items-center gap-2 w-full">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-wider transition-colors select-none",
              isSelectionEnabled ? "text-[#FF5C35]" : "text-gray-400"
            )}>
              Selection
            </span>
            <button
              type="button"
              onClick={() => {
                const nextVal = !isSelectionEnabled;
                setIsSelectionEnabled(nextVal);
                if (nextVal) {
                  setIsRelocationMode(false);
                }
                setSelectionStart(null);
                setReservationToMove(null);
              }}
              className={cn(
                "ml-auto w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer shrink-0",
                isSelectionEnabled 
                  ? (isDarkMode ? "bg-[#FF5C35]/50" : "bg-[#FF5C35]") 
                  : (isDarkMode ? "bg-white/5" : "bg-black/10")
              )}
            >
              <motion.div 
                animate={{ x: isSelectionEnabled ? 14 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                  isDarkMode ? "bg-white" : "bg-white shadow-sm"
                )}
              />
            </button>
          </div>
          
          <div className="flex items-center gap-2 w-full">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-wider transition-colors select-none",
              isEditMode ? "text-blue-500" : "text-gray-400"
            )}>
              Edit Mode
            </span>
            <button
              type="button"
              onClick={() => {
                setIsEditMode(!isEditMode);
                if (isEditMode) {
                  setCarIdToMove(null);
                  setReservationIdToSwap(null);
                }
              }}
              className={cn(
                "ml-auto w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer shrink-0",
                isEditMode 
                  ? (isDarkMode ? "bg-blue-500/50" : "bg-blue-500") 
                  : (isDarkMode ? "bg-white/5" : "bg-black/10")
              )}
            >
              <motion.div 
                animate={{ x: isEditMode ? 14 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                  isDarkMode ? "bg-white" : "bg-white shadow-sm"
                )}
              />
            </button>
          </div>
        </div>

        {/* Country Filter Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {VEHICLE_COUNTRIES.map((country) => {
            const isActive = activeCountry === country;
            const color = COUNTRY_COLORS[country as string] || '#808080';
            
            return (
              <button
                key={country}
                type="button"
                onClick={() => setActiveCountry(country)}
                className={cn(
                  "relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-black text-xs tracking-widest uppercase transition-all duration-300 whitespace-nowrap cursor-pointer shrink-0",
                  isActive 
                    ? "text-black" 
                    : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black")
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeCountryTabPanel"
                    className="absolute inset-0 rounded-full"
                    style={{ 
                      background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
                      borderLeft: `2px solid ${color}`,
                    }}
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5 z-10 transition-colors duration-300">
                  <div 
                    className="w-2 h-2 rounded-full ring-2 ring-black/5 transition-all duration-300 shadow-sm shrink-0" 
                    style={{ 
                      backgroundColor: isActive ? 'rgba(0,0,0,0.8)' : color,
                    }} 
                  />
                  <span className={cn(
                    "transition-colors duration-300 text-[11px] sm:text-xs",
                    isActive 
                      ? (isDarkMode ? "text-white" : "text-black") 
                      : (isDarkMode ? "text-gray-400" : "text-gray-600")
                  )}>
                    {country}
                  </span>
                  <div className={cn(
                    "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-black shrink-0 shadow-sm border transition-all duration-300",
                    isActive 
                      ? "border-transparent" 
                      : (isDarkMode ? "bg-white/5 text-gray-400 border-white/10" : "bg-black/5 text-gray-500 border-black/5")
                  )}
                  style={{ 
                    backgroundColor: isActive ? color : undefined,
                    color: isActive ? (['ALL COUNTRIES', 'Macedonia'].includes(country) ? 'black' : 'white') : undefined
                  }}>
                    {countryCounts[country] || 0}
                  </div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Desktop Incoming Fleet Quick Peek Button */}
      <button
        type="button"
        onClick={() => setIsIncomingFleetOpen(true)}
        className={cn(
          "hidden md:flex ml-1 items-center gap-1 px-2 py-2 rounded-full border-2 transition-all hover:scale-105 active:scale-95 shadow-lg group cursor-pointer shrink-0",
          isDarkMode 
            ? "bg-[#1A1614] border-[#FF5C35]/30 text-white hover:border-[#FF5C35]" 
            : "bg-white border-[#FF5C35]/20 text-[#0E0C0B] hover:border-[#FF5C35]"
        )}
      >
        <div className="relative">
          <ArrowDownRight className="w-4 h-4 text-[#FF5C35] group-hover:rotate-12 transition-transform" />
          {incomingFleetCount > 0 && (
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#FF5C35] rounded-full flex items-center justify-center border-2 border-white shadow-sm scale-75">
              <span className="text-[7px] font-black text-white leading-none">{incomingFleetCount}</span>
            </div>
          )}
        </div>
        <span className="font-black text-[10px] tracking-widest uppercase">Incoming</span>
      </button>
    </div>
  );
});

FilterHeader.displayName = 'FilterHeader';
