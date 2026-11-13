'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Flame, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Expense } from '@/types';
import { COUNTRY_COLORS, normalizeCountry } from '@/components/ExpenseCard';

interface ExpenseSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  currentUserEmail?: string;
  isDarkMode: boolean;
}

export default function ExpenseSettleModal({
  isOpen,
  onClose,
  expense,
  currentUserEmail,
  isDarkMode,
}: ExpenseSettleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const handleConfirmSettle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'expenses', expense.id), {
        status: 'PAID',
        settledBy: currentUserEmail || 'Supervisor',
        settledAt: Date.now(),
        updatedAt: Date.now(),
      });
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error("Failed to settle expense:", err);
      setError("Failed to settle expense. Please verify connection and permissions.");
      setIsSubmitting(false);
    }
  };

  const countryKey = normalizeCountry(expense.country);
  const countryTheme = COUNTRY_COLORS[countryKey] || COUNTRY_COLORS.Macedonia;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 cursor-pointer"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={cn(
            "relative z-10 max-w-md w-full p-6 rounded-3xl border shadow-2xl flex flex-col gap-5",
            isDarkMode ? "bg-[#1E1B1A] border-white/10 text-white" : "bg-white border-stone-200 text-stone-900"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest leading-none">
                  APPROVE EXPENSE OUTLAY
                </h3>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                  Supervisor Confirmation
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details Card */}
          <div className={cn(
            "p-4 rounded-2xl border flex flex-col gap-2.5",
            isDarkMode ? "bg-black/20 border-white/5" : "bg-stone-50 border-stone-200/80"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase">CATEGORY / TITLE</span>
              <span className="text-xs font-black uppercase tracking-tight text-right truncate max-w-[220px]">
                {expense.category}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase">AMOUNT COST</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {expense.currency === 'MKD' ? `${expense.amount.toLocaleString()} den` : `€${expense.amount.toLocaleString()}`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase">COUNTRY</span>
              <span 
                className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm tracking-wider"
                style={{
                  backgroundColor: countryTheme.hex,
                  color: countryTheme.text === 'text-white' ? '#FFFFFF' : '#000000'
                }}
              >
                {countryKey.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase">REGISTERED BY</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF5C35]/15 text-[#FF5C35]">
                {expense.teammate}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Approving this outlay will mark it as <strong className="text-emerald-500 font-black">PAID</strong> and stamp the card with the green approval seal across all workspaces.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all cursor-pointer",
                isDarkMode ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-200 text-gray-600 hover:bg-gray-100"
              )}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleConfirmSettle}
              disabled={isSubmitting}
              className="py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>SAVING...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>SETTLE & APPROVE</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
