'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Flame, 
  Check, 
  CheckCircle2,
  Globe,
  Sparkles,
  Clock,
  RotateCcw,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/context';
import { Expense } from '@/types';
import { format, parseISO } from 'date-fns';
import ExpenseCard, { normalizeCountry, COUNTRY_COLORS } from '@/components/ExpenseCard';
import ExpenseReceiptModal from '@/components/ExpenseReceiptModal';
import ExpenseDetailModal from '@/components/ExpenseDetailModal';
import AddExpenseModal from '@/components/AddExpenseModal';

const ALL_COUNTRIES = [
  'Macedonia', 'Kosovo', 'Albania', 'Montenegro', 'Bosnia'
];

// Accounts with unrestricted access across all country tabs in Expenses
const EXPENSES_ALL_ACCESS_EMAILS = [
  'sahindzemsit@gmail.com',
  'mrbulimomo@gmail.com'
];

// Strict country-based accounts for the EXPENSES section
const EXPENSES_COUNTRY_EMAILS: Record<string, string[]> = {
  Macedonia: [
    'gorentmkd@gmail.com',
    'goaracrent@gmail.com',
    'ibisherdin44@gmail.com',
    'ejupinedim@gmail.com',
    'burhanejupi94@gmail.com',
    'leonard.kaja@gmail.com',
    'valmirsmira@gmail.com'
  ],
  Kosovo: [
    'orhani.embelsia@gmail.com',
    'adilgorent@gmail.com',
    'dulloviymer@gmail.com',
    'momorentacarpr@gmail.com'
  ],
  Albania: [
    'info@rentacarmomo.al',
    'arlamema1@gmail.com',
    'ferhatiklaus@gmail.com'
  ],
  Bosnia: [
    'momobosnia@gmail.com',
    'bejtic.kerim@gmail.com',
    'hanan.ibishiii@gmail.com'
  ],
  Montenegro: [
    'fikricanozrazgat@gmail.com',
    'emrearit@gmail.com',
    'esraozrazgat@gmail.com'
  ]
};

