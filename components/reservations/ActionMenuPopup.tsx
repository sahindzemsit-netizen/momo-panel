'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface ActionMenuPopupProps {
  actionMenuId: string | null;
  actionMenuCoords: { top: number; left: number } | null;
  isDarkMode: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'ON RENT' | 'UPCOMING') => void;
  onCancelBooking: (id: string) => void;
}

export const ActionMenuPopup = memo(({
  actionMenuId,
  actionMenuCoords,
  isDarkMode,
  onClose,
  onUpdateStatus,
  onCancelBooking
}: ActionMenuPopupProps) => {
  if (!actionMenuId || !actionMenuCoords || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div 
        style={{
          position: 'fixed',
          top: actionMenuCoords.top,
          left: actionMenuCoords.left - 8,
          transform: actionMenuCoords.top > (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600) 
            ? 'translate(-100%, -100%)' 
            : 'translate(-100%, 0)',
        }}
        className="pointer-events-none z-[10000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className={cn(
            "p-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border pointer-events-auto flex flex-col gap-1 min-w-[140px]",
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => onUpdateStatus(actionMenuId, 'ON RENT')} 
            className={cn(
              "px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", 
              isDarkMode ? "bg-[#C62828]/20 text-[#EF5350] hover:bg-[#C62828]/40" : "bg-[#FFEBEE] text-[#C62828] hover:bg-[#FFCDD2]"
            )}
          >
            On rent
          </button>
          <button 
            onClick={() => onUpdateStatus(actionMenuId, 'UPCOMING')} 
            className={cn(
              "px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", 
              isDarkMode ? "bg-[#00FF00]/20 text-[#00FF00] hover:bg-[#00FF00]/40" : "bg-[#00FF00]/10 text-black hover:bg-[#00FF00]/20"
            )}
          >
            Upcoming
          </button>
          <div className={cn("h-px w-full my-1", isDarkMode ? "bg-white/5" : "bg-gray-100")} />
          <button 
            onClick={() => onCancelBooking(actionMenuId)} 
            className={cn(
              "px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", 
              isDarkMode 
                ? "bg-white/10 text-gray-400 hover:bg-white/20" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Cancel Reservation
          </button>
        </motion.div>
      </div>
    </div>,
    document.body
  );
});

ActionMenuPopup.displayName = 'ActionMenuPopup';
