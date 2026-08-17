'use client';

import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Stats } from '@/types';
import { STATS_DOC_PATH } from '@/lib/stats';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import Image from 'next/image';

interface SummaryPanelProps {
  isDarkMode: boolean;
}

export default function SummaryPanel({ isDarkMode }: SummaryPanelProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isTabVisible) return;

    const statsRef = doc(db, STATS_DOC_PATH);
    const unsubscribe = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setStats(snap.data() as Stats);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, STATS_DOC_PATH);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isTabVisible]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-pulse">
        <div className="h-32 rounded-[32px] bg-gray-200/50" />
        <div className="h-32 rounded-[32px] bg-gray-200/50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row mb-8 items-center md:justify-center gap-6">
      {/* Completed Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden p-5 rounded-[24px] border-2 transition-all duration-500 group w-full md:max-w-[500px] flex-1 md:h-[175px] shrink-0",
          isDarkMode
            ? "bg-emerald-950/20 border-emerald-500/20 shadow-[0_20px_50px_rgba(0,153,102,0.1)]"
            : "bg-[#d4ffe4] border-emerald-100 shadow-[0_20px_40px_rgba(0,153,102,0.05)]"
        )}
      >
        {/* Right Side Gradient Overlay */}
        <div className={cn(
          "absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l pointer-events-none transition-opacity duration-500",
          isDarkMode ? "from-emerald-500/10 to-transparent" : "from-emerald-500/5 to-transparent"
        )} />

        <div className="flex items-center justify-between relative z-10 h-full">
          <div>
            <p className={cn(
              "text-[12px] font-black tracking-[0.2em] uppercase mb-1",
              isDarkMode ? "text-emerald-500/60" : "text-emerald-600/60"
            )}>
              Total Completed Value
            </p>
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110",
                isDarkMode ? "bg-emerald-500 text-white" : "bg-emerald-600 text-white"
              )}>
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className={cn(
                "text-2xl md:text-3xl font-black tracking-tight",
                isDarkMode ? "text-white" : "text-[#0E0C0B]"
              )}>
                {formatCurrency(stats?.totalCompletedValue || 0)}
              </h3>
            </div>
            <p className={cn(
              "text-[12px] font-bold mt-2 opacity-60",
              isDarkMode ? "text-emerald-400" : "text-emerald-700"
            )}>
              Count: {stats?.completedCount || 0} Completions
            </p>
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-100 pointer-events-none">
            <Image 
              src="/increase.png" 
              alt="Increase" 
              width={90} 
              height={90} 
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </motion.div>

      {/* Cancelled Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "relative overflow-hidden p-5 rounded-[24px] border-2 transition-all duration-500 group w-full md:max-w-[500px] flex-1 md:h-[175px] shrink-0",
          isDarkMode
            ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
            : "bg-[#e2e1e1] border-slate-200 shadow-[0_20px_40px_rgba(0,0,0,0.04)]"
        )}
      >
        {/* Right Side Gradient Overlay */}
        <div className={cn(
          "absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l pointer-events-none transition-opacity duration-500",
          isDarkMode ? "from-black/20 to-transparent" : "from-slate-300/20 to-transparent"
        )} />

        <div className="flex items-center justify-between relative z-10 h-full">
          <div>
            <p className={cn(
              "text-[12px] font-black tracking-[0.2em] uppercase mb-1",
              isDarkMode ? "text-gray-500" : "text-gray-400"
            )}>
              Total Cancelled Value
            </p>
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110",
                isDarkMode ? "bg-gray-600 text-white" : "bg-gray-400 text-white"
              )}>
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className={cn(
                "text-2xl md:text-3xl font-black tracking-tight",
                isDarkMode ? "text-white" : "text-[#0E0C0B]"
              )}>
                {formatCurrency(stats?.totalCancelledValue || 0)}
              </h3>
            </div>
            <p className={cn(
              "text-[12px] font-bold mt-2 opacity-60",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
              Count: {stats?.cancelledCount || 0} Cancellations
            </p>
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-100 pointer-events-none">
            <Image 
              src="/decrease.png" 
              alt="Decrease" 
              width={90} 
              height={90} 
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </motion.div>
    </div>

  );
}
