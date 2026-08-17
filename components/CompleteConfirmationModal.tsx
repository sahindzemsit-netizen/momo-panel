'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Calendar, Car, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDarkMode: boolean;
  clientName?: string;
  vehicleName?: string;
  startDate?: string;
  endDate?: string;
}

export default function CompleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isDarkMode,
  clientName,
  vehicleName,
  startDate,
  endDate
}: CompleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-md rounded-[32px] shadow-2xl border p-6 overflow-hidden z-10",
              isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                  Complete Booking
                </h2>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:rotate-90",
                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content/Reservation Details */}
            <div className="space-y-4">
              <p className={cn("text-sm font-bold leading-relaxed mb-4", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Are you sure you want to mark this reservation as <span className="text-emerald-500 font-extrabold">COMPLETED</span>? This action will update stats and cannot be undone.
              </p>

              {(clientName || vehicleName || (startDate && endDate)) && (
                <div className={cn(
                  "p-4 rounded-2xl flex flex-col gap-3 border",
                  isDarkMode ? "bg-[#1E1B1A]/60 border-white/5" : "bg-gray-50/70 border-gray-100"
                )}>
                  {clientName && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-black tracking-widest text-gray-400 uppercase leading-none mb-0.5">CLIENT</span>
                        <p className={cn("text-xs font-black", isDarkMode ? "text-white" : "text-black")}>{clientName}</p>
                      </div>
                    </div>
                  )}

                  {vehicleName && (
                    <div className="flex items-center gap-3">
                      <Car className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-black tracking-widest text-gray-400 uppercase leading-none mb-0.5">VEHICLE</span>
                        <p className={cn("text-xs font-black uppercase", isDarkMode ? "text-white" : "text-black")}>{vehicleName}</p>
                      </div>
                    </div>
                  )}

                  {startDate && endDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-black tracking-widest text-gray-400 uppercase leading-none mb-0.5">RENTAL PERIOD</span>
                        <p className={cn("text-xs font-black", isDarkMode ? "text-white" : "text-black")}>
                          {startDate} — {endDate}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex-1 py-3 rounded-2xl font-black text-sm tracking-widest uppercase transition-all border-2 cursor-pointer",
                  isDarkMode 
                    ? "bg-transparent border-white/5 text-gray-400 hover:bg-white/5" 
                    : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50"
                )}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "flex-[2] py-3 rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg transition-all text-white border-b-4 cursor-pointer",
                  isDarkMode 
                    ? "bg-emerald-600 border-emerald-800 shadow-emerald-600/20 hover:bg-emerald-700" 
                    : "bg-emerald-500 border-emerald-700 shadow-emerald-500/20 hover:bg-emerald-600"
                )}
              >
                Yes, Complete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
