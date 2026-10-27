'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isDarkMode: boolean;
}

export default function CancellationModal({ isOpen, onClose, onConfirm, isDarkMode }: CancellationModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onConfirm(reason);
      setReason('');
      onClose();
    }
  };

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
              "relative w-full max-w-md rounded-[32px] shadow-2xl border p-6 overflow-hidden",
              isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                  Cancel Reservation
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className={cn(
                  "text-[10px] font-black tracking-widest uppercase ml-1",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  Reason for Cancellation
                </label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why this reservation is being cancelled..."
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold text-sm min-h-[120px] resize-none",
                    isDarkMode 
                      ? "bg-[#1A1614] border-white/5 text-white focus:border-red-500" 
                      : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-red-500"
                  )}
                />
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-black text-sm tracking-widest uppercase transition-all border-2",
                    isDarkMode 
                      ? "bg-transparent border-white/5 text-gray-400 hover:bg-white/5" 
                      : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50"
                  )}
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className={cn(
                    "flex-[2] py-3 rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg transition-all text-white border-b-4",
                    isDarkMode 
                      ? "bg-red-500 border-red-700 shadow-red-500/20 hover:bg-red-600" 
                      : "bg-red-600 border-red-800 shadow-red-600/20 hover:bg-red-700"
                  )}
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
