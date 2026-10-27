'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sun, Snowflake, ArrowRight, Loader2, ShieldCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle } from '@/types';

export interface TyreConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  vehicle: Vehicle | null;
  currentTyre: 'summer' | 'winter';
  targetTyre: 'summer' | 'winter';
  isDarkMode: boolean;
  isSaving?: boolean;
}

export const TyreConfirmationModal: React.FC<TyreConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  vehicle,
  currentTyre,
  targetTyre,
  isDarkMode,
  isSaving = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !isSaving) {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm, isSaving]);

  if (!isOpen || !vehicle) return null;

  const isSwitchingToWinter = targetTyre === 'winter';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSaving && onClose()}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full max-w-sm rounded-[28px] shadow-2xl border p-5 overflow-hidden z-10 select-none",
            isDarkMode 
              ? "bg-[#201C1A] border-white/10 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]" 
              : "bg-white border-neutral-200 text-[#0E0C0B] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)]"
          )}
        >
          {/* Top subtle glow background accent */}
          <div 
            className={cn(
              "absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-2xl pointer-events-none opacity-20",
              isSwitchingToWinter ? "bg-blue-500" : "bg-amber-500"
            )}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <div 
                className={cn(
                  "w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm shrink-0",
                  isSwitchingToWinter 
                    ? "bg-blue-500/15 text-blue-500 border border-blue-500/30" 
                    : "bg-[#FF9F00]/15 text-[#FF9F00] border border-[#FF9F00]/30"
                )}
              >
                {isSwitchingToWinter ? (
                  <Snowflake className="w-5 h-5 fill-current animate-pulse" />
                ) : (
                  <Sun className="w-5 h-5 fill-current" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight leading-tight">
                  {isSwitchingToWinter ? "Switch to Winter Tyres" : "Switch to Summer Tyres"}
                </h3>
                <p className={cn("text-[11px] font-bold", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  Fleet tyre configuration
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer hover:rotate-90 disabled:opacity-50",
                isDarkMode 
                  ? "bg-white/5 text-gray-300 hover:bg-white/10" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Vehicle Info Bar */}
          <div 
            className={cn(
              "px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 mb-4",
              isDarkMode ? "bg-white/[0.03] border-white/5" : "bg-gray-50 border-gray-150"
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                VEHICLE
              </span>
              <p className="font-black text-xs uppercase tracking-wide truncate">
                {vehicle.name}
              </p>
            </div>

            {vehicle.plate && (
              <div 
                className="inline-flex items-center justify-center rounded-md border border-black/20 shadow-sm shrink-0 relative overflow-hidden bg-white text-black font-mono font-black tracking-wide uppercase leading-none pl-2 pr-1.5"
                style={{ height: '22px', fontSize: '11px' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-700" />
                <span>{vehicle.plate}</span>
              </div>
            )}
          </div>

          {/* Before & After Transition Cards */}
          <div className="grid grid-cols-5 items-center gap-2 mb-4">
            {/* Current */}
            <div 
              className={cn(
                "col-span-2 p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center",
                isDarkMode ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-100"
              )}
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                CURRENT
              </span>
              <div 
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shadow-xs",
                  currentTyre === 'winter' ? "bg-blue-500 text-white" : "bg-[#FF9F00] text-white"
                )}
              >
                {currentTyre === 'winter' ? (
                  <Snowflake className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Sun className="w-3.5 h-3.5 fill-current" />
                )}
              </div>
              <span className="text-[11px] font-black uppercase tracking-tight">
                {currentTyre === 'winter' ? 'Winter' : 'Summer'}
              </span>
            </div>

            {/* Transition Arrow */}
            <div className="col-span-1 flex items-center justify-center">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center border shadow-xs",
                isDarkMode ? "bg-white/5 border-white/5 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-400"
              )}>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Target */}
            <div 
              className={cn(
                "col-span-2 p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center ring-2",
                isSwitchingToWinter 
                  ? (isDarkMode 
                      ? "bg-blue-950/20 border-blue-500/40 ring-blue-500/30 text-white" 
                      : "bg-blue-50 border-blue-200 ring-blue-400/40 text-blue-950")
                  : (isDarkMode 
                      ? "bg-amber-950/20 border-amber-500/40 ring-amber-500/30 text-white" 
                      : "bg-amber-50 border-amber-200 ring-amber-400/40 text-amber-950")
              )}
            >
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider",
                isSwitchingToWinter ? "text-blue-500" : "text-amber-500"
              )}>
                NEW SETUP
              </span>
              <div 
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm",
                  isSwitchingToWinter ? "bg-blue-500 text-white" : "bg-[#FF9F00] text-white"
                )}
              >
                {isSwitchingToWinter ? (
                  <Snowflake className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Sun className="w-3.5 h-3.5 fill-current" />
                )}
              </div>
              <span className="text-[11px] font-black uppercase tracking-tight">
                {targetTyre === 'winter' ? 'Winter' : 'Summer'}
              </span>
            </div>
          </div>

          {/* Persistence Guarantee Notice */}
          <div 
            className={cn(
              "flex items-start gap-2 p-2.5 rounded-xl border mb-5 text-[11px] font-bold leading-relaxed",
              isDarkMode ? "bg-white/[0.02] border-white/5 text-gray-300" : "bg-gray-50 border-gray-100 text-gray-600"
            )}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p>
              This tyre setup will be <span className="text-emerald-500 font-extrabold">permanently saved</span> in the fleet database and will remain set even after page reload or restart.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer border text-center active:scale-95 disabled:opacity-50",
                isDarkMode 
                  ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" 
                  : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
              )}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isSaving}
              className={cn(
                "flex-[1.5] py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 text-center active:scale-95 text-white disabled:opacity-50",
                isSwitchingToWinter 
                  ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/25" 
                  : "bg-[#FF9F00] hover:bg-[#E68F00] shadow-orange-500/25"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  {isSwitchingToWinter ? (
                    <Snowflake className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Confirm {isSwitchingToWinter ? 'Winter' : 'Summer'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