export default function ExpensesPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const { expenses = [], user, adminData, setIsMobileMenuOpen } = useAppState();

  // Supervisor access check
  const isSupervisor = useMemo(() => {
    return (
      user?.email === 'sahindzemsit@gmail.com' ||
      user?.email === 'mrbulimomo@gmail.com' ||
      adminData?.password?.toUpperCase() === 'SUPERVISOR'
    );
  }, [adminData, user]);

  // Allowed country tabs specifically for the EXPENSES section
  const allowedExpensesCountries = useMemo(() => {
    const userEmail = (user?.email || '').trim().toLowerCase();

    // 1. Unrestricted accounts: sahindzemsit@gmail.com & mrbulimomo@gmail.com
    if (EXPENSES_ALL_ACCESS_EMAILS.some(e => e.toLowerCase() === userEmail)) {
      return ['ALL', ...ALL_COUNTRIES];
    }

    // 2. Strict country-based accounts: ONLY sees their assigned country tab
    for (const [country, emails] of Object.entries(EXPENSES_COUNTRY_EMAILS)) {
      if (emails.some(e => e.toLowerCase() === userEmail)) {
        return [country];
      }
    }

    // 3. Fallback for unlisted accounts
    const raw = adminData?.allowedLocations || [];
    if (raw.some((loc: string) => loc.toUpperCase() === 'ALL')) {
      return ['ALL', ...ALL_COUNTRIES];
    }
    const matched = ALL_COUNTRIES.filter(c =>
      raw.some((loc: string) => loc.toUpperCase() === c.toUpperCase())
    );
    return matched.length > 0 ? matched : ['Macedonia'];
  }, [adminData?.allowedLocations, user?.email]);

  const hasAllAccess = useMemo(() => {
    return allowedExpensesCountries.includes('ALL');
  }, [allowedExpensesCountries]);

  const isCountryAllowed = (country: string) => {
    if (hasAllAccess) return true;
    const norm = normalizeCountry(country);
    return allowedExpensesCountries.some((loc: string) => loc.toUpperCase() === norm.toUpperCase());
  };

  const availableCountryTabs = useMemo(() => {
    if (hasAllAccess) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(c => 
      allowedExpensesCountries.some(loc => loc.toUpperCase() === c.toUpperCase())
    );
  }, [hasAllAccess, allowedExpensesCountries]);

  // State
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    return hasAllAccess ? 'ALL' : (availableCountryTabs[0] || 'Macedonia');
  });

  // Keep selected country in sync if permitted countries change
  useEffect(() => {
    if (!hasAllAccess) {
      if (selectedCountry === 'ALL' || !availableCountryTabs.some(c => c.toUpperCase() === selectedCountry.toUpperCase())) {
        setSelectedCountry(availableCountryTabs[0] || 'Macedonia');
      }
    }
  }, [hasAllAccess, availableCountryTabs, selectedCountry]);

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [selectedDetailExpense, setSelectedDetailExpense] = useState<Expense | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Visible expenses after country permissions
  const visibleExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const c = normalizeCountry(exp.country);
      return isCountryAllowed(c);
    });
  }, [expenses, allowedExpensesCountries, hasAllAccess]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    const targetDateStr = timeFilter === 'TODAY' ? format(selectedDate, 'yyyy-MM-dd') : '';

    return visibleExpenses.filter(exp => {
      // Country filter
      if (selectedCountry !== 'ALL') {
        const c = normalizeCountry(exp.country);
        if (c.toUpperCase() !== selectedCountry.toUpperCase()) return false;
      }

      // Status filter
      if (categoryFilter !== 'ALL' && exp.status !== categoryFilter) {
        return false;
      }

      // Date filter
      if (targetDateStr) {
        const expDateStr = (exp.date || '').split('T')[0];
        if (expDateStr !== targetDateStr) return false;
      }

      // Search query
      if (query) {
        const match =
          (exp.category || '').toLowerCase().includes(query) ||
          (exp.teammate || '').toLowerCase().includes(query) ||
          (exp.country || '').toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [visibleExpenses, selectedCountry, categoryFilter, timeFilter, selectedDate, debouncedSearchQuery]);

  // Calculate Aggregates
  const stats = useMemo(() => {
    let pendingEur = 0;
    let pendingMkd = 0;
    let pendingCount = 0;
    let paidEur = 0;
    let paidMkd = 0;
    let paidCount = 0;

    filteredExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const curr = exp.currency || 'EUR';
      if (exp.status === 'PAID') {
        if (curr === 'MKD') paidMkd += amt;
        else paidEur += amt;
        paidCount += 1;
      } else {
        if (curr === 'MKD') pendingMkd += amt;
        else pendingEur += amt;
        pendingCount += 1;
      }
    });

    return {
      pendingEur,
      pendingMkd,
      pendingCount,
      paidEur,
      paidMkd,
      paidCount
    };
  }, [filteredExpenses]);

  const { totalCount, pendingRatio, paidRatio } = useMemo(() => {
    const tot = stats.pendingCount + stats.paidCount;
    return {
      totalCount: tot,
      pendingRatio: tot > 0 ? stats.pendingCount / tot : 0,
      paidRatio: tot > 0 ? stats.paidCount / tot : 0
    };
  }, [stats]);

  // Pagination (10 cards per page)
  const itemsPerPage = 10;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
    setTimeFilter('TODAY');
    setCurrentPage(1);
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
    setTimeFilter('TODAY');
    setCurrentPage(1);
  };

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-3 sm:pt-4 md:pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-6 space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div>
              <h1 className={cn(
                "text-2xl font-black tracking-tight",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                EXPENSES
              </h1>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                DECK OF OPERATION CARDS • COUNTRY BASED
              </p>
            </div>

            {/* Mobile menu button positioned on the very right side */}
            <button 
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                "md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ml-auto cursor-pointer shadow-sm",
                isDarkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200"
              )}
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#FF5C35] hover:bg-[#FF7D5E] text-white rounded-2xl font-black tracking-widest text-xs transition-all cursor-pointer shadow-lg shadow-[#FF5C35]/25 hover:scale-105 active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            NEW EXPENSE
          </button>
        </div>

        {/* 3-Panel Compact Modern Header: Pending Outlays | Settlement Volume | Paid Outlays (Single Pair, Compact Height, Bulletproof Contrast) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          
          {/* 1. Left Card: PENDING OUTLAYS */}
          <div 
            className="rounded-[24px] border flex overflow-hidden select-none relative transition-all"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(145deg, #261715 0%, #1B100E 100%)' 
                : 'linear-gradient(145deg, #FFF7F5 0%, #FEEDEA 55%, #FDE4DC 100%)',
              borderColor: isDarkMode 
                ? 'rgba(255, 92, 53, 0.35)' 
                : 'rgba(254, 205, 195, 0.95)',
              boxShadow: isDarkMode 
                ? '0 10px 24px -8px rgba(0, 0, 0, 0.65)' 
                : '0 12px 28px -10px rgba(255, 92, 53, 0.22), 0 2px 8px rgba(0, 0, 0, 0.02)'
            }}
          >
            {/* Left Accent Ribbon */}
            <div 
              className="w-10 sm:w-11 flex items-center justify-center shrink-0 border-r border-white/40 dark:border-white/10 select-none relative overflow-hidden"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(180deg, #6B2418 0%, #45160E 100%)'
                  : 'linear-gradient(180deg, #FF7A59 0%, #FF5C35 100%)'
              }}
            >
              <span 
                className="whitespace-nowrap font-sans font-black tracking-[0.22em] text-[9px] uppercase text-white drop-shadow-sm select-none"
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)'
                }}
              >
                PENDING
              </span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 py-2 px-3.5 sm:px-4 flex flex-col justify-between gap-1.5">
              {/* Header Label Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF5C35]" />
                  <p 
                    className="text-[10px] font-black tracking-[0.16em] uppercase"
                    style={{ color: isDarkMode ? '#FFA38D' : '#991B1B' }}
                  >
                    PENDING TOTAL
                  </p>
                </div>
              </div>

              {/* Single Pair of Totals & Visuals */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {/* Euro Total */}
                  <div className="flex items-baseline gap-1">
                    <span 
                      className="text-2xl sm:text-[28px] font-black tracking-tight leading-none"
                      style={{ color: isDarkMode ? '#FFFFFF' : '#0F172A' }}
                    >
                      {stats.pendingEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#FF5C35]">
                      €
                    </span>
                  </div>
                </div>

                {/* Visuals: 3D Orb Badge (Left) + Stamp Artwork (Right) */}
                <div className="flex items-center gap-2.5 shrink-0 select-none">
                  {/* 3D Orb Badge */}
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center select-none shrink-0">
                    <div 
                      className="absolute inset-0 rounded-full border-2 border-dashed border-[#FF5C35]/50 pointer-events-none" 
                    />
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center text-center shadow-md border border-white/90 relative"
                      style={{
                        background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FFF3EE 50%, #F8D8CB 100%)',
                        boxShadow: 'inset -2px -2px 5px rgba(255, 92, 53, 0.2), inset 2px 2px 5px rgba(255, 255, 255, 0.95), 0 6px 14px -3px rgba(255, 92, 53, 0.3)'
                      }}
                    >
                      <Flame className="w-3 h-3 text-[#FF5C35] shrink-0 drop-shadow-xs" />
                      <span className="font-sans font-black text-xs sm:text-sm tracking-tight leading-none mt-0.5 text-stone-900">
                        {stats.pendingCount}
                      </span>
                      <span className="font-sans font-black text-[#A05540] text-[6px] uppercase tracking-widest leading-none">
                        CARDS
                      </span>
                    </div>
                  </div>

                  {/* Stamp Artwork */}
                  <div className="shrink-0 select-none drop-shadow-[0_6px_14px_rgba(255,92,53,0.22)]">
                    <Image 
                      src="/pendingoutlay.png" 
                      alt="Pending Outlay" 
                      width={50} 
                      height={50} 
                      className="object-contain" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Center Card: SETTLEMENT VOLUME */}
          <div 
            className="rounded-[24px] border flex overflow-hidden select-none relative transition-all"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(145deg, #171926 0%, #11131E 100%)' 
                : 'linear-gradient(145deg, #F8FAFD 0%, #F0F4FA 55%, #E7EFF9 100%)',
              borderColor: isDarkMode 
                ? 'rgba(99, 102, 241, 0.35)' 
                : 'rgba(207, 220, 245, 0.95)',
              boxShadow: isDarkMode 
                ? '0 10px 24px -8px rgba(0, 0, 0, 0.65)' 
                : '0 12px 28px -10px rgba(79, 70, 229, 0.16), 0 2px 8px rgba(0, 0, 0, 0.02)'
            }}
          >
            {/* Left Accent Ribbon */}
            <div 
              className="w-10 sm:w-11 flex items-center justify-center shrink-0 border-r border-white/40 dark:border-white/10 select-none relative overflow-hidden"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(180deg, #2A2B5E 0%, #1C1D42 100%)'
                  : 'linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)'
              }}
            >
              <span 
                className="whitespace-nowrap font-sans font-black tracking-[0.22em] text-[9px] uppercase text-white drop-shadow-sm select-none"
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)'
                }}
              >
                VOLUME
              </span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 py-2 px-3.5 sm:px-4 flex flex-col justify-between gap-1.5">
              {/* Header Label Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                  <p 
                    className="text-[10px] font-black tracking-[0.16em] uppercase"
                    style={{ color: isDarkMode ? '#A5B4FC' : '#3730A3' }}
                  >
                    TOTAL EXPENSE VOLUME
                  </p>
                </div>
                <span 
                  className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border font-mono"
                  style={{
                    background: isDarkMode ? 'rgba(79, 70, 229, 0.15)' : 'rgba(79, 70, 229, 0.12)',
                    color: isDarkMode ? '#A5B4FC' : '#3730A3',
                    borderColor: isDarkMode ? 'rgba(79, 70, 229, 0.3)' : 'rgba(79, 70, 229, 0.25)'
                  }}
                >
                  {Math.round(paidRatio * 100)}% SETTLED
                </span>
              </div>

              {/* Single Pair of Totals & Gauge */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {/* Euro Combined Total */}
                  <div className="flex items-baseline gap-1">
                    <span 
                      className="text-2xl sm:text-[28px] font-black tracking-tight leading-none"
                      style={{ color: isDarkMode ? '#FFFFFF' : '#0F172A' }}
                    >
                      {(stats.pendingEur + stats.paidEur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#4F46E5] dark:text-[#818CF8]">
                      €
                    </span>
                  </div>
                </div>

                {/* Donut Gauge Pill */}
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs border shrink-0"
                  style={{
                    background: isDarkMode ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255, 255, 255, 0.85)',
                    borderColor: isDarkMode ? 'rgba(79, 70, 229, 0.35)' : 'rgba(207, 220, 245, 0.95)'
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span 
                    className="font-sans font-black text-xs sm:text-sm tracking-tight leading-none mt-0.5"
                    style={{ color: isDarkMode ? '#FFFFFF' : '#1E1B4B' }}
                  >
                    {Math.round(paidRatio * 100)}%
                  </span>
                  <span 
                    className="font-sans font-black text-[6.5px] uppercase tracking-widest leading-none"
                    style={{ color: isDarkMode ? '#A5B4FC' : '#4338CA' }}
                  >
                    {stats.paidCount}/{totalCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Right Card: PAID OUTLAYS */}
          <div 
            className="rounded-[24px] border flex overflow-hidden select-none relative transition-all"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(145deg, #132219 0%, #0D1912 100%)' 
                : 'linear-gradient(145deg, #F2FAF5 0%, #E6F6ED 55%, #D9F1E2 100%)',
              borderColor: isDarkMode 
                ? 'rgba(16, 185, 129, 0.35)' 
                : 'rgba(183, 232, 205, 0.95)',
              boxShadow: isDarkMode 
                ? '0 10px 24px -8px rgba(0, 0, 0, 0.65)' 
                : '0 12px 28px -10px rgba(16, 185, 129, 0.22), 0 2px 8px rgba(0, 0, 0, 0.02)'
            }}
          >
            {/* Left Accent Ribbon */}
            <div 
              className="w-10 sm:w-11 flex items-center justify-center shrink-0 border-r border-white/40 dark:border-white/10 select-none relative overflow-hidden"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(180deg, #134E35 0%, #0B3322 100%)'
                  : 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
              }}
            >
              <span 
                className="whitespace-nowrap font-sans font-black tracking-[0.22em] text-[9px] uppercase text-white drop-shadow-sm select-none"
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)'
                }}
              >
                SETTLED
              </span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 py-2 px-3.5 sm:px-4 flex flex-col justify-between gap-1.5">
              {/* Header Label Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#059669]" />
                  <p 
                    className="text-[10px] font-black tracking-[0.16em] uppercase"
                    style={{ color: isDarkMode ? '#6EE7B7' : '#065F46' }}
                  >
                    SETTLED TOTAL
                  </p>
                </div>
              </div>

              {/* Single Pair of Totals & Visuals */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {/* Euro Total */}
                  <div className="flex items-baseline gap-1">
                    <span 
                      className="text-2xl sm:text-[28px] font-black tracking-tight leading-none"
                      style={{ color: isDarkMode ? '#FFFFFF' : '#0F172A' }}
                    >
                      {stats.paidEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#059669]">
                      €
                    </span>
                  </div>
                </div>

                {/* Visuals: 3D Orb Badge (Left) + Stamp Artwork (Right) */}
                <div className="flex items-center gap-2.5 shrink-0 select-none">
                  {/* 3D Orb Badge */}
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center select-none shrink-0">
                    <div 
                      className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/50 pointer-events-none" 
                    />
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center text-center shadow-md border border-white/90 relative"
                      style={{
                        background: 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #EDF8F2 50%, #D4EFE1 100%)',
                        boxShadow: 'inset -2px -2px 5px rgba(16, 185, 129, 0.2), inset 2px 2px 5px rgba(255, 255, 255, 0.95), 0 6px 14px -3px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#059669] shrink-0 drop-shadow-xs" />
                      <span className="font-sans font-black text-xs sm:text-sm tracking-tight leading-none mt-0.5 text-stone-900">
                        {stats.paidCount}
                      </span>
                      <span className="font-sans font-black text-[#386D54] text-[6px] uppercase tracking-widest leading-none">
                        CARDS
                      </span>
                    </div>
                  </div>

                  {/* Stamp Artwork */}
                  <div className="shrink-0 select-none drop-shadow-[0_6px_14px_rgba(16,185,129,0.22)]">
                    <Image 
                      src="/paidoutlay.png" 
                      alt="Paid Outlay" 
                      width={50} 
                      height={50} 
                      className="object-contain" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Unified Filter & Search Bar: Search (Left) + Countries & Status (Center) + Time View & Date Picker (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
          {/* Search */}
          <div className="relative w-full sm:w-56 md:w-64 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                "pl-10 pr-4 h-9 rounded-xl text-[10px] font-black tracking-widest outline-none border transition-all w-full uppercase placeholder:normal-case",
                isDarkMode 
                  ? "bg-[#1A1614] border-white/10 text-white focus:border-[#FF5C35]" 
                  : "bg-white border-stone-200 text-stone-900 focus:border-[#FF5C35]"
              )}
            />
          </div>

          {/* Center: Countries + Status */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Country Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase mr-0.5">
                COUNTRIES:
              </span>
              
              {hasAllAccess && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountry('ALL');
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border cursor-pointer",
                    selectedCountry === 'ALL'
                      ? "bg-[#FF5C35] text-white border-transparent shadow-md scale-105"
                      : isDarkMode ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                  )}
                >
                  ALL
                </button>
              )}

              {availableCountryTabs.map(ctry => {
                const theme = COUNTRY_COLORS[ctry] || COUNTRY_COLORS.Macedonia;
                const isSelected = selectedCountry.toUpperCase() === ctry.toUpperCase();
                return (
                  <button
                    key={ctry}
                    type="button"
                    onClick={() => {
                      setSelectedCountry(ctry);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border cursor-pointer flex items-center gap-1.5",
                      isSelected
                        ? "shadow-md scale-105 border-transparent"
                        : isDarkMode ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                    )}
                    style={isSelected ? {
                      backgroundColor: theme.hex,
                      color: theme.text === 'text-white' ? '#FFFFFF' : '#000000',
                      boxShadow: `0 4px 14px ${theme.hex}50`
                    } : undefined}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: isSelected ? (theme.text === 'text-white' ? '#FFFFFF' : '#000000') : theme.hex }}
                    />
                    <span>{ctry}</span>
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200 dark:bg-white/10 hidden xl:block" />

            {/* Status selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase mr-0.5">
                STATUS:
              </span>
              {(['ALL', 'PENDING', 'PAID'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(s);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border cursor-pointer",
                    categoryFilter === s
                      ? s === 'PENDING'
                        ? "bg-red-500 text-white border-red-500 shadow-md scale-105"
                        : s === 'PAID'
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md scale-105"
                          : "bg-[#FF5C35] text-white border-[#FF5C35] shadow-md scale-105"
                      : isDarkMode ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                  )}
                >
                  {s === 'PAID' ? 'SETTLED' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Time View & Date Picker */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
            <div className="flex items-center gap-1.5 p-1 bg-gray-200/50 dark:bg-white/5 rounded-xl">
              {(['ALL', 'TODAY'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTimeFilter(t);
                    if (t === 'TODAY') setSelectedDate(new Date());
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all cursor-pointer",
                    timeFilter === t
                      ? "bg-[#FF5C35] text-white shadow-sm font-extrabold"
                      : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
                  )}
                >
                  {t === 'ALL' ? 'ALL DAYS' : 'TODAY'}
                </button>
              ))}
            </div>

            {/* Day navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevDay}
                className={cn(
                  "p-1.5 rounded-xl border transition-all cursor-pointer",
                  isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-stone-200 hover:bg-stone-100 text-stone-700"
                )}
                title="Previous Day"
              >
                ◀
              </button>
              <span className="text-[10px] font-mono font-black px-2 uppercase text-gray-500 whitespace-nowrap">
                {timeFilter === 'TODAY' ? format(selectedDate, 'dd/MM/yyyy') : 'ALL DATES'}
              </span>
              <button
                type="button"
                onClick={handleNextDay}
                className={cn(
                  "p-1.5 rounded-xl border transition-all cursor-pointer",
                  isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-stone-200 hover:bg-stone-100 text-stone-700"
                )}
                title="Next Day"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* 3D Expense Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black tracking-widest uppercase text-gray-500 dark:text-gray-400">
              OPERATIONAL EXPENSE CARDS ({filteredExpenses.length})
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className={cn(
              "p-12 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center gap-3",
              isDarkMode ? "border-white/10 bg-white/5" : "border-stone-200 bg-stone-50"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-[#FF5C35] flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                No expense cards match your current filters
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-[#FF5C35] text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                + Create New Card
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {paginatedExpenses.map(exp => (
                  <ExpenseCard
                    key={exp.id}
                    expense={exp}
                    isDarkMode={isDarkMode}
                    canSettle={false}
                    onViewReceipt={(url) => setSelectedReceiptUrl(url)}
                    onViewDetail={(expense) => setSelectedDetailExpense(expense)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all border cursor-pointer",
                  currentPage === 1 ? "opacity-30 cursor-not-allowed border-transparent text-gray-400" : isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-stone-200 hover:bg-stone-100 text-stone-700"
                )}
              >
                PREVIOUS
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-xl text-[10px] font-black cursor-pointer transition-all flex items-center justify-center",
                      currentPage === pageNum
                        ? "bg-[#FF5C35] text-white font-extrabold shadow-md scale-105"
                        : isDarkMode ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all border cursor-pointer",
                  currentPage === totalPages ? "opacity-30 cursor-not-allowed border-transparent text-gray-400" : isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-stone-200 hover:bg-stone-100 text-stone-700"
                )}
              >
                NEXT
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Add Expense Modal with Feature 5 receipt dropzone */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        defaultCountry={selectedCountry !== 'ALL' ? selectedCountry : undefined}
        allowedCountries={availableCountryTabs}
        isDarkMode={isDarkMode}
      />

      {/* Full Detail Modal for settled/viewable cards */}
      <ExpenseDetailModal
        isOpen={!!selectedDetailExpense}
        onClose={() => setSelectedDetailExpense(null)}
        expense={selectedDetailExpense}
        isDarkMode={isDarkMode}
        onOpenReceipt={(url) => setSelectedReceiptUrl(url)}
      />

      {/* Receipt Image Lightbox Modal */}
      <ExpenseReceiptModal
        isOpen={!!selectedReceiptUrl}
        onClose={() => setSelectedReceiptUrl(null)}
        receiptUrl={selectedReceiptUrl}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
