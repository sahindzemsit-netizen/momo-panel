'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle } from '@/types';

interface ChassisNumberPopupProps {
  editingChassisId: string | null;
  chassisCoords: { top: number; left: number } | null;
  isDarkMode: boolean;
  dbVehicles: Vehicle[];
  isEditingChassis: boolean;
  chassisInput: string;
  setIsEditingChassis: (val: boolean) => void;
  setChassisInput: (val: string) => void;
  onClose: () => void;
  onSaveChassis: () => void;
}

export const ChassisNumberPopup = memo(({
  editingChassisId,
  chassisCoords,
  isDarkMode,
  dbVehicles,
  isEditingChassis,
  chassisInput,
  setIsEditingChassis,
  setChassisInput,
  onClose,
  onSaveChassis
}: ChassisNumberPopupProps) => {
  if (!editingChassisId || !chassisCoords || typeof document === 'undefined') {
    return null;
  }

  const car = dbVehicles.find(v => String(v.id) === editingChassisId);

  return createPortal(
    <div className="fixed inset-0 z-[99999] pointer-events-auto flex items-start justify-start">
      <div 
        className="fixed inset-0 bg-transparent" 
        onClick={onClose} 
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10, x: '-50%' }}
        animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
        className={cn(
          "fixed z-[100000] flex items-center gap-2 px-3 py-1.5 rounded-full shadow-2xl border-2 transition-all min-w-[120px]",
          isDarkMode 
            ? "bg-[#1A1614] border-[#FF5C35]/50 text-white" 
            : "bg-white border-[#FF5C35] text-[#0E0C0B]"
        )}
        style={{ 
          top: chassisCoords.top - 48, 
          left: chassisCoords.left
        }}
      >
        <div className="flex items-center gap-2 w-full">
          <span className="text-[9px] font-black tracking-widest text-[#FF5C35] shrink-0">VIN:</span>
          
          {isEditingChassis ? (
            <>
              <input
                autoFocus
                value={chassisInput || ''}
                onChange={(e) => setChassisInput(e.target.value)}
                placeholder="+"
                className={cn(
                  "bg-transparent border-none outline-none text-[11px] font-mono font-black uppercase tracking-wider w-full placeholder:text-[#FF5C35]",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveChassis();
                  if (e.key === 'Escape') {
                    if (car?.chassisNumber) {
                      setIsEditingChassis(false);
                      setChassisInput(car.chassisNumber);
                    } else {
                      onClose();
                    }
                  }
                }}
              />
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={onSaveChassis}
                  className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    if (car?.chassisNumber) {
                      setIsEditingChassis(false);
                      setChassisInput(car.chassisNumber);
                    } else {
                      onClose();
                    }
                  }}
                  className="w-5 h-5 rounded-full bg-gray-500/20 text-gray-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              <span className={cn(
                "text-[11px] font-mono font-black uppercase tracking-wider w-full truncate",
                isDarkMode ? "text-white" : "text-[#0E0C0B]"
              )}>
                {chassisInput || '+'}
              </span>
              <button
                onClick={() => setIsEditingChassis(true)}
                className="w-5 h-5 rounded-full bg-[#FF5C35]/10 text-[#FF5C35] flex items-center justify-center cursor-pointer ml-1"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
        {/* Arrow */}
        <div className={cn(
          "absolute -bottom-[8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px]",
          isDarkMode ? "border-t-[#FF5C35]/50" : "border-t-[#FF5C35]"
        )} />
      </motion.div>
    </div>,
    document.body
  );
});

ChassisNumberPopup.displayName = 'ChassisNumberPopup';
