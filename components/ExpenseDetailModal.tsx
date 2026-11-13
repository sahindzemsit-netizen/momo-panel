'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  Calendar, 
  Clock, 
  User, 
  DollarSign, 
  Globe, 
  FileText, 
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense } from '@/types';
import { format, parseISO } from 'date-fns';
import { normalizeCountry, COUNTRY_COLORS } from './ExpenseCard';

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  isDarkMode: boolean;
  onOpenReceipt?: (url: string) => void;
}

export default function ExpenseDetailModal({
  isOpen,
  onClose,
  expense,
  isDarkMode,
  onOpenReceipt,
}: ExpenseDetailModalProps) {
  if (!isOpen || !expense) return null;

  const isPaid = expense.status === 'PAID';
  const countryKey = normalizeCountry(expense.country);
  const countryTheme = COUNTRY_COLORS[countryKey] || COUNTRY_COLORS.Macedonia;

  // Safe Date parsing
  let formattedDateOnly = 'N/A';
  let formattedTimeOnly = '--:--';
  let dayOfWeek = '---';

  try {
    const parsedDate = parseISO(expense.date);
    formattedDateOnly = format(parsedDate, 'MMMM dd, yyyy');
    dayOfWeek = format(parsedDate, 'EEEE').toUpperCase();
    formattedTimeOnly = format(parsedDate, 'HH:mm');
  } catch (_e) {
    if (expense.createdAt) {
      const d = new Date(expense.createdAt);
      formattedDateOnly = format(d, 'MMMM dd, yyyy');
      dayOfWeek = format(d, 'EEEE').toUpperCase();
      formattedTimeOnly = format(d, 'HH:mm');
    }
  }

  const settledDateStr = expense.settledAt 
    ? format(new Date(expense.settledAt), 'MMMM dd, yyyy • HH:mm')
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "relative w-full max-w-lg rounded-[24px] sm:rounded-[32px] border p-3 sm:p-7 shadow-2xl overflow-x-hidden overflow-y-auto sm:overflow-visible z-10 flex flex-col gap-2 sm:gap-6 max-h-[92vh] sm:max-h-none",
            isDarkMode 
              ? "bg-[#1A1615] border-white/10 text-white" 
              : "bg-white border-stone-200 text-stone-900"
          )}
          style={{
            boxShadow: isDarkMode 
              ? `0 25px 60px -15px ${countryTheme.glow}, 0 0 0 1px rgba(255,255,255,0.08)` 
              : `0 25px 60px -15px ${countryTheme.glow}, 0 10px 30px rgba(0,0,0,0.08)`
          }}
        >
          {/* Ambient top glow */}
          <div 
            className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-30"
            style={{ backgroundColor: countryTheme.hex }}
          />

          {/* Header Row */}
          <div className="flex items-start justify-between gap-2.5 sm:gap-4 relative z-10 border-b pb-2 sm:pb-4 border-black/5 dark:border-white/5">
            <div className="flex flex-col gap-0.5 sm:gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span 
                  className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                  style={{
                    backgroundColor: countryTheme.hex,
                    color: countryTheme.text === 'text-white' ? '#FFFFFF' : '#000000'
                  }}
                >
                  <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>{countryKey.toUpperCase()}</span>
                </span>

                {isPaid ? (
                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-xs">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                    <span>APPROVED & SETTLED</span>
                  </span>
                ) : (
                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-500 flex items-center gap-1.5">
                    <span>PENDING OUTLAY</span>
                  </span>
                )}
              </div>

              <h2 className={cn(
                "text-sm sm:text-xl font-black uppercase tracking-tight mt-0.5 sm:mt-1 leading-snug break-words",
                isDarkMode ? "text-white" : "text-stone-900"
              )}>
                {expense.category}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shrink-0 hover:scale-105 active:scale-95",
                isDarkMode 
                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "bg-stone-100 border-stone-200 hover:bg-stone-200 text-stone-600 hover:text-stone-900"
              )}
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Amount Showcase Banner */}
          <div 
            className="rounded-lg sm:rounded-2xl p-2 sm:p-4 flex items-center justify-between border relative overflow-hidden"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' 
                : 'linear-gradient(135deg, #F8F9FA 0%, #F1F3F5 100%)',
              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
            }}
          >
            <div>
              <span className="text-[7.5px] sm:text-[9px] font-black tracking-widest uppercase text-gray-400 block">
                TOTAL EXPENSE COST
              </span>
              <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5">
                <span className="text-xl sm:text-3xl font-black tracking-tight font-mono text-[#FF5C35]">
                  {Math.round(expense.amount).toLocaleString()}
                </span>
                <span className="text-xs sm:text-base font-black text-gray-500 font-mono uppercase">
                  {expense.currency === 'MKD' ? 'den (MKD)' : '€ (EUR)'}
                </span>
              </div>
            </div>

            <div 
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl border-2 flex items-center justify-center font-black text-xs sm:text-lg shadow-sm shrink-0"
              style={{
                borderColor: countryTheme.hex,
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : '#FFFFFF',
                color: countryTheme.hex
              }}
            >
              {expense.currency === 'MKD' ? 'den' : '€'}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-3 text-xs">
            {/* Teammate */}
            <div className={cn(
              "p-2 sm:p-3 rounded-lg sm:rounded-2xl border flex flex-col gap-0.5 sm:gap-1",
              isDarkMode ? "bg-black/30 border-white/5" : "bg-stone-50 border-stone-200/60"
            )}>
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF5C35]" />
                REGISTERED BY
              </span>
              <span className="font-black text-[10.5px] sm:text-xs uppercase tracking-wide truncate">
                {expense.teammate || 'SYSTEM'}
              </span>
            </div>

            {/* Country */}
            <div className={cn(
              "p-2 sm:p-3 rounded-lg sm:rounded-2xl border flex flex-col gap-0.5 sm:gap-1",
              isDarkMode ? "bg-black/30 border-white/5" : "bg-stone-50 border-stone-200/60"
            )}>
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF5C35]" />
                COUNTRY
              </span>
              <span className="font-black text-[10.5px] sm:text-xs uppercase tracking-wide truncate">
                {countryKey.toUpperCase()}
              </span>
            </div>

            {/* Date */}
            <div className={cn(
              "p-2 sm:p-3 rounded-lg sm:rounded-2xl border flex flex-col gap-0.5 sm:gap-1",
              isDarkMode ? "bg-black/30 border-white/5" : "bg-stone-50 border-stone-200/60"
            )}>
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF5C35]" />
                DATE OCCURRED
              </span>
              <span className="font-black text-[10.5px] sm:text-xs uppercase tracking-wide truncate">
                {formattedDateOnly}
              </span>
              <span className="text-[7px] sm:text-[8px] font-bold text-gray-400 tracking-wider">
                {dayOfWeek}
              </span>
            </div>

            {/* Time */}
            <div className={cn(
              "p-2 sm:p-3 rounded-lg sm:rounded-2xl border flex flex-col gap-0.5 sm:gap-1",
              isDarkMode ? "bg-black/30 border-white/5" : "bg-stone-50 border-stone-200/60"
            )}>
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF5C35]" />
                LOG TIME
              </span>
              <span 
                className="font-black text-[10.5px] sm:text-xs uppercase tracking-wide text-black"
                style={{ color: '#000000' }}
              >
                {formattedTimeOnly}
              </span>
            </div>
          </div>

          {/* Settle Approval Audit Information */}
          {isPaid && (
            <div className="p-2 sm:p-3.5 rounded-lg sm:rounded-2xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col gap-0.5 sm:gap-1">
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                SETTLEMENT APPROVAL AUDIT
              </span>
              <div className="text-[10px] sm:text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-1 pt-0.5 sm:pt-1">
                <div className="truncate">
                  <span className="text-gray-400 text-[8.5px] sm:text-[10px]">APPROVED BY: </span>
                  <span className="font-black uppercase text-emerald-600 dark:text-emerald-300">
                    {expense.settledBy || 'Supervisor'}
                  </span>
                </div>
                {settledDateStr && (
                  <div className="shrink-0">
                    <span className="text-gray-400 text-[8.5px] sm:text-[10px]">TIME: </span>
                    <span className="font-bold text-[8.5px] sm:text-[10px] text-gray-500 dark:text-gray-400">
                      {settledDateStr}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Receipt Section */}
          {expense.receiptUrl && (
            <div className="flex items-center justify-between p-1.5 sm:p-3 rounded-lg sm:rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <span className="font-black text-[10px] sm:text-xs uppercase block truncate">Attached Receipt / Bill</span>
                  <span className="text-[7.5px] sm:text-[9px] text-gray-400 font-mono block truncate">Document uploaded & verified</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onOpenReceipt && expense.receiptUrl) {
                    onOpenReceipt(expense.receiptUrl);
                  } else if (expense.receiptUrl) {
                    window.open(expense.receiptUrl, '_blank', 'noreferrer');
                  }
                }}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 shrink-0 ml-1.5"
              >
                <span>View Receipt</span>
                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </div>
          )}

          {/* Footer Close Button */}
          <div className="flex justify-end pt-1 sm:pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider border transition-all cursor-pointer hover:scale-105 active:scale-95 text-center",
                isDarkMode 
                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" 
                  : "bg-stone-100 border-stone-200 hover:bg-stone-200 text-stone-800"
              )}
            >
              Close Detail View
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
