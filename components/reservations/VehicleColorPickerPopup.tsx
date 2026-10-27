'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle } from '@/types';

export const MAIN_CAR_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Gray', value: '#808080' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Orange', value: '#FFA500' },
];

interface VehicleColorPickerPopupProps {
  editingColorId: string | null;
  colorCoords: { top: number; left: number } | null;
  isDarkMode: boolean;
  dbVehicles: Vehicle[];
  onClose: () => void;
  onSaveColor: (color: string) => void;
}

export const VehicleColorPickerPopup = memo(({
  editingColorId,
  colorCoords,
  isDarkMode,
  dbVehicles,
  onClose,
  onSaveColor
}: VehicleColorPickerPopupProps) => {
  if (!editingColorId || !colorCoords || typeof document === 'undefined') {
    return null;
  }

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
          "fixed z-[100000] p-2.5 rounded-2xl shadow-2xl border-2 transition-all grid grid-cols-5 gap-1.5 min-w-[130px]",
          isDarkMode 
            ? "bg-[#1C1816]/95 border-[#FF5C35]/50 backdrop-blur-md" 
            : "bg-white border-[#FF5C35] text-[#0E0C0B]"
        )}
        style={{ 
          top: colorCoords.top + 30, 
          left: colorCoords.left
        }}
      >
        {MAIN_CAR_COLORS.map((color) => {
          const car = dbVehicles.find(v => String(v.id) === editingColorId);
          const isCurrent = car?.color === color.value;
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onSaveColor(color.value)}
              title={color.name}
              className={cn(
                "w-5 h-5 rounded-full border transition-transform hover:scale-115 cursor-pointer shadow-sm relative overflow-hidden",
                isCurrent 
                  ? (isDarkMode ? "border-white scale-110" : "border-black scale-110") 
                  : (isDarkMode ? "border-white/10" : "border-black/10")
              )}
              style={{ backgroundColor: color.value }}
            >
              {isCurrent && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <Check className={cn("w-3 h-3 stroke-[3]", color.value === '#FFFFFF' ? "text-black" : "text-white")} />
                </div>
              )}
            </button>
          );
        })}
      </motion.div>
    </div>,
    document.body
  );
});

VehicleColorPickerPopup.displayName = 'VehicleColorPickerPopup';
