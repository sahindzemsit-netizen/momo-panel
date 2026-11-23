'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Banknote, Coins, DollarSign, Sparkles, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlyingCurrencyConfig {
  id: string;
  kind: 'bill' | 'coin' | 'dollar';
  tone: 'emerald' | 'amber';
  x: number[];
  y: number[];
  rotate: number[];
  scale: number[];
  duration: number;
  delay: number;
}

const FLYING_CURRENCIES: FlyingCurrencyConfig[] = [
  {
    id: 'bill-left-arc',
    kind: 'bill',
    tone: 'emerald',
    x: [-78, -26, 16],
    y: [46, -24, -76],
    rotate: [-22, 10, -14],
    scale: [0.75, 1.08, 0.72],
    duration: 2.6,
    delay: 0,
  },
  {
    id: 'bill-right-arc',
    kind: 'bill',
    tone: 'emerald',
    x: [82, 26, -14],
    y: [38, -28, -80],
    rotate: [24, -10, 14],
    scale: [0.75, 1.05, 0.72],
    duration: 2.8,
    delay: 0.45,
  },
  {
    id: 'dollar-pop-right',
    kind: 'dollar',
    tone: 'amber',
    x: [14, 58, 72],
    y: [12, -44, -84],
    rotate: [-12, 18, -8],
    scale: [0.65, 1.02, 0.68],
    duration: 2.3,
    delay: 0.25,
  },
  {
    id: 'coins-pop-left',
    kind: 'coin',
    tone: 'amber',
    x: [-18, -62, -74],
    y: [18, -40, -82],
    rotate: [10, -16, 8],
    scale: [0.68, 1.02, 0.68],
    duration: 2.4,
    delay: 0.7,
  },
  {
    id: 'bill-center-rise',
    kind: 'bill',
    tone: 'emerald',
    x: [-8, 18, -6],
    y: [68, 6, -72],
    rotate: [-14, 14, -8],
    scale: [0.72, 1.1, 0.75],
    duration: 2.5,
    delay: 1.05,
  },
  {
    id: 'dollar-swoop',
    kind: 'dollar',
    tone: 'emerald',
    x: [-88, 0, 88],
    y: [-14, -62, -18],
    rotate: [-24, 0, 24],
    scale: [0.65, 1.06, 0.65],
    duration: 3.0,
    delay: 0.85,
  },
  {
    id: 'coins-right-rise',
    kind: 'coin',
    tone: 'emerald',
    x: [56, 30, 48],
    y: [58, -10, -68],
    rotate: [16, -12, 10],
    scale: [0.68, 0.96, 0.65],
    duration: 2.5,
    delay: 1.4,
  },
  {
    id: 'bill-top-glide',
    kind: 'bill',
    tone: 'amber',
    x: [-68, -8, 64],
    y: [-30, -76, -42],
    rotate: [-18, 6, 20],
    scale: [0.68, 1, 0.68],
    duration: 2.9,
    delay: 1.65,
  },
];

export default function MobileCashflowLoader({ isDarkMode }: { isDarkMode: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center justify-center w-full px-6 select-none overflow-hidden">
      {/* Animated Flying Dollars Stage */}
      <div className="relative w-64 h-60 flex items-center justify-center">
        {/* Soft ambient radial backdrop */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [0.94, 1.06, 0.94], opacity: [0.45, 0.8, 0.45] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(
            'absolute w-40 h-40 rounded-full pointer-events-none',
            isDarkMode
              ? 'bg-gradient-to-tr from-emerald-500/15 via-amber-500/10 to-emerald-400/15'
              : 'bg-gradient-to-tr from-emerald-100/80 via-amber-100/60 to-emerald-50/80'
          )}
        />

        {/* Rotating orbital ring */}
        <motion.div
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          className={cn(
            'absolute w-40 h-40 rounded-full border border-dashed pointer-events-none',
            isDarkMode ? 'border-emerald-500/25' : 'border-emerald-500/30'
          )}
        />

        {/* Flying Currency Bills & Coins */}
        {FLYING_CURRENCIES.map((item) => {
          const isEmerald = item.tone === 'emerald';
          const IconComponent =
            item.kind === 'bill' ? Banknote : item.kind === 'coin' ? Coins : DollarSign;

          return (
            <motion.div
              key={item.id}
              initial={{
                x: item.x[0],
                y: item.y[0],
                rotate: item.rotate[0],
                scale: prefersReducedMotion ? 0.95 : item.scale[0],
                opacity: prefersReducedMotion ? 0.85 : 0,
              }}
              animate={
                prefersReducedMotion
                  ? {
                      x: item.x[1],
                      y: item.y[1],
                      rotate: item.rotate[1],
                      opacity: 0.85,
                    }
                  : {
                      x: item.x,
                      y: item.y,
                      rotate: item.rotate,
                      scale: item.scale,
                      opacity: [0, 1, 1, 0],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: item.duration,
                      delay: item.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      times: [0, 0.2, 0.8, 1],
                    }
              }
              className={cn(
                'absolute flex items-center justify-center border pointer-events-none',
                item.kind === 'bill'
                  ? 'w-11 h-8 rounded-xl'
                  : 'w-9 h-9 rounded-full',
                isEmerald
                  ? isDarkMode
                    ? 'bg-[#1B3329] border-emerald-500/40 text-emerald-400'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-600'
                  : isDarkMode
                    ? 'bg-[#352919] border-amber-500/40 text-amber-400'
                    : 'bg-amber-50 border-amber-300 text-amber-600'
              )}
            >
              <IconComponent className={item.kind === 'bill' ? 'w-5 h-5' : 'w-4 h-4'} />
            </motion.div>
          );
        })}

        {/* Central Wallet Vault Card */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [0, -6, 0],
                  scale: [1, 1.04, 1],
                }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(
            'relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center border-2',
            isDarkMode
              ? 'bg-[#231F1D] border-emerald-500/35 text-emerald-400'
              : 'bg-white border-emerald-200 text-emerald-600'
          )}
        >
          <Wallet className="w-9 h-9" />
          <motion.div
            animate={prefersReducedMotion ? undefined : { rotate: [0, 12, -10, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center border-2 border-white dark:border-[#1E1B1A]"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </motion.div>
        </motion.div>
      </div>

      {/* Crisp Typography & Shimmer Track */}
      <div className="flex flex-col items-center text-center space-y-2 mt-1">
        <p
          className={cn(
            'text-sm font-black tracking-[0.18em] uppercase',
            isDarkMode ? 'text-white' : 'text-[#0E0C0B]'
          )}
        >
          CASHFLOW LEDGER
        </p>
        <p
          className={cn(
            'text-xs font-medium tracking-wide',
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          )}
        >
          Counting bills &amp; syncing balances...
        </p>

        {/* Smooth Compositor Progress Track */}
        <div
          className={cn(
            'w-48 h-1.5 rounded-full overflow-hidden mt-3',
            isDarkMode ? 'bg-white/10' : 'bg-gray-100'
          )}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={prefersReducedMotion ? { x: '0%' } : { x: ['-100%', '220%'] }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            }
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
