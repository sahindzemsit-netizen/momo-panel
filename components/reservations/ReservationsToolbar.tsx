'use client';

import React, { memo } from 'react';
import { motion } from 'motion/react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

interface ReservationsToolbarProps {
  isDarkMode: boolean;
  isRelocationMode: boolean;
  isCarLocationMode: boolean;
  effectiveColor: string;
  isLightSidebar: boolean;
  headerMonth: number;
  headerYear: number;
  onToggleRelocationMode: () => void;
  onToggleCarLocationMode: () => void;
  onOpenAddReservationModal: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const ReservationsToolbar = memo(({
  isDarkMode,
  isRelocationMode,
  isCarLocationMode,
  effectiveColor,
  isLightSidebar,
  headerMonth,
  headerYear,
  onToggleRelocationMode,
  onToggleCarLocationMode,
  onOpenAddReservationModal,
  onPrevMonth,
  onNextMonth
}: ReservationsToolbarProps) => {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-[10px] pl-2 shrink-0">
      <div className="w-full md:w-[480px] shrink-0 ml-[5px] mr-[-5px]">
        <div className="flex items-center gap-3">
          <h1 className={cn(
            "text-xl font-black tracking-tighter leading-none transition-colors",
            isDarkMode ? "text-white" : "text-[#0E0C0B]"
          )}>BOOKING SCHEDULE</h1>
          
          <div className="flex flex-col gap-1.5 shrink-0">
            {/* Relocation Mode Toggle */}
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all shadow-sm shrink-0",
              isRelocationMode 
                ? (isDarkMode ? "bg-[#FF5C35]/10 border-[#FF5C35]/30 shadow-[0_0_10px_rgba(255,92,53,0.15)]" : "bg-[#FF5C35]/5 border-[#FF5C35]/20")
                : (isDarkMode ? "bg-black/20 border-white/5" : "bg-gray-100/50 border-gray-200/50")
            )}>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest transition-colors select-none",
                isRelocationMode ? "text-[#FF5C35]" : "text-gray-400"
              )}>
                Relocation Mode
              </span>
              <button
                type="button"
                onClick={onToggleRelocationMode}
                className={cn(
                  "w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer",
                  isRelocationMode 
                    ? (isDarkMode ? "bg-[#FF5C35]/50" : "bg-[#FF5C35]") 
                    : (isDarkMode ? "bg-white/5" : "bg-black/10")
                )}
                title="Toggle relocation mode to move bookings to other cars"
              >
                <motion.div 
                  animate={{ x: isRelocationMode ? 14 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={cn(
                    "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                    isDarkMode ? "bg-white" : "bg-white shadow-sm"
                  )}
                />
              </button>
            </div>

            {/* Car Location Toggle */}
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all shadow-sm shrink-0",
              isCarLocationMode 
                ? (isDarkMode ? "bg-[#10B981]/10 border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-[#10B981]/5 border-[#10B981]/20")
                : (isDarkMode ? "bg-black/20 border-white/5" : "bg-gray-100/50 border-gray-200/50")
            )}>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest transition-colors select-none",
                isCarLocationMode ? "text-[#10B981]" : "text-gray-400"
              )}>
                Car Location
              </span>
              <button
                type="button"
                onClick={onToggleCarLocationMode}
                className={cn(
                  "w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer",
                  isCarLocationMode 
                    ? (isDarkMode ? "bg-[#10B981]/50" : "bg-[#10B981]") 
                    : (isDarkMode ? "bg-white/5" : "bg-black/10")
                )}
                title="Toggle car location mode to move a car to another country and reset its status"
              >
                <motion.div 
                  animate={{ x: isCarLocationMode ? 14 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={cn(
                    "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                    isDarkMode ? "bg-white" : "bg-white shadow-sm"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
        <p className="text-[7px] font-black text-gray-400 tracking-[0.2em] uppercase mt-0.5">OPERATIONAL TIMELINE</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
        <button 
          type="button"
          onClick={onOpenAddReservationModal}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-[18px] shadow-[0_10px_20px_rgba(0,0,0,0.15)] border-b-4 transition-all hover:scale-[1.02] active:scale-95 font-black text-[9px] tracking-widest uppercase cursor-pointer",
            isDarkMode ? "bg-[#FF5C35] text-white border-[#C84528]" : "bg-[#0E0C0B] text-white border-black/50"
          )}
        >
          <Plus className={cn("w-3.5 h-3.5", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
          ADD RESERVATION
        </button>

        <div className={cn(
          "flex-1 md:flex-none flex items-center justify-between md:justify-start rounded-[18px] p-1 shadow-[0_10px_20px_rgba(0,0,0,0.15)] border-b-4 transition-all hover:scale-[1.02]",
          isDarkMode ? "border-black/50" : "border-black/50"
        )} style={{ background: effectiveColor }}>
          <button 
            type="button"
            onClick={onPrevMonth}
            className={cn(
              "p-1.5 transition-all hover:scale-110 active:scale-90 cursor-pointer",
              isLightSidebar ? "text-black/70 hover:text-[#FF5C35]" : "text-white hover:text-[#FF5C35]"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className={cn(
            "px-2 md:px-4 font-black text-[9px] tracking-[0.2em] min-w-[100px] md:min-w-[120px] text-center select-none",
            isLightSidebar ? "text-black" : "text-white"
          )}>
            {MONTHS[headerMonth]} {headerYear}
          </span>
          <button 
            type="button"
            onClick={onNextMonth}
            className={cn(
              "p-1.5 transition-all hover:scale-110 active:scale-90 cursor-pointer",
              isLightSidebar ? "text-black/70 hover:text-[#FF5C35]" : "text-white hover:text-[#FF5C35]"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
});

ReservationsToolbar.displayName = 'ReservationsToolbar';
