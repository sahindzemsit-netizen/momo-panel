'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useAppState } from '@/lib/context';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, where, setDoc, getDocs } from 'firebase/firestore';
import { 
  Wallet, 
  Lock, 
  FileText, 
  BookOpen, 
  Check, 
  User, 
  CarFront, 
  Sparkles, 
  Eye, 
  Loader2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn, parseDateSafe } from '@/lib/utils';
import PriceLabel from '@/components/PriceLabel';

interface CashflowItem {
  id: string;
  reservationId: string;
  name: string;
  vehicleId: string | number;
  days: string | number;
  totalPrice: number;
  amountPaid: number;
  paidTo: string;
  cashflowHandledBy: string;
  processedBy?: string;
  cashflowNote: string;
  paymentMethod: string;
  cashAmount?: number;
  cardAmount?: number;
  receiptUrl?: string;
  createdAt: number;
  isPaid: boolean;
  approvedBy?: string;
  start?: any;
  end?: any;
  arrivalTime?: string;
  departureTime?: string;
  fromLocation?: string;
  toLocation?: string;
}

// Plate color helper matching active bookings panel behavior
const getPlateColorByPlate = (plateStr: string, vehiclesList: any[]) => {
  if (!plateStr || !vehiclesList) return null;
  const clean = plateStr.replace(/\s+/g, '').toUpperCase();
  const found = vehiclesList.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
  return found?.color || null;
};

// Location pill styling matching active bookings panel behaviour
const getLocationPillStyles = (location: string | undefined) => {
  if (!location) return { bg: 'transparent', text: '#000000' };
  const loc = location.toUpperCase();
  if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA')) return { bg: '#64BC61', text: '#000000' };
  if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO')) return { bg: '#3B82F6', text: '#000000' };
  if (loc.includes('TIRANA') || loc.includes('ALBANIA')) return { bg: '#6B7280', text: '#FFFFFF' };
  if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO')) return { bg: '#FF9F00', text: '#000000' };
  if (loc.includes('SARAJEVO') || loc.includes('BOSNIA')) return { bg: '#8B5CF6', text: '#000000' };
  return { bg: '#64BC61', text: '#000000' };
};

