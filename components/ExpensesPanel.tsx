'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Check, 
  Calendar, 
  Clock, 
  User, 
  DollarSign, 
  X, 
  Search, 
  Sparkles, 
  Flame, 
  Activity, 
  ShieldAlert,
  Fuel,
  Coffee,
  Wrench,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/context';
import { Expense } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';

const RECOMMENDED_CATEGORIES = [
  { name: 'gas', label: 'Gas / Fuel', icon: Fuel, color: 'text-amber-500 bg-amber-500/10' },
  { name: 'food', label: 'Food & Meals', icon: Coffee, color: 'text-orange-500 bg-orange-500/10' },
  { name: 'maintenance', label: 'Maintenance / Service', icon: Wrench, color: 'text-blue-500 bg-blue-500/10' },
  { name: 'other', label: 'Other', icon: HelpCircle, color: 'text-purple-500 bg-purple-500/10' }
];

const TEAMMATES = [
  'ADEM', 'ALEN', 'ALTUN', 'ARLA', 'BESAR', 'BUJAR', 'BULI', 'BURHAN', 'CAN', 
  'DEVI', 'EMRE', 'ENSAR', 'ERDIN', 'ERGIN', 'FABIO', 'FITIM', 'HANAN', 
  'JETON', 'KERIM', 'KLAUS', 'LEONARD', 'NAIM', 'NEDIM', 'ORHAN', 'RINOR', 
  'SEIT', 'SHAHIN', 'TIKI', 'VALMIR', 'YMER'
];

const TEAMMATE_PASSWORDS: Record<string, string> = {
  ADEM: '83491',
  BURHAN: '27506',
  BUJAR: '61924',
  BESAR: '45813',
  NEDIM: '90275',
  ERDIN: '36482',
  BULI: '55055',
  SHAHIN: '72641',
  LEONARD: '18359',
  SEIT: '49027',
  JETON: '63518',
  NAIM: '27843',
  ARLA: '85196',
  DEVI: '39204',
  FABIO: '54672',
  ENSAR: '91835',
  KLAUS: '20461',
  YMER: '73598',
  ORHAN: '46270',
  ALEN: '15983',
  KERIM: '83491',
  HANAN: '27506',
  FITIM: '61924',
  ERGIN: '45813',
  RINOR: '90275',
  VALMIR: '36482',
  EMRE: '51790',
  CAN: '72641',
  TIKI: '18359',
  ALTUN: '49027'
};

