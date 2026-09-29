'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Flag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_COLORS, AVAILABLE_COUNTRIES } from '@/lib/constants';
import { Reservation } from '@/types';

interface CountriesSelectionPopupProps {
  countriesPopupId: string | null;
  countriesPopupCoords: { top: number; left: number } | null;
  isDarkMode: boolean;
  userReservations: Reservation[];
  onClose: () => void;
  onToggleCountry: (bookingId: string, country: string) => void;
}

export const CountriesSelectionPopup = memo(({
  countriesPopupId,
  countriesPopupCoords,
  isDarkMode,
  userReservations,
  onClose,
  onToggleCountry
}: CountriesSelectionPopupProps) => {
  if (!countriesPopupId || !countriesPopupCoords || typeof document === 'undefined') {
    return null;
  }

  const bookingObj = userReservations.find(b => String(b.id) === String(countriesPopupId));

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div 
        style={{
          position: 'fixed',
          top: countriesPopupCoords.top,
          left: countriesPopupCoords.left,
          transform: 'translate(0, -50%)',
        }}
        className="pointer-events-none z-[10000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "p-3 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border pointer-events-auto flex flex-col gap-2 min-w-[140px] max-h-[400px] overflow-y-auto",
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 border-b pb-2 mb-1" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <Flag className="w-3 h-3 text-gray-500" />
            <span className="text-[9px] font-black tracking-widest uppercase opacity-60">Countries</span>
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            {!bookingObj ? (
              <span className="text-[10px] italic text-gray-400 font-bold uppercase tracking-widest text-center py-2">
                Select client
              </span>
            ) : (
              AVAILABLE_COUNTRIES.map(c => {
                const isSelected = (bookingObj.countries || []).includes(c);
                return (
                  <button 
                    key={c} 
                    onClick={() => onToggleCountry(bookingObj.id, c)}
                    className={cn(
                      "flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer group",
                      isSelected 
                        ? (isDarkMode ? "bg-[#FF5C35]/20" : "bg-[#FF5C35]/10") 
                        : "hover:bg-gray-500/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: COUNTRY_COLORS[c] || '#ccc' }} />
                      <span className={cn(
                        "text-xs font-black tracking-tight", 
                        isSelected 
                          ? "text-[#FF5C35]" 
                          : (isDarkMode ? "text-gray-400" : "text-gray-500")
                      )}>
                        {c}
                      </span>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                      isSelected 
                        ? "bg-[#FF5C35] border-[#FF5C35]" 
                        : (isDarkMode ? "border-white/10" : "border-black/10")
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
});

CountriesSelectionPopup.displayName = 'CountriesSelectionPopup';
