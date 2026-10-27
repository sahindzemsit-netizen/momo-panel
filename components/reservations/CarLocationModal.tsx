'use client';

import React, { memo } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRY_COLORS, VEHICLE_COUNTRIES } from '@/lib/constants';
import { Vehicle } from '@/types';

interface CarLocationModalProps {
  selectedCarForLocationUpdate: Vehicle | null;
  isDarkMode: boolean;
  onClose: () => void;
  onRelocateCar: (country: string) => void;
}

export const CarLocationModal = memo(({
  selectedCarForLocationUpdate,
  isDarkMode,
  onClose,
  onRelocateCar
}: CarLocationModalProps) => {
  if (!selectedCarForLocationUpdate) return null;

  const home = selectedCarForLocationUpdate.country || 'Macedonia';
  const options = VEHICLE_COUNTRIES;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative w-full max-w-md rounded-[32px] shadow-2xl border p-6 flex flex-col overflow-hidden",
          isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-150"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
              TAG CAR LOCATION
            </h2>
            <p className="text-[9px] font-bold text-emerald-500 tracking-[0.2em] uppercase mt-1">
              TAG VEHICLE LOCATION
            </p>
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:rotate-90 cursor-pointer",
              isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={cn(
          "p-4 rounded-2xl mb-5 border",
          isDarkMode ? "bg-[#1E1B1A]/80 border-white/5" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vehicle</span>
              <span className={cn("text-xs font-black uppercase", isDarkMode ? "text-white" : "text-black")}>
                {selectedCarForLocationUpdate.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Plate Number</span>
              <span className="font-mono text-xs font-bold text-gray-700 bg-gray-200/50 px-1.5 py-0.5 rounded">
                {selectedCarForLocationUpdate.plate}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Home Country</span>
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COUNTRY_COLORS[selectedCarForLocationUpdate.country || 'Macedonia'] }}
                />
                <span className={cn("text-xs font-black uppercase", isDarkMode ? "text-white" : "text-black")}>
                  {selectedCarForLocationUpdate.country || 'Macedonia'}
                </span>
              </div>
            </div>
            {selectedCarForLocationUpdate.forcedPhysicalCountry && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Tag</span>
                <span className={cn("text-xs font-black uppercase text-emerald-500", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                  IN {selectedCarForLocationUpdate.forcedPhysicalCountry.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3 text-center">
          Select a country to set location tag:
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {options.map((country) => {
            const isHome = country === home;
            return (
              <button
                key={country}
                onClick={() => onRelocateCar(country)}
                className={cn(
                  "group p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.03] hover:shadow-md cursor-pointer relative",
                  isDarkMode 
                    ? "bg-[#1E1B1A]/80 border-white/5 hover:border-emerald-500 hover:bg-emerald-500/5" 
                    : "bg-white border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20"
                )}
              >
                {isHome && (
                  <span className="absolute top-1.5 right-1.5 px-1 py-px text-[7px] font-black uppercase bg-emerald-500 text-white rounded">
                    HOME
                  </span>
                )}
                <div 
                  className="w-4 h-4 rounded-full border border-black/10 flex items-center justify-center"
                  style={{ backgroundColor: COUNTRY_COLORS[country] }}
                />
                <span className={cn(
                  "text-xs font-extrabold uppercase tracking-wider group-hover:text-emerald-500 transition-colors",
                  isDarkMode ? "text-white" : "text-black"
                )}>
                  {country}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[9px] text-gray-400 text-center uppercase tracking-wide">
          * Setting location tag automatically sets its status to <span className="font-bold text-emerald-500">AVAILABLE</span> and keeps status notes/colors.
        </p>
      </motion.div>
    </div>
  );
});

CarLocationModal.displayName = 'CarLocationModal';