export default function ExpensesPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const { expenses = [], user, isAdmin } = useAppState();

  const allowedTeammates = useMemo(() => {
    const email = user?.email?.toLowerCase() || '';
    
    // Super-users can view all
    if (email === 'mrbulimomo@gmail.com' || email === 'sahindzemsit@gmail.com') {
      return TEAMMATES;
    }

    // Group A
    if ([
      'gorentmkd@gmail.com', 'ibisherdin44@gmail.com', 'ejupinedim@gmail.com',
      'burhanejupi94@gmail.com', 'leonard.kaja@gmail.com', 'valmirsmira@gmail.com',
      'goaracrent@gmail.com'
    ].includes(email)) {
      return ['ADEM', 'BUJAR', 'BURHAN', 'BESAR', 'NEDIM', 'ERDIN', 'LEONARD', 'SEIT', 'JETON', 'NAIM', 'ENSAR', 'FITIM', 'ERGIN', 'VALMIR'];
    }

    // Group B
    if ([
      'dulloviymer@gmail.com', 'momorentacarpr@gmail.com', 'adilgorent@gmail.com'
    ].includes(email)) {
      return ['ALTUN', 'YMER', 'ORHAN', 'RINOR', 'TIKI'];
    }

    // Group C
    if (email === 'info@rentacarmomo.al') {
      return ['ARLA', 'DEVI', 'FABIO', 'KLAUS'];
    }

    // Group D
    if ([
      'ramadani.fin.doo@gmail.com', 'momobosnia@gmail.com', 'hanan.ibishiii@gmail.com',
      'bejtic.kerim@gmail.com'
    ].includes(email)) {
      return ['ALEN', 'KERIM', 'HANAN'];
    }

    // Group E
    if ([
      'fikricanozrazgat@gmail.com', 'emrearit@gmail.com', 'esraozrazgat@gmail.com'
    ].includes(email)) {
      return ['CAN', 'EMRE'];
    }

    return [];
  }, [user]);

  const visibleExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const tm = (exp.teammate || '').trim().toUpperCase();
      return allowedTeammates.includes(tm);
    });
  }, [expenses, allowedTeammates]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const [selectedTeammate, setSelectedTeammate] = useState<string>('ALL');
  const [isTeammateDropdownOpen, setIsTeammateDropdownOpen] = useState(false);
  const [pinPendingTeammate, setPinPendingTeammate] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return new Date();
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [currency, setCurrency] = useState<'EUR' | 'MKD'>('EUR');
  const [settlingExpense, setSettlingExpense] = useState<{ id: string; category: string; amount: number; currency: 'EUR' | 'MKD' } | null>(null);
  const [viewingCategoryText, setViewingCategoryText] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // New Expense Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    amount: '',
    teammate: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset pagination on search or filter change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleFilterChange = (val: string) => {
    setCategoryFilter(val);
    setCurrentPage(1);
  };

  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
    setCurrentPage(1);
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
    setCurrentPage(1);
  };

  const handleVerifyPin = (pin: string) => {
    if (!pinPendingTeammate) return;
    const correctPin = TEAMMATE_PASSWORDS[pinPendingTeammate];
    if (pin === correctPin) {
      setSelectedTeammate(pinPendingTeammate);
      setPinPendingTeammate(null);
      setEnteredPin('');
      setPinError(null);
    } else {
      setPinError('Access Denied');
      // Briefly shake and clear
      setTimeout(() => {
        setEnteredPin('');
      }, 600);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (enteredPin.length >= 5) return;
    const newPin = enteredPin + val;
    setEnteredPin(newPin);
    setPinError(null);
    if (newPin.length === 5) {
      handleVerifyPin(newPin);
    }
  };

  // Calculate Aggregates
  const stats = useMemo(() => {
    let pendingEur = 0;
    let pendingMkd = 0;
    let pendingCount = 0;
    let paidEur = 0;
    let paidMkd = 0;
    let paidCount = 0;

    visibleExpenses.forEach((exp) => {
      // 1. Teammate Filter
      if (selectedTeammate !== 'ALL') {
        const tMatch = (exp.teammate || '').trim().toLowerCase() === selectedTeammate.trim().toLowerCase();
        if (!tMatch) return;
      }

      // 2. Time/Date Filter
      let matchTime = true;
      if (timeFilter === 'TODAY') {
        try {
          const expDateStr = (exp.date || '').split('T')[0];
          const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
          matchTime = expDateStr === targetDateStr;
        } catch (_) {
          matchTime = false;
        }
      }
      if (!matchTime) return;

      // 3. Status/Category Filter
      if (categoryFilter !== 'ALL') {
        if ((exp.status || '').toUpperCase() !== categoryFilter.toUpperCase()) return;
      }

      // 4. Search Query Filter
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchSearch = 
          (exp.category || '').toLowerCase().includes(query) ||
          (exp.teammate || '').toLowerCase().includes(query);
        if (!matchSearch) return;
      }

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
  }, [visibleExpenses, selectedTeammate, timeFilter, selectedDate, debouncedSearchQuery, categoryFilter]);

  const { totalCount, pendingRatio, paidRatio } = useMemo(() => {
    const tot = stats.pendingCount + stats.paidCount;
    return {
      totalCount: tot,
      pendingRatio: tot > 0 ? stats.pendingCount / tot : 0,
      paidRatio: tot > 0 ? stats.paidCount / tot : 0
    };
  }, [stats]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter((exp) => {
      const matchSearch = 
        (exp.category || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (exp.teammate || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchStatus = categoryFilter === 'ALL' || (exp.status || '').toUpperCase() === categoryFilter.toUpperCase();
      
      let matchTime = true;
      if (timeFilter === 'TODAY') {
        try {
          const expDateStr = (exp.date || '').split('T')[0];
          const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
          matchTime = expDateStr === targetDateStr;
        } catch (_) {
          matchTime = false;
        }
      }

      const matchTeammate = selectedTeammate === 'ALL' || 
        (exp.teammate || '').trim().toLowerCase() === selectedTeammate.trim().toLowerCase();
      
      return matchSearch && matchStatus && matchTime && matchTeammate;
    });
  }, [visibleExpenses, debouncedSearchQuery, categoryFilter, timeFilter, selectedDate, selectedTeammate]);

  // Paginated Expenses (10 cards per page)
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * 10;
    return filteredExpenses.slice(startIndex, startIndex + 10);
  }, [filteredExpenses, currentPage]);

  const totalPages = Math.ceil(filteredExpenses.length / 10);

  // Form Submission
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.category.trim()) {
      setFormError('Category is required');
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be a valid positive number');
      return;
    }
    if (!formData.teammate.trim()) {
      setFormError('Teammate is required');
      return;
    }

    const normalizedTeammate = formData.teammate.trim().toUpperCase();
    if (!allowedTeammates.includes(normalizedTeammate)) {
      setFormError(`You are not authorized to manage expenses for ${normalizedTeammate}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentHoursMinutes = format(now, 'HH:mm');
      const payload = {
        date: formData.date.includes('T') ? formData.date : `${formData.date}T${currentHoursMinutes}`,
        category: formData.category.trim(),
        amount: amt,
        status: 'PENDING' as const, // automatically Pending when created
        teammate: formData.teammate.trim(),
        currency: currency,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'expenses'), payload);
      
      // Reset form
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        amount: '',
        teammate: ''
      });
      setCurrency('EUR');
      setIsModalOpen(false);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setFormError('Failed to save expense. Please verify administrative roles.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Toggler
  const handleToggleStatus = async (id: string, currentStatus: 'PENDING' | 'PAID') => {
    if (currentStatus === 'PAID') return; // Once settled/paid, it cannot be reverted
    if (user?.email !== 'mrbulimomo@gmail.com') {
      console.error("Unauthorized: Only mrbulimomo@gmail.com can settle expenses.");
      return;
    }
    try {
      await updateDoc(doc(db, 'expenses', id), {
        status: 'PAID',
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `expenses/${id}`);
    }
  };

  // Identify Category Icon & Colors
  const getCategoryTheme = (catName: string) => {
    const nameLower = catName.toLowerCase();
    if (nameLower.includes('gas') || nameLower.includes('fuel')) {
      return { icon: Fuel, color: 'text-amber-500', bg: 'bg-amber-500/10', gradient: 'from-amber-500/20 to-amber-950/20' };
    }
    if (nameLower.includes('food') || nameLower.includes('meal') || nameLower.includes('lunch') || nameLower.includes('coffee')) {
      return { icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-orange-950/20' };
    }
    if (nameLower.includes('repair') || nameLower.includes('maintenance') || nameLower.includes('service') || nameLower.includes('oil')) {
      return { icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-blue-950/20' };
    }
    return { icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-500/10', gradient: 'from-indigo-500/20 to-indigo-950/20' };
  };

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-black tracking-tight",
              isDarkMode ? "text-white" : "text-gray-900"
            )}>EXPENSES</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              DECK OF OPERATION CARDS
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedTeammate !== 'ALL' && (
              <button
                onClick={() => {
                  setFormData({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    category: '',
                    amount: '',
                    teammate: selectedTeammate
                  });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FF5C35] hover:bg-[#FF7D5E] text-white rounded-xl font-bold tracking-widest text-[10px] transition-all cursor-pointer shadow-lg shadow-[#FF5C35]/20 hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                ADD EXPENSE
              </button>
            )}
          </div>
        </div>

        {/* Aggregated Panels / Counters (Green and Red Premium Panels + Central Settlement Gauge) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* PENDING CARD (RED/ORANGE PREMIUM PANEL) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleFilterChange(categoryFilter === 'PENDING' ? 'ALL' : 'PENDING')}
            className={cn(
              "lg:col-span-2 p-5 rounded-2xl border-l-4 border relative overflow-hidden transition-all duration-300 group flex flex-col justify-between h-[150px] cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
              isDarkMode 
                ? "bg-gradient-to-br from-[#2D1616] via-[#1F1111] to-[#170E0E] border-red-500/30 border-l-red-500 text-white" 
                : "bg-gradient-to-br from-red-50/70 via-rose-50/40 to-white border-red-200 border-l-red-500 text-gray-800",
              categoryFilter === 'PENDING' ? (isDarkMode ? "ring-2 ring-red-500/50" : "ring-2 ring-red-500/30") : ""
            )}
            style={{ 
              boxShadow: isDarkMode 
                ? '0 12px 40px rgba(239, 68, 68, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.05)' 
                : '0 12px 40px rgba(239, 68, 68, 0.08)' 
            }}
          >
            <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-red-500/10 transition-transform duration-500 group-hover:scale-110" />
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-red-500/10 pb-2 mb-2 dark:border-white/5">
              <span className={cn(
                "text-[9px] font-extrabold tracking-widest uppercase shrink-0",
                isDarkMode ? "text-red-400" : "text-red-600"
              )}>PENDING OUTLAYS</span>

              {/* 3D Progress Bar on Header Right */}
              <div className="flex items-center gap-3 max-w-[220px] w-full justify-end ml-4">
                <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
                  {stats.pendingCount} PENDING
                </span>
                <div className="h-2.5 w-24 bg-black/40 dark:bg-black/50 rounded-full p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-white/5 overflow-hidden shrink-0">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 shadow-[0_0_8px_rgba(239,68,68,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.4)] relative transition-all duration-500"
                    style={{ width: `${pendingRatio * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Price section with big icon to the right */}
            <div className="flex-1 flex items-center justify-between gap-4">
              {/* Left Column: Prices */}
              <div className="flex-1 flex flex-col justify-center h-full py-1">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <span className="text-[8px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block uppercase">EURO TOTAL</span>
                    <span className={cn("text-2xl tracking-tight font-black block", isDarkMode ? "text-red-400" : "text-red-600")}>
                      {stats.pendingEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="hidden sm:block h-8 w-[1px] bg-red-500/15 dark:bg-white/10" />
                  <div>
                    <span className="text-[8px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block uppercase">DENAR TOTAL</span>
                    <span className={cn("text-2xl tracking-tight font-black block", isDarkMode ? "text-red-400" : "text-red-600")}>
                      {stats.pendingMkd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} den
                    </span>
                  </div>
                </div>
              </div>

              {/* Nice big icon next to/to the right side of the prices - perfectly centered */}
              <div className="shrink-0 transition-transform duration-300 group-hover:scale-110 flex items-center justify-center h-full">
                <Image 
                  src="/pendingoutlay.png" 
                  alt="Pending Outlay" 
                  width={100} 
                  height={100} 
                  className="object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </motion.div>

          {/* CENTRAL SETTLEMENT GAUGE PANEL (MIDDLE OVERVIEW) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleFilterChange('ALL')}
            className={cn(
              "lg:col-span-1 md:col-span-2 p-4 rounded-2xl border relative overflow-hidden transition-all duration-300 group flex flex-col justify-between h-[150px] cursor-pointer hover:scale-[1.01] active:scale-[0.99] items-center text-center",
              isDarkMode 
                ? "bg-gradient-to-br from-[#0B0912] via-[#08070D] to-[#040306] border-black/40 text-white" 
                : "bg-gradient-to-br from-indigo-100/40 via-purple-100/20 to-gray-100/40 border-gray-200 text-gray-800",
              categoryFilter === 'ALL' ? (isDarkMode ? "ring-2 ring-indigo-500/50" : "ring-2 ring-indigo-500/30") : ""
            )}
            style={{ 
              boxShadow: isDarkMode 
                ? 'inset 0 6px 14px rgba(0, 0, 0, 0.7), inset 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 0px rgba(255, 255, 255, 0.04)' 
                : 'inset 0 4px 10px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 0px rgba(255, 255, 255, 0.8)' 
            }}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-indigo-500/5 transition-transform duration-500 group-hover:scale-110" />

            {/* Header */}
            <div className="w-full flex items-center justify-center border-b border-indigo-500/5 pb-1.5 mb-1 dark:border-white/5">
              <span className={cn(
                "text-[9px] font-extrabold tracking-widest uppercase text-center",
                isDarkMode ? "text-indigo-400" : "text-indigo-600"
              )}>DECK RATIO</span>
            </div>

            {/* Dial with Stats */}
            <div className="flex-1 flex items-center justify-center gap-4 w-full">
              {/* Radial Progress Ring */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-20 h-20" viewBox="0 0 80 80">
                  <defs>
                    <linearGradient id="settleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  {/* Outer glow ring under track */}
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    className="stroke-gray-200/40 dark:stroke-white/5 fill-none"
                    strokeWidth="6"
                  />
                  {/* Animated track progress */}
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="url(#settleGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                    animate={{ strokeDashoffset: (2 * Math.PI * 32) - (paidRatio * (2 * Math.PI * 32)) }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute flex flex-col items-center justify-center leading-none">
                  <span className="text-sm font-black tracking-tight">
                    {Math.round(paidRatio * 100)}%
                  </span>
                  <span className="text-[7px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                    SETTLED
                  </span>
                </div>
              </div>

              {/* Textual summary on the right of the dial */}
              <div className="flex flex-col text-left justify-center shrink-0 gap-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-extrabold tracking-widest text-gray-400 dark:text-gray-500 block uppercase leading-none">TOTAL VOLUME</span>
                  <span className="text-[12px] tracking-tight font-black text-indigo-500 dark:text-indigo-400 block leading-none">
                    {(stats.pendingEur + stats.paidEur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                  <span className="text-[10px] tracking-tight font-black text-indigo-500 dark:text-indigo-400 block leading-none">
                    {(stats.pendingMkd + stats.paidMkd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} den
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-extrabold tracking-widest text-gray-400 dark:text-gray-500 block uppercase leading-none">COUNT</span>
                  <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-300 block leading-none">
                    {stats.paidCount} OF {totalCount} CARDS
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* PAID CARD (GREEN/EMERALD PREMIUM PANEL) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleFilterChange(categoryFilter === 'PAID' ? 'ALL' : 'PAID')}
            className={cn(
              "lg:col-span-2 p-5 rounded-2xl border-l-4 border relative overflow-hidden transition-all duration-300 group flex flex-col justify-between h-[150px] cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
              isDarkMode 
                ? "bg-gradient-to-br from-[#122417] via-[#0E1B12] to-[#0A150E] border-emerald-500/30 border-l-emerald-500 text-white" 
                : "bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white border-emerald-200 border-l-emerald-500 text-gray-800",
              categoryFilter === 'PAID' ? (isDarkMode ? "ring-2 ring-emerald-500/50" : "ring-2 ring-emerald-500/30") : ""
            )}
            style={{ 
              boxShadow: isDarkMode 
                ? '0 12px 40px rgba(16, 185, 129, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.05)' 
                : '0 12px 40px rgba(16, 185, 129, 0.08)' 
            }}
          >
            <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-emerald-500/10 transition-transform duration-500 group-hover:scale-110" />
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2 mb-2 dark:border-white/5">
              <span className={cn(
                "text-[9px] font-extrabold tracking-widest uppercase shrink-0",
                isDarkMode ? "text-emerald-400" : "text-emerald-600"
              )}>PAID OUTLAYS</span>

              {/* 3D Progress Bar on Header Right */}
              <div className="flex items-center gap-3 max-w-[220px] w-full justify-end ml-4">
                <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">
                  {stats.paidCount} SETTLED
                </span>
                <div className="h-2.5 w-24 bg-black/40 dark:bg-black/50 rounded-full p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-white/5 overflow-hidden shrink-0">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.4)] relative transition-all duration-500"
                    style={{ width: `${paidRatio * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Price section with big icon to the right */}
            <div className="flex-1 flex items-center justify-between gap-4">
              {/* Left Column: Prices */}
              <div className="flex-1 flex flex-col justify-center h-full py-1">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <span className="text-[8px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block uppercase">EURO TOTAL</span>
                    <span className={cn("text-2xl tracking-tight font-black block", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                      {stats.paidEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="hidden sm:block h-8 w-[1px] bg-emerald-500/15 dark:bg-white/10" />
                  <div>
                    <span className="text-[8px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block uppercase">DENAR TOTAL</span>
                    <span className={cn("text-2xl tracking-tight font-black block", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                      {stats.paidMkd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} den
                    </span>
                  </div>
                </div>
              </div>

              {/* Nice big icon next to/to the right side of the prices - perfectly centered */}
              <div className="shrink-0 transition-transform duration-300 group-hover:scale-110 flex items-center justify-center h-full">
                <Image 
                  src="/paidoutlay.png" 
                  alt="Paid Outlay" 
                  width={100} 
                  height={100} 
                  className="object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filter, Search, and Calendar controls */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-end items-center">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-[8px] font-black tracking-widest text-gray-400 dark:text-gray-500 uppercase">STATUS:</span>
              <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                {['ALL', 'PENDING', 'PAID'].map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer whitespace-nowrap",
                      categoryFilter === f 
                        ? "bg-[#FF5C35] text-white shadow-sm" 
                        : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-700 hover:text-gray-900")
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date & Calendar Row */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
            {/* Left/Middle: Time View & Teammate Selector grouped together */}
            <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
              {/* Today vs All Tabs */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[8px] font-black tracking-widest text-gray-400 dark:text-gray-500 uppercase">TIME VIEW:</span>
                <div className="flex gap-1.5 p-1 bg-gray-200/50 dark:bg-white/5 rounded-xl">
                  {(['ALL', 'TODAY'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTimeFilter(t);
                        if (t === 'TODAY') {
                          setSelectedDate(new Date());
                        }
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer whitespace-nowrap",
                        timeFilter === t 
                          ? "bg-[#FF5C35] text-white shadow-sm" 
                          : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-700 hover:text-gray-900")
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teammate Selector Tab/Dropdown */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start relative" id="teammate-filter-container">
                <span className="text-[8px] font-black tracking-widest text-gray-400 dark:text-gray-500 uppercase">TEAMMATE:</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTeammateDropdownOpen(!isTeammateDropdownOpen)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border border-dashed h-8 min-w-[50px] justify-center",
                      selectedTeammate !== 'ALL'
                        ? "bg-[#FF5C35] border-transparent text-white shadow-sm font-black"
                        : (isDarkMode 
                            ? "bg-white/5 border-white/15 text-gray-400 hover:text-white hover:bg-white/10" 
                            : "bg-gray-100 border-gray-300 text-gray-500 hover:text-gray-900 hover:bg-gray-200")
                    )}
                  >
                    <span>{selectedTeammate === 'ALL' ? '' : selectedTeammate}</span>
                    <span className="text-[8px] opacity-70">▼</span>
                  </button>

                  {/* Dropdown list of teammates */}
                  {isTeammateDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setIsTeammateDropdownOpen(false)} 
                      />
                      <div 
                        className={cn(
                          "absolute z-50 mt-2 p-3 rounded-2xl shadow-2xl border w-[280px] sm:w-[320px] left-0 transition-all",
                          isDarkMode 
                            ? "bg-[#181514] border-white/10 text-white" 
                            : "bg-white border-gray-200 text-gray-800"
                        )}
                        style={{
                          boxShadow: isDarkMode 
                            ? '0 20px 45px rgba(0,0,0,0.75), inset 0 1px 1px rgba(255,255,255,0.05)'
                            : '0 20px 45px rgba(0,0,0,0.15)'
                        }}
                      >
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200/10 dark:border-white/5">
                          <span className="text-[8px] font-black tracking-widest text-gray-400 uppercase">SELECT TEAMMATE</span>
                          {selectedTeammate !== 'ALL' && (
                            <button 
                              type="button"
                              onClick={() => {
                                setSelectedTeammate('ALL');
                                setIsTeammateDropdownOpen(false);
                              }}
                              className="text-[8px] font-black tracking-widest text-red-500 hover:text-red-400 uppercase transition-colors"
                            >
                              RESET
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto pr-1 select-none custom-scrollbar">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTeammate('ALL');
                              setIsTeammateDropdownOpen(false);
                            }}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase text-left transition-all truncate",
                              selectedTeammate === 'ALL'
                                ? "bg-[#FF5C35] text-white"
                                : (isDarkMode ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-100 text-gray-700")
                            )}
                          >
                            ALL
                          </button>

                          {allowedTeammates.map((tm) => (
                            <button
                              key={tm}
                              type="button"
                              onClick={() => {
                                if (selectedTeammate === tm) {
                                  setIsTeammateDropdownOpen(false);
                                  return;
                                }
                                setPinPendingTeammate(tm);
                                setEnteredPin('');
                                setPinError(null);
                                setIsTeammateDropdownOpen(false);
                              }}
                              className={cn(
                                "px-2 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase text-left transition-all truncate",
                                selectedTeammate === tm
                                  ? "bg-[#FF5C35] text-white font-black"
                                  : (isDarkMode ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-100 text-gray-700")
                              )}
                              title={tm}
                            >
                              {tm}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Search cards bar in the middle/right of the row */}
            <div className="relative w-full sm:w-72 lg:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="SEARCH CARDS / TEAMMATES..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={cn(
                  "pl-10 pr-4 h-8 rounded-xl text-[10px] font-black tracking-widest outline-none border-2 transition-all w-full",
                  isDarkMode 
                    ? "bg-[#1A1614] border-white/5 text-white focus:border-orange-500" 
                    : "bg-white border-gray-100 text-gray-900 focus:border-orange-500"
                )}
              />
            </div>

            {/* Calendar Bar */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start shrink-0">
              <button
                onClick={() => {
                  handlePrevDay();
                  setTimeFilter('TODAY'); // Auto-switch to TODAY when navigating days
                }}
                className={cn(
                  "p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white hover:bg-[#FF5C35]/25 hover:border-[#FF5C35]" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-[#FF5C35]/10 hover:border-[#FF5C35]"
                )}
                title="Previous Day"
              >
                <span className="text-xs font-black">◀</span>
              </button>

              <div className="flex flex-col items-center min-w-[160px] text-center">
                <span className={cn(
                  "text-[9px] font-extrabold tracking-widest",
                  timeFilter === 'TODAY' ? "text-[#FF5C35]" : "text-gray-400 dark:text-gray-500"
                )}>
                  {timeFilter === 'TODAY' ? 'SELECTED DATE' : 'CALENDAR BAR (ALL MODE)'}
                </span>
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-wider",
                  timeFilter === 'TODAY' 
                    ? (isDarkMode ? "text-white" : "text-gray-900")
                    : "text-gray-400 dark:text-gray-500"
                )}>
                  {format(selectedDate, 'EEEE, MMM dd, yyyy')}
                </span>
              </div>

              <button
                onClick={() => {
                  handleNextDay();
                  setTimeFilter('TODAY'); // Auto-switch to TODAY when navigating days
                }}
                className={cn(
                  "p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white hover:bg-[#FF5C35]/25 hover:border-[#FF5C35]" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-[#FF5C35]/10 hover:border-[#FF5C35]"
                )}
                title="Next Day"
              >
                <span className="text-xs font-black">▶</span>
              </button>
            </div>
          </div>
        </div>

        {/* GAMING CARDS DECK */}
        {filteredExpenses.length === 0 ? (
          <div className={cn(
            "p-12 text-center rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3",
            isDarkMode ? "border-white/5 bg-[#1C1816]" : "border-gray-200 bg-gray-50/50"
          )}>
            <FileText className="w-10 h-10 text-gray-400 animate-pulse" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              NO EXPENSE CARDS REGISTERED IN THIS DECK
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <AnimatePresence>
                {paginatedExpenses.map((exp) => {
                  const isPaid = exp.status === 'PAID';
                  const { icon: CategoryIcon, color: catColor, bg: catBg } = getCategoryTheme(exp.category);
                  
                  // Format Day of Week and Date nicely
                  let formattedDateOnly = 'Unknown';
                  let formattedTimeOnly = '--:--';
                  let dayOfWeek = '-';
                  try {
                    let dateToParse = exp.date;
                    if (!dateToParse.includes('T') && !dateToParse.includes(':')) {
                      dateToParse = `${dateToParse}T12:00`;
                    }
                    const parsed = parseISO(dateToParse);
                    formattedDateOnly = format(parsed, 'MMM dd, yyyy');
                    formattedTimeOnly = format(parsed, 'HH:mm');
                    dayOfWeek = format(parsed, 'EEEE').toUpperCase(); // e.g., "SUNDAY"
                  } catch (_) {
                    // Fallback
                    formattedDateOnly = exp.date;
                  }

                  return (
                    <motion.div
                      key={exp.id}
                      layoutId={`expense-card-${exp.id}`}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      whileHover={(!isPaid && user?.email === 'mrbulimomo@gmail.com') ? { y: -6, scale: 1.02 } : undefined}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      onClick={() => {
                        if (!isPaid && user?.email === 'mrbulimomo@gmail.com') {
                          setSettlingExpense({
                            id: exp.id,
                            category: exp.category,
                            amount: Number(exp.amount) || 0,
                            currency: exp.currency || 'EUR'
                          });
                        }
                      }}
                      className={cn(
                        "rounded-2xl border-2 p-3 flex flex-col relative overflow-hidden transition-all select-none h-[210px]",
                        isPaid 
                          ? (isDarkMode 
                              ? "bg-gradient-to-b from-[#18231c] to-[#0f1812] border-emerald-500/30 border-b-2 border-r-[1px] text-white opacity-85 cursor-default" 
                              : "bg-gradient-to-b from-emerald-50/90 to-emerald-100/80 border-emerald-300/60 border-b-2 border-r-[1px] text-gray-800 opacity-90 cursor-default")
                          : (user?.email === 'mrbulimomo@gmail.com'
                              ? (isDarkMode 
                                  ? "bg-gradient-to-b from-[#231818] to-[#180f0f] border-red-500/40 border-b-[8px] border-r-[4px] border-b-red-600 border-r-red-600/70 text-white cursor-pointer hover:shadow-2xl active:translate-y-[4px] active:border-b-[4px] active:border-r-[2px]" 
                                  : "bg-gradient-to-b from-red-50/95 to-red-100/90 border-red-300 border-b-[8px] border-r-[4px] border-b-red-500 border-r-red-400/80 text-gray-800 cursor-pointer hover:shadow-2xl active:translate-y-[4px] active:border-b-[4px] active:border-r-[2px]")
                              : (isDarkMode
                                  ? "bg-gradient-to-b from-[#231818] to-[#180f0f] border-red-500/40 border-b-[8px] border-r-[4px] border-b-red-600 border-r-red-600/70 text-white cursor-default opacity-90"
                                  : "bg-gradient-to-b from-red-50/95 to-red-100/90 border-red-300 border-b-[8px] border-r-[4px] border-b-red-500 border-r-red-400/80 text-gray-800 cursor-default opacity-90")
                            )
                      )}
                      style={{
                        boxShadow: isPaid 
                          ? (isDarkMode 
                              ? 'inset 0 4px 12px rgba(0, 0, 0, 0.65), inset 0 -1px 2px rgba(255, 255, 255, 0.05), 0 1px 1px rgba(0,0,0,0.2)'
                              : 'inset 0 4px 10px rgba(16, 185, 129, 0.12), inset 0 -1px 2px rgba(255, 255, 255, 0.6), 0 1px 1px rgba(0,0,0,0.05)')
                          : (isDarkMode 
                              ? '0 15px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.08)'
                              : '0 12px 24px -10px rgba(239, 68, 68, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.6)')
                      }}
                      title={isPaid ? "Settled and Paid Card" : (user?.email === 'mrbulimomo@gmail.com' ? "Click to Settle / Pay Card" : "Pending Outlay Card")}
                    >
                      {/* Glowing card energy/spell accent line */}
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
                        isPaid ? "from-emerald-400 to-teal-500" : "from-red-400 to-rose-500"
                      )} />

                      {/* Category Title Header Pin */}
                      <div className="flex items-start gap-1.5 mt-1 self-start max-w-[calc(100%-72px)] w-full">
                        <div className={cn("p-1 rounded-md shrink-0 mt-0.5", catBg)}>
                          <CategoryIcon className={cn("w-3 h-3", catColor)} />
                        </div>
                        <div className="flex-1 text-[10px] font-black tracking-wider uppercase whitespace-normal break-words leading-tight text-black dark:text-black">
                          {exp.category.length > 60 ? (
                            <>
                              <span>{exp.category.substring(0, 55)}...</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingCategoryText(exp.category);
                                }}
                                className="ml-1 text-[8px] font-black text-[#FF5C35] hover:underline cursor-pointer inline-block uppercase align-middle"
                              >
                                SHOW MORE
                              </button>
                            </>
                          ) : (
                            <span>{exp.category}</span>
                          )}
                        </div>
                      </div>

                      {/* Power/Cost Circle (gaming element) - Shipped to top-right with floating animation */}
                      <motion.div 
                        className="absolute top-2 right-2 flex flex-col items-center justify-center z-10 w-[66px] h-[66px]"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                      >
                        {/* Rotating dashed magic border ring */}
                        <div className="absolute w-[66px] h-[66px] flex items-center justify-center pointer-events-none">
                          <svg className="w-full h-full animate-[spin_12s_linear_infinite]" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="44"
                              fill="none"
                              stroke={isPaid ? "#10b981" : "#ef4444"}
                              strokeWidth="4.5"
                              strokeDasharray="8 6"
                              className="opacity-75 dark:opacity-90"
                            />
                          </svg>
                        </div>

                        {/* Magical circular frame with solid high contrast design - slightly bigger */}
                        <div className={cn(
                          "w-[54px] h-[54px] rounded-full border-2 flex flex-col items-center justify-center relative shadow-lg transition-all duration-300",
                          isPaid 
                            ? "border-emerald-500 bg-white shadow-emerald-500/20"
                            : "border-red-500 bg-white shadow-red-500/20"
                        )}>
                          <span className="text-[7px] font-black absolute top-1 uppercase tracking-widest text-black">
                            {exp.currency === 'MKD' ? 'den' : '€'}
                          </span>
                          <span className="text-sm font-black tracking-tight mt-1 text-black">
                            {Math.round(exp.amount)}
                          </span>
                          <span className="text-[5px] font-black tracking-widest text-black/50">COST</span>
                          
                          {/* Shimmer/Spark module inside card */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-black/5 to-transparent rounded-full pointer-events-none" />
                        </div>
                      </motion.div>

                      {/* Card stats / Info parameters area */}
                      <div className={cn(
                        "p-2 rounded-xl border mt-auto mb-1.5 flex flex-col gap-1 text-[9px] z-0",
                        isDarkMode ? "bg-black/25 border-white/5" : "bg-white/80 border-gray-100 shadow-sm"
                      )}>
                        {/* TEAMMATE ELEMENT */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-black dark:text-black font-black uppercase tracking-widest">
                            <User className="w-2.5 h-2.5 text-[#FF5C35]" />
                            <span>TEAMMATE</span>
                          </div>
                          <span className={cn(
                            "font-black truncate max-w-[90px] uppercase px-2.5 py-1 rounded-full text-[10px] tracking-widest shadow-md text-white border-2",
                            isDarkMode 
                              ? "bg-gradient-to-r from-orange-600 to-[#FF5C35] border-orange-400/30" 
                              : "bg-gradient-to-r from-orange-500 to-[#FF5C35] border-orange-200"
                          )}>
                            {exp.teammate}
                          </span>
                        </div>

                        {/* DATE & DAY OF WEEK */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-black dark:text-black font-black uppercase tracking-widest">
                            <Calendar className="w-2.5 h-2.5 text-[#FF5C35]" />
                            <span>DATE</span>
                          </div>
                          <div className="text-right flex items-center gap-1">
                            <span className="font-black text-[8px] text-black dark:text-black">{formattedDateOnly}</span>
                            <span className="text-[7px] text-black dark:text-black font-black tracking-widest uppercase">({dayOfWeek})</span>
                          </div>
                        </div>

                        {/* TIME */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-black dark:text-black font-black uppercase tracking-widest">
                            <Clock className="w-2.5 h-2.5 text-[#FF5C35]" />
                            <span>TIME</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-[8px] text-black dark:text-black">{formattedTimeOnly}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Status Banner (Automatically Pending - Non-clickable) */}
                      <div className="select-none">
                        {!isPaid ? (
                          <div className="w-full py-1 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg text-[8px] font-black tracking-widest text-center flex items-center justify-center gap-1 shadow-md shadow-red-500/10">
                            <Flame className="w-2.5 h-2.5 animate-pulse" />
                            PENDING
                          </div>
                        ) : (
                          <div className="w-full py-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg text-[8px] font-black tracking-widest text-center flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10">
                            <Check className="w-2.5 h-2.5" />
                            SETTLED & PAID
                          </div>
                        )}
                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Gaming-styled Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4 pb-4">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest cursor-pointer transition-all border",
                    currentPage === 1 
                      ? "opacity-30 cursor-not-allowed border-transparent text-gray-400" 
                      : (isDarkMode ? "hover:bg-[#FF5C35] hover:text-white border-white/10 text-white" : "hover:bg-[#FF5C35] hover:text-white border-gray-200 text-gray-700")
                  )}
                  id="btn-prev-page"
                >
                  PREVIOUS
                </button>
                <div className="flex items-center gap-1.5" id="pagination-pages">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-xl text-[10px] font-black cursor-pointer transition-all flex items-center justify-center",
                          currentPage === pageNum 
                            ? "bg-[#FF5C35] text-white font-extrabold" 
                            : (isDarkMode ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                        )}
                        id={`btn-page-${pageNum}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest cursor-pointer transition-all border",
                    currentPage === totalPages 
                      ? "opacity-30 cursor-not-allowed border-transparent text-gray-400" 
                      : (isDarkMode ? "hover:bg-[#FF5C35] hover:text-white border-white/10 text-white" : "hover:bg-[#FF5C35] hover:text-white border-gray-200 text-gray-700")
                  )}
                  id="btn-next-page"
                >
                  NEXT
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[130] p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              id="modal-backdrop"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className={cn(
                "w-full max-w-md p-6 rounded-3xl border shadow-2xl relative z-10 flex flex-col gap-5",
                isDarkMode ? "bg-[#1E1B1A] border-white/5 text-white" : "bg-white border-gray-100 text-gray-800"
              )}
              id="add-expense-modal"
            >
              <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-black text-xs tracking-widest uppercase">CONSTRUCT NEW OP-EX CARD</span>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full border border-gray-100 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
                  id="btn-close-modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 text-[10px] font-bold text-red-500 bg-red-500/15 border border-red-500/20 rounded-xl tracking-wider text-center uppercase" id="form-error">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} className="space-y-4" id="expense-form">
                
                {/* Date Input */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black tracking-widest text-gray-500 uppercase block">Expense Occurred Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className={cn(
                      "w-full p-3 rounded-xl border outline-none text-[10px] font-black tracking-wider uppercase transition-all focus:border-orange-500",
                      isDarkMode ? "bg-[#1A1614] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-black !text-black font-black !font-black"
                    )}
                    id="input-date"
                  />
                </div>

                {/* Category Input */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black tracking-widest text-gray-500 uppercase block">Category (Manual Input)</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className={cn(
                      "w-full p-3 rounded-xl border outline-none text-[10px] font-black tracking-wider uppercase transition-all focus:border-orange-500",
                      isDarkMode ? "bg-[#1A1614] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-black !text-black font-black !font-black"
                    )}
                    id="input-category"
                  />
                  
                  {/* Preset helpers */}
                  <div className="flex gap-1.5 mt-1 overflow-x-auto no-scrollbar py-1" id="preset-categories">
                    {RECOMMENDED_CATEGORIES.map((preset) => (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => setFormData(prev => ({ ...prev, category: preset.name.toUpperCase() }))}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[7px] font-black tracking-widest uppercase transition-all cursor-pointer whitespace-nowrap",
                          isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black tracking-widest text-gray-500 uppercase block">Amount Cost</label>
                  <div className={cn(
                    "relative flex items-center rounded-xl border-2 transition-all focus-within:border-orange-500 overflow-hidden",
                    isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-gray-50 border-gray-200"
                  )} id="wrapper-amount-input">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className={cn(
                        "flex-1 p-3 outline-none text-[10px] bg-transparent font-black tracking-wider uppercase",
                        isDarkMode ? "text-white" : "text-black !text-black font-black !font-black"
                      )}
                      id="input-amount"
                    />
                    
                    {/* Currency selection on the right */}
                    <div className="flex items-center gap-1.5 px-3 border-l border-gray-200 dark:border-white/10 shrink-0" id="currency-indicators-group">
                      {/* Currency Symbol right side of core price */}
                      <span className="text-xs font-black text-gray-500 dark:text-gray-400">
                        {currency === 'EUR' ? '€' : 'den'}
                      </span>
                      {/* Toggle button to select EUR or MKD */}
                      <button
                        type="button"
                        onClick={() => setCurrency(prev => prev === 'EUR' ? 'MKD' : 'EUR')}
                        className={cn(
                          "p-1.5 rounded-lg text-[9px] font-black tracking-widest select-none cursor-pointer hover:bg-orange-500/10 hover:text-[#FF5C35] transition-all flex items-center gap-1",
                          currency === 'EUR' ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-500"
                        )}
                        title="Toggle payment currency"
                        id="currency-toggle"
                      >
                        {currency === 'EUR' ? (
                          <span className="text-[14px]">🇪🇺</span>
                        ) : (
                          <span className="text-[14px]">🇲🇰</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Teammate Input */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black tracking-widest text-gray-500 uppercase block">
                    Teammate {selectedTeammate !== 'ALL' && '(LOCKED)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.teammate}
                    onChange={(e) => setFormData(prev => ({ ...prev, teammate: e.target.value }))}
                    disabled={selectedTeammate !== 'ALL'}
                    className={cn(
                      "w-full p-3 rounded-xl border outline-none text-[10px] font-black tracking-wider uppercase transition-all",
                      selectedTeammate !== 'ALL'
                        ? "bg-orange-500/10 border-orange-500/20 text-[#FF5C35] cursor-not-allowed font-black"
                        : (isDarkMode ? "bg-[#1A1614] border-white/5 text-white focus:border-orange-500" : "bg-gray-50 border-gray-200 text-black !text-black font-black !font-black focus:border-orange-500")
                    )}
                    id="input-teammate"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 p-3 bg-[#FF5C35] hover:bg-[#FF7D5E] disabled:opacity-40 text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  id="btn-submit-expense"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      SUMMON CARD DECK
                    </>
                  )}
                </button>

              </form>
            </motion.div>
          </div>
        )}

        {pinPendingTeammate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setPinPendingTeammate(null);
                setEnteredPin('');
                setPinError(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={pinError ? { 
                scale: 1, 
                opacity: 1, 
                y: 0,
                x: [0, -10, 10, -10, 10, -10, 10, 0] 
              } : { 
                scale: 1, 
                opacity: 1, 
                y: 0 
              }}
              transition={pinError ? { duration: 0.5, type: 'spring', stiffness: 500 } : { type: 'spring', damping: 25, stiffness: 350 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-sm rounded-3xl p-6 border-2 shadow-2xl overflow-hidden z-10 flex flex-col items-center",
                isDarkMode 
                  ? "bg-[#181514] border-orange-500/30 text-white" 
                  : "bg-white border-orange-200 text-gray-800"
              )}
            >
              {/* Glowing Ambient Light */}
              <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl pointer-events-none bg-orange-500/10 animate-pulse" />
              
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setPinPendingTeammate(null);
                  setEnteredPin('');
                  setPinError(null);
                }}
                className={cn(
                  "absolute right-4 top-4 p-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-20",
                  isDarkMode ? "hover:bg-white/5 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                )}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title & Badge */}
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-[#FF5C35] flex items-center justify-center mb-4">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-black tracking-widest uppercase mb-1">
                AUTHENTICATE
              </h3>
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center mb-6">
                ENTER PIN CODE FOR <span className="text-[#FF5C35] font-black">{pinPendingTeammate}</span>
              </p>

              {/* Hidden input to catch physical keyboard entries and trigger mobile keyboard */}
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={5}
                value={enteredPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 5) {
                    setEnteredPin(val);
                    setPinError(null);
                    if (val.length === 5) {
                      handleVerifyPin(val);
                    }
                  }
                }}
                autoFocus
                className="absolute inset-0 w-full h-full opacity-0 cursor-default z-10"
                style={{ caretColor: 'transparent' }}
              />

              {/* Styled 5 Digit Indicator Blocks */}
              <div className="flex justify-center gap-3 mb-6 relative z-30">
                {Array.from({ length: 5 }).map((_, i) => {
                  const digit = enteredPin[i];
                  const isFocused = enteredPin.length === i;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "w-11 h-13 rounded-xl border-2 flex items-center justify-center text-lg font-black tracking-widest transition-all",
                        digit 
                          ? "border-[#FF5C35] bg-orange-500/5 text-[#FF5C35]" 
                          : (isFocused 
                              ? "border-[#FF5C35] bg-transparent animate-pulse" 
                              : (isDarkMode ? "border-white/10 bg-white/5 text-transparent" : "border-gray-200 bg-gray-50 text-transparent"))
                      )}
                    >
                      {digit ? "●" : ""}
                    </div>
                  );
                })}

                {/* Access Denied Tooltip */}
                <AnimatePresence>
                  {pinError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black tracking-widest px-3 py-1.5 rounded-lg shadow-xl uppercase z-50 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
                      ACCESS DENIED
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* On-screen Keypad (Numbers 0-9) */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] select-none z-20">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num.toString())}
                    className={cn(
                      "h-12 rounded-xl text-xs font-black transition-all flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer border",
                      isDarkMode 
                        ? "bg-white/5 border-white/5 hover:bg-white/10 text-white" 
                        : "bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-800"
                    )}
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear */}
                <button
                  type="button"
                  onClick={() => {
                    setEnteredPin('');
                    setPinError(null);
                  }}
                  className={cn(
                    "h-12 rounded-xl text-[9px] font-black tracking-widest transition-all flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer border uppercase",
                    isDarkMode 
                      ? "bg-red-500/10 border-red-500/15 text-red-400 hover:bg-red-500/20" 
                      : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                  )}
                >
                  CLEAR
                </button>

                {/* 0 */}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className={cn(
                    "h-12 rounded-xl text-xs font-black transition-all flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer border",
                    isDarkMode 
                      ? "bg-white/5 border-white/5 hover:bg-white/10 text-white" 
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-800"
                  )}
                >
                  0
                </button>

                {/* Backspace */}
                <button
                  type="button"
                  onClick={() => {
                    setEnteredPin(prev => prev.slice(0, -1));
                    setPinError(null);
                  }}
                  className={cn(
                    "h-12 rounded-xl text-[9px] font-black tracking-widest transition-all flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer border uppercase",
                    isDarkMode 
                      ? "bg-white/5 border-white/5 hover:bg-white/10 text-gray-400" 
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-600"
                  )}
                >
                  DEL
                </button>
              </div>

              {/* Password Hint Warning */}
              <span className="text-[7px] font-black text-gray-400/60 dark:text-gray-500/60 uppercase tracking-widest mt-6 text-center">
                5-DIGIT ENCRYPTED KEY
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Outlay Confirmation Modal */}
      <AnimatePresence>
        {settlingExpense && (
          <div className="fixed inset-0 flex items-center justify-center z-[140] p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettlingExpense(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              id="settle-confirm-backdrop"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-sm p-6 rounded-3xl border shadow-2xl relative z-10 flex flex-col gap-5 text-center",
                isDarkMode ? "bg-[#1E1B1A] border-white/5 text-white" : "bg-white border-gray-100 text-gray-800"
              )}
              id="settle-confirm-modal"
            >
              {/* Animated Warning Icon */}
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse">
                <HelpCircle className="w-6 h-6" />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-black text-xs tracking-widest uppercase">CONFIRM CARD SETTLEMENT</h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  Are you sure you want to transition this outlay to <span className="text-emerald-500 font-black">settled & paid</span>?
                </p>
              </div>

              {/* Expense Details Card */}
              <div className={cn(
                "p-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5",
                isDarkMode ? "bg-[#2A2625] border-white/5" : "bg-gray-50 border-gray-100"
              )}>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {settlingExpense.category}
                </span>
                <span className="text-2xl font-black tracking-tight">
                  {settlingExpense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {settlingExpense.currency === 'MKD' ? 'den' : '€'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  onClick={() => setSettlingExpense(null)}
                  className={cn(
                    "h-10 rounded-xl text-[9px] font-black tracking-widest transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer border uppercase",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10" 
                      : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  CANCEL
                </button>
                <button
                  onClick={async () => {
                    const expId = settlingExpense.id;
                    setSettlingExpense(null);
                    await handleToggleStatus(expId, 'PENDING');
                  }}
                  className="h-10 rounded-xl text-[9px] font-black tracking-widest transition-all bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white hover:scale-[1.03] active:scale-[0.97] cursor-pointer shadow-lg shadow-emerald-500/15 border-none uppercase"
                >
                  SETTLE & PAY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Full Description Modal */}
      <AnimatePresence>
        {viewingCategoryText && (
          <div className="fixed inset-0 flex items-center justify-center z-[150] p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingCategoryText(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              id="category-view-backdrop"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-sm p-6 rounded-3xl border shadow-2xl relative z-10 flex flex-col gap-4 text-center",
                isDarkMode ? "bg-[#1E1B1A] border-white/5 text-white" : "bg-white border-gray-100 text-gray-800"
              )}
              id="category-view-modal"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-[#FF5C35]">
                <FileText className="w-6 h-6" />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-black text-xs tracking-widest uppercase">EXPENSE DETAILS</h3>
                <p className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                  Full Category / Description
                </p>
              </div>

              {/* Full Text Display Area */}
              <div className={cn(
                "p-4 rounded-2xl border text-left max-h-[200px] overflow-y-auto no-scrollbar",
                isDarkMode ? "bg-[#2A2625] border-white/5" : "bg-gray-50 border-gray-100"
              )}>
                <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-black whitespace-pre-wrap break-words leading-relaxed">
                  {viewingCategoryText}
                </span>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setViewingCategoryText(null)}
                className="w-full h-10 rounded-xl text-[9px] font-black tracking-widest transition-all bg-[#FF5C35] hover:bg-[#FF7D5E] text-white cursor-pointer shadow-lg shadow-[#FF5C35]/15 border-none uppercase"
                id="category-view-close-btn"
              >
                CLOSE
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