// Safe date formatter producing standard dd/MM/yyyy format matching active panel
const formatDateSafe = (d: any) => {
  if (!d) return '';
  const date = parseDateSafe(d);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Extract country code from location string
const getCountryFromLocation = (location: string | undefined): string | null => {
  if (!location) return null;
  const loc = location.toUpperCase();
  if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA')) return 'MACEDONIA';
  if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO')) return 'KOSOVO';
  if (loc.includes('TIRANA') || loc.includes('ALBANIA')) return 'ALBANIA';
  if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO')) return 'MONTENEGRO';
  if (loc.includes('SARAJEVO') || loc.includes('BOSNIA')) return 'BOSNIA';
  return null;
};

// Calculate Monday of a date
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

// Get the date used to sort/group a cashflow item
const getItemDate = (item: any, userReservations: any[], getReservationSafe?: (id: string) => any) => {
  const reservation = getReservationSafe 
    ? getReservationSafe(item.reservationId) 
    : userReservations?.find(r => String(r.id) === String(item.reservationId));
  const start = item.start ? item.start : reservation?.start;
  if (start) {
    const d = parseDateSafe(start);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(item.createdAt || Date.now());
};

// Helper to render beautiful 3D cylinders representing Cash and Card distributions
const render3DCylinders = (cashVal: number, cardVal: number, isPending: boolean) => {
  const maxVal = Math.max(cashVal, cardVal, 1);
  const cashHeight = cashVal > 0 ? Math.max((cashVal / maxVal) * 32, 6) : 2;
  const cardHeight = cardVal > 0 ? Math.max((cardVal / maxVal) * 32, 6) : 2;

  // Base configurations
  const yBase = 46;
  const rx = 9;
  const ry = 3.5;
  const w = rx * 2;

  const cashColors = isPending 
    ? { base: '#7F1D1D', light: '#FEF2F2', cap: '#EF4444', label: 'CASH' }
    : { base: '#064E3B', light: '#ECFDF5', cap: '#10B981', label: 'CASH' };
    
  const cardColors = isPending
    ? { base: '#1E3A8A', light: '#EFF6FF', cap: '#3B82F6', label: 'CARD' }
    : { base: '#1E3A8A', light: '#EFF6FF', cap: '#3B82F6', label: 'CARD' };

  const cyl = (x: number, h: number, val: number, cols: typeof cashColors) => {
    const gradBodyId = `body-grad-${isPending ? 'p' : 's'}-${cols.label.toLowerCase()}`;
    const gradTopId = `top-grad-${isPending ? 'p' : 's'}-${cols.label.toLowerCase()}`;
    const yTop = yBase - h;
    
    return (
      <g key={cols.label} className="group/cyl cursor-pointer transition-transform duration-300 hover:-translate-y-0.5">
        <defs>
          <linearGradient id={gradBodyId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={cols.base} />
            <stop offset="35%" stopColor={cols.cap} />
            <stop offset="70%" stopColor={cols.base} />
            <stop offset="100%" stopColor={cols.base} />
          </linearGradient>
          <linearGradient id={gradTopId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={cols.light} />
            <stop offset="100%" stopColor={cols.cap} />
          </linearGradient>
        </defs>

        {/* 3D shadow */}
        <ellipse cx={x + rx} cy={yBase} rx={rx + 1.5} ry={ry + 0.8} fill="black" fillOpacity="0.25" filter="blur(1px)" />

        {/* Column body */}
        {h > 2 && (
          <path
            d={`M ${x} ${yTop} 
                A ${rx} ${ry} 0 0 0 ${x + w} ${yTop} 
                L ${x + w} ${yBase} 
                A ${rx} ${ry} 0 0 1 ${x} ${yBase} 
                Z`}
            fill={`url(#${gradBodyId})`}
          />
        )}

        {/* Column cap */}
        <ellipse cx={x + rx} cy={yTop} rx={rx} ry={ry} fill={`url(#${gradTopId})`} stroke={cols.light} strokeWidth={0.5} />

        {/* Value text indicator */}
        <text
          x={x + rx}
          y={yTop - 5}
          textAnchor="middle"
          className="font-mono text-[8px] font-black fill-white text-white select-none whitespace-nowrap"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {val}€
        </text>

        {/* Column lower label */}
        <text
          x={x + rx}
          y={yBase + ry + 8}
          textAnchor="middle"
          className="font-mono text-[7px] font-black fill-white/80 text-[#FFE8D6] select-none tracking-wider"
        >
          {cols.label}
        </text>
      </g>
    );
  };

  return (
    <>
      {cyl(6, cashHeight, cashVal, cashColors)}
      {cyl(38, cardHeight, cardVal, cardColors)}
    </>
  );
};

// Helper to render beautiful 3D round/donut charts representing Cash vs Card split
const render3DRoundChart = (cashVal: number, cardVal: number, isPending: boolean) => {
  const total = cashVal + cardVal;
  
  // Outer radius of donut
  const r = 18;
  const cx = 32;
  const cy = 32;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * r; // ~113.1
  
  // Calculate relative proportions
  let cashShare = 0.5;
  let cardShare = 0.5;
  
  if (total > 0) {
    cashShare = cashVal / total;
    cardShare = cardVal / total;
  } else {
    // If no values, render a clean decorative glass grey ring
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth - 2} />
      </g>
    );
  }

  // Segment colors with 3D gradients
  const cashGradId = `cash-round-grad-${isPending ? 'p' : 's'}`;
  const cardGradId = `card-round-grad-${isPending ? 'p' : 's'}`;
  const shadowFilterId = `shadow-${isPending ? 'p' : 's'}`;

  // Cash stroke calculations
  const cashStrokeDash = circumference * cashShare;
  const cashStrokeOffset = 0; // Starts at top (-90deg)

  // Card stroke calculations
  const cardStrokeDash = circumference * cardShare;
  // Starts exactly where cash ends
  const cardStrokeOffset = -cashStrokeDash;

  const cashColors = isPending
    ? { stop1: '#FF9C45', stop2: '#E65A19' } // Radiant coral/orange
    : { stop1: '#34D399', stop2: '#047857' }; // Jade/Forest emerald

  const cardColors = isPending
    ? { stop1: '#60A5FA', stop2: '#1D4ED8' } // Sky blue to cobalt
    : { stop1: '#8B5CF6', stop2: '#5B21B6' }; // Purple/Violet

  return (
    <g>
      <defs>
        {/* Gradients */}
        <linearGradient id={cashGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={cashColors.stop1} />
          <stop offset="100%" stopColor={cashColors.stop2} />
        </linearGradient>
        <linearGradient id={cardGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={cardColors.stop1} />
          <stop offset="100%" stopColor={cardColors.stop2} />
        </linearGradient>
        
        {/* Radial sheen for 3D sphere look */}
        <radialGradient id="ring-sheen" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        <filter id={shadowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Decorative dark background ring to look like a precise recessed track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={strokeWidth + 1.5} />

      {/* Active Segments with drop shadow for 3D lift */}
      <g filter={`url(#${shadowFilterId})`}>
        {/* Cash Segment */}
        {cashVal > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${cashGradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${cashStrokeDash} ${circumference}`}
            strokeDashoffset={cashStrokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            className="transition-all duration-500 ease-out"
          />
        )}

        {/* Card Segment */}
        {cardVal > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${cardGradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${cardStrokeDash} ${circumference}`}
            strokeDashoffset={cardStrokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            className="transition-all duration-500 ease-out"
          />
        )}
      </g>

      {/* Subtle overlay ring for glassy reflection/highlight */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ring-sheen)" strokeWidth={strokeWidth - 2.5} pointerEvents="none" transform="rotate(-90 32 32)" />
      
      {/* Central lighting core of the donut */}
      <circle cx={cx} cy={cy} r={r - strokeWidth/2} fill="rgba(0,0,0,0.08)" />
    </g>
  );
};

const PLATE_COUNTRIES = [
  { code: 'MKD', name: 'Macedonia', color: '#64BC61', textColor: '#000000' },
  { code: 'KS', name: 'Kosovo', color: '#3B82F6', textColor: '#FFFFFF' },
  { code: 'ALB', name: 'Albania', color: '#E11D48', textColor: '#FFFFFF' },
  { code: 'BIH', name: 'Bosnia', color: '#8B5CF6', textColor: '#FFFFFF' },
  { code: 'PG', name: 'Montenegro', color: '#FF9F00', textColor: '#000000' },
] as const;

const getPlateCountry = (vehicle: Vehicle | undefined, item?: CashflowItem, reservation?: any): string | null => {
  if (vehicle) {
    const c = (vehicle.country || vehicle.forcedPhysicalCountry || '').toUpperCase().trim();
    if (c === 'MACEDONIA' || c === 'MKD') return 'MKD';
    if (c === 'KOSOVO' || c === 'KS' || c === 'RKS') return 'KS';
    if (c === 'ALBANIA' || c === 'ALB') return 'ALB';
    if (c === 'BOSNIA' || c === 'BIH') return 'BIH';
    if (c === 'MONTENEGRO' || c === 'PG' || c === 'MNE') return 'PG';
  }

  const plate = (
    vehicle?.plate || 
    (item as any)?.deletedExtraPlate || 
    (reservation as any)?.deletedExtraPlate || 
    ''
  ).toUpperCase().replace(/\s+/g, '');

  if (!plate) return null;

  if (plate.includes('MKD') || plate.startsWith('SK') || plate.startsWith('OH') || plate.startsWith('BT') || plate.startsWith('TE') || plate.startsWith('GV') || plate.startsWith('KU') || plate.startsWith('PP') || plate.startsWith('VE') || plate.startsWith('ST') || plate.startsWith('GE') || plate.startsWith('SR') || plate.startsWith('KO') || plate.startsWith('RA') || plate.startsWith('KI') || plate.startsWith('SU') || plate.startsWith('KR') || plate.startsWith('NE') || plate.startsWith('VI') || plate.startsWith('DE') || plate.startsWith('DH') || plate.startsWith('MB') || plate.startsWith('PS') || plate.startsWith('VAL')) return 'MKD';
  if (plate.includes('RKS') || plate.includes('KS') || /^\d{2}-/.test(plate) || /^\d{2}[A-Z]/.test(plate)) return 'KS';
  if (plate.includes('ALB') || plate.startsWith('TR') || plate.startsWith('AA') || plate.startsWith('AB')) return 'ALB';
  if (plate.includes('BIH') || plate.startsWith('SA')) return 'BIH';
  if (plate.includes('PG') || plate.includes('MNE') || plate.startsWith('PG') || plate.startsWith('UL') || plate.startsWith('BD') || plate.startsWith('HN') || plate.startsWith('TV') || plate.startsWith('CT') || plate.startsWith('NK') || plate.startsWith('BAR')) return 'PG';

  return null;
};

export default function CashflowPanel({ isDarkMode, currentSystemTime }: { isDarkMode: boolean; currentSystemTime?: Date }) {
  const { vehicles, adminData, user, userReservations } = useAppState();

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');
  const [confirmingItem, setConfirmingItem] = useState<CashflowItem | null>(null);
  const [confirmingUnpaidItem, setConfirmingUnpaidItem] = useState<CashflowItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchPaidToQuery, setSearchPaidToQuery] = useState('');
  const [debouncedSearchPaidToQuery, setDebouncedSearchPaidToQuery] = useState('');

  // Debounce search queries to prevent heavy re-filtering while responding instantly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPaidToQuery(searchPaidToQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchPaidToQuery]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPlateCountries, setSelectedPlateCountries] = useState<string[]>([]);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('ALL');
  
  // Custom Popover Calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'single' | 'range'>('single');
  const [calendarSingleDate, setCalendarSingleDate] = useState<string>(() => {
    const d = currentSystemTime || new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  });
  const [calendarRangeStart, setCalendarRangeStart] = useState<string>('');
  const [calendarRangeEnd, setCalendarRangeEnd] = useState<string>('');
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => {
    const d = currentSystemTime || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const calendarPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarPopoverRef.current && !calendarPopoverRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  const formatYmdToDmy = useCallback((ymd: string) => {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }, []);

  const datePickerDisplayText = useMemo(() => {
    if (calendarMode === 'single') {
      if (!calendarSingleDate) return 'ALL DAYS';
      return formatYmdToDmy(calendarSingleDate);
    } else {
      if (!calendarRangeStart && !calendarRangeEnd) return 'SELECT RANGE';
      if (calendarRangeStart && !calendarRangeEnd) return `${formatYmdToDmy(calendarRangeStart)} - ...`;
      if (!calendarRangeStart && calendarRangeEnd) return `... - ${formatYmdToDmy(calendarRangeEnd)}`;
      const s = calendarRangeStart <= calendarRangeEnd ? calendarRangeStart : calendarRangeEnd;
      const e = calendarRangeStart <= calendarRangeEnd ? calendarRangeEnd : calendarRangeStart;
      return `${formatYmdToDmy(s)} - ${formatYmdToDmy(e)}`;
    }
  }, [calendarMode, calendarSingleDate, calendarRangeStart, calendarRangeEnd, formatYmdToDmy]);

  const handlePrevDay = () => {
    if (calendarMode === 'single') {
      if (!calendarSingleDate) {
        const today = currentSystemTime || new Date();
        const yr = today.getFullYear();
        const mo = String(today.getMonth() + 1).padStart(2, '0');
        const dy = String(today.getDate()).padStart(2, '0');
        setCalendarSingleDate(`${yr}-${mo}-${dy}`);
      } else {
        const parts = calendarSingleDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          d.setDate(d.getDate() - 1);
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          setCalendarSingleDate(`${yr}-${mo}-${dy}`);
          setCalendarViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      }
    } else {
      if (calendarRangeStart) {
        const partsS = calendarRangeStart.split('-');
        if (partsS.length === 3) {
          const dS = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10));
          dS.setDate(dS.getDate() - 1);
          const yrS = dS.getFullYear();
          const moS = String(dS.getMonth() + 1).padStart(2, '0');
          const dyS = String(dS.getDate()).padStart(2, '0');
          setCalendarRangeStart(`${yrS}-${moS}-${dyS}`);
          setCalendarViewDate(new Date(dS.getFullYear(), dS.getMonth(), 1));
        }
      }
      if (calendarRangeEnd) {
        const partsE = calendarRangeEnd.split('-');
        if (partsE.length === 3) {
          const dE = new Date(parseInt(partsE[0], 10), parseInt(partsE[1], 10) - 1, parseInt(partsE[2], 10));
          dE.setDate(dE.getDate() - 1);
          const yrE = dE.getFullYear();
          const moE = String(dE.getMonth() + 1).padStart(2, '0');
          const dyE = String(dE.getDate()).padStart(2, '0');
          setCalendarRangeEnd(`${yrE}-${moE}-${dyE}`);
        }
      }
    }
    setCurrentPage(0);
  };

  const handleNextDay = () => {
    if (calendarMode === 'single') {
      if (!calendarSingleDate) {
        const today = currentSystemTime || new Date();
        const yr = today.getFullYear();
        const mo = String(today.getMonth() + 1).padStart(2, '0');
        const dy = String(today.getDate()).padStart(2, '0');
        setCalendarSingleDate(`${yr}-${mo}-${dy}`);
      } else {
        const parts = calendarSingleDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          d.setDate(d.getDate() + 1);
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          setCalendarSingleDate(`${yr}-${mo}-${dy}`);
          setCalendarViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      }
    } else {
      if (calendarRangeStart) {
        const partsS = calendarRangeStart.split('-');
        if (partsS.length === 3) {
          const dS = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10));
          dS.setDate(dS.getDate() + 1);
          const yrS = dS.getFullYear();
          const moS = String(dS.getMonth() + 1).padStart(2, '0');
          const dyS = String(dS.getDate()).padStart(2, '0');
          setCalendarRangeStart(`${yrS}-${moS}-${dyS}`);
          setCalendarViewDate(new Date(dS.getFullYear(), dS.getMonth(), 1));
        }
      }
      if (calendarRangeEnd) {
        const partsE = calendarRangeEnd.split('-');
        if (partsE.length === 3) {
          const dE = new Date(parseInt(partsE[0], 10), parseInt(partsE[1], 10) - 1, parseInt(partsE[2], 10));
          dE.setDate(dE.getDate() + 1);
          const yrE = dE.getFullYear();
          const moE = String(dE.getMonth() + 1).padStart(2, '0');
          const dyE = String(dE.getDate()).padStart(2, '0');
          setCalendarRangeEnd(`${yrE}-${moE}-${dyE}`);
        }
      }
    }
    setCurrentPage(0);
  };

  const handleSelectToday = () => {
    const today = currentSystemTime || new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const dy = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yr}-${mo}-${dy}`;
    setCalendarMode('single');
    setCalendarSingleDate(todayStr);
    setCalendarRangeStart('');
    setCalendarRangeEnd('');
    setCalendarViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setCurrentPage(0);
  };

  const handleSelectAllDays = () => {
    setCalendarSingleDate('');
    setCalendarRangeStart('');
    setCalendarRangeEnd('');
    setCurrentPage(0);
  };

  // Check special access for country plate tabs: mrbulimomo@gmail.com, sahindzemsit@gmail.com, and burhanejupi94@gmail.com
  const canSeePlateCountryTabs = useMemo(() => {
    const email = (user?.email || '').toLowerCase().trim();
    return email === 'mrbulimomo@gmail.com' || email === 'sahindzemsit@gmail.com' || email === 'burhanejupi94@gmail.com';
  }, [user?.email]);

  const togglePlateCountry = (code: string) => {
    setSelectedPlateCountries(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
    setCurrentPage(0);
  };

  // 1. Check supervisor access: user profile MUST have 'SUPERVISOR' password OR be sahindzemsit@gmail.com
  const hasAccess = useMemo(() => {
    return user?.email === 'sahindzemsit@gmail.com' || adminData?.password?.toUpperCase() === 'SUPERVISOR';
  }, [adminData, user]);

  const missingActiveReservations: any[] = [];

  // Cache of all found reservations to prevent any flickering during active-to-completed transition
  const cachedReservationsRef = useRef<Record<string, any>>({});
  
  useEffect(() => {
    if (userReservations && userReservations.length > 0) {
      userReservations.forEach(r => {
        if (r && r.id) {
          cachedReservationsRef.current[String(r.id)] = r;
        }
      });
    }
  }, [userReservations]);

  const getReservationSafe = useCallback((resId: string) => {
    const live = userReservations?.find(r => String(r.id) === String(resId));
    if (live) return live;
    return cachedReservationsRef.current[String(resId)];
  }, [userReservations]);

  const filtersSectionRef = useRef<HTMLDivElement>(null);

  const scrollToFilters = useCallback(() => {
    filtersSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const prevDateStrRef = useRef<string>("");

  useEffect(() => {
    if (!currentSystemTime) return;
    const currentDayStr = currentSystemTime.toDateString();
    
    // Only execute if calendar day shifted
    if (prevDateStrRef.current && prevDateStrRef.current !== currentDayStr) {
      setSelectedDate(prev => {
        if (!prev) return prev; // Keep "All Days" if selected
        const prevDayStr = prev.toDateString();
        // If the selected date was today, update it to the new today!
        if (prevDayStr === prevDateStrRef.current) {
          return currentSystemTime;
        }
        return prev;
      });
    }
    prevDateStrRef.current = currentDayStr;
  }, [currentSystemTime]);

  const itemsPerPage = 5;

  // Stabilize dynamic array for dependency tracking
  const allowedLocationsStr = useMemo(() => {
    if (!adminData?.allowedLocations) return '';
    return [...adminData.allowedLocations].sort().join(',');
  }, [adminData?.allowedLocations]);

  // Helper check for location authorization in UI and querying
  const isLocationAllowed = useCallback((countryKey: string) => {
    if (!adminData?.allowedLocations) return false;
    const rawAllowed = adminData.allowedLocations || [];
    const hasAllAccess = rawAllowed.some(loc => String(loc).toUpperCase() === 'ALL');
    if (hasAllAccess) return true;
    return rawAllowed.some(loc => String(loc).toUpperCase() === countryKey.toUpperCase());
  }, [adminData?.allowedLocations]);

  const [rowAuditLogs, setRowAuditLogs] = useState<Record<string, any[]>>({});

  // 2. Fetch cashflow documents in real-time
  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const rawAllowed = adminData?.allowedLocations || [];
    const hasAllAccess = rawAllowed.some(loc => String(loc).toUpperCase() === 'ALL');

    let q;
    if (hasAllAccess) {
      // Unfiltered query runs perfectly if role allows read everything
      q = query(collection(db, 'cashflow'));
    } else if (rawAllowed.length > 0) {
      // Query specific locations explicitly. Sort in-memory to prevent index errors.
      q = query(
        collection(db, 'cashflow'),
        where('fromLocation', 'in', rawAllowed)
      );
    } else {
      setCashflowItems([]);
      setLoading(false);
      return;
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CashflowItem[];

      // Sort by createdAt Descending in front-end memory to prevent complex index crashes!
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || a.createdAt || 0;
        const timeB = b.createdAt?.seconds || b.createdAt || 0;
        return Number(timeB) - Number(timeA);
      });

      setCashflowItems(items);
      setLoading(false);
    }, (error) => {
      console.error("Error loading cashflow collection:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hasAccess, allowedLocationsStr]);

  // One-time gentle background sync for legacy split records missing explicit cash/card amounts
  const syncedResIdsRef = useRef<Set<string>>(new Set());
  const isSyncRunningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!hasAccess || cashflowItems.length === 0 || isSyncRunningRef.current) return;

    // Filter items that have a split payment method but don't have explicit cashAmount / cardAmount saved
    const candidates = cashflowItems.filter(item => {
      if (!item.reservationId) return false;
      if (syncedResIdsRef.current.has(item.reservationId)) return false;
      
      const method = (item.paymentMethod || '').toLowerCase();
      const isSplit = method.includes('cash/card') || method.includes('split');
      const hasExactNumbers = typeof item.cashAmount === 'number' && typeof item.cardAmount === 'number';
      
      return isSplit && !hasExactNumbers;
    });

    if (candidates.length === 0) return;

    isSyncRunningRef.current = true;

    const processSync = async () => {
      for (const item of candidates) {
        const resId = String(item.reservationId);
        syncedResIdsRef.current.add(resId);

        try {
          const historySnap = await getDocs(collection(db, 'reservations', resId, 'paymentHistory'));
          if (!historySnap.empty) {
            let cash = 0;
            let card = 0;
            historySnap.docs.forEach(d => {
              const data = d.data();
              const amt = Number(data.amount) || 0;
              const m = String(data.method || 'Cash').toLowerCase();
              if (m === 'card') {
                card += amt;
              } else {
                cash += amt;
              }
            });

            if (cash > 0 || card > 0) {
              await setDoc(doc(db, 'cashflow', item.id), {
                cashAmount: cash,
                cardAmount: card,
                updatedAt: Date.now()
              }, { merge: true });

              try {
                await setDoc(doc(db, 'reservations', resId), {
                  cashAmount: cash,
                  cardAmount: card,
                  updatedAt: Date.now()
                }, { merge: true });
              } catch (resErr) {
                // Ignore if reservation doc not found
              }
            }
          }
        } catch (err) {
          console.warn(`Background sync skipped for reservation ${resId}:`, err);
        }

        // Wait 250ms between items to keep execution extremely light and fast without overloading network
        await new Promise(res => setTimeout(res, 250));
      }
      isSyncRunningRef.current = false;
    };

    processSync();
  }, [hasAccess, cashflowItems]);

  const handleMarkAsPaid = async (item: CashflowItem) => {
    try {
      await updateDoc(doc(db, 'cashflow', item.id), {
        isPaid: true,
        approvedBy: user?.email || 'Unknown User',
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating paid status:", err);
    }
  };

  const handleMarkAsUnpaid = async (item: CashflowItem) => {
    try {
      await updateDoc(doc(db, 'cashflow', item.id), {
        isPaid: false,
        approvedBy: "",
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating unpaid status:", err);
    }
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Render English Calendar Popover Component
  const renderCalendarPopover = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth(); // 0-11

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndexRaw = new Date(year, month, 1).getDay();
    let firstDayIndex = firstDayIndexRaw - 1;
    if (firstDayIndex < 0) firstDayIndex = 6; // Monday is 0, Sunday is 6

    const prevMonthDays = new Date(year, month, 0).getDate();

    const daysGrid: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const d = prevMonthDays - i;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysGrid.push({ day: d, isCurrentMonth: false, dateStr });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysGrid.push({ day: d, isCurrentMonth: true, dateStr });
    }

    // Next month padding
    const totalSlots = 42;
    const nextMonthPadding = totalSlots - daysGrid.length;
    for (let d = 1; d <= nextMonthPadding; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysGrid.push({ day: d, isCurrentMonth: false, dateStr });
    }

    const handlePrevMonth = () => {
      setCalendarViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
      setCalendarViewDate(new Date(year, month + 1, 1));
    };

    const handleDayClick = (dateStr: string) => {
      if (calendarMode === 'single') {
        setCalendarSingleDate(dateStr);
        setCalendarRangeStart('');
        setCalendarRangeEnd('');
        setCurrentPage(0);
      } else {
        if (!calendarRangeStart || (calendarRangeStart && calendarRangeEnd)) {
          setCalendarRangeStart(dateStr);
          setCalendarRangeEnd('');
        } else {
          if (dateStr < calendarRangeStart) {
            setCalendarRangeStart(dateStr);
            setCalendarRangeEnd('');
          } else {
            setCalendarRangeEnd(dateStr);
          }
        }
        setCurrentPage(0);
      }
    };

    const isSelected = (dateStr: string) => {
      if (calendarMode === 'single') {
        return calendarSingleDate === dateStr;
      } else {
        return calendarRangeStart === dateStr || calendarRangeEnd === dateStr;
      }
    };

    const isInRange = (dateStr: string) => {
      if (calendarMode === 'range' && calendarRangeStart && calendarRangeEnd) {
        const start = calendarRangeStart <= calendarRangeEnd ? calendarRangeStart : calendarRangeEnd;
        const end = calendarRangeStart <= calendarRangeEnd ? calendarRangeEnd : calendarRangeStart;
        return dateStr > start && dateStr < end;
      }
      return false;
    };

    const handleTodayClick = () => {
      const today = currentSystemTime || new Date();
      const yStr = today.getFullYear();
      const mStr = String(today.getMonth() + 1).padStart(2, '0');
      const dStr = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yStr}-${mStr}-${dStr}`;
      setCalendarViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
      if (calendarMode === 'single') {
        setCalendarSingleDate(todayStr);
      } else {
        setCalendarRangeStart(todayStr);
        setCalendarRangeEnd('');
      }
      setCurrentPage(0);
    };

    const handleClearClick = () => {
      if (calendarMode === 'single') {
        setCalendarSingleDate('');
      } else {
        setCalendarRangeStart('');
        setCalendarRangeEnd('');
      }
      setCurrentPage(0);
    };

    let selectedSummaryText = 'No date selected';
    if (calendarMode === 'single' && calendarSingleDate) {
      selectedSummaryText = `Selected: ${formatYmdToDmy(calendarSingleDate)}`;
    } else if (calendarMode === 'range') {
      if (calendarRangeStart && calendarRangeEnd) {
        const s = calendarRangeStart <= calendarRangeEnd ? calendarRangeStart : calendarRangeEnd;
        const e = calendarRangeStart <= calendarRangeEnd ? calendarRangeEnd : calendarRangeStart;
        selectedSummaryText = `Range: ${formatYmdToDmy(s)} to ${formatYmdToDmy(e)}`;
      } else if (calendarRangeStart) {
        selectedSummaryText = `Starts: ${formatYmdToDmy(calendarRangeStart)} (pick end date)`;
      } else {
        selectedSummaryText = 'Pick range start date';
      }
    }

    return (
      <div 
        ref={calendarPopoverRef}
        className={cn(
          "absolute top-full mt-2 left-0 z-50 w-72 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 select-none",
          isDarkMode 
            ? "bg-[#231F1D] border-white/15 text-white shadow-black/80" 
            : "bg-white border-black/10 text-gray-900 shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Two Tabs at top: SINGLE and RANGE */}
        <div className={cn(
          "grid grid-cols-2 gap-1 p-1 rounded-xl mb-3 border",
          isDarkMode ? "bg-black/20 border-white/10" : "bg-gray-100 border-gray-200"
        )}>
          <button
            type="button"
            onClick={() => {
              setCalendarMode('single');
              if (!calendarSingleDate && calendarRangeStart) {
                setCalendarSingleDate(calendarRangeStart);
              }
            }}
            className={cn(
              "py-1 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer text-center",
              calendarMode === 'single'
                ? "bg-[#FF5C35] text-white shadow-md font-black"
                : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
            )}
          >
            SINGLE
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendarMode('range');
              if (!calendarRangeStart && calendarSingleDate) {
                setCalendarRangeStart(calendarSingleDate);
              }
            }}
            className={cn(
              "py-1 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer text-center",
              calendarMode === 'range'
                ? "bg-[#FF5C35] text-white shadow-md font-black"
                : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
            )}
          >
            RANGE
          </button>
        </div>

        {/* Month Header */}
        <div className="flex items-center justify-between mb-2.5 px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={cn(
              "p-1 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95",
              isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-gray-200 hover:bg-gray-100 text-gray-700"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-black uppercase tracking-wider font-mono">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className={cn(
              "p-1 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95",
              isDarkMode ? "border-white/10 hover:bg-white/10 text-white" : "border-gray-200 hover:bg-gray-100 text-gray-700"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1.5 text-center text-[10px] font-black uppercase tracking-wider text-gray-400 font-mono">
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
          <div>Sun</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map(({ day, isCurrentMonth, dateStr }, idx) => {
            const selected = isSelected(dateStr);
            const inRange = isInRange(dateStr);

            return (
              <button
                key={`${dateStr}-${idx}`}
                type="button"
                onClick={() => handleDayClick(dateStr)}
                className={cn(
                  "h-7 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer relative font-mono",
                  !isCurrentMonth && "opacity-25",
                  selected
                    ? "bg-[#FF5C35] text-white font-black scale-105 shadow-sm z-10"
                    : inRange
                      ? "bg-[#FF5C35]/20 text-[#FF5C35] font-black rounded-none"
                      : isDarkMode
                        ? "text-white hover:bg-white/10"
                        : "text-gray-800 hover:bg-gray-100"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Selected text summary */}
        <div className="mt-2.5 text-center">
          <span className="text-[10px] font-black tracking-wider uppercase text-[#FF5C35] font-mono">
            {selectedSummaryText}
          </span>
        </div>

        {/* Bottom Buttons: Clear and Today */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest font-mono">
          <button
            type="button"
            onClick={handleClearClick}
            className="text-red-500 hover:underline cursor-pointer font-black"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleTodayClick}
            className="text-[#FF5C35] hover:underline cursor-pointer font-black"
          >
            Today
          </button>
        </div>
      </div>
    );
  };

  // Filter out invalid/empty/corrupted old data so page is initially empty until a reservation is sent
  const filteredItems = useMemo(() => {
    let list = cashflowItems.filter(item => item.reservationId && item.name && item.name !== 'N/A');

    // Filter by calendar selection (SINGLE or RANGE)
    if (calendarMode === 'single' && calendarSingleDate) {
      const parts = calendarSingleDate.split('-').map(Number);
      if (parts.length === 3) {
        const [selYr, selMo, selDy] = parts;
        list = list.filter(item => {
          const itemD = getItemDate(item, userReservations || [], getReservationSafe);
          return itemD.getFullYear() === selYr && 
                 (itemD.getMonth() + 1) === selMo && 
                 itemD.getDate() === selDy;
        });
      }
    } else if (calendarMode === 'range' && (calendarRangeStart || calendarRangeEnd)) {
      list = list.filter(item => {
        const itemD = getItemDate(item, userReservations || [], getReservationSafe);
        const yr = itemD.getFullYear();
        const mo = String(itemD.getMonth() + 1).padStart(2, '0');
        const dy = String(itemD.getDate()).padStart(2, '0');
        const itemStr = `${yr}-${mo}-${dy}`;

        if (calendarRangeStart && calendarRangeEnd) {
          const start = calendarRangeStart <= calendarRangeEnd ? calendarRangeStart : calendarRangeEnd;
          const end = calendarRangeStart <= calendarRangeEnd ? calendarRangeEnd : calendarRangeStart;
          return itemStr >= start && itemStr <= end;
        } else if (calendarRangeStart) {
          return itemStr >= calendarRangeStart;
        } else if (calendarRangeEnd) {
          return itemStr <= calendarRangeEnd;
        }
        return true;
      });
    }

    // Filter by country if selected
    if (selectedCountry) {
      list = list.filter(item => {
        const reservation = getReservationSafe(item.reservationId);
        const fromLocation = (reservation?.fromLocation !== undefined && reservation?.fromLocation !== '') ? reservation.fromLocation : item.fromLocation;
        if (!fromLocation) return false;
        const country = getCountryFromLocation(fromLocation);
        return country === selectedCountry;
      });
    }

    // Filter by plate country tabs if selected
    if (selectedPlateCountries.length > 0) {
      list = list.filter(item => {
        const reservation = getReservationSafe(item.reservationId);
        const liveVehicleId = reservation ? reservation.vehicleId : item.vehicleId;
        const vehicle = vehicles.find(v => String(v.id) === String(liveVehicleId)) || vehicles.find(v => String(v.id) === String(item.vehicleId));
        const plateCountry = getPlateCountry(vehicle, item, reservation);
        return plateCountry ? selectedPlateCountries.includes(plateCountry) : false;
      });
    }

    // Filter by status (SETTLED vs PENDING)
    if (statusFilter === 'PENDING') {
      list = list.filter(item => !item.isPaid);
    } else if (statusFilter === 'SETTLED') {
      list = list.filter(item => item.isPaid);
    }

    // Filter by search query (works with car plates and client names)
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const reservation = getReservationSafe(item.reservationId);
        const liveClientName = reservation ? (reservation.client || reservation.name || item.name) : item.name;
        const clientNameMatch = liveClientName?.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q);
        const liveVehicleId = reservation ? reservation.vehicleId : item.vehicleId;
        const vehicle = vehicles.find(v => String(v.id) === String(liveVehicleId)) || vehicles.find(v => String(v.id) === String(item.vehicleId));
        
        const isDeletedExtra = !!((item as any).deletedExtraPlate || (item as any).deletedExtraName || (reservation as any)?.deletedExtraPlate || (reservation as any)?.deletedExtraName);
        const plate = isDeletedExtra
          ? ((item as any).deletedExtraPlate || (reservation as any)?.deletedExtraPlate || '')
          : (vehicle?.plate || '');
        const vehicleName = isDeletedExtra
          ? ((item as any).deletedExtraName || (reservation as any)?.deletedExtraName || 'EXTRA')
          : (vehicle?.name === 'EXTRA' || vehicle?.isExtra)
            ? (vehicle?.extraName || 'EXTRA')
            : (vehicle?.name || 'Unknown');

        const plateMatch = plate?.toLowerCase().includes(q);
        const nameMatch = vehicleName?.toLowerCase().includes(q);
        return clientNameMatch || plateMatch || nameMatch;
      });
    }

    // Filter strictly by Paid To search query (who received the money)
    if (debouncedSearchPaidToQuery.trim()) {
      const pq = debouncedSearchPaidToQuery.toLowerCase().trim();
      list = list.filter(item => {
        const reservation = getReservationSafe(item.reservationId);
        const paidTo = (item.paidTo || reservation?.paidTo || item.cashflowHandledBy || reservation?.cashflowHandledBy || '').toLowerCase();
        return paidTo.includes(pq);
      });
    }

    return list;
  }, [cashflowItems, calendarMode, calendarSingleDate, calendarRangeStart, calendarRangeEnd, selectedCountry, selectedPlateCountries, statusFilter, debouncedSearchQuery, debouncedSearchPaidToQuery, getReservationSafe, vehicles, userReservations]);

  const exportToCSV = useCallback(() => {
    if (filteredItems.length === 0) return;
    
    // CSV Header
    const headers = ["Client Name", "Car Plate", "Period Start", "Period End", "Location", "Days", "Total Price", "Amount Paid", "Payment Method", "Status", "Teammate", "Paid To", "Created At"];
    
    const rows = filteredItems.map(item => {
      const reservation = getReservationSafe(item.reservationId);
      const liveClientName = reservation ? (reservation.client || reservation.name || item.name) : item.name;
      const liveVehicleId = reservation ? reservation.vehicleId : item.vehicleId;
      const vehicle = vehicles.find(v => String(v.id) === String(liveVehicleId)) || vehicles.find(v => String(v.id) === String(item.vehicleId));
      
      const isDeletedExtra = !!((item as any).deletedExtraPlate || (item as any).deletedExtraName || (reservation as any)?.deletedExtraPlate || (reservation as any)?.deletedExtraName);
      const plate = isDeletedExtra
        ? ((item as any).deletedExtraPlate || (reservation as any)?.deletedExtraPlate || '')
        : (vehicle?.plate || 'N/A');
      
      const startVal = formatDateSafe(reservation?.start ? reservation.start : item.start);
      const endVal = formatDateSafe(reservation?.end ? reservation.end : item.end);
      const fromLoc = reservation?.fromLocation || item.fromLocation || 'N/A';
      const liveDays = reservation ? (reservation.days || item.days) : item.days;
      
      const totalPrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      const amountPaid = reservation ? (typeof reservation.amountPaid === 'number' ? reservation.amountPaid : Number(reservation.amountPaid) || 0) : (item.amountPaid || 0);
      const payMethod = item.paymentMethod || 'Cash';
      const statusStr = item.isPaid ? 'PAID' : 'UNPAID';
      const teammate = item.processedBy || reservation?.processedBy || item.cashflowHandledBy || 'System';
      const paidToVal = item.paidTo || 'N/A';
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A';
      
      return [
        `"${String(liveClientName).replace(/"/g, '""')}"`,
        `"${String(plate).replace(/"/g, '""')}"`,
        `"${startVal}"`,
        `"${endVal}"`,
        `"${String(fromLoc).replace(/"/g, '""')}"`,
        `"${liveDays}"`,
        `"${totalPrice}"`,
        `"${amountPaid}"`,
        `"${String(payMethod).replace(/"/g, '""')}"`,
        `"${statusStr}"`,
        `"${String(teammate).replace(/"/g, '""')}"`,
        `"${String(paidToVal).replace(/"/g, '""')}"`,
        `"${dateStr}"`
      ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cashflow_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredItems, getReservationSafe, vehicles]);

  // Group cashflows into time periods (daily, weekly, monthly, yearly)
  const groupedPeriods = useMemo(() => {
    if (selectedTimePeriod === 'ALL') return null;

    const groups: Record<string, { key: string, label: string, items: CashflowItem[], dateSortValue: number }> = {};

    filteredItems.forEach(item => {
      const dateObj = getItemDate(item, userReservations || [], getReservationSafe);
      let groupKey = '';
      let groupLabel = '';
      let dateSortValue = dateObj.getTime();

      if (selectedTimePeriod === 'DAILY') {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        groupKey = `${year}-${month}-${day}`;
        groupLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
      } else if (selectedTimePeriod === 'WEEKLY') {
        const monday = getMonday(dateObj);
        const day = String(monday.getDate()).padStart(2, '0');
        const month = String(monday.getMonth() + 1).padStart(2, '0');
        const year = monday.getFullYear();
        groupKey = `${year}-W${Math.ceil(monday.getDate() / 7)}`;
        groupLabel = `WEEK OF ${day}/${month}/${year}`.toUpperCase();
        dateSortValue = monday.getTime();
      } else if (selectedTimePeriod === 'MONTHLY') {
        const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        groupKey = `${year}-${monthNum}`;
        groupLabel = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase();
        dateSortValue = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime();
      } else if (selectedTimePeriod === 'YEARLY') {
        const year = dateObj.getFullYear();
        groupKey = `${year}`;
        groupLabel = `YEAR ${year}`.toUpperCase();
        dateSortValue = new Date(dateObj.getFullYear(), 0, 1).getTime();
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          label: groupLabel,
          items: [],
          dateSortValue
        };
      }
      groups[groupKey].items.push(item);
    });

    return Object.values(groups).sort((a, b) => b.dateSortValue - a.dateSortValue).map(g => {
      const sortedItems = g.items.sort((a, b) => {
        const dA = getItemDate(a, userReservations || [], getReservationSafe).getTime();
        const dB = getItemDate(b, userReservations || [], getReservationSafe).getTime();
        return dB - dA;
      });
      
      const pendingTotal = sortedItems.filter(item => !item.isPaid).reduce((sum, item) => {
        const reservation = getReservationSafe(item.reservationId);
        const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
        return sum + (livePrice || 0);
      }, 0);
      const settledTotal = sortedItems.filter(item => item.isPaid).reduce((sum, item) => {
        const reservation = getReservationSafe(item.reservationId);
        const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
        return sum + (livePrice || 0);
      }, 0);

      return {
        ...g,
        items: sortedItems,
        pendingTotal,
        settledTotal
      };
    });
  }, [filteredItems, selectedTimePeriod, getReservationSafe]);

  // Unified renderer for cashflow ledger rows
  const renderCashflowRow = (item: CashflowItem) => {
    const reservation = getReservationSafe(item.reservationId);
    const liveClientName = reservation ? (reservation.client || reservation.name || item.name) : item.name;
    const liveDays = reservation ? (reservation.days !== undefined ? reservation.days : item.days) : item.days;
    const liveVehicleId = reservation ? reservation.vehicleId : item.vehicleId;
    const vehicle = vehicles.find(v => String(v.id) === String(liveVehicleId)) || vehicles.find(v => String(v.id) === String(item.vehicleId));
    const isDeletedExtra = !!((item as any).deletedExtraPlate || (item as any).deletedExtraName || (reservation as any)?.deletedExtraPlate || (reservation as any)?.deletedExtraName);
    const vehicleName = isDeletedExtra
      ? ((item as any).deletedExtraName || (reservation as any)?.deletedExtraName || 'EXTRA')
      : (vehicle?.name === 'EXTRA' || vehicle?.isExtra)
        ? (vehicle?.extraName || 'EXTRA')
        : (vehicle?.name || 'Unknown');
    const plate = isDeletedExtra
      ? ((item as any).deletedExtraPlate || (reservation as any)?.deletedExtraPlate || '')
      : (vehicle?.plate || '');
    const startVal = reservation?.start ? reservation.start : item.start;
    const endVal = reservation?.end ? reservation.end : item.end;
    const arrivalTimeVal = reservation?.arrivalTime !== undefined ? reservation.arrivalTime : item.arrivalTime;
    const departureTimeVal = reservation?.departureTime !== undefined ? reservation.departureTime : item.departureTime;
    const fromLocationVal = (reservation?.fromLocation !== undefined && reservation?.fromLocation !== '') ? reservation.fromLocation : item.fromLocation;
    const toLocationVal = (reservation?.toLocation !== undefined && reservation?.toLocation !== '') ? reservation.toLocation : item.toLocation;
    const hasNote = !!item.cashflowNote?.trim();
    const processedBy = item.processedBy || reservation?.processedBy || item.cashflowHandledBy || 'System';

    const itemCreatedTimeMs = (() => {
      if (!item.createdAt) return 0;
      if (typeof item.createdAt === 'number') return item.createdAt;
      if (item.createdAt.toDate) return item.createdAt.toDate().getTime();
      if (item.createdAt.seconds) return item.createdAt.seconds * 1000;
      return new Date(item.createdAt).getTime();
    })();

    const logsAfterCreation = (rowAuditLogs[item.reservationId] || []).filter(
      (log) => log.jsTimestamp > itemCreatedTimeMs + 1000
    );

    // 1. Price
    const getPriceHistory = () => {
      const priceLogs = logsAfterCreation.filter(
        (log) => log.changedFields?.totalPrice || log.changedFields?.amountPaid
      );
      
      const originalValue = item.totalPrice;
      const originalBy = item.processedBy || reservation?.processedBy || item.cashflowHandledBy || 'Original Team';

      interface PriceStep {
        value: number;
        changedBy: string;
      }

      const steps: PriceStep[] = [
        { value: originalValue, changedBy: originalBy }
      ];
      
      priceLogs.forEach((log) => {
        let newVal: number | null = null;
        if (log.changedFields?.totalPrice) {
          newVal = Number(log.changedFields.totalPrice.newValue);
        } else if (log.changedFields?.amountPaid) {
          newVal = Number(log.changedFields.amountPaid.newValue);
        }
        if (newVal !== null && !isNaN(newVal)) {
          const lastStep = steps[steps.length - 1];
          if (!lastStep || lastStep.value !== newVal) {
            steps.push({
              value: newVal,
              changedBy: log.changedBy || 'Teammate'
            });
          }
        }
      });

      const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      if (reservation && !isNaN(livePrice)) {
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.value !== livePrice) {
          const lastLog = priceLogs[priceLogs.length - 1];
          steps.push({
            value: livePrice,
            changedBy: lastLog?.changedBy || 'Teammate'
          });
        }
      }

      const cleanSteps = steps.filter((step, idx) => {
        if (idx === 0) return false;
        if (
          Number(step.value) === Number(originalValue) &&
          step.changedBy.toUpperCase() === originalBy.toUpperCase()
        ) {
          return false;
        }
        return true;
      });

      const modifiers = new Set<string>(cleanSteps.map(s => s.changedBy));

      return {
        hasChanged: cleanSteps.length > 0,
        steps: [steps[0], ...cleanSteps],
        modifiers: Array.from(modifiers)
      };
    };

    // 2. Car/Plate
    const getCarHistory = () => {
      const carLogs = logsAfterCreation.filter(
        (log) => log.changedFields?.vehicleId || log.changedFields?.vehicle || log.changedFields?.plate
      );
      
      const originalVehicleId = item.vehicleId;
      const originalBy = item.processedBy || reservation?.processedBy || item.cashflowHandledBy || 'Original Team';

      const getCarNameAndPlate = (vId: string | number) => {
        const isDeletedExtra = !!((item as any).deletedExtraPlate || (item as any).deletedExtraName || (reservation as any)?.deletedExtraPlate || (reservation as any)?.deletedExtraName);
        if (isDeletedExtra && String(vId) === String(item.vehicleId)) {
          const dPlate = (item as any).deletedExtraPlate || (reservation as any)?.deletedExtraPlate || '';
          const dName = (item as any).deletedExtraName || (reservation as any)?.deletedExtraName || 'EXTRA';
          return `${dName} (${dPlate})`;
        }
        const vDoc = vehicles.find(v => String(v.id) === String(vId));
        if (vDoc) {
          const vName = (vDoc.name === 'EXTRA' || vDoc.isExtra) ? (vDoc.extraName || 'EXTRA') : vDoc.name;
          return `${vName} (${vDoc.plate || 'NO PLATE'})`;
        }
        return `Unknown Car Id: ${vId}`;
      };

      interface CarStep {
        value: string;
        changedBy: string;
      }

      const steps: CarStep[] = [
        { value: getCarNameAndPlate(originalVehicleId), changedBy: originalBy }
      ];
      
      carLogs.forEach((log) => {
        if (log.changedFields?.vehicleId) {
          const newVal = log.changedFields.vehicleId.newValue;
          const mappedVal = getCarNameAndPlate(newVal);
          const lastStep = steps[steps.length - 1];
          if (!lastStep || lastStep.value !== mappedVal) {
            steps.push({
              value: mappedVal,
              changedBy: log.changedBy || 'Teammate'
            });
          }
        }
      });

      if (reservation) {
        const liveMapped = getCarNameAndPlate(liveVehicleId);
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.value !== liveMapped) {
          const lastLog = carLogs[carLogs.length - 1];
          steps.push({
            value: liveMapped,
            changedBy: lastLog?.changedBy || 'Teammate'
          });
        }
      }

      const originalCarString = getCarNameAndPlate(originalVehicleId);
      const cleanSteps = steps.filter((step, idx) => {
        if (idx === 0) return false;
        if (
          step.value === originalCarString &&
          step.changedBy.toUpperCase() === originalBy.toUpperCase()
        ) {
          return false;
        }
        return true;
      });

      const modifiers = new Set<string>(cleanSteps.map(s => s.changedBy));

      return {
        hasChanged: cleanSteps.length > 0,
        steps: [steps[0], ...cleanSteps],
        modifiers: Array.from(modifiers)
      };
    };

    const priceInfo = getPriceHistory();
    const carInfo = getCarHistory();

    return (
      <div 
        key={item.id}
        className={cn(
          "rounded-[18px] transition-all border p-3 md:py-2.5 md:px-4 relative overflow-visible z-10 hover:z-30",
          item.isPaid 
            ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15" : "bg-emerald-50 border-emerald-100 hover:bg-emerald-100")
            : (isDarkMode ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/15" : "bg-red-50 border-red-100 hover:bg-red-100")
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-left">
          {/* Client Name Column */}
          <div className="md:w-[26%] truncate text-left">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">CLIENT NAME</p>
            <p className={cn("font-black text-sm truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")} title={liveClientName}>
              {liveClientName}
            </p>
          </div>

          {/* Car / Plate Column - Plate BELOW name */}
          <div className="md:w-[12%] flex flex-col justify-center gap-1">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">CAR / PLATE</p>
            <div className={cn(
               "relative group flex flex-col items-start transition-all duration-300 rounded-xl p-1",
               carInfo.hasChanged && "outline-none ring-2 ring-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500/40"
            )}>
              {vehicleName !== 'Unknown' || plate ? (
                <div className="flex flex-col gap-1 items-start w-full">
                  <span className={cn(
                    "font-black uppercase truncate max-w-full leading-tight",
                    isDarkMode ? "text-white" : "text-gray-900",
                    isDeletedExtra && "line-through text-red-500/85 decoration-red-500/80 decoration-2"
                  )}>{vehicleName}</span>
                  <div 
                    className={cn(
                      "inline-flex items-center rounded-md border-2 px-1.5 py-0.5 shadow-md shrink-0 relative overflow-hidden",
                      isDeletedExtra ? "opacity-75 bg-gray-100 border-gray-300" : "border-black/30 bg-white"
                    )}
                    style={{ height: '20px' }}
                  >
                    <div className="w-[3px] h-3 bg-blue-700 rounded-l-[1px] -ml-1.5 mr-1 shrink-0" />
                    <span 
                      className={cn(
                        "font-mono font-black text-black tracking-wider uppercase leading-none select-all relative z-10",
                        getPlateColorByPlate(plate, vehicles) ? "pr-[11px]" : "",
                        isDeletedExtra && "line-through text-gray-500"
                      )}
                      style={{ fontSize: '11px' }}
                    >
                      {plate}
                    </span>
                    {(() => {
                      const col = getPlateColorByPlate(plate, vehicles);
                      if (!col) return null;
                      return (
                        <div 
                          className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                          style={{ 
                            width: '9px',
                            backgroundColor: col
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <span className="text-gray-500">N/A</span>
              )}

              {/* Tooltip */}
              {carInfo.hasChanged && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1.5 w-[500px] p-3 bg-red-950/95 text-white border border-red-500/30 rounded-xl shadow-2xl backdrop-blur-sm z-[99999] pointer-events-none transition-all duration-200">
                  <div className="flex items-center gap-1.5 text-red-500 font-extrabold text-[10px] tracking-wider uppercase mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Post-Cashflow Modification
                  </div>

                  {/* Original Value Orange Panel */}
                  <div className="mt-1 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex flex-col gap-1 shadow-[inset_0_1px_2px_rgba(245,158,11,0.05)]">
                    <span className="text-amber-500 font-black text-[9px] tracking-wider uppercase">Original Entry (At Cashflow Submit)</span>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-amber-300 font-mono text-[11px] font-black leading-none">
                        {carInfo.steps[0].value}
                      </span>
                      <span className="text-[8px] text-amber-400 font-sans font-black uppercase tracking-wider text-right truncate max-w-[240px]">
                        By: {carInfo.steps[0].changedBy}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-red-500/20 pt-1.5 mt-1">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Sequence of changes (Top to bottom):</p>
                    <div className="flex flex-col gap-1.5 font-mono text-[10px] leading-tight text-gray-100">
                      {carInfo.steps.map((step, idx) => {
                        if (idx === 0) return null;
                        return (
                          <div key={idx} className="flex items-center justify-between gap-4 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                            <span className={cn(
                              "font-black shrink-0 text-left truncate max-w-[230px]",
                              idx === carInfo.steps.length - 1 
                                ? "text-emerald-400 font-extrabold underline decoration-emerald-500/35" 
                                : "text-gray-100 line-through decoration-white/20"
                            )}>
                              {step.value}
                            </span>
                            <span className="text-[8px] text-gray-400 truncate max-w-[240px] font-sans font-black uppercase tracking-wider text-right shrink-0">
                              By: {step.changedBy}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Period Column */}
          <div className="md:w-[9%] flex flex-col items-center justify-center text-center">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">PERIOD</p>
            <div className="flex flex-col items-center justify-center p-1 w-full">
              {startVal || endVal ? (
                <div className="flex flex-col items-center">
                  <div className="text-center">
                    <p className={cn("text-[12px] font-black tracking-tight leading-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                      {formatDateSafe(startVal)}
                    </p>
                    {arrivalTimeVal && (
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-[#FF5C35]" />
                        <p className="text-[10px] font-black text-[#FF5C35] leading-none">{arrivalTimeVal}</p>
                      </div>
                    )}
                  </div>
                  <div className="h-px w-4 bg-gray-400 dark:bg-white/20 my-0.5" />
                  <div className="text-center">
                    <p className={cn("text-[12px] font-black tracking-tight leading-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                      {formatDateSafe(endVal)}
                    </p>
                    {departureTimeVal && (
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-blue-500" />
                        <p className="text-[10px] font-black text-blue-500 leading-none">{departureTimeVal}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] font-black text-gray-400/40 italic">N/A</span>
              )}
            </div>
          </div>

          {/* Location Column */}
          <div className="md:w-[9%] flex flex-col items-center justify-center gap-1 py-1">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">LOCATION</p>
            <div className="flex flex-col items-center justify-center p-1 w-full">
              {fromLocationVal || toLocationVal ? (
                <div className="flex flex-col gap-1 items-center max-w-full">
                  {fromLocationVal && (() => {
                    const pill = getLocationPillStyles(fromLocationVal);
                    return (
                      <div 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                        style={{ backgroundColor: pill.bg }}
                      >
                        <ArrowUpRight className="w-2.5 h-2.5 text-black shrink-0" />
                        <span className="text-black truncate max-w-[70px]">
                          {fromLocationVal}
                        </span>
                      </div>
                    );
                  })()}
                  {toLocationVal && (() => {
                    const pill = getLocationPillStyles(toLocationVal);
                    return (
                      <div 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                        style={{ backgroundColor: pill.bg }}
                      >
                        <ArrowDownRight className="w-2.5 h-2.5 text-black shrink-0" />
                        <span className="text-black truncate max-w-[70px]">
                          {toLocationVal}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <span className="text-[9px] font-black text-gray-400/40 italic text-center">N/A</span>
              )}
            </div>
          </div>

          {/* Days Column */}
          <div className="md:w-[4%] md:text-center font-mono font-black shrink-0">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">DAYS</p>
            <span>{typeof liveDays === 'string' && liveDays.endsWith('d') ? `${liveDays.substring(0, liveDays.length - 1)} d` : `${liveDays} d`} 🛣️</span>
          </div>

          {/* Amount Column - exact copy from active bookings */}
          <div className="md:w-[9%] flex items-center md:justify-center font-black">
            <div className="w-full">
              <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">AMOUNT</p>
              <div className="flex items-center md:justify-center">
                <div className={cn(
                  "relative group flex items-center md:justify-center transition-all duration-300 rounded-xl p-1 w-full",
                  priceInfo.hasChanged && "outline-none ring-2 ring-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500/40"
                )}>
                  <PriceLabel 
                    reservationId={item.reservationId}
                    totalPrice={reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice}
                    amountPaid={reservation ? (typeof reservation.amountPaid === 'number' ? reservation.amountPaid : Number(reservation.amountPaid) || 0) : (item.amountPaid || 0)}
                    status="COMPLETED"
                    isDarkMode={isDarkMode}
                    cashflowNotificationSent={false}
                    readOnly={user?.email?.toLowerCase() !== 'mrbulimomo@gmail.com' && user?.email?.toLowerCase() !== 'sahindzemsit@gmail.com'}
                    paymentMethod={item.paymentMethod}
                    changedByEmail={user?.email || 'Supervisor'}
                  />

                  {/* Tooltip */}
                  {priceInfo.hasChanged && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1.5 w-[500px] p-3 bg-red-950/95 text-white border border-red-500/30 rounded-xl shadow-2xl backdrop-blur-sm z-[99999] pointer-events-none transition-all duration-200">
                      <div className="flex items-center gap-1.5 text-red-500 font-extrabold text-[10px] tracking-wider uppercase mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Post-Cashflow Modification
                      </div>

                      {/* Original Value Orange Panel */}
                      <div className="mt-1 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex flex-col gap-1 shadow-[inset_0_1px_2px_rgba(245,158,11,0.05)]">
                        <span className="text-amber-500 font-black text-[9px] tracking-wider uppercase">Original Entry (At Cashflow Submit)</span>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-amber-300 font-mono text-[11px] font-black leading-none">
                            {priceInfo.steps[0].value}€
                          </span>
                          <span className="text-[8px] text-amber-400 font-sans font-black uppercase tracking-wider text-right truncate max-w-[240px]">
                            By: {priceInfo.steps[0].changedBy}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-red-500/20 pt-1.5 mt-1">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Sequence of changes (Top to bottom):</p>
                        <div className="flex flex-col gap-1.5 font-mono text-[10px] leading-tight text-gray-100">
                          {priceInfo.steps.map((step, idx) => {
                            if (idx === 0) return null;
                            return (
                              <div key={idx} className="flex items-center justify-between gap-4 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                <span className={cn(
                                  "font-black shrink-0 text-left truncate max-w-[230px]",
                                  idx === priceInfo.steps.length - 1 
                                    ? "text-emerald-400 font-extrabold underline decoration-emerald-500/35" 
                                    : "text-gray-100 line-through decoration-white/20"
                                )}>
                                  {step.value}€
                                </span>
                                <span className="text-[8px] text-gray-400 truncate max-w-[240px] font-sans font-black uppercase tracking-wider text-right shrink-0">
                                  By: {step.changedBy}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Teammate & Paid To Column - Placed BEFORE Reconcile & State */}
          <div className="md:w-[10%] flex flex-col justify-center items-center text-center gap-1.5 py-1">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">TEAMMATE / PAID TO</p>
            <div className={cn(
              "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border flex items-center gap-1 select-all shadow-sm max-w-full",
              isDarkMode 
                ? "border-amber-900/40 text-amber-400 bg-amber-900/20" 
                : "border-amber-200 text-amber-700 bg-amber-50"
            )}>
              <User className="w-2.5 h-2.5 text-amber-500 shrink-0" />
              <span className="truncate max-w-[65px]">
                {processedBy}
              </span>
            </div>
            {item.paidTo && (
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase border flex items-center gap-1 select-all shadow-sm max-w-full",
                isDarkMode
                  ? "border-emerald-950 text-emerald-400 bg-emerald-950/40"
                  : "border-emerald-100 text-emerald-700 bg-emerald-50"
              )}>
                <span className="text-[9px]" role="img" aria-label="paid-to">💰</span>
                <span className="truncate max-w-[65px]">{item.paidTo}</span>
              </div>
            )}
          </div>
          {/* Notes & Receipt Icons Column */}
          <div className="md:w-[5%] flex items-center md:justify-center gap-1.5 overflow-visible">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">RECONCILE</p>
            {/* Note Button / Icon with Relative Popover Container */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasNote) toggleNote(item.id);
                }}
                disabled={!hasNote}
                className={cn(
                  "w-7 h-7 rounded-lg border flex items-center justify-center transition-all p-1.5 shadow-sm relative z-20",
                  hasNote 
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500 cursor-pointer hover:scale-105 active:scale-95" 
                    : "bg-gray-500/10 border-gray-500/10 text-gray-400 cursor-not-allowed opacity-50"
                )}
                title={hasNote ? "View Note" : "No notes written"}
              >
                <BookOpen className="w-4 h-4 stroke-[2.5]" />
              </button>

              {hasNote && expandedNotes[item.id] && (
                <div 
                  className={cn(
                    "absolute bottom-full mb-2 right-0 md:-right-4 flex flex-col gap-1.5 w-64 p-3 border rounded-xl shadow-2xl backdrop-blur-md z-[99999] animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-auto",
                    isDarkMode 
                      ? "bg-[#231F1D]/95 border-amber-500/30 text-white" 
                      : "bg-white/95 border-amber-300 text-gray-800 shadow-amber-200/10"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-amber-500 font-extrabold text-[10px] tracking-wider uppercase mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
                      Teammate Note
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleNote(item.id); }}
                      className="text-gray-400 hover:text-red-500 font-black text-xs cursor-pointer p-0.5 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <p className={cn(
                    "text-[11px] font-black font-mono tracking-wider whitespace-pre-wrap break-words leading-relaxed text-left",
                    isDarkMode ? "text-amber-100" : "text-amber-900"
                  )}>
                    {item.cashflowNote}
                  </p>
                </div>
              )}
            </div>

            {/* Receipt Button / Icon */}
            {item.receiptUrl ? (
              <a
                href={item.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="w-7 h-7 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer p-1.5"
                title="Open Receipt Image"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
              </a>
            ) : (
              <div
                className="w-7 h-7 rounded-lg border bg-gray-500/10 border-gray-500/10 text-gray-400 flex items-center justify-center opacity-50 p-1.5"
                title="No files uploaded"
              >
                <FileText className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Created At Column */}
          {(() => {
            const raw = (item as any).sentToCashflowAt || 
                        (item as any).slackSentAt || 
                        reservation?.sentToCashflowAt || 
                        reservation?.slackSentAt || 
                        item.createdAt;
            let createdAtInfo: { time24h: string; dateStr: string } | null = null;
            if (raw) {
              let d: Date | null = null;
              if (typeof raw === 'number') d = new Date(raw);
              else if (typeof raw === 'object' && typeof (raw as any).toDate === 'function') d = (raw as any).toDate();
              else if (typeof raw === 'object' && (raw as any).seconds) d = new Date((raw as any).seconds * 1000);
              else d = new Date(raw);

              if (d && !isNaN(d.getTime())) {
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const time24h = `${hours}:${minutes}`;
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const dateStr = `${day}/${month}`;
                createdAtInfo = { time24h, dateStr };
              }
            }

            return (
              <div className="md:w-[8%] flex flex-col items-center justify-center text-center">
                <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">CREATED AT</p>
                {createdAtInfo ? (
                  <div className="flex flex-col items-center justify-center font-mono">
                    <span className={cn("text-xs font-black tracking-wider leading-none", isDarkMode ? "text-amber-400" : "text-amber-600")}>
                      {createdAtInfo.time24h}
                    </span>
                    <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 mt-0.5">
                      {createdAtInfo.dateStr}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-gray-400/40 italic font-mono">N/A</span>
                )}
              </div>
            );
          })()}

          {/* Actions / State Button Column */}
          <div className="md:w-[8%] flex items-center justify-end gap-1.5 relative shrink-0">
            <p className="md:hidden text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 text-left">STATE</p>
            {item.isPaid ? (
              <>
                <div className="relative group flex items-center justify-end">
                  <div className={cn(
                    "px-2 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border flex items-center gap-1 shadow-sm select-none",
                    isDarkMode ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-emerald-100 border-emerald-200 text-emerald-800"
                  )}>
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>PAID</span>
                  </div>
                  
                  {/* Rich elegant tooltip on hover */}
                  <div className={cn(
                    "absolute bottom-full mb-2 right-0 hidden group-hover:block z-50 px-3 py-1.5 text-[9px] font-mono font-black tracking-wider rounded-xl border shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-200 whitespace-nowrap",
                    isDarkMode ? "bg-[#231F1D] text-emerald-400 border-emerald-500/30" : "bg-white text-emerald-400 border-emerald-200"
                  )}>
                    APPROVED BY: <span className="underline decoration-emerald-500/40">{item.approvedBy || 'SYSTEM'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setConfirmingUnpaidItem(item)}
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 shrink-0",
                    isDarkMode 
                      ? "bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400" 
                      : "bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                  )}
                  title="Mark back to Unpaid"
                >
                  <span className="font-bold text-xs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', marginTop: '-1px' }}>✕</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmingItem(item)}
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 shrink-0",
                    isDarkMode 
                      ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white" 
                      : "bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white"
                  )}
                  title="Mark as Paid"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>

                <button
                  disabled
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 opacity-40 cursor-not-allowed",
                    isDarkMode 
                      ? "bg-red-500/5 border-red-500/10 text-red-500/40" 
                      : "bg-red-50/50 border-red-100/50 text-red-400/40"
                  )}
                  title="Already Unpaid"
                >
                  <span className="font-bold text-xs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', marginTop: '-1px' }}>✕</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Calculations for Pending/Paid cards based on valid filtered items
  const pendingStats = useMemo(() => {
    const pendingList = filteredItems.filter(item => !item.isPaid);
    let cashTotal = 0;
    let cardTotal = 0;
    let total = 0;

    pendingList.forEach(item => {
      const reservation = getReservationSafe(item.reservationId);
      const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      const price = livePrice || 0;
      total += price;

      const c = Number((item as any).cashAmount ?? (reservation as any)?.cashAmount);
      const d = Number((item as any).cardAmount ?? (reservation as any)?.cardAmount);
      const hasExactAmounts = (!isNaN(c) && c > 0) || (!isNaN(d) && d > 0);

      if (hasExactAmounts) {
        const cashVal = isNaN(c) || c < 0 ? 0 : c;
        const cardVal = isNaN(d) || d < 0 ? 0 : d;
        const sumRecorded = cashVal + cardVal;
        if (sumRecorded === price || price === 0 || sumRecorded === 0) {
          cashTotal += cashVal;
          cardTotal += cardVal;
        } else {
          const ratio = price / sumRecorded;
          cashTotal += cashVal * ratio;
          cardTotal += cardVal * ratio;
        }
      } else {
        const method = (item.paymentMethod || reservation?.paymentMethod || 'cash').toLowerCase();
        if (method === 'card') {
          cardTotal += price;
        } else if (method === 'cash/card' || method === 'split') {
          cashTotal += price / 2;
          cardTotal += price / 2;
        } else {
          cashTotal += price;
        }
      }
    });

    return {
      total,
      cashTotal: Math.round(cashTotal * 100) / 100,
      cardTotal: Math.round(cardTotal * 100) / 100,
      count: pendingList.length
    };
  }, [filteredItems, getReservationSafe]);

  const paidStats = useMemo(() => {
    const paidList = filteredItems.filter(item => item.isPaid);
    let cashTotal = 0;
    let cardTotal = 0;
    let total = 0;

    paidList.forEach(item => {
      const reservation = getReservationSafe(item.reservationId);
      const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      const price = livePrice || 0;
      total += price;

      const c = Number((item as any).cashAmount ?? (reservation as any)?.cashAmount);
      const d = Number((item as any).cardAmount ?? (reservation as any)?.cardAmount);
      const hasExactAmounts = (!isNaN(c) && c > 0) || (!isNaN(d) && d > 0);

      if (hasExactAmounts) {
        const cashVal = isNaN(c) || c < 0 ? 0 : c;
        const cardVal = isNaN(d) || d < 0 ? 0 : d;
        const sumRecorded = cashVal + cardVal;
        if (sumRecorded === price || price === 0 || sumRecorded === 0) {
          cashTotal += cashVal;
          cardTotal += cardVal;
        } else {
          const ratio = price / sumRecorded;
          cashTotal += cashVal * ratio;
          cardTotal += cardVal * ratio;
        }
      } else {
        const method = (item.paymentMethod || reservation?.paymentMethod || 'cash').toLowerCase();
        if (method === 'card') {
          cardTotal += price;
        } else if (method === 'cash/card' || method === 'split') {
          cashTotal += price / 2;
          cardTotal += price / 2;
        } else {
          cashTotal += price;
        }
      }
    });

    return {
      total,
      cashTotal: Math.round(cashTotal * 100) / 100,
      cardTotal: Math.round(cardTotal * 100) / 100,
      count: paidList.length
    };
  }, [filteredItems, getReservationSafe]);

  const totalSettledAmount = useMemo(() => {
    return filteredItems.filter(item => item.isPaid).reduce((sum, item) => {
      const reservation = getReservationSafe(item.reservationId);
      const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      return sum + (livePrice || 0);
    }, 0);
  }, [filteredItems, getReservationSafe]);

  const totalPendingAmount = useMemo(() => {
    return filteredItems.filter(item => !item.isPaid).reduce((sum, item) => {
      const reservation = getReservationSafe(item.reservationId);
      const livePrice = reservation ? (typeof reservation.totalPrice === 'number' ? reservation.totalPrice : Number(reservation.totalPrice) || 0) : item.totalPrice;
      return sum + (livePrice || 0);
    }, 0);
  }, [filteredItems, getReservationSafe]);

  // Pagination totals and page range
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [filteredItems.length, totalPages, currentPage]);

  // Reset pagination state when filters change
  useEffect(() => {
    setCurrentPage(0);
    setGroupPages({});
  }, [selectedCountry, statusFilter, selectedTimePeriod, searchQuery, calendarMode, calendarSingleDate, calendarRangeStart, calendarRangeEnd]);

  const paginatedItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const visibleReservationIds = useMemo(() => {
    if (selectedTimePeriod === 'ALL') {
      return Array.from(new Set(
        paginatedItems.map(item => item.reservationId).filter(Boolean)
      ));
    } else {
      const ids: string[] = [];
      groupedPeriods?.forEach((group) => {
        const groupPage = groupPages[group.key] || 0;
        const paginatedGroupItems = group.items.slice(groupPage * itemsPerPage, (groupPage + 1) * itemsPerPage);
        paginatedGroupItems.forEach(item => {
          if (item.reservationId) {
            ids.push(item.reservationId);
          }
        });
      });
      return Array.from(new Set(ids));
    }
  }, [selectedTimePeriod, paginatedItems, groupedPeriods, groupPages, itemsPerPage]);

  useEffect(() => {
    if (!hasAccess || visibleReservationIds.length === 0) return;
    
    const unsubscs: (() => void)[] = [];
    
    visibleReservationIds.forEach(resId => {
      const qChanges = collection(db, 'auditLogs', resId, 'changes');
      const unsub = onSnapshot(qChanges, (snapshot) => {
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            jsTimestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : Date.now())
          };
        });
        
        // Sort ascending so they are chronological
        logs.sort((a, b) => a.jsTimestamp - b.jsTimestamp);
        
        setRowAuditLogs(prev => ({
          ...prev,
          [resId]: logs
        }));
      }, (error) => {
        console.warn(`Failed to listen to changes for reservation ${resId}:`, error);
      });
      unsubscs.push(unsub);
    });
    
    return () => {
      unsubscs.forEach(unsub => unsub());
    };
  }, [hasAccess, visibleReservationIds]);

  // Render Access Denied Panel if not authorized
  if (!hasAccess) {
    return (
      <div className={cn(
        "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col justify-center items-center overflow-y-auto no-scrollbar",
        isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
      )}>
        <div className="max-w-md w-full bg-white dark:bg-[#1E1B1A] p-8 rounded-[32px] border border-red-500/20 shadow-2xl flex flex-col items-center gap-6 select-none animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-black text-red-500 tracking-tight uppercase">
              ACCESS DENIED
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono tracking-wider max-w-[270px] mx-auto text-center">
              SUPERVISOR PRIVILEGES ARE REQUIRED TO BROWSE THIS FINANCIAL ARCHIVE.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading view
  if (loading) {
    return (
      <div className={cn(
        "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col justify-center items-center overflow-y-auto no-scrollbar",
        isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
      )}>
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs text-gray-500 font-mono tracking-wider mt-4">FETCHING SECURE LEDGER...</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-4 md:p-6 space-y-6">
        {/* 1. Header Overview Cards Container */}
        <div className={cn(
          "rounded-[40px] border p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-xl",
          isDarkMode 
            ? "bg-stone-900/40 border-white/5 shadow-black/40" 
            : "bg-slate-100/40 border-slate-200/40 shadow-slate-100/50"
        )}>
          {/* Main layout of cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Left Card: PENDING STATUS */}
            <div 
              className="rounded-[32px] border flex overflow-hidden select-none transition-all duration-300 hover:shadow-2xl hover:scale-[1.005] relative"
              style={{
                background: 'linear-gradient(135deg, #FBECE3 0%, #F5D3C4 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.65)',
                boxShadow: '0 20px 45px -15px rgba(245, 185, 164, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
              }}
            >
              {/* Left Accent Strip (Sidebar) */}
              <div 
                className="w-14 flex items-center justify-center shrink-0 border-r border-white/25 select-none relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #F5BCA6 0%, #EAA287 100%)'
                }}
              >
                <span 
                  className="whitespace-nowrap font-sans font-black tracking-[0.2em] text-[10px] text-[#4F2518] uppercase select-none"
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)'
                  }}
                >
                  PENDING STATUS
                </span>
              </div>

              {/* Card Body content */}
              <div className="flex-1 py-4 px-5 md:py-4 md:px-6 flex flex-col md:flex-row justify-between items-stretch gap-6">
                
                {/* Left block: Title, Amount, Subtext, Subpanels */}
                <div className="flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <p className="text-[10px] md:text-[11px] font-black tracking-[0.15em] text-[#8A6355] uppercase">
                      PENDING TOTAL
                    </p>
                    <h3 className="text-3xl md:text-4xl font-black tracking-tight text-stone-900 leading-none">
                      {pendingStats.total.toLocaleString()} €
                    </h3>
                    <p className="text-[11px] font-bold text-[#8A7268]/85">
                      (Cash & Card)
                    </p>
                  </div>

                  {/* Subpanels */}
                  <div className="space-y-2">
                    {/* Cash Subpanel */}
                    <div 
                      className="backdrop-blur-sm border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.015)] rounded-2xl py-1.5 px-3.5 flex items-center justify-between w-full min-w-[150px] transition-all duration-300 hover:shadow-md"
                      style={{
                        background: 'linear-gradient(to left, rgba(18, 179, 124, 0.45) 0%, rgba(18, 179, 124, 0.08) 55%, rgba(255, 255, 255, 0.45) 85%)'
                      }}
                    >
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-stone-600 font-extrabold text-[10px] tracking-wide">Cash:</span>
                        <span className="text-stone-900 font-black text-lg tracking-tight leading-none">{pendingStats.cashTotal.toLocaleString()} €</span>
                      </div>
                      <div className="text-[#0e9f6e] bg-[#12b37c]/10 p-1.5 rounded-lg border border-[#12b37c]/20 shrink-0 transition-transform duration-300 hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 8h10M11 12h10M11 16h10M3 12h2M3 16h2M3 8h2" />
                          <circle cx="4" cy="12" r="1"/>
                          <circle cx="4" cy="16" r="1"/>
                          <circle cx="4" cy="8" r="1"/>
                        </svg>
                      </div>
                    </div>

                    {/* Card Subpanel */}
                    <div 
                      className="backdrop-blur-sm border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.015)] rounded-2xl py-1.5 px-3.5 flex items-center justify-between w-full min-w-[150px] transition-all duration-300 hover:shadow-md"
                      style={{
                        background: 'linear-gradient(to left, rgba(139, 92, 246, 0.38) 0%, rgba(139, 92, 246, 0.08) 55%, rgba(255, 255, 255, 0.45) 85%)'
                      }}
                    >
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-stone-600 font-extrabold text-[10px] tracking-wide">Card:</span>
                        <span className="text-stone-900 font-black text-lg tracking-tight leading-none">{pendingStats.cardTotal.toLocaleString()} €</span>
                      </div>
                      <div className="text-[#7e3af2] bg-[#8b5cf6]/10 p-1.5 rounded-lg border border-[#8b5cf6]/20 shrink-0 transition-transform duration-300 hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="14" x="2" y="5" rx="2"/>
                          <line x1="2" x2="22" y1="10" y2="10"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right block: 3D Round Chart Section */}
                <div className="flex flex-col items-center justify-center shrink-0 select-none min-w-[160px] relative animate-pulse-gentle gap-4 pt-2">
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes spin-slow {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                    @keyframes pulse-gentle {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.02); }
                    }
                    .animate-spin-slow {
                      animation: spin-slow 20s linear infinite;
                    }
                    .animate-pulse-gentle {
                      animation: pulse-gentle 6s ease-in-out infinite;
                    }
                  `}} />

                  {/* Nice 3D Bigger Icon above the chart */}
                  <div className="relative z-10 transition-transform duration-300 hover:scale-110 drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)] shrink-0">
                    <Image 
                      src="/emptywallet.png" 
                      alt="Pending Cashflow" 
                      width={54} 
                      height={54} 
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* 3D Round Progress Ring SVG */}
                  {(() => {
                    const total = pendingStats.cashTotal + pendingStats.cardTotal;
                    const cashShare = total > 0 ? pendingStats.cashTotal / total : 0.5;
                    const cardShare = total > 0 ? pendingStats.cardTotal / total : 0.5;
                    
                    const radius = 36;
                    const strokeWidth = 11;
                    const circ = 2 * Math.PI * radius;
                    
                    const cashStroke = cashShare * circ;
                    const cardStroke = cardShare * circ;
                    
                    return (
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 animate-spin-slow" viewBox="0 0 100 100">
                          <defs>
                            <filter id="glow-3d-pending" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
                              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.1" />
                            </filter>
                            
                            <linearGradient id="cash-grad-pending" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                            <linearGradient id="card-grad-pending" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#a78bfa" />
                              <stop offset="100%" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>

                          {/* Base track */}
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke="rgba(255, 255, 255, 0.25)"
                            strokeWidth={strokeWidth}
                          />

                          {/* Cash segment */}
                          {cashStroke > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="url(#cash-grad-pending)"
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${cashStroke} ${circ}`}
                              strokeDashoffset={0}
                              strokeLinecap="round"
                              filter="url(#glow-3d-pending)"
                              className="transition-all duration-500 ease-out"
                            />
                          )}

                          {/* Card segment */}
                          {cardStroke > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="url(#card-grad-pending)"
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${cardStroke} ${circ}`}
                              strokeDashoffset={-cashStroke}
                              strokeLinecap="round"
                              filter="url(#glow-3d-pending)"
                              className="transition-all duration-500 ease-out"
                            />
                          )}
                        </svg>

                        {/* Centered 3D Floating Records Badge */}
                        <div 
                          className="absolute inset-0 m-auto w-16 h-16 rounded-full flex flex-col items-center justify-center text-center select-none cursor-pointer transition-all duration-300 hover:scale-110"
                          style={{
                            boxShadow: '0 8px 24px -6px rgba(227, 164, 153, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -2px 4px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255,255,255,0.95)',
                            background: 'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #FAF6F4 100%)'
                          }}
                        >
                          <span className="font-sans font-black text-stone-900 text-xl tracking-tight leading-none drop-shadow-sm">
                            {pendingStats.count}
                          </span>
                          <span className="font-sans font-black text-[#A07060] text-[7px] uppercase tracking-widest mt-1 leading-none">
                            Records
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>

            {/* Right Card: SETTLED STATUS */}
            <div 
              className="rounded-[32px] border flex overflow-hidden select-none transition-all duration-300 hover:shadow-2xl hover:scale-[1.005] relative"
              style={{
                background: 'linear-gradient(135deg, #E6F3EC 0%, #D2E8DD 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.65)',
                boxShadow: '0 20px 45px -15px rgba(180, 222, 199, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
              }}
            >
              {/* Left Accent Strip (Sidebar) */}
              <div 
                className="w-14 flex items-center justify-center shrink-0 border-r border-white/25 select-none relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #C2E8D3 0%, #A2D5B7 100%)'
                }}
              >
                <span 
                  className="whitespace-nowrap font-sans font-black tracking-[0.2em] text-[10px] text-[#1E3F2E] uppercase select-none"
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)'
                  }}
                >
                  SETTLED STATUS
                </span>
              </div>

              {/* Card Body content */}
              <div className="flex-1 py-4 px-5 md:py-4 md:px-6 flex flex-col md:flex-row justify-between items-stretch gap-6">
                
                {/* Left block: Title, Amount, Subtext, Subpanels */}
                <div className="flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <p className="text-[10px] md:text-[11px] font-black tracking-[0.15em] text-[#4D6256] uppercase">
                      SETTLED TOTAL
                    </p>
                    <h3 className="text-3xl md:text-4xl font-black tracking-tight text-stone-900 leading-none">
                      {paidStats.total.toLocaleString()} €
                    </h3>
                    <p className="text-[11px] font-bold text-[#698375]/85">
                      (Cash & Card)
                    </p>
                  </div>

                  {/* Subpanels */}
                  <div className="space-y-2">
                    {/* Cash Subpanel */}
                    <div 
                      className="backdrop-blur-sm border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.015)] rounded-2xl py-1.5 px-3.5 flex items-center justify-between w-full min-w-[150px] transition-all duration-300 hover:shadow-md"
                      style={{
                        background: 'linear-gradient(to left, rgba(18, 179, 124, 0.45) 0%, rgba(18, 179, 124, 0.08) 55%, rgba(255, 255, 255, 0.45) 85%)'
                      }}
                    >
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-stone-600 font-extrabold text-[10px] tracking-wide">Cash:</span>
                        <span className="text-stone-900 font-black text-lg tracking-tight leading-none">{paidStats.cashTotal.toLocaleString()} €</span>
                      </div>
                      <div className="text-[#0e9f6e] bg-[#12b37c]/10 p-1.5 rounded-lg border border-[#12b37c]/20 shrink-0 transition-transform duration-300 hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 8h10M11 12h10M11 16h10M3 12h2M3 16h2M3 8h2" />
                          <circle cx="4" cy="12" r="1"/>
                          <circle cx="4" cy="16" r="1"/>
                          <circle cx="4" cy="8" r="1"/>
                        </svg>
                      </div>
                    </div>

                    {/* Card Subpanel */}
                    <div 
                      className="backdrop-blur-sm border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.015)] rounded-2xl py-1.5 px-3.5 flex items-center justify-between w-full min-w-[150px] transition-all duration-300 hover:shadow-md"
                      style={{
                        background: 'linear-gradient(to left, rgba(139, 92, 246, 0.38) 0%, rgba(139, 92, 246, 0.08) 55%, rgba(255, 255, 255, 0.45) 85%)'
                      }}
                    >
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-stone-600 font-extrabold text-[10px] tracking-wide">Card:</span>
                        <span className="text-stone-900 font-black text-lg tracking-tight leading-none">{paidStats.cardTotal.toLocaleString()} €</span>
                      </div>
                      <div className="text-[#7e3af2] bg-[#8b5cf6]/10 p-1.5 rounded-lg border border-[#8b5cf6]/20 shrink-0 transition-transform duration-300 hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="14" x="2" y="5" rx="2"/>
                          <line x1="2" x2="22" y1="10" y2="10"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right block: 3D Round Chart Section */}
                <div className="flex flex-col items-center justify-center shrink-0 select-none min-w-[160px] relative animate-pulse-gentle gap-4 pt-2">
                  {/* Nice 3D Bigger Icon above the chart */}
                  <div className="relative z-10 transition-transform duration-300 hover:scale-110 drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)] shrink-0">
                    <Image 
                      src="/wallet.png" 
                      alt="Settled Cashflow" 
                      width={54} 
                      height={54} 
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* 3D Round Progress Ring SVG */}
                  {(() => {
                    const total = paidStats.cashTotal + paidStats.cardTotal;
                    const cashShare = total > 0 ? paidStats.cashTotal / total : 0.5;
                    const cardShare = total > 0 ? paidStats.cardTotal / total : 0.5;
                    
                    const radius = 36;
                    const strokeWidth = 11;
                    const circ = 2 * Math.PI * radius;
                    
                    const cashStroke = cashShare * circ;
                    const cardStroke = cardShare * circ;
                    
                    return (
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 animate-spin-slow" viewBox="0 0 100 100">
                          <defs>
                            <filter id="glow-3d-paid" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.12" />
                              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.08" />
                            </filter>
                            
                            <linearGradient id="cash-grad-paid" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                            <linearGradient id="card-grad-paid" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#a78bfa" />
                              <stop offset="100%" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>

                          {/* Base track */}
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke="rgba(255, 255, 255, 0.25)"
                            strokeWidth={strokeWidth}
                          />

                          {/* Cash segment */}
                          {cashStroke > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="url(#cash-grad-paid)"
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${cashStroke} ${circ}`}
                              strokeDashoffset={0}
                              strokeLinecap="round"
                              filter="url(#glow-3d-paid)"
                              className="transition-all duration-500 ease-out"
                            />
                          )}

                          {/* Card segment */}
                          {cardStroke > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="url(#card-grad-paid)"
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${cardStroke} ${circ}`}
                              strokeDashoffset={-cashStroke}
                              strokeLinecap="round"
                              filter="url(#glow-3d-paid)"
                              className="transition-all duration-500 ease-out"
                            />
                          )}
                        </svg>

                        {/* Centered 3D Floating Records Badge */}
                        <div 
                          className="absolute inset-0 m-auto w-16 h-16 rounded-full flex flex-col items-center justify-center text-center select-none cursor-pointer transition-all duration-300 hover:scale-110"
                          style={{
                            boxShadow: '0 8px 24px -6px rgba(158, 217, 198, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -2px 4px rgba(0, 0, 0, 0.05)',
                            border: '1px solid rgba(255,255,255,0.95)',
                            background: 'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #F4FAF6 100%)'
                          }}
                        >
                          <span className="font-sans font-black text-stone-900 text-xl tracking-tight leading-none drop-shadow-sm">
                            {paidStats.count}
                          </span>
                          <span className="font-sans font-black text-[#508A70] text-[7px] uppercase tracking-widest mt-1 leading-none">
                            Records
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>

          </div>

        </div>

      {/* 2. Controls & Filters Panel */}
      <div 
        ref={filtersSectionRef}
        className={cn(
          "rounded-[28px] border p-4 space-y-4 shadow-sm",
          isDarkMode ? "bg-[#231F1D] border-white/5" : "bg-white border-black/5"
        )}>
        {/* Search and Calendar Row */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
          {/* Search inputs: Main search + Teammate/Paid To search */}
          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Main search: Client Name or Car Plate */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Search by client name or car plate..."
                className={cn(
                  "w-full pl-10 pr-9 py-3 rounded-2xl text-xs font-black tracking-wider outline-none border focus:border-[#FF5C35]/50 transition-all uppercase placeholder:normal-case",
                  isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/5 text-black"
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-black text-xs cursor-pointer p-1 transition-colors"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Paid To search (who received the money: e.g. WEB, BURHAN) */}
            <div className="relative">
              <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/80 pointer-events-none" />
              <input 
                type="text"
                value={searchPaidToQuery}
                onChange={(e) => {
                  setSearchPaidToQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Search by paid to (e.g. WEB, BURHAN)..."
                className={cn(
                  "w-full pl-10 pr-9 py-3 rounded-2xl text-xs font-black tracking-wider outline-none border focus:border-emerald-500/50 transition-all uppercase placeholder:normal-case",
                  isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/5 text-black"
                )}
              />
              {searchPaidToQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchPaidToQuery('');
                    setCurrentPage(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-black text-xs cursor-pointer p-1 transition-colors"
                  title="Clear paid to search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Calendar Navigation Bar */}
          <div className={cn(
            "xl:col-span-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 py-1.5 rounded-2xl border",
            isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/5 text-black"
          )}>
            <div className="flex items-center gap-1.5 justify-between sm:justify-start">
              <button
                type="button"
                onClick={handlePrevDay}
                className={cn(
                  "p-2 rounded-xl border hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0",
                  isDarkMode ? "border-white/10 hover:bg-white/5 text-white" : "border-black/15 hover:bg-black/5 text-black"
                )}
                title="Previous Day"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(prev => !prev)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black tracking-wider uppercase transition-all cursor-pointer font-mono select-none",
                    isCalendarOpen || (calendarMode === 'single' ? calendarSingleDate : calendarRangeStart)
                      ? "bg-[#FF5C35]/10 border-[#FF5C35] text-[#FF5C35]"
                      : isDarkMode
                        ? "border-white/10 hover:bg-white/5 text-white"
                        : "border-black/15 hover:bg-black/5 text-black"
                  )}
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-[#FF5C35] shrink-0" />
                  <span>{datePickerDisplayText}</span>
                </button>

                {isCalendarOpen && renderCalendarPopover()}
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                className={cn(
                  "p-2 rounded-xl border hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0",
                  isDarkMode ? "border-white/10 hover:bg-white/5 text-white" : "border-black/15 hover:bg-black/5 text-black"
                )}
                title="Next Day"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 font-mono justify-end">
              <button
                type="button"
                onClick={handleSelectToday}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer",
                  calendarMode === 'single' && calendarSingleDate === (() => {
                    const t = currentSystemTime || new Date();
                    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                  })()
                    ? "bg-[#FF5C35] text-white border-[#FF5C35] shadow-sm"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleSelectAllDays}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer",
                  !calendarSingleDate && !calendarRangeStart && !calendarRangeEnd
                    ? "bg-[#FF5C35] text-white border-[#FF5C35] shadow-sm"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                All Days
              </button>
            </div>
          </div>
        </div>

        {/* Tab filters row: Country Tabs on Left, Period Tabs on Right */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* Left section: Country Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black tracking-widest text-[#FF5C35] uppercase mr-1 select-none font-mono">FROM:</span>
            
            {/* ALL button */}
            <button
              onClick={() => {
                setSelectedCountry(null);
                setCurrentPage(0);
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                !selectedCountry
                  ? "bg-[#FF5C35] text-white border-[#FF5C35] shadow-md scale-105"
                  : isDarkMode
                    ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                    : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
              )}
            >
              All
            </button>

            {/* Macedonia Button */}
            {isLocationAllowed('MACEDONIA') && (
              <button
                onClick={() => {
                  setSelectedCountry('MACEDONIA');
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedCountry === 'MACEDONIA'
                    ? "bg-[#64BC61] text-black border-[#64BC61] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Macedonia
              </button>
            )}

            {/* Kosovo Button */}
            {isLocationAllowed('KOSOVO') && (
              <button
                onClick={() => {
                  setSelectedCountry('KOSOVO');
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedCountry === 'KOSOVO'
                    ? "bg-[#3B82F6] text-white border-[#3B82F6] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Kosovo
              </button>
            )}

            {/* Albania Button */}
            {isLocationAllowed('ALBANIA') && (
              <button
                onClick={() => {
                  setSelectedCountry('ALBANIA');
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedCountry === 'ALBANIA'
                    ? "bg-[#E11D48] text-white border-[#E11D48] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Albania
              </button>
            )}

            {/* Montenegro Button */}
            {isLocationAllowed('MONTENEGRO') && (
              <button
                onClick={() => {
                  setSelectedCountry('MONTENEGRO');
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedCountry === 'MONTENEGRO'
                    ? "bg-[#FF9F00] text-black border-[#FF9F00] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Montenegro
              </button>
            )}

            {/* Bosnia Button */}
            {isLocationAllowed('BOSNIA') && (
              <button
                onClick={() => {
                  setSelectedCountry('BOSNIA');
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedCountry === 'BOSNIA'
                    ? "bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                Bosnia
              </button>
            )}
          </div>

          {/* Middle section: Status Selection (PENDING and SETTLED) */}
          <div className="flex flex-wrap items-center gap-1.5 px-0 xl:px-4">
            <span className="text-[9px] font-black tracking-widest text-[#FF5C35] uppercase mr-1 select-none font-mono">STATUS:</span>
            {(['ALL', 'PENDING', 'SETTLED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  statusFilter === status
                    ? status === 'PENDING'
                      ? "bg-red-500 text-white border-red-500 shadow-md scale-105"
                      : status === 'SETTLED'
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-md scale-105"
                        : "bg-[#FF5C35] text-white border-[#FF5C35] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                {status === 'ALL' ? 'both' : status.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Right section: Grouping Periods (ALL, DAILY, WEEKLY, MONTHLY, YEARLY) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black tracking-widest text-[#FF5C35] uppercase mr-1 select-none font-mono">PERIODS:</span>
            
            {(['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((period) => (
              <button
                key={period}
                onClick={() => {
                  setSelectedTimePeriod(period);
                  setCurrentPage(0);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border shrink-0 cursor-pointer",
                  selectedTimePeriod === period
                    ? "bg-[#FF5C35] text-white border-[#FF5C35] shadow-md scale-105"
                    : isDarkMode
                      ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400"
                      : "bg-transparent border-black/10 hover:bg-black/5 text-gray-500"
                )}
              >
                {period === 'ALL' ? 'flat view' : period.toLowerCase()}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. Main Cashflow Records list */}
      <div className="space-y-3">
        {/* Table Title and Metadata Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-black tracking-widest uppercase">
              CASHFLOW WORKSPACE ({filteredItems.length})
            </h2>
            {/* Realtime sum indicators right at the top */}
            <div className="flex items-center gap-2 select-none shrink-0 font-mono">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black border uppercase shadow-sm flex items-center gap-1.5 transition-all",
                isDarkMode 
                  ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400" 
                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}>
                <span>SETTLED: €{totalSettledAmount}</span>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black border uppercase shadow-sm flex items-center gap-1.5 transition-all",
                isDarkMode 
                  ? "bg-red-950/40 border-red-900/50 text-red-400" 
                  : "bg-red-50 border-red-100 text-red-700"
              )}>
                <span>PENDING: €{totalPendingAmount}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* 5 Small round plate country tabs (restricted to mrbulimomo@gmail.com and sahindzemsit@gmail.com) */}
            {canSeePlateCountryTabs && (
              <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/5 shadow-inner">
                {PLATE_COUNTRIES.map(ctry => {
                  const isSelected = selectedPlateCountries.includes(ctry.code);
                  return (
                    <button
                      key={ctry.code}
                      onClick={() => togglePlateCountry(ctry.code)}
                      title={`Toggle ${ctry.name} Plate (${ctry.code})`}
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono font-black text-[9px] sm:text-[10px] transition-all duration-200 cursor-pointer select-none",
                        isSelected
                          ? "scale-110 shadow-md text-white font-black"
                          : isDarkMode
                            ? "bg-transparent text-gray-400 hover:text-white hover:bg-white/10"
                            : "bg-transparent text-gray-500 hover:text-black hover:bg-black/10"
                      )}
                      style={isSelected ? {
                        backgroundColor: ctry.color,
                        boxShadow: `0 2px 8px ${ctry.color}80`,
                        color: ctry.textColor
                      } : undefined}
                    >
                      {ctry.code}
                    </button>
                  );
                })}
              </div>
            )}

            <span className="text-[9px] font-mono text-gray-500 bg-black/5 dark:bg-white/5 py-1 px-3 rounded-full uppercase">
              {selectedTimePeriod !== 'ALL' ? 'grouped analysis' : 'realtime archive'}
            </span>
          </div>
        </div>

        {/* Conditional Rendering: Flat View vs Grouped View */}
        {selectedTimePeriod === 'ALL' ? (
          /* Table representation */
          <div className={cn(
            "rounded-[32px] border overflow-visible p-2.5 md:p-3 pb-4 space-y-1.5",
            isDarkMode ? "bg-[#1E1B1A] border-white/5" : "bg-white border-black/5 shadow-sm"
          )}>
            {/* Header row */}
            <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-black/5 dark:border-white/5 select-none text-left font-mono">
              <div className="w-[26%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">Client Name</div>
              <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">Car / Plate</div>
              <div className="w-[9%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Period</div>
              <div className="w-[9%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Location</div>
              <div className="w-[4%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Days</div>
              <div className="w-[9%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Amount</div>
              <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Teammate / Paid To</div>
              <div className="w-[5%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Reconcile</div>
              <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">Created At</div>
              <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-right">State</div>
            </div>

            {/* List items */}
            {paginatedItems.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 font-mono tracking-widest lowercase">
                no cashflow entries reported yet.
              </div>
            ) : (
              paginatedItems.map((item) => renderCashflowRow(item))
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-4 px-2 mt-2 select-none">
                <span className="text-[9px] font-black text-gray-500 font-mono uppercase tracking-widest">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl border text-[9px] font-black tracking-widest uppercase transition-all shadow-sm",
                      currentPage === 0 
                        ? "opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5 border-transparent text-gray-400" 
                        : "cursor-pointer bg-white dark:bg-white/5 hover:scale-105 active:scale-95 border-black/10 dark:border-white/10"
                    )}
                  >
                    PREV
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl border text-[9px] font-black tracking-widest uppercase transition-all shadow-sm",
                      currentPage === totalPages - 1 
                        ? "opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5 border-transparent text-gray-400" 
                        : "cursor-pointer bg-white dark:bg-white/5 hover:scale-105 active:scale-95 border-black/10 dark:border-white/10"
                    )}
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Grouped analysis view */
          <div className="space-y-6">
            {groupedPeriods && groupedPeriods.length === 0 ? (
              <div className={cn(
                "rounded-[32px] border p-12 text-center text-xs text-gray-400 font-mono tracking-widest lowercase",
                isDarkMode ? "bg-[#1E1B1A] border-white/5" : "bg-white border-black/5 shadow-sm"
              )}>
                no entries match current criteria for this period.
              </div>
            ) : (
              groupedPeriods?.map((group) => {
                const groupPage = groupPages[group.key] || 0;
                const groupTotalPages = Math.ceil(group.items.length / itemsPerPage);
                const paginatedGroupItems = group.items.slice(groupPage * itemsPerPage, (groupPage + 1) * itemsPerPage);

                return (
                  <div key={group.key} className="space-y-2">
                    {/* Group header section */}
                    <div className={cn(
                      "px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 font-mono select-none",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    )}>
                      <span className="text-[11px] font-black tracking-wider text-[#FF5C35]">
                        {group.label} ({group.items.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border shadow-sm flex items-center gap-1",
                          isDarkMode ? "border-emerald-950 text-emerald-400 bg-emerald-950/40" : "border-emerald-100 text-emerald-700 bg-emerald-50"
                        )}>
                          <span>settled: €{group.settledTotal}</span>
                        </div>
                        <div className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border shadow-sm flex items-center gap-1",
                          isDarkMode ? "border-red-950 text-red-400 bg-red-950/40" : "border-red-100 text-red-700 bg-red-50"
                        )}>
                          <span>pending: €{group.pendingTotal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Grouped list of items */}
                    <div className="space-y-1.5">
                      {paginatedGroupItems.map((item) => renderCashflowRow(item))}
                    </div>

                    {/* Group pagination controls */}
                    {groupTotalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2 px-2 select-none">
                        <span className="text-[9px] font-black text-gray-500 font-mono uppercase tracking-widest">
                          Page {groupPage + 1} of {groupTotalPages}
                        </span>
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                          <button
                            onClick={() => {
                              setGroupPages(prev => ({
                                ...prev,
                                [group.key]: Math.max(0, groupPage - 1)
                              }));
                            }}
                            disabled={groupPage === 0}
                            className={cn(
                              "px-2 py-1 rounded-lg border text-[8px] font-black tracking-widest uppercase transition-all shadow-xs",
                              groupPage === 0 
                                ? "opacity-50 bg-black/5 dark:bg-white/5 border-transparent text-gray-400 cursor-not-allowed" 
                                : "cursor-pointer bg-white dark:bg-white/5 hover:scale-105 active:scale-95 border-black/10 dark:border-white/10"
                            )}
                          >
                            PREV
                          </button>
                          <button
                            onClick={() => {
                              setGroupPages(prev => ({
                                ...prev,
                                [group.key]: Math.min(groupTotalPages - 1, groupPage + 1)
                              }));
                            }}
                            disabled={groupPage === groupTotalPages - 1}
                            className={cn(
                              "px-2 py-1 rounded-lg border text-[8px] font-black tracking-widest uppercase transition-all shadow-xs",
                              groupPage === groupTotalPages - 1 
                                ? "opacity-50 bg-black/5 dark:bg-white/5 border-transparent text-gray-400 cursor-not-allowed" 
                                : "cursor-pointer bg-white dark:bg-white/5 hover:scale-105 active:scale-95 border-black/10 dark:border-white/10"
                            )}
                          >
                            NEXT
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in duration-200">
          <div className={cn(
            "max-w-md w-full rounded-[24px] border p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200",
            isDarkMode ? "bg-[#1E1B1A] border-white/10 text-white" : "bg-white border-black/5 text-gray-900"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Confirm Payment</h3>
                <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mt-0.5">MARKING AS FULLY PAID</p>
              </div>
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">RESERVATION INFO:</p>
              <div className={cn(
                "p-3 rounded-lg border flex flex-col gap-1",
                isDarkMode ? "bg-[#292523] border-white/5" : "bg-gray-50 border-black/5"
              )}>
                <div>
                  <span className="text-gray-400">CLIENT: </span>
                  <span className="font-black uppercase">{confirmingItem.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">TOTAL: </span>
                  <span className="font-black">€{confirmingItem.totalPrice}</span>
                </div>
                <div>
                  <span className="text-gray-400">PAID TO: </span>
                  <span className="font-black uppercase">{confirmingItem.paidTo || confirmingItem.cashflowHandledBy || 'SYSTEM'}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
              Are you sure you want to approve this cashflow ledger as fully PAID? This action will register your approval under your account email: <span className="underline font-mono">{user?.email || 'Unknown'}</span>.
            </p>

            <div className="flex gap-2 justify-end font-mono mt-2">
              <button
                onClick={() => setConfirmingItem(null)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all cursor-pointer",
                  isDarkMode 
                    ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400" 
                    : "bg-transparent border-black/10 hover:bg-black/5 text-gray-600"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleMarkAsPaid(confirmingItem);
                  setConfirmingItem(null);
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-lg transition-all cursor-pointer"
              >
                Approve & Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Revert to Unpaid Confirmation Modal */}
      {confirmingUnpaidItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in duration-200">
          <div className={cn(
            "max-w-md w-full rounded-[24px] border p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200",
            isDarkMode ? "bg-[#1E1B1A] border-white/10 text-white" : "bg-white border-black/5 text-gray-900"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                <span className="font-bold text-lg select-none">✕</span>
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Revert to Unpaid</h3>
                <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mt-0.5">RESET PAYMENT STATE</p>
              </div>
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">RESERVATION INFO:</p>
              <div className={cn(
                "p-3 rounded-lg border flex flex-col gap-1",
                isDarkMode ? "bg-[#292523] border-white/5" : "bg-gray-50 border-black/5"
              )}>
                <div>
                  <span className="text-gray-400">CLIENT: </span>
                  <span className="font-black uppercase">{confirmingUnpaidItem.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">TOTAL: </span>
                  <span className="font-black">€{confirmingUnpaidItem.totalPrice}</span>
                </div>
                <div>
                  <span className="text-gray-400">PAID TO: </span>
                  <span className="font-black uppercase">{confirmingUnpaidItem.paidTo || confirmingUnpaidItem.cashflowHandledBy || 'SYSTEM'}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
              Are you sure you want to revert this cashflow ledger back to <span className="text-red-500 font-bold">UNPAID</span>? This will clear the approved payment status and approval logs.
            </p>

            <div className="flex gap-2 justify-end font-mono mt-2">
              <button
                onClick={() => setConfirmingUnpaidItem(null)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all cursor-pointer",
                  isDarkMode 
                    ? "bg-transparent border-white/10 hover:bg-white/5 text-gray-400" 
                    : "bg-transparent border-black/10 hover:bg-black/5 text-gray-600"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleMarkAsUnpaid(confirmingUnpaidItem);
                  setConfirmingUnpaidItem(null);
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-lg transition-all cursor-pointer"
              >
                Revert to Unpaid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
