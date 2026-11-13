'use client';

import React from 'react';
import { motion } from 'motion/react';
import { FileText, Calendar, Clock, User, Flame, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense } from '@/types';
import { format, parseISO } from 'date-fns';

export const COUNTRY_COLORS: Record<string, { bg: string; text: string; hex: string; glow: string; border: string }> = {
  Macedonia: { bg: 'bg-[#64BC61]', text: 'text-black', hex: '#64BC61', glow: 'rgba(100, 188, 97, 0.25)', border: 'border-[#64BC61]/40' },
  Kosovo: { bg: 'bg-[#3B82F6]', text: 'text-white', hex: '#3B82F6', glow: 'rgba(59, 130, 246, 0.25)', border: 'border-[#3B82F6]/40' },
  Albania: { bg: 'bg-[#EC4899]', text: 'text-white', hex: '#EC4899', glow: 'rgba(236, 72, 153, 0.25)', border: 'border-[#EC4899]/40' },
  Montenegro: { bg: 'bg-[#FF9F00]', text: 'text-black', hex: '#FF9F00', glow: 'rgba(255, 159, 0, 0.25)', border: 'border-[#FF9F00]/40' },
  Bosnia: { bg: 'bg-[#8B5CF6]', text: 'text-white', hex: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.25)', border: 'border-[#8B5CF6]/40' },
};

// Map any lowercase or varied country string to standard key
export const normalizeCountry = (c?: string): string => {
  if (!c) return 'Macedonia';
  const up = c.toUpperCase();
  if (up.includes('MAC') || up.includes('MKD')) return 'Macedonia';
  if (up.includes('KOS') || up.includes('KS')) return 'Kosovo';
  if (up.includes('ALB')) return 'Albania';
  if (up.includes('MONT') || up.includes('MNE') || up.includes('PG')) return 'Montenegro';
  if (up.includes('BOS') || up.includes('BIH')) return 'Bosnia';
  return 'Macedonia';
};

interface ExpenseCardProps {
  expense: Expense;
  isDarkMode: boolean;
  onSettle?: (id: string) => void;
  canSettle?: boolean;
  onViewReceipt?: (url: string) => void;
  onViewDetail?: (expense: Expense) => void;
}

export default function ExpenseCard({
  expense,
  isDarkMode,
  onSettle,
  canSettle = false,
  onViewReceipt,
  onViewDetail,
}: ExpenseCardProps) {
  const isPaid = expense.status === 'PAID';
  const countryKey = normalizeCountry(expense.country);
  const countryTheme = COUNTRY_COLORS[countryKey] || COUNTRY_COLORS.Macedonia;

  // Safe Date parsing
  let formattedDateOnly = 'N/A';
  let formattedTimeOnly = '--:--';
  let dayOfWeek = '---';

  try {
    const parsedDate = parseISO(expense.date);
    formattedDateOnly = format(parsedDate, 'MMM dd, yyyy');
    dayOfWeek = format(parsedDate, 'EEEE').toUpperCase();
    formattedTimeOnly = format(parsedDate, 'HH:mm');
  } catch (_e) {
    if (expense.createdAt) {
      const d = new Date(expense.createdAt);
      formattedDateOnly = format(d, 'MMM dd, yyyy');
      dayOfWeek = format(d, 'EEEE').toUpperCase();
      formattedTimeOnly = format(d, 'HH:mm');
    }
  }

  const handleCardClick = () => {
    if (isPaid && onViewDetail) {
      onViewDetail(expense);
    } else if (!isPaid && canSettle && onSettle) {
      onSettle(expense.id);
    }
  };

  const isClickable = (isPaid && !!onViewDetail) || (!isPaid && canSettle && !!onSettle);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={handleCardClick}
      className={cn(
        "rounded-[28px] border-2 p-3.5 flex flex-col justify-between transition-transform duration-150 ease-out relative overflow-hidden group select-none min-h-[260px] transform-gpu backface-hidden [transform:translateZ(0)]",
        isDarkMode
          ? "bg-[#1F1B1A]"
          : "bg-white shadow-md hover:shadow-xl",
        isClickable ? "cursor-pointer hover:scale-[1.02] active:scale-[0.99]" : "cursor-default"
      )}
      style={{
        borderColor: isPaid ? 'rgba(16, 185, 129, 0.4)' : countryTheme.hex,
        boxShadow: isDarkMode
          ? `0 10px 30px -10px ${countryTheme.glow}, inset 0 1px 1px rgba(255,255,255,0.06)`
          : `0 14px 34px -12px ${countryTheme.glow}, inset 0 1px 2px rgba(255,255,255,0.8)`
      }}
    >
      {/* Ambient Country Accent Glow on top border (static, no opacity transition to avoid re-blurring raster) */}
      <div 
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-40"
        style={{ backgroundColor: countryTheme.hex }}
      />

      {/* Top Header Row: Document Icon + Title + 3D Cost Circle */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-start gap-2 flex-1 min-w-0 pt-0.5">
          {/* Document Receipt Icon */}
          {expense.receiptUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewReceipt && expense.receiptUrl) {
                  onViewReceipt(expense.receiptUrl);
                } else if (expense.receiptUrl) {
                  window.open(expense.receiptUrl, '_blank', 'noreferrer');
                }
              }}
              className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm cursor-pointer bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400"
              title="View Attached Receipt / Bill"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
            </button>
          ) : (
            <div
              className={cn(
                "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 opacity-40 select-none",
                isDarkMode ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-500"
              )}
              title="No Receipt Attached"
            >
              <FileText className="w-4 h-4" />
            </div>
          )}

          {/* Expense Title / Category */}
          <div className="flex flex-col min-w-0 pr-1">
            <h3 className={cn(
              "font-black text-xs uppercase tracking-tight line-clamp-2 leading-tight",
              isDarkMode ? "text-white" : "text-stone-900"
            )}>
              {expense.category}
            </h3>
          </div>
        </div>

        {/* 3D Rotating Cost Circle */}
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          {/* Rotating dashed ring */}
          <svg className="absolute w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={isPaid ? "#10b981" : countryTheme.hex}
              strokeWidth="4.5"
              strokeDasharray="8 6"
              className="opacity-75 dark:opacity-90"
            />
          </svg>

          {/* Inner circle badge */}
          <div className={cn(
            "w-[50px] h-[50px] rounded-full border-2 flex flex-col items-center justify-center relative shadow-lg bg-white",
            isPaid ? "border-emerald-500 shadow-emerald-500/20" : "shadow-sm"
          )}
          style={{ borderColor: isPaid ? '#10b981' : countryTheme.hex }}
          >
            <span className="text-[7px] font-black absolute top-1 uppercase tracking-widest text-black">
              {expense.currency === 'MKD' ? 'den' : '€'}
            </span>
            <span className="text-sm font-black tracking-tight mt-1 text-black">
              {Math.round(expense.amount).toLocaleString()}
            </span>
            <span className="text-[5px] font-black tracking-widest text-black/50 leading-none">COST</span>
          </div>
        </div>
      </div>

      {/* Middle Card Parameters Block */}
      <div className={cn(
        "p-2.5 rounded-2xl border my-2 flex flex-col gap-1.5 text-[9px] relative z-10",
        isDarkMode ? "bg-black/30 border-white/5" : "bg-stone-50/80 border-stone-200/60 shadow-inner"
      )}>
        {/* Country */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Lock className="w-2.5 h-2.5 text-[#FF5C35]" />
            <span>COUNTRY</span>
          </div>
          <span 
            className="font-black truncate max-w-[130px] uppercase px-2 py-0.5 rounded-full text-[9px] tracking-wider shadow-sm flex items-center gap-1"
            style={{
              backgroundColor: countryTheme.hex,
              color: countryTheme.text === 'text-white' ? '#FFFFFF' : '#000000'
            }}
          >
            <span>{countryKey.toUpperCase()}</span>
          </span>
        </div>

        {/* Teammate Name */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <User className="w-2.5 h-2.5 text-[#FF5C35]" />
            <span>TEAMMATE</span>
          </div>
          <span className={cn(
            "font-black truncate max-w-[120px] uppercase px-2.5 py-0.5 rounded-full text-[9px] tracking-wider border shadow-sm",
            isDarkMode 
              ? "bg-white/10 text-white border-white/15" 
              : "bg-white text-stone-900 border-stone-200"
          )}>
            {expense.teammate || 'SYSTEM'}
          </span>
        </div>

        {/* Date & Day */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Calendar className="w-2.5 h-2.5 text-[#FF5C35]" />
            <span>DATE</span>
          </div>
          <div className="text-right flex items-center gap-1">
            <span className={cn("font-black text-[8px]", isDarkMode ? "text-white" : "text-stone-900")}>
              {formattedDateOnly}
            </span>
            <span className="text-[7px] font-black tracking-widest uppercase opacity-60">
              ({dayOfWeek})
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Clock className="w-2.5 h-2.5 text-[#FF5C35]" />
            <span>TIME</span>
          </div>
          <span className={cn("font-black text-[8px]", isDarkMode ? "text-white" : "text-stone-900")}>
            {formattedTimeOnly}
          </span>
        </div>
      </div>

      {/* Bottom Status Banner */}
      <div className="relative z-10 select-none mt-auto">
        {!isPaid ? (
          <div className="w-full py-1.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl text-[9px] font-black tracking-widest text-center flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20">
            <Flame className="w-3 h-3" />
            <span>PENDING OUTLAY</span>
            {canSettle && (
              <span className="text-[7px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase ml-1">
                Click to Settle
              </span>
            )}
          </div>
        ) : (
          <div className="w-full py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl text-[9px] font-black tracking-widest text-center flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20">
            <Check className="w-3 h-3 stroke-[3]" />
            <span>SETTLED & PAID</span>
            {onViewDetail && (
              <span className="text-[7px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase ml-1">
                View Full Details
              </span>
            )}
          </div>
        )}
      </div>

      {/* Big Green APPROVED Rubber Stamp (when PAID) */}
      {isPaid && (
        <motion.div
          initial={{ scale: 1.4, opacity: 0, rotate: -25 }}
          animate={{ scale: 1, opacity: 0.95, rotate: -12 }}
          transition={{ type: "spring", damping: 14, stiffness: 220 }}
          className="absolute inset-0 m-auto w-[180px] h-[78px] pointer-events-none z-30 flex items-center justify-center"
        >
          <div className="w-full h-full border-4 border-emerald-600 dark:border-emerald-500 rounded-2xl p-1 bg-white/85 dark:bg-black/75 shadow-[0_4px_24px_rgba(16,185,129,0.35)] flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 select-none">
            <div className="w-full h-full border-2 border-dashed border-emerald-600/70 dark:border-emerald-500/70 rounded-xl flex flex-col items-center justify-center px-2 py-0.5">
              <div className="flex items-center gap-1">
                <Check className="w-5 h-5 stroke-[3.5]" />
                <span className="font-black text-xl tracking-[0.2em] font-mono leading-none">
                  APPROVED
                </span>
              </div>
              <div className="flex items-center justify-between w-full text-[7px] font-mono font-black uppercase tracking-widest mt-1 border-t border-emerald-500/30 pt-0.5 px-1">
                <span>SETTLED</span>
                <span>{expense.settledAt ? format(new Date(expense.settledAt), 'dd/MM/yyyy') : formattedDateOnly}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
