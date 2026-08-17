'use client';

import React, { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronLeft, ChevronRight, Clock, Car, Search, FileText, BookOpen, Pencil, Trash2, User, ArrowUpRight, ArrowDownRight, Pin, Flag, Check, CreditCard, Contact, Sun, Snowflake, RotateCcw, X, ArrowUpDown, Printer, Loader2, Coins, CircleUser, CarFront, Phone, Mail, MapPin, FileDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, guessGenderFromName, parseDateSafe, isValidMatchValue } from '@/lib/utils';
import { format, isSameDay, addYears } from 'date-fns';
import Image from 'next/image';
import ReservationModal from './ReservationModal';
import CancellationModal from './CancellationModal';
import CompleteConfirmationModal from './CompleteConfirmationModal';
import DocumentPanel from './DocumentPanel';
import WhatsAppButton from './WhatsAppButton';
import PriceLabel from './PriceLabel';
import { ActiveBookingsPanel } from './ActiveBookingsPanel';
import { BookingGridTooltip } from './BookingGridTooltip';
import { CountriesHoverTooltip } from './CountriesHoverTooltip';
import { CarExtraDetailsModal } from './CarExtraDetailsModal';
import { FilterHeader } from './FilterHeader';
import { CashflowNotificationPopup } from './CashflowNotificationPopup';
import { StatusNotePopup } from './StatusNotePopup';
import { ReservationNotePopup } from './ReservationNotePopup';
import { IncomingFleetPanel } from './IncomingFleetPanel';
import { AddVehicleModal } from './AddVehicleModal';
import { functions, db, auth, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateStatsOnStatusChange } from '@/lib/stats';
import { setDoc, doc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, addDoc, Timestamp, serverTimestamp, increment, getDoc, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Reservation, Vehicle } from '@/types';
import { COUNTRY_COLORS, AVAILABLE_COUNTRIES, VEHICLE_COUNTRIES } from '@/lib/constants';
import { Virtuoso } from 'react-virtuoso';
import { useAppState } from '@/lib/context';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MAIN_CAR_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Gray', value: '#808080' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Orange', value: '#FFA500' },
];

interface ReservationsProps {
  isDarkMode: boolean;
  sidebarColor: string;
  userReservations: Reservation[];
  dbVehicles: Vehicle[];
  currentSystemTime?: Date;
  reservationFilter: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null;
  setReservationFilter: (val: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null) => void;
  isDataLoading?: boolean;
}

interface CalendarDay {
  day: number;
  weekday: string;
  isToday: boolean;
  isPast: boolean;
  daysFromToday: number;
  date: Date;
  midnightMs: number;
  isNextMonth?: boolean;
}

const BIRTHSTONE_COLORS: Record<number, { name: string; rgb: [number, number, number] }> = {
  0: { name: 'January', rgb: [139, 0, 0] },         // Dark Red
  1: { name: 'February', rgb: [138, 43, 226] },     // Purple / Violet
  2: { name: 'March', rgb: [127, 255, 212] },        // Aquamarine / Light Blue
  3: { name: 'April', rgb: [226, 232, 240] },        // Clear / Diamond White
  4: { name: 'May', rgb: [16, 185, 129] },          // Emerald Green
  5: { name: 'June', rgb: [244, 114, 182] },         // Light Pink / Pearl White
  6: { name: 'July', rgb: [225, 29, 72] },          // Vibrant Red
  7: { name: 'August', rgb: [163, 230, 53] },        // Pale Green / Peridot
  8: { name: 'September', rgb: [30, 58, 138] },      // Deep Sapphire Blue
  9: { name: 'October', rgb: [219, 39, 119] },       // Rose Pink / Opal
  10: { name: 'November', rgb: [217, 119, 6] },      // Golden Yellow / Topaz
  11: { name: 'December', rgb: [13, 148, 136] }      // Turquoise / Blue-Topaz
};

const getHeaderGradient = (days: CalendarDay[], isDark: boolean) => {
  if (!days || days.length === 0) return '';
  const baseColor = isDark ? '35, 31, 29' : '245, 241, 233'; // #231F1D (rgb) vs #F5F1E9 (rgb)
  const baseHex = isDark ? '#231F1D' : '#F5F1E9';
  
  let stops = '';
  if (days.length === 1) {
    const m = days[0].date.getMonth();
    const info = BIRTHSTONE_COLORS[m];
    const rgb = info ? info.rgb : [245, 241, 239];
    const alpha = isDark ? 0.28 : 0.38;
    stops = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) 0%, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) 100%`;
  } else {
    stops = days.map((d, index) => {
      const pct = ((index / (days.length - 1)) * 100).toFixed(1);
      const m = d.date.getMonth();
      const info = BIRTHSTONE_COLORS[m];
      const rgb = info ? info.rgb : [245, 241, 239];
      const alpha = isDark ? 0.28 : 0.38;
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha}) ${pct}%`;
    }).join(', ');
  }
  
  const horizontalGradient = `linear-gradient(to right, ${stops})`;
  // Smooth layered vertical gradient: washes out to solid background color at the very top (0%) 
  // and reveals the beautiful birthstone horizontal colors at the bottom (100%).
  const verticalFade = `linear-gradient(to bottom, ${baseHex} 0%, rgba(${baseColor}, 0.2) 65%, transparent 100%)`;
  
  return `${verticalFade}, ${horizontalGradient}`;
};

const getTextColorForBg = (bgColor?: string) => {
  if (!bgColor) return '#FFFFFF';
  const cleanHex = bgColor.replace('#', '').toUpperCase();
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 200) + (g * 500) + (b * 100)) / 800; // slightly customized for high readability on secondary colors like yellow
    return yiq >= 150 ? '#0E0C0B' : '#FFFFFF';
  }
  if (cleanHex === 'FFF' || cleanHex === 'FFFFFF' || cleanHex === 'WHITE' || bgColor.toLowerCase() === 'white') {
    return '#0E0C0B';
  }
  return '#FFFFFF';
};

interface DayBooking {
  id: string;
  client: string;
  startDate: Date;
  endDate: Date;
  startMs?: number;
  endMs?: number;
  status: string;
  color: string;
  totalPrice?: number | string;
  arrivalTime?: string;
  departureTime?: string;
}

interface CarBooking {
  carId: number;
  reservations: DayBooking[];
}

// --- Optimized Memoized Components ---

const MonthDivider = memo(({ monthName, isDarkMode, showFocusBlur, isHeader }: { monthName: string, isDarkMode: boolean, showFocusBlur?: boolean, isHeader?: boolean }) => {
  const mIndex = MONTHS.indexOf(monthName.toUpperCase());
  const info = mIndex !== -1 ? BIRTHSTONE_COLORS[mIndex] : null;
  const rgb = info ? info.rgb : null;

  const bgStyle = rgb ? {
    background: `linear-gradient(to bottom, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isDarkMode ? 0.28 : 0.32}) 0%, rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isDarkMode ? 0.01 : 0.03}) 100%)`
  } : {};

  return (
    <div className={cn(
      "flex items-center justify-center relative shrink-0",
      isHeader ? "h-[53.2px]" : "h-full",
      showFocusBlur ? "px-0 mx-0" : "px-0 mx-0",
      isDarkMode ? "border-x border-white/5" : "border-x border-black/5"
    )}
    style={{ 
      flex: '0.5 0 0%',
      ...bgStyle,
      ...(isHeader ? { marginBottom: '-10px' } : {})
    }}
    >
      <span className={cn(
        "text-[8px] font-black tracking-[0.3em] uppercase whitespace-nowrap z-10",
        isDarkMode ? "text-white/50" : "text-black/60"
      )} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        {monthName}
      </span>
    </div>
  );
});

MonthDivider.displayName = 'MonthDivider';

const DayCell = memo(({ day, isDarkMode, carBooking, showFocusBlur, isFirstRow, onHover, onLeave, isSelectionEnabled, isRelocationMode, isSelected, isSelectionInRange, onClick, isEditMode, onReservationSelect, reservationIdToSwap, reservationToMoveId, isExtraRow, isExtraCancelMode, onCancelBooking, fleetSearch, onOverdueClick, todayMidnightMs }: { 
  day: CalendarDay, 
  isDarkMode: boolean, 
  carBooking: CarBooking | undefined, 
  showFocusBlur: boolean, 
  isFirstRow?: boolean,
  onHover: (e: React.MouseEvent, bookings: DayBooking[], isFirstRow: boolean) => void,
  onLeave: () => void,
  isSelectionEnabled?: boolean,
  isRelocationMode?: boolean,
  isSelected?: boolean,
  isSelectionInRange?: boolean,
  onClick?: () => void,
  isEditMode?: boolean,
  onReservationSelect?: (resId: string) => void,
  reservationIdToSwap?: string | null,
  reservationToMoveId?: string | null,
  isExtraRow?: boolean,
  isExtraCancelMode?: boolean,
  onCancelBooking?: (id: string) => void,
  fleetSearch?: string,
  onOverdueClick?: (resId: string) => void,
  todayMidnightMs?: number
}) => {
  const dayBookings = useMemo(() => {
    const dayMs = day.midnightMs ?? day.date.getTime();
    const filtered = carBooking?.reservations.filter((r: any) => {
      const sMs = r.startMs ?? r.startDate.getTime();
      const eMs = r.endMs ?? r.endDate.getTime();
      return dayMs >= sMs && dayMs <= eMs;
    }) || [];
    
    return [...filtered].sort((a: any, b: any) => {
      const aEndMs = a.endMs ?? a.endDate.getTime();
      const aStartMs = a.startMs ?? a.startDate.getTime();
      const bEndMs = b.endMs ?? b.endDate.getTime();
      const bStartMs = b.startMs ?? b.startDate.getTime();
      
      if (aEndMs === dayMs && bStartMs === dayMs) return -1;
      if (aStartMs === dayMs && bEndMs === dayMs) return 1;
      return 0;
    });
  }, [carBooking?.reservations, day.midnightMs, day.date]);

  const isBooked = dayBookings.length > 0;

  const overdueRentRes = useMemo(() => {
    if (!carBooking?.reservations) return null;
    const dMs = day.midnightMs ?? day.date.getTime();
    const todayMs = todayMidnightMs ?? (() => {
      const val = new Date();
      return new Date(val.getFullYear(), val.getMonth(), val.getDate()).getTime();
    })();

    return carBooking.reservations.find((r: any) => {
      if (r.status !== 'ON RENT') return false;
      const eMs = r.endMs ?? r.endDate.getTime();
      return todayMs > eMs && dMs > eMs && dMs <= todayMs;
    });
  }, [carBooking?.reservations, day.midnightMs, day.date, todayMidnightMs]);

  const isOverdue = !isBooked && !isExtraRow && !!overdueRentRes;

  const isHandover = dayBookings.length > 1;
  const isResSelectedForSwap = dayBookings.some(b => String(b.id) === String(reservationIdToSwap));
  const isResSelectedForMove = reservationToMoveId && dayBookings.some(b => String(b.id) === String(reservationToMoveId));
  const isDirectCancelActive = !!(isExtraRow && isExtraCancelMode && isBooked);

  const blurAmount = showFocusBlur && day.isPast ? 10 : 0;

  const isSearchMatch = useMemo(() => {
    if (!fleetSearch?.trim()) return false;
    const query = fleetSearch.toLowerCase();
    return dayBookings.some(b => (b.client || '').toLowerCase().includes(query));
  }, [dayBookings, fleetSearch]);

  return (
    <div 
      className={cn(
        "flex justify-center items-center relative min-w-0 h-full group/cell hover:z-[100] contain-layout-style",
        !showFocusBlur && "flex-1",
        (isSelectionEnabled || isRelocationMode || isBooked || isDirectCancelActive || isOverdue) && "cursor-pointer"
      )}
      style={{ flex: '1 0 0%', contain: 'layout style' }}
      onMouseEnter={(e) => isBooked && !isDirectCancelActive && onHover(e, dayBookings, !!isFirstRow)}
      onMouseLeave={onLeave}
      onClick={() => {
        if (isDirectCancelActive && onCancelBooking) {
          onCancelBooking(dayBookings[0].id);
        } else if (isOverdue && onOverdueClick && overdueRentRes) {
          onOverdueClick(overdueRentRes.id);
        } else if (isEditMode && isBooked && onReservationSelect) {
          onReservationSelect(dayBookings[0].id);
        } else {
          onClick?.();
        }
      }}
    >
      <div 
        className={cn(
          "w-5 h-5 sm:w-6 sm:h-6 border flex items-center justify-center text-[11px] font-black relative z-10 shadow-sm overflow-hidden rounded-full transition-none",
          day.isToday && (isDarkMode ? "border-white border-2" : "border-[#0E0C0B] border-2"),
          isBooked && !isHandover
            ? cn("text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]", dayBookings[0].color, !day.isToday && "border-transparent")
            : isHandover
              ? cn("text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]", !day.isToday && "border-transparent")
              : isOverdue
                ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                : cn(
                    isDarkMode
                      ? "text-white bg-[#2C2724]"
                      : "text-[#0E0C0B] bg-white",
                    !day.isToday && (isDarkMode ? "border-white/5" : "border-black/20")
                  ),
          isResSelectedForSwap && "ring-4 ring-inset ring-white scale-110 !z-[110]",
          isResSelectedForMove && "ring-4 ring-inset ring-[#FF5C35] scale-110 !z-[110]",
          isDirectCancelActive && "ring-2 ring-red-500 scale-105 shadow-[0_0_8px_rgba(239,68,68,0.5)] !z-[110]",
          isSearchMatch && "ring-4 ring-amber-500 scale-110 select-none shadow-[0_0_15px_rgba(245,158,11,0.8)] !z-[110]"
        )}
        style={{
          filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
          opacity: blurAmount > 0 ? 0.4 : 1
        }}
        title={isOverdue && overdueRentRes ? `Overdue ON RENT: ${overdueRentRes.client}` : undefined}
      >
        {isHandover ? (
          <>
            <div className={cn("absolute inset-0", dayBookings[0].color)} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
            <div className={cn("absolute inset-0", dayBookings[1].color)} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="w-[141%] h-[2px] bg-black/40 rotate-[-45deg]" />
            </div>
            <span className={cn(
              "relative z-30 text-[11px] font-black leading-none",
              isDarkMode ? "text-white" : "text-[#0E0C0B]"
            )}>
              {day.day}
            </span>
          </>
        ) : (
          <>
            {isDirectCancelActive ? (
              <Trash2 className="w-3 h-3 text-white" />
            ) : isOverdue ? (
              <span className="text-amber-600 dark:text-yellow-400 font-extrabold text-[12px] filter drop-shadow-[0_0_2px_rgba(245,158,11,0.7)] select-none">!</span>
            ) : (
              day.day
            )}
            {isBooked && (
              <div className="absolute inset-0 bg-white/10 rounded-full" />
            )}
            {/* Selection Overlays */}
            {isSelected && (
              <div className="absolute inset-0 bg-[#FF5C35] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            {isSelectionInRange && !isSelected && (
              <div className="absolute inset-0 bg-[#FF5C35]/40" />
            )}
          </>
        )}
      </div>
    </div>
  );
});

DayCell.displayName = 'DayCell';

export const globalGetDestinationCountry = (toLocation: string | undefined): 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece' | undefined => {
  if (!toLocation) return undefined;
  const loc = toLocation.trim().toUpperCase();
  if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA') || loc === 'MK' || loc === 'MKD') return 'Macedonia';
  if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO') || loc === 'RKS' || loc === 'KS') return 'Kosovo';
  if (loc.includes('TIRANA') || loc.includes('ALBANIA') || loc === 'AL' || loc === 'ALB') return 'Albania';
  if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO') || loc === 'MNE' || loc === 'ME') return 'Montenegro';
  if (loc.includes('SARAJEVO') || loc.includes('BOSNIA') || loc === 'BIH' || loc === 'BA') return 'Bosnia';
  if (loc.includes('ATHENS') || loc.includes('THESSALONIKI') || loc.includes('GREECE') || loc === 'GR' || loc === 'GRC' || loc === 'EUROPE') return 'Greece';
  
  if (loc === 'MACEDONIA') return 'Macedonia';
  if (loc === 'KOSOVO') return 'Kosovo';
  if (loc === 'ALBANIA') return 'Albania';
  if (loc === 'BOSNIA') return 'Bosnia';
  if (loc === 'MONTENEGRO') return 'Montenegro';
  if (loc === 'SERBIA') return 'Serbia';
  if (loc === 'EUROPE' || loc === 'GREECE') return 'Greece';
  return undefined;
};

const COUNTRY_BG_CLASSES: Record<string, string> = {
  Macedonia: 'bg-[#64BC61]',
  Kosovo: 'bg-[#3B82F6]',
  Albania: 'bg-[#EC4899]',
  Bosnia: 'bg-[#8B5CF6]',
  Montenegro: 'bg-[#FF9F00]',
  Serbia: 'bg-[#7B3F00]',
  Greece: 'bg-[#4A4A4A]',
  "ALL COUNTRIES": 'bg-[#FACC15]'
};

const COUNTRY_SHADES: Record<string, string[]> = {
  Macedonia: [
    'bg-[#64BC61]', // Standard green
    'bg-[#8AD987]', // Lighter green
    'bg-[#459B42]', // Darker green
  ],
  Kosovo: [
    'bg-[#3B82F6]', // Standard blue
    'bg-[#60A5FA]', // Lighter blue
    'bg-[#1D4ED8]', // Darker blue
  ],
  Albania: [
    'bg-[#EC4899]', // Standard pink
    'bg-[#F472B6]', // Lighter pink
    'bg-[#DB2777]', // Darker pink
  ],
  Bosnia: [
    'bg-[#8B5CF6]', // Standard purple
    'bg-[#A78BFA]', // Lighter purple
    'bg-[#6D28D9]', // Darker purple
  ],
  Montenegro: [
    'bg-[#FF9F00]', // Standard orange
    'bg-[#FFB74D]', // Lighter orange
    'bg-[#E68A00]', // Darker orange
  ],
  Serbia: [
    'bg-[#7B3F00]', // Standard brown
    'bg-[#9C5A14]', // Lighter brown/tan
    'bg-[#5C2E00]', // Darker brown
  ],
  Greece: [
    'bg-[#4A4A4A]', // Standard charcoal
    'bg-[#6E6E6E]', // Lighter charcoal
    'bg-[#2D2D2D]', // Darker charcoal
  ],
  "ALL COUNTRIES": [
    'bg-[#FACC15]', // Standard yellow
    'bg-[#FDE047]', // Lighter yellow
    'bg-[#EAB308]', // Darker yellow/gold
  ],
};

const DEFAULT_SHADES = [
  'bg-[#FF9F00]',
  'bg-[#FFB74D]',
  'bg-[#E68A00]'
];

const getBrandIcon = (name: string) => {
  return null;
};

const MaskedCarIcon = ({ color, className, onClick }: { color: string, className?: string, onClick?: (e: React.MouseEvent) => void }) => (
  <div 
    className={cn(className)}
    onClick={onClick}
    style={{ 
      backgroundColor: color,
      maskImage: 'url(/car.png)',
      WebkitMaskImage: 'url(/car.png)',
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center'
    }}
  />
);

const VirtualRow = ({ children, height = 37 }: { children: React.ReactNode; height?: number }) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        rootMargin: '300px 0px 300px 0px',
        threshold: 0,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div 
      ref={ref} 
      style={{ 
        minHeight: `${height}px`,
        contentVisibility: isIntersecting ? 'auto' : 'hidden',
        containIntrinsicSize: `auto ${height}px`,
      }}
      className="w-full shrink-0"
    >
      {isIntersecting ? children : <div style={{ height: `${height}px` }} className="w-full shrink-0 border-b border-transparent" />}
    </div>
  );
};

interface FleetSearchInputProps {
  isDarkMode: boolean;
  onSearch: (val: string) => void;
}

const FleetSearchInput = memo(({ isDarkMode, onSearch }: FleetSearchInputProps) => {
  const [localVal, setLocalVal] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(localVal);
    }, 40);
    return () => clearTimeout(timer);
  }, [localVal, onSearch]);

  return (
    <div 
      className={cn(
        "flex-1 h-full rounded-[16px] flex items-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(0,0,0,0.03)] transition-colors relative group",
        isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-[#EBE4D9] border-white"
      )}
    >
      <Search 
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 transition-colors z-10",
          isDarkMode ? "text-gray-500" : "text-gray-400"
        )} 
      />
      <input
        type="text"
        placeholder="SEARCH CARS..."
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        className={cn(
          "w-full h-full bg-transparent pl-8 pr-7 text-[10px] font-extrabold tracking-wide uppercase transition-all duration-300 outline-none border-none",
          isDarkMode ? "text-white placeholder:text-gray-600" : "text-[#0E0C0B] placeholder:text-gray-400"
        )}
        style={{ height: '28px' }}
      />
      {localVal && (
        <button 
          type="button"
          onClick={() => {
            setLocalVal('');
            onSearch('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-[#FF5C35] cursor-pointer z-10 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});
FleetSearchInput.displayName = 'FleetSearchInput';

const CarRow = memo(({ car: vehicle, carBooking, calendarDays, isDarkMode, showFocusBlur, isFirstRow, onHoverDay, onLeaveDay, tyreType, onTyreToggle, onStatusClick, isSelectionEnabled, isRelocationMode, isCarLocationMode, isEditMode, selectionStart, onGridClick, isSelectedForMove, onCarSelect, onCarLocationClick, onReservationSelect, reservationIdToSwap, onChassisClick, onColorClick, reservationToMoveId, isExtraCancelMode, onToggleExtraCancelMode, onCancelBooking, userReservations, activeCountry, currentSystemTime, fleetSearch, onOverdueClick, todayMidnightMs, violationPlatesSet }: { 
  vehicle: Vehicle, 
  carBooking: CarBooking | undefined, 
  calendarDays: CalendarDay[], 
  isDarkMode: boolean, 
  showFocusBlur: boolean, 
  isFirstRow?: boolean,
  onHoverDay: (e: React.MouseEvent, bookings: DayBooking[], isFirstRow: boolean) => void,
  onLeaveDay: () => void,
  tyreType?: 'summer' | 'winter',
  onTyreToggle: (e: React.MouseEvent, vehicleId: number | string) => void,
  onStatusClick: (e: React.MouseEvent, car: Vehicle) => void,
  isSelectionEnabled?: boolean,
  isRelocationMode?: boolean,
  isCarLocationMode?: boolean,
  isEditMode?: boolean,
  selectionStart?: { carId: number | string, date: Date } | null,
  onGridClick: (carId: number | string, day: CalendarDay) => void,
  isSelectedForMove?: boolean,
  onCarSelect?: (carId: number | string) => void,
  onCarLocationClick?: (car: Vehicle) => void,
  onReservationSelect?: (resId: string) => void,
  reservationIdToSwap?: string | null,
  onChassisClick?: (e: React.MouseEvent, car: Vehicle) => void,
  onColorClick?: (e: React.MouseEvent, car: Vehicle) => void,
  reservationToMoveId?: string | null,
  isExtraCancelMode?: boolean,
  onToggleExtraCancelMode?: () => void,
  onCancelBooking?: (id: string) => void,
  userReservations?: Reservation[],
  activeCountry?: string,
  currentSystemTime?: Date,
  fleetSearch?: string,
  onOverdueClick?: (resId: string) => void,
  todayMidnightMs?: number,
  violationPlatesSet?: Set<string>,
  onOpenExtraDetails?: (vehicle: Vehicle, coords: { top: number; left: number; isAbove?: boolean }) => void
}) => {
  const hasViolation = useCallback((plate?: string) => {
    if (!plate || !violationPlatesSet) return false;
    const cleanPlate = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return violationPlatesSet.has(cleanPlate);
  }, [violationPlatesSet]);

  const brandIcon = getBrandIcon(vehicle.name);

  const getDestinationCountry = globalGetDestinationCountry;

  const homeCountry = vehicle.country || 'Macedonia';
  
  const getDepartureCountry = (fromLocation: string | undefined): 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece' | undefined => {
    if (!fromLocation) return undefined;
    const loc = fromLocation.trim().toUpperCase();
    if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA') || loc === 'MK' || loc === 'MKD') return 'Macedonia';
    if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO') || loc === 'RKS' || loc === 'KS') return 'Kosovo';
    if (loc.includes('TIRANA') || loc.includes('ALBANIA') || loc === 'AL' || loc === 'ALB') return 'Albania';
    if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO') || loc === 'MNE' || loc === 'ME') return 'Montenegro';
    if (loc.includes('SARAJEVO') || loc.includes('BOSNIA') || loc === 'BIH' || loc === 'BA') return 'Bosnia';
    if (loc.includes('ATHENS') || loc.includes('THESSALONIKI') || loc.includes('GREECE') || loc === 'GR' || loc === 'GRC' || loc === 'EUROPE') return 'Greece';
    
    if (loc === 'MACEDONIA') return 'Macedonia';
    if (loc === 'KOSOVO') return 'Kosovo';
    if (loc === 'ALBANIA') return 'Albania';
    if (loc === 'BOSNIA') return 'Bosnia';
    if (loc === 'MONTENEGRO') return 'Montenegro';
    if (loc === 'SERBIA') return 'Serbia';
    if (loc === 'EUROPE' || loc === 'GREECE') return 'Greece';
    return undefined;
  };

  const { lastCompletedRes, onRentReservation } = useMemo(() => {
    if (!userReservations || userReservations.length === 0) {
      return { lastCompletedRes: null as Reservation | null, onRentReservation: null as Reservation | null };
    }
    const nowTime = (currentSystemTime || new Date()).getTime();
    let latestComp: Reservation | null = null;
    let latestCompEnd = -Infinity;
    let onRent: Reservation | null = null;
    let latestOnRentStart = -Infinity;

    for (let i = 0; i < userReservations.length; i++) {
      const r = userReservations[i];
      if (String(r.vehicleId) === String(vehicle.id)) {
        if (r.status === 'COMPLETED') {
          const sTime = parseDateSafe(r.start).getTime();
          if (sTime <= nowTime) {
            const eTime = parseDateSafe(r.end).getTime();
            if (eTime > latestCompEnd) {
              latestCompEnd = eTime;
              latestComp = r;
            }
          }
        } else if (r.status === 'ON RENT') {
          const sTime = parseDateSafe(r.start).getTime();
          if (sTime > latestOnRentStart) {
            latestOnRentStart = sTime;
            onRent = r;
          }
        }
      }
    }
    return { lastCompletedRes: latestComp, onRentReservation: onRent };
  }, [userReservations, vehicle.id, currentSystemTime]);

  const lastCompletedDestination = lastCompletedRes && lastCompletedRes.toLocation
    ? getDestinationCountry(lastCompletedRes.toLocation)
    : undefined;

  const onRentDestination = onRentReservation && onRentReservation.toLocation
    ? getDestinationCountry(onRentReservation.toLocation)
    : undefined;

  const onRentDeparture = onRentReservation && onRentReservation.fromLocation
    ? getDepartureCountry(onRentReservation.fromLocation)
    : undefined;

  const forcedPhysicalCountry = vehicle.forcedPhysicalCountry;

  const currentCountry = onRentDestination 
    ? onRentDestination 
    : (forcedPhysicalCountry || lastCompletedDestination || homeCountry);

  const isAwayAndNotReturned = onRentReservation
    ? (onRentDestination ? onRentDestination !== homeCountry : false)
    : (forcedPhysicalCountry
        ? forcedPhysicalCountry !== homeCountry
        : !!(lastCompletedDestination && lastCompletedDestination !== homeCountry));

  const displayedAwayCountry = onRentDestination || forcedPhysicalCountry || lastCompletedDestination;

  const getRowStyles = (countryName: string) => {
    switch (countryName) {
      case 'Kosovo':
        return {
          infoBg: isDarkMode 
            ? "bg-gradient-to-r from-blue-600/60 to-blue-600/10" 
            : "bg-gradient-to-r from-blue-500/40 to-blue-500/5",
        };
      case 'Bosnia':
        return {
          infoBg: isDarkMode 
            ? "bg-gradient-to-r from-violet-600/60 to-violet-600/10" 
            : "bg-gradient-to-r from-violet-500/40 to-violet-500/5",
        };
      case 'Albania':
        return {
          infoBg: isDarkMode 
            ? "bg-gradient-to-r from-[#EC4899]/60 to-[#EC4899]/10" 
            : "bg-gradient-to-r from-[#EC4899]/40 to-[#EC4899]/5",
        };
      case 'Montenegro':
        return {
          infoBg: isDarkMode 
            ? "bg-gradient-to-r from-[#FF9F00]/60 to-[#FF9F00]/10" 
            : "bg-gradient-to-r from-[#FF9F00]/40 to-[#FF9F00]/5",
        };
      case 'Macedonia':
      default:
        return {
          infoBg: isDarkMode 
            ? "bg-gradient-to-r from-[#64BC61]/60 to-[#64BC61]/10" 
            : "bg-gradient-to-r from-[#64BC61]/40 to-[#64BC61]/5",
        };
    }
  };

  const isGuestView = activeCountry && activeCountry !== homeCountry;
  const displayCountry = isGuestView ? homeCountry : currentCountry;
  const badgeCountry = isGuestView ? homeCountry : (displayedAwayCountry || 'Macedonia');

  const styles = getRowStyles(homeCountry);

  if (!vehicle || !vehicle.id) return null;

  return (
    <div className={cn(
      "flex border-b group relative hover:z-[100] contain-layout-style",
      isDarkMode ? "border-neutral-700/80" : "border-gray-300"
    )}
    style={{ 
      height: '37px',
      contain: 'layout style',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      willChange: 'transform'
    }}
    >
      {/* Car Info */}
      <div 
        onClick={() => {
          if (isCarLocationMode) {
            onCarLocationClick?.(vehicle);
          } else if (isEditMode) {
            onCarSelect?.(vehicle.id);
          }
        }}
        className={cn(
          "w-[285px] p-0 border-r shrink-0 flex items-center justify-center shadow-[inset_-2px_0_10px_rgba(0,0,0,0.02)] relative z-20 car-row-info",
          isDarkMode ? "border-neutral-700/80" : "border-gray-300",
          styles.infoBg,
          isSelectedForMove && "ring-4 ring-inset ring-[#FF5C35] brightness-110",
          isCarLocationMode && "ring-2 ring-inset ring-emerald-500/50 hover:brightness-105 hover:bg-emerald-500/5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]",
          isEditMode && !isSelectedForMove && "cursor-pointer hover:brightness-105 active:scale-[0.98]"
        )}
        style={{
          width: '285px',
          height: '37px'
        }}
        >
        {vehicle.name === 'EXTRA' ? (
          <div className="w-full h-full relative select-none">
            <div className="flex items-center justify-between w-full h-full px-3 py-1 gap-2">
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                {!vehicle.plate && (
                  <span className={cn(
                    "font-black text-xs uppercase tracking-widest leading-none",
                    isDarkMode ? "text-gray-300" : "text-gray-800"
                  )}>
                    EXTRA
                  </span>
                )}
                {vehicle.plate && (
                  <div 
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border border-black/20 shadow-sm shrink-0 relative overflow-hidden bg-white text-black font-mono font-black tracking-wide uppercase leading-none pl-[4px] pr-[2px]",
                    )}
                    style={{ 
                      height: '19px',
                      fontSize: '10px'
                    }}
                  >
                    {/* EU Left bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-700" />
                    <span className="pl-[4px] pr-[2px]">{vehicle.plate}</span>
                  </div>
                )}
                {vehicle.plate && vehicle.extraName && (
                  <span 
                    className={cn(
                      "font-black text-[11px] uppercase tracking-wide truncate max-w-[150px] ml-1",
                      isDarkMode ? "text-white" : "text-[#0E0C0B]"
                    )}
                    title={vehicle.extraName}
                  >
                    {vehicle.extraName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExtraCancelMode?.();
                  }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all cursor-pointer border md:active:scale-95 hover:scale-105 shrink-0",
                    isExtraCancelMode 
                      ? "bg-red-500 border-red-400 text-white shadow-md shadow-red-500/25 animate-pulse" 
                      : isDarkMode 
                        ? "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10" 
                        : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                  )}
                  title={isExtraCancelMode ? "Cancel Mode is ON (Click a booked slot to cancel instantly)" : "Click to turn Cancel Mode ON"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {!vehicle.plate ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.closest('.car-row-info')?.getBoundingClientRect();
                      if (rect && onOpenExtraDetails) {
                        const isAbove = rect.top > window.innerHeight / 2;
                        onOpenExtraDetails(vehicle, {
                          left: rect.left + 12,
                          top: isAbove ? rect.top - 6 : rect.bottom + 6,
                          isAbove
                        });
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer border md:active:scale-95 hover:scale-105 shrink-0",
                      isDarkMode 
                        ? "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10" 
                        : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                    )}
                    title="Add Car Plate"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.closest('.car-row-info')?.getBoundingClientRect();
                        if (rect && onOpenExtraDetails) {
                          const isAbove = rect.top > window.innerHeight / 2;
                          onOpenExtraDetails(vehicle, {
                            left: rect.left + 12,
                            top: isAbove ? rect.top - 6 : rect.bottom + 6,
                            isAbove
                          });
                        }
                      }}
                      className={cn(
                        "p-1.5 rounded-lg transition-all cursor-pointer border md:active:scale-95 hover:scale-105 shrink-0 bg-neutral-100 border-neutral-200 text-gray-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-400"
                      )}
                      title="Edit Car Details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Selection Move Indicator */}
            {isEditMode && (
              <div className="absolute top-1 left-1 z-30 pointer-events-none">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full flex items-center justify-center shadow-md",
                  isSelectedForMove ? "bg-white text-[#FF5C35]" : "bg-[#FF5C35] text-white"
                )}>
                  <ArrowUpDown className={cn("w-1.5 h-1.5 transition-transform", isSelectedForMove ? "rotate-180" : "rotate-0")} />
                </div>
              </div>
            )}

            {/* Main Horizontal Flex container */}
            <div 
              className="h-full flex items-center gap-2 px-2.5 py-1 relative z-10 select-none"
              style={{ width: '282px' }}
            >
              
              {/* 1. Tyre toggler (sun/snowflake) */}
              <button
                onClick={(e) => onTyreToggle(e, String(vehicle.id))}
                className={cn(
                  "rounded flex items-center justify-center shadow-sm shrink-0 hover:opacity-90 transition-opacity cursor-pointer",
                  tyreType === 'winter' 
                    ? "bg-blue-500 text-white" 
                    : "bg-[#FF9F00] text-white"
                )}
                style={{
                  height: '15px',
                  width: '15px',
                  marginTop: '-20px',
                  marginLeft: '-6px'
                }}
              >
                {tyreType === 'winter' ? <Snowflake className="w-2.5 h-2.5 fill-current" /> : <Sun className="w-2.5 h-2.5 fill-current" />}
              </button>

              {/* 2. Transmission badge (M/A) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChassisClick?.(e, vehicle);
                }}
                className={cn(
                  "rounded-full border border-black/15 flex items-center justify-center shadow-sm shrink-0 cursor-pointer font-black hover:opacity-90 transition-opacity",
                  vehicle.transmission === 'Manual'
                    ? "bg-white text-black"
                    : "bg-black text-white"
                )}
                title={vehicle.chassisNumber ? `VIN: ${vehicle.chassisNumber}` : "Click to add VIN"}
                style={{
                  marginTop: '15px',
                  height: '17px',
                  width: '17px',
                  marginLeft: '-24px'
                }}
              >
                <span className="font-black text-[9px] leading-none pb-[0.5px]">
                  {vehicle.transmission === 'Manual' ? 'M' : 'A'}
                </span>
              </button>

              {/* 3. Text block: Tag (e.g. IN BOSNIA) above, and Car name below */}
              <div className="flex-1 min-w-0 flex flex-col justify-center items-start gap-px">
                {isGuestView || (isAwayAndNotReturned && displayedAwayCountry && displayedAwayCountry !== homeCountry) ? (
                  <div 
                    className="relative z-[40] pointer-events-none mb-[1px] shrink-0"
                    style={{ marginLeft: '0px', marginRight: '-10px' }}
                  >
                    <div 
                      className="flex items-center gap-0.5 px-1 py-px rounded-full border text-[6px] font-black tracking-wider uppercase leading-none whitespace-nowrap"
                      style={{
                        borderColor: `${COUNTRY_COLORS[badgeCountry]}50`,
                        color: COUNTRY_COLORS[badgeCountry],
                        backgroundColor: `${COUNTRY_COLORS[badgeCountry]}15`
                      }}
                      title={`Car's home country is ${homeCountry} but is physically in or heading to ${displayedAwayCountry}`}
                    >
                      <MapPin className="w-1.5 h-1.5 shrink-0" />
                      <span>
                        {isGuestView
                          ? `${homeCountry} GUEST` 
                          : `IN ${displayedAwayCountry}`
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Space placeholder to preserve alignment */
                  <div className="h-[9px]" />
                )}

                <div className="w-full min-w-0 flex items-center justify-start" style={{ height: '14px' }}>
                  <h3 
                    className={cn(
                      "uppercase tracking-wide truncate leading-none text-left w-full font-black font-sans",
                      isDarkMode ? "text-white" : "text-[#0E0C0B]"
                    )}
                    style={{
                      fontSize: '12px',
                      lineHeight: '14px',
                      marginLeft: '-5px',
                      width: '140px',
                      marginTop: '-5px'
                    }}
                    title={vehicle.name}
                  >
                    {vehicle.name}
                  </h3>
                </div>
              </div>

              {/* 4. License Plate */}
              <div className="shrink-0 flex items-center">
                <div 
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border-2 shadow-sm shrink-0 relative overflow-hidden",
                    hasViolation(vehicle.plate)
                      ? "bg-red-100 border-red-500 shadow-inner"
                      : "bg-white border-black/30"
                  )}
                  style={{ 
                    width: '95px', 
                    height: '22px',
                    marginLeft: '0px',
                    marginTop: '0px',
                    marginBottom: '0px',
                    marginRight: '-21px'
                  }}
                >
                  {/* EU Left bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-blue-700 rounded-l-[4px]" />
                  
                  {/* Digits with slight spacing */}
                  <span 
                    className="font-mono font-black text-black tracking-wide uppercase leading-none select-all text-center pl-[6px] pr-[10px]"
                    style={{ fontSize: '12px' }}
                  >
                    {vehicle.plate}
                  </span>

                  {/* Color picker box */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onColorClick?.(e, vehicle);
                    }}
                    className="absolute right-0 top-0 bottom-0 flex items-center justify-center cursor-pointer z-10 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                    style={{ 
                      width: '7px',
                      backgroundColor: vehicle.color || 'transparent'
                    }}
                    title={vehicle.color ? `Color: ${MAIN_CAR_COLORS.find(c => c.value === vehicle.color)?.name || vehicle.color} (Click to change)` : "Click to choose color"}
                  >
                    {!vehicle.color && (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 group/colorplus rounded-r-[4px]">
                        <Plus className="w-2 h-2 stroke-[4]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* 5. Status Note Indicator / Interactive button */}
              <div className="shrink-0 flex items-center justify-center w-6 h-6">
                <button
                  onClick={(e) => onStatusClick(e, vehicle)}
                  className={cn(
                    "flex items-center justify-center cursor-pointer rounded-full relative group/brand select-none transition-all",
                    vehicle.statusNote 
                      ? "shadow-md opacity-100" 
                      : isDarkMode
                        ? "opacity-85 border border-neutral-700 shadow-sm"
                        : "opacity-85 border border-[#CCCCCC] shadow-sm"
                  )}
                  style={{
                    width: '20.9931px',
                    height: '20.9931px',
                    marginTop: '0px',
                    marginLeft: '7px',
                    marginRight: '-16px',
                    backgroundColor: vehicle.statusNote ? (vehicle.statusColor || '#FF5C35') : '#FFFFFF'
                  }}
                >
                  {/* Full tooltip */}
                  {vehicle.statusNote && (
                    <div className={cn(
                      "absolute left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl text-[10px] font-black shadow-lg opacity-0 group-hover/brand:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-normal min-w-[140px] max-w-[220px] z-[99999] border text-center uppercase tracking-wide",
                      isFirstRow ? "top-full mt-2" : "bottom-full mb-2",
                      isDarkMode ? "border-white/10" : "border-black/5"
                    )}
                    style={{
                      backgroundColor: vehicle.statusColor || '#FF5C35',
                      color: getTextColorForBg(vehicle.statusColor || '#FF5C35')
                    }}
                    >
                      <div className="relative">
                        {vehicle.statusNote}
                        <div className={cn(
                          "absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent",
                          isFirstRow ? "-top-[12px] border-b-[6px]" : "-bottom-[12px] border-t-[6px]"
                        )} 
                        style={isFirstRow ? { borderBottomColor: vehicle.statusColor || '#FF5C35' } : { borderTopColor: vehicle.statusColor || '#FF5C35' }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              </div>

            </div>
          </>
        )}
      </div>

      <div className={cn(
        "flex-1 relative z-10 min-w-0",
        isDarkMode ? "bg-[#1A1614]/20" : "bg-white/40"
      )}>
        <div className={cn(
          "flex w-full px-1 py-1 relative h-full items-center translate-z-0 ml-[-5px]",
          !showFocusBlur && "gap-0.5"
        )}>
          {calendarDays.map((day, idx) => {
            const isNewMonth = idx > 0 && day.date.getMonth() !== calendarDays[idx-1].date.getMonth();
            const isExtraRow = vehicle.name === 'EXTRA' || vehicle.isExtra || String(vehicle.id).startsWith('extra-');
            
            return (
              <React.Fragment key={day.date.getTime()}>
                {isNewMonth && <MonthDivider monthName={MONTHS[day.date.getMonth()]} isDarkMode={isDarkMode} showFocusBlur={showFocusBlur} />}
                <DayCell 
                  day={day} 
                  isDarkMode={isDarkMode} 
                  carBooking={carBooking} 
                  showFocusBlur={showFocusBlur}
                  isFirstRow={isFirstRow}
                  onHover={onHoverDay}
                  onLeave={onLeaveDay}
                  isSelectionEnabled={isSelectionEnabled}
                  isRelocationMode={isRelocationMode}
                  isSelected={selectionStart?.carId === vehicle.id && isSameDay(selectionStart.date, day.date)}
                  onClick={() => onGridClick(vehicle.id, day)}
                  isEditMode={isEditMode}
                  onReservationSelect={onReservationSelect}
                  reservationIdToSwap={reservationIdToSwap}
                  reservationToMoveId={reservationToMoveId}
                  isExtraRow={isExtraRow}
                  isExtraCancelMode={isExtraCancelMode}
                  onCancelBooking={onCancelBooking}
                  fleetSearch={fleetSearch}
                  onOverdueClick={onOverdueClick}
                  todayMidnightMs={todayMidnightMs}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
});

CarRow.displayName = 'CarRow';

interface SearchInputProps {
  isDarkMode: boolean;
  onSearch: (value: string) => void;
  initialValue: string;
}

const SearchInput: React.FC<SearchInputProps> = React.memo(({ isDarkMode, onSearch, initialValue }) => {
  const [localValue, setLocalValue] = useState(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(localValue);
    }, 40);
    return () => clearTimeout(handler);
  }, [localValue, onSearch]);

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input 
        type="text"
        placeholder="Search active bookings..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className={cn(
          "w-full pl-11 pr-4 py-2 rounded-xl border-2 transition-all outline-none font-bold text-sm",
          isDarkMode 
            ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
            : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
        )}
      />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

const getPlateColorByPlate = (plateStr: string, vehiclesList: Vehicle[]) => {
  if (!plateStr || !vehiclesList) return null;
  const clean = plateStr.replace(/\s+/g, '').toUpperCase();
  const found = vehiclesList.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
  return found?.color || null;
};

export default function Reservations({ 
  isDarkMode, 
  sidebarColor, 
  userReservations, 
  dbVehicles, 
  currentSystemTime,
  reservationFilter,
  setReservationFilter,
  isDataLoading = false
}: ReservationsProps) {
  const { violations = [] } = useAppState();
  const [currentDate, setCurrentDate] = useState(new Date()); // Current month and year
  const todayMidnightMs = useMemo(() => {
    const today = currentSystemTime || new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  }, [currentSystemTime]);

  const violationPlatesSet = useMemo(() => {
    const set = new Set<string>();
    (violations || []).forEach(v => {
      if (v.status === 'waiting' && v.plate) {
        set.add(v.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase());
      }
    });
    return set;
  }, [violations]);

  // Fast pre-indexed lookup map for vehicle -> client names to make searching instant
  const vehicleClientNamesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (userReservations || []).forEach(r => {
      if (r.status !== 'CANCELLED' && r.vehicleId && r.name) {
        const vId = String(r.vehicleId);
        let list = map.get(vId);
        if (!list) {
          list = [];
          map.set(vId, list);
        }
        list.push(r.name.toLowerCase());
      }
    });
    return map;
  }, [userReservations]);
  const [escalatorOffsetDays, setEscalatorOffsetDays] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [reservationToComplete, setReservationToComplete] = useState<any | null>(null);
  const [isExtraCancelMode, setIsExtraCancelMode] = useState(false);
  const handleToggleExtraCancelMode = useCallback(() => {
    setIsExtraCancelMode(prev => !prev);
  }, []);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [modalMode, setModalMode] = useState<'full' | 'dates'>('full');
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dbVehicles.forEach(v => {
      const isExtra = v.isExtra || v.name === 'EXTRA' || String(v.id).startsWith('extra-');
      if (!v.isRetired && !isExtra) {
        const country = v.country || 'Macedonia';
        counts[country] = (counts[country] || 0) + 1;
      }
    });
    return counts;
  }, [dbVehicles]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionMenuCoords, setActionMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [countriesPopupId, setCountriesPopupId] = useState<string | null>(null);
  const [countriesPopupCoords, setCountriesPopupCoords] = useState<{ top: number; left: number } | null>(null);
  const [hoveredCountriesId, setHoveredCountriesId] = useState<string | null>(null);
  const [hoveredCountriesCoords, setHoveredCountriesCoords] = useState<{ top: number; left: number } | null>(null);
  
  // Custom Audit Log Hover States
  const [hoveredAuditId, setHoveredAuditId] = useState<string | null>(null);
  const [hoveredAuditCoords, setHoveredAuditCoords] = useState<{ top: number; left: number; align?: 'left' | 'right' } | null>(null);
  const [auditLogsMap, setAuditLogsMap] = useState<Record<string, { logs: any[], loading: boolean, error?: string }>>({});
  const [editedReservationIds, setEditedReservationIds] = useState<Set<string>>(new Set());
  const [nonStatusEditIds, setNonStatusEditIds] = useState<Set<string>>(new Set());
  const lastFetchedTimeportsRef = useRef<Record<string, number>>({});
  const [auditAdjustY, setAuditAdjustY] = useState(0);

  useEffect(() => {
    if (!hoveredAuditId) {
      setAuditAdjustY(0);
    }
  }, [hoveredAuditId]);

  const currentAuditLogState = auditLogsMap[hoveredAuditId || ''];
  const auditLogsLength = currentAuditLogState?.logs?.filter((log: any) => {
    if (log.action === 'status_changed') return false;
    if (log.changedFields) {
      const keys = Object.keys(log.changedFields).filter(k => k !== 'status' && k !== 'uploadedDocuments');
      return keys.length > 0;
    }
    return true;
  })?.length || 0;
  const auditLogsLoading = currentAuditLogState?.loading || false;

  const auditPanelRef = useCallback((node: HTMLDivElement | null) => {
    if (node && hoveredAuditCoords) {
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const topOffset = hoveredAuditCoords.top - (rect.height / 2);
      const bottomOffset = hoveredAuditCoords.top + (rect.height / 2);

      let adjust = 0;
      if (topOffset < 16) {
        adjust = 16 - topOffset;
      } else if (bottomOffset > viewportHeight - 16) {
        adjust = (viewportHeight - 16) - bottomOffset;
      }
      
      if (Math.abs(adjust - auditAdjustY) > 1) {
        setAuditAdjustY(adjust);
      }
    }
  }, [hoveredAuditCoords, auditAdjustY, auditLogsLength, auditLogsLoading]);

  useEffect(() => {
    let isMounted = true;
    const fetchAuditSummary = async () => {
      try {
        const q = collection(db, 'auditLogs');
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const ids = new Set<string>();
        const nonStatusIds = new Set<string>();
        
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const resId = data.reservationId || docSnap.id;
          if (resId) {
            ids.add(String(resId));
            if (data.hasNonStatusEdits === true) {
              nonStatusIds.add(String(resId));
            }
          }
        });
        
        setNonStatusEditIds(nonStatusIds);
        setEditedReservationIds(ids);
      } catch (err) {
        console.error("Failed to fetch audit logs on mount:", err);
      }
    };

    fetchAuditSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuditClick = (e: React.MouseEvent, resId: string) => {
    e.stopPropagation();
    if (hoveredAuditId === resId) {
      setHoveredAuditId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const fitsOnRight = rect.right + 450 < window.innerWidth;
      setAuditAdjustY(0); // Reset position offset on new click
      setHoveredAuditCoords({
        top: rect.top + rect.height / 2,
        left: fitsOnRight ? rect.right : rect.left,
        align: fitsOnRight ? 'right' : 'left'
      });
      setHoveredAuditId(resId);
    }
  };

  useEffect(() => {
    if (!hoveredAuditId) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.audit-log-panel') &&
        !target.closest('.audit-log-btn')
      ) {
        setHoveredAuditId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [hoveredAuditId]);

  useEffect(() => {
    if (!hoveredAuditId) return;

    setAuditLogsMap(prev => {
      if (prev[hoveredAuditId] && prev[hoveredAuditId].logs.length > 0) {
        return prev;
      }
      return {
        ...prev,
        [hoveredAuditId]: { logs: [], loading: true }
      };
    });

    const fetchAuditHistory = async () => {
      try {
        const q = collection(db, 'auditLogs', hoveredAuditId, 'changes');
        const snapshot = await getDocs(q);
        const fetchedLogs = snapshot.docs.map(doc => {
          const data = doc.data();
          let formattedTime = '';
          if (data.timestamp) {
            const t = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
            formattedTime = format(t, 'yyyy-MM-dd HH:mm:ss');
          }
          return {
            id: doc.id,
            ...data,
            formattedTime,
            jsTimestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : Date.now())
          };
        });

        // Sort client-side descending by timestamp to keep recent ones first without requiring composite index
        fetchedLogs.sort((a, b) => b.jsTimestamp - a.jsTimestamp);

        setAuditLogsMap(prev => ({
          ...prev,
          [hoveredAuditId]: { logs: fetchedLogs, loading: false }
        }));
      } catch (err: any) {
        console.error("Failed to fetch audit logs:", err);
        let errMsg = err?.message || String(err);
        setAuditLogsMap(prev => ({
          ...prev,
          [hoveredAuditId]: { logs: [], loading: false, error: errMsg }
        }));
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          handleFirestoreError(err, OperationType.LIST, `auditLogs/${hoveredAuditId}/changes`);
        }
      }
    };

    fetchAuditHistory();
  }, [hoveredAuditId]);

  const [isAddCarModalOpen, setIsAddCarModalOpen] = useState(false);
  const [fleetSearch, setFleetSearch] = useState('');
  const [debouncedFleetSearch, setDebouncedFleetSearch] = useState('');
  const [freeTodayOnly, setFreeTodayOnly] = useState(false);
  const [returningTodayOnly, setReturningTodayOnly] = useState(false);

  // Debounce fleetSearch input for butter-smooth, practically instant UI filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFleetSearch(fleetSearch);
    }, 40);
    return () => clearTimeout(timer);
  }, [fleetSearch]);

  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusCoords, setStatusCoords] = useState<{ top: number; left: number } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [statusColor, setStatusColor] = useState('#FFFFFF');

  const [editingChassisId, setEditingChassisId] = useState<string | null>(null);
  const [isEditingChassis, setIsEditingChassis] = useState(false);
  const [chassisCoords, setChassisCoords] = useState<{ top: number; left: number } | null>(null);
  const [chassisInput, setChassisInput] = useState('');

  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorCoords, setColorCoords] = useState<{ top: number; left: number } | null>(null);

  const handleColorClick = useCallback((e: React.MouseEvent, car: Vehicle) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setColorCoords({
      top: rect.top,
      left: rect.left + (rect.width / 2)
    });
    setEditingColorId(String(car.id));
  }, []);

  const handleSaveColor = async (selectedColor: string) => {
    if (!editingColorId) return;
    try {
      await updateDoc(doc(db, 'vehicles', String(editingColorId)), {
        color: selectedColor,
        updatedAt: Date.now()
      });
      setEditingColorId(null);
    } catch (err: unknown) {
      console.error("Error saving vehicle color:", err);
    }
  };

  const handleSaveChassis = async () => {
    if (!editingChassisId) return;
    try {
      await updateDoc(doc(db, 'vehicles', String(editingChassisId)), {
        chassisNumber: chassisInput.toUpperCase(),
        updatedAt: Date.now()
      });
      setEditingChassisId(null);
      setIsEditingChassis(false);
      setChassisInput('');
    } catch (err: unknown) {
      console.error("Error saving chassis number:", err);
    }
  };

  const handleChassisClick = useCallback((e: React.MouseEvent, car: Vehicle) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // The fixed container uses viewport coordinates.
    // We want the tooltip centered on the icon.
    setChassisCoords({ 
      top: rect.top, 
      left: rect.left + (rect.width / 2) 
    });
    setEditingChassisId(String(car.id));
    setChassisInput(car.chassisNumber || '');
    // If it has no chassis number, start in edit mode
    setIsEditingChassis(!car.chassisNumber);
  }, []);

  const handleSaveStatus = useCallback(async (note: string, color: string) => {
    if (!editingStatusId) return;
    try {
      await updateDoc(doc(db, 'vehicles', String(editingStatusId)), {
        statusNote: note,
        statusColor: color,
        updatedAt: Date.now()
      });
      setEditingStatusId(null);
    } catch (err: unknown) {
      console.error("Error updating status:", err);
    }
  }, [editingStatusId]);

  const handleResetStatus = useCallback(async () => {
    if (!editingStatusId) return;
    try {
      await updateDoc(doc(db, 'vehicles', String(editingStatusId)), {
        statusNote: '',
        statusColor: '#FFFFFF',
        updatedAt: Date.now()
      });
      setEditingStatusId(null);
    } catch (err: unknown) {
      console.error("Error resetting status:", err);
    }
  }, [editingStatusId]);

  const handleStatusClick = useCallback((e: React.MouseEvent, car: Vehicle) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Adjusted to show near the icon
    setStatusCoords({ top: rect.bottom + 10, left: rect.left - 100 });
    setEditingStatusId(String(car.id));
    setStatusNote(car.statusNote || '');
    setStatusColor(car.statusColor || '#FFFFFF');
  }, []);

  const [activeCountry, setActiveCountry] = useState<string>('Macedonia');
  const [showFocusBlur, setShowFocusBlur] = useState(true);
  const [isIncomingFleetOpen, setIsIncomingFleetOpen] = useState(false);
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [selectedDocReservationId, setSelectedDocReservationId] = useState<string | null>(null);
  const [tyreTypes, setTyreTypes] = useState<Record<number | string, 'summer' | 'winter'>>({});
  
  interface TransformedBooking extends Reservation {
    client: string;
    vehicle: string;
    plate: string;
    vehicleCountry?: string;
    rawStart: Date;
    rawEnd: Date;
    price: string;
  }

  const [cashflowPopupId, setCashflowPopupId] = useState<string | null>(null);
  const [cashflowPopupCoords, setCashflowPopupCoords] = useState<{ top: number; left: number } | null>(null);
  const [cashflowPaymentSummary, setCashflowPaymentSummary] = useState<string>('');
  const [isCashflowSending, setIsCashflowSending] = useState(false);
  const [sentCashflowIds, setSentCashflowIds] = useState<string[]>([]);
  const [cashflowHandledBy, setCashflowHandledBy] = useState<string>('');
  const [cashflowNote, setCashflowNote] = useState('');
  const [cashflowFile, setCashflowFile] = useState<File | null>(null);

  const handleCloseCashflowPopup = () => {
    setCashflowPopupId(null);
    setCashflowHandledBy('');
    setCashflowNote('');
    setCashflowFile(null);
  };

  const fetchPaymentSummary = async (reservationId: string) => {
    try {
      const q = query(
        collection(db, 'reservations', reservationId, 'paymentHistory'),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => doc.data() as Payment);
      
      const totals = history.reduce((acc: Record<string, number>, curr: Payment) => {
        acc[curr.method] = (acc[curr.method] || 0) + curr.amount;
        return acc;
      }, {} as Record<string, number>);

      const summary = Object.entries(totals)
        .map(([method, total]) => `${total}€ ${method}`)
        .join(' | ');
      
      setCashflowPaymentSummary(summary || '0€ (No payments)');
    } catch (error) {
      console.error("Error fetching payment summary for Cashflow:", error);
      setCashflowPaymentSummary('Error fetching info');
    }
  };

  const handleCashflowNotify = async (booking: TransformedBooking | Reservation) => {
    if (!cashflowHandledBy) {
      alert("Please enter who handled the payment.");
      return;
    }
    setIsCashflowSending(true);
    try {
      const vehicleId = booking.vehicleId;
      const vehicle = dbVehicles.find((v: Vehicle) => String(v.id) === String(vehicleId));
      
      const vehicleName = (vehicle?.name || 'N/A').toUpperCase();
      const plate = (vehicle?.plate || '').toUpperCase();
      
      const clientName = ((booking as { client?: string; name?: string }).client || (booking as { client?: string; name?: string }).name || 'N/A').toUpperCase();
      
      const durationStr = String(booking.days);
      const duration = durationStr.replace('d', '');

      let hasReceipt = false;
      let receiptImageUrl = '';

      if (cashflowFile) {
        try {
          const storagePath = `receipt_documents/${booking.id}/${cashflowFile.name}`;
          const storageRef = ref(storage, storagePath);
          
          await uploadBytes(storageRef, cashflowFile);
          receiptImageUrl = await getDownloadURL(storageRef);
          hasReceipt = true;
        } catch (uploadError) {
          console.error("Failed to upload cashflow file to Storage:", uploadError);
          throw new Error("Failed to upload receipt image to Storage. Please check your storage rules / connection.");
        }
      }

      let canonicalPaymentMethod = 'cash';
      let exactCashAmount = 0;
      let exactCardAmount = 0;
      try {
        const historyQuery = query(
          collection(db, 'reservations', String(booking.id), 'paymentHistory'),
          orderBy('timestamp', 'desc')
        );
        const historySnapshot = await getDocs(historyQuery);
        const historyDocs = historySnapshot.docs.map(doc => doc.data() as Payment);
        
        historyDocs.forEach(p => {
          const amt = Number(p.amount) || 0;
          const method = String(p.method || 'Cash').toLowerCase();
          if (method === 'card') {
            exactCardAmount += amt;
          } else {
            exactCashAmount += amt;
          }
        });

        const hasCash = exactCashAmount > 0;
        const hasCard = exactCardAmount > 0;
        if (hasCash && hasCard) {
          canonicalPaymentMethod = 'cash/card';
        } else if (hasCard) {
          canonicalPaymentMethod = 'card';
        } else {
          canonicalPaymentMethod = 'cash';
        }
      } catch (historyErr) {
        console.warn("Failed to fetch paymentHistory, parsing cashflowPaymentSummary fallback:", historyErr);
        if (cashflowPaymentSummary) {
          const upper = cashflowPaymentSummary.toUpperCase();
          if ((upper.includes('CASH') && upper.includes('CARD')) || upper.includes('SPLIT')) {
            canonicalPaymentMethod = 'cash/card';
          } else if (upper.includes('CARD')) {
            canonicalPaymentMethod = 'card';
          }
        }
      }

      const nowTs = Date.now();
      try {
        await updateDoc(doc(db, 'reservations', String(booking.id)), {
          cashflowNotificationSent: true,
          slackSentAt: (booking as any).slackSentAt || nowTs,
          sentToCashflowAt: (booking as any).sentToCashflowAt || nowTs,
          cashflowHandledBy: cashflowHandledBy.toUpperCase(),
          paidTo: cashflowHandledBy.toUpperCase(),
          cashflowNote: cashflowNote.trim().toUpperCase(),
          paymentMethod: canonicalPaymentMethod,
          cashAmount: exactCashAmount,
          cardAmount: exactCardAmount,
          fromLocation: booking.fromLocation || '',
          toLocation: booking.toLocation || ''
        });

        // Extract raw dates or format safely we can pass directly to Firestore
        const getRawDate = (d: any) => {
          if (!d) return '';
          if (d instanceof Date) return d.toISOString();
          if (typeof d === 'object' && typeof d.toDate === 'function') {
            try {
              return d.toDate().toISOString();
            } catch (e) {
              return '';
            }
          }
          return String(d);
        };

        const startVal = (booking as any).rawStart ? getRawDate((booking as any).rawStart) : getRawDate(booking.start);
        const endVal = (booking as any).rawEnd ? getRawDate((booking as any).rawEnd) : getRawDate(booking.end);

        // Add doc to the new dedicated cashflow collection
        await setDoc(doc(db, 'cashflow', String(booking.id)), {
          reservationId: String(booking.id),
          name: clientName,
          vehicleId: booking.vehicleId,
          days: booking.days,
          totalPrice: booking.totalPrice,
          amountPaid: booking.amountPaid || 0,
          cashAmount: exactCashAmount,
          cardAmount: exactCardAmount,
          paidTo: cashflowHandledBy.toUpperCase(),
          cashflowHandledBy: cashflowHandledBy.toUpperCase(),
          cashflowNote: cashflowNote.trim().toUpperCase(),
          paymentMethod: canonicalPaymentMethod,
          receiptUrl: receiptImageUrl,
          slackSentAt: (booking as any).slackSentAt || nowTs,
          sentToCashflowAt: (booking as any).sentToCashflowAt || nowTs,
          createdAt: nowTs,
          isPaid: false,
          start: startVal,
          end: endVal,
          arrivalTime: booking.arrivalTime || '',
          departureTime: booking.departureTime || '',
          fromLocation: booking.fromLocation || '',
          toLocation: booking.toLocation || '',
          processedBy: booking.processedBy || ''
        });
      } catch (dbError) {
        console.error("Firestore update failed:", dbError);
        throw new Error("Updating reservation and creating cashflow record failed. Please verify database connectivity.");
      }

      setSentCashflowIds(prev => [...prev, booking.id]);
      handleCloseCashflowPopup();
    } catch (error) {
       console.error("Error sending to Cashflow:", error);
       alert("Failed to send notification to Cashflow.");
    } finally {
      setIsCashflowSending(false);
    }
  };

  const [isSelectionEnabled, setIsSelectionEnabled] = useState(false);
  const [isRelocationMode, setIsRelocationMode] = useState(false);
  const [isCarLocationMode, setIsCarLocationMode] = useState(false);
  const [selectedCarForLocationUpdate, setSelectedCarForLocationUpdate] = useState<Vehicle | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ carId: number | string, date: Date } | null>(null);

  const handleCarLocationClick = useCallback((car: Vehicle) => {
    if (car.name === 'EXTRA' || String(car.id).startsWith('extra-')) {
      return;
    }
    setSelectedCarForLocationUpdate(car);
  }, []);

  const handleRelocateCar = async (targetCountry: string | null) => {
    if (!selectedCarForLocationUpdate) return;
    try {
      await updateDoc(doc(db, 'vehicles', String(selectedCarForLocationUpdate.id)), {
        forcedPhysicalCountry: targetCountry,
        status: 'AVAILABLE',
        updatedAt: Date.now()
      });
      setSelectedCarForLocationUpdate(null);
      setIsCarLocationMode(false);
    } catch (err: unknown) {
      console.error("Error relocating vehicle:", err);
      alert("Failed to relocate vehicle in Firestore. Please try again.");
    }
  };

  const handleOverdueClick = useCallback((resId: string) => {
    const res = userReservations.find(r => String(r.id) === String(resId));
    if (res) {
      setEditingReservation(res);
      setModalMode('full');
      setIsModalOpen(true);
    }
  }, [userReservations]);

  const [carIdToMove, setCarIdToMove] = useState<number | string | null>(null);
  const [reservationIdToSwap, setReservationIdToSwap] = useState<string | null>(null);
  const [reservationToMove, setReservationToMove] = useState<Reservation | null>(null);

  const handleReservationSelect = useCallback(async (resId: string) => {
    if (!isEditMode) return;
    
    if (!reservationIdToSwap) {
      setReservationIdToSwap(resId);
    } else {
      if (resId === reservationIdToSwap) {
        setReservationIdToSwap(null);
        return;
      }

      const resA = userReservations.find(r => String(r.id) === String(reservationIdToSwap));
      const resB = userReservations.find(r => String(r.id) === String(resId));

      if (!resA || !resB) {
        setReservationIdToSwap(null);
        return;
      }

      // Check collision for resA moving to resB's car
      const collidingA = userReservations.some(r => {
        if (
          r.id === resA.id || 
          r.id === resB.id || 
          String(r.vehicleId) !== String(resB.vehicleId) || 
          r.status === 'CANCELLED' ||
          r.status === 'COMPLETED'
        ) {
          return false;
        }
        const startA = new Date(resA.start); startA.setHours(0,0,0,0);
        const endA = new Date(resA.end); endA.setHours(0,0,0,0);
        const startR = new Date(r.start); startR.setHours(0,0,0,0);
        const endR = new Date(r.end); endR.setHours(0,0,0,0);

        const overlapStart = startA > startR ? startA : startR;
        const overlapEnd = endA < endR ? endA : endR;
        if (overlapStart > overlapEnd) {
          return false; // No overlap at all
        }

        const isOverlapExactlyOneDay = isSameDay(overlapStart, overlapEnd);
        if (isOverlapExactlyOneDay) {
          const overlapDay = overlapStart;
          const isValidCase1 = isSameDay(endR, overlapDay) && isSameDay(startA, overlapDay);
          const isValidCase2 = isSameDay(startR, overlapDay) && isSameDay(endA, overlapDay);
          if (isValidCase1 || isValidCase2) {
            return false; // Allowed handover
          }
        }
        return true; // Any other overlap is a clash
      });

      // Check collision for resB moving to resA's car
      const collidingB = userReservations.some(r => {
        if (
          r.id === resB.id || 
          r.id === resA.id || 
          String(r.vehicleId) !== String(resA.vehicleId) || 
          r.status === 'CANCELLED' ||
          r.status === 'COMPLETED'
        ) {
          return false;
        }
        const startB = new Date(resB.start); startB.setHours(0,0,0,0);
        const endB = new Date(resB.end); endB.setHours(0,0,0,0);
        const startR = new Date(r.start); startR.setHours(0,0,0,0);
        const endR = new Date(r.end); endR.setHours(0,0,0,0);

        const overlapStart = startB > startR ? startB : startR;
        const overlapEnd = endB < endR ? endB : endR;
        if (overlapStart > overlapEnd) {
          return false; // No overlap at all
        }

        const isOverlapExactlyOneDay = isSameDay(overlapStart, overlapEnd);
        if (isOverlapExactlyOneDay) {
          const overlapDay = overlapStart;
          const isValidCase1 = isSameDay(endR, overlapDay) && isSameDay(startB, overlapDay);
          const isValidCase2 = isSameDay(startR, overlapDay) && isSameDay(endB, overlapDay);
          if (isValidCase1 || isValidCase2) {
            return false; // Allowed handover
          }
        }
        return true; // Any other overlap is a clash
      });

      if (collidingA || collidingB) {
        alert("Cannot swap: One of the reservations would collide with a third booking on the target car.");
        setReservationIdToSwap(null);
        return;
      }

      try {
        const changedByEmail = auth.currentUser?.email || 'admin@momo.com';

        const carA = dbVehicles.find((v: any) => String(v.id) === String(resB.vehicleId));
        const carB = dbVehicles.find((v: any) => String(v.id) === String(resA.vehicleId));

        const isCarAExtra = carA && (carA.isExtra || carA.name === 'EXTRA' || String(carA.id).startsWith('extra-'));
        const updateA: Record<string, any> = {
          vehicleId: resB.vehicleId,
          updatedAt: Date.now()
        };
        if (isCarAExtra && carA && carA.plate) {
          updateA.snapshotExtraPlate = carA.plate;
          updateA.snapshotExtraName = carA.extraName || 'EXTRA';
        } else {
          updateA.snapshotExtraPlate = '';
          updateA.snapshotExtraName = '';
        }

        const isCarBExtra = carB && (carB.isExtra || carB.name === 'EXTRA' || String(carB.id).startsWith('extra-'));
        const updateB: Record<string, any> = {
          vehicleId: resA.vehicleId,
          updatedAt: Date.now()
        };
        if (isCarBExtra && carB && carB.plate) {
          updateB.snapshotExtraPlate = carB.plate;
          updateB.snapshotExtraName = carB.extraName || 'EXTRA';
        } else {
          updateB.snapshotExtraPlate = '';
          updateB.snapshotExtraName = '';
        }

        await Promise.all([
          updateDoc(doc(db, 'reservations', resA.id), updateA),
          updateDoc(doc(db, 'reservations', resB.id), updateB),
        // Audit Log for resA
        setDoc(doc(db, 'auditLogs', String(resA.id)), {
          reservationId: String(resA.id),
          updatedAt: serverTimestamp(),
          hasNonStatusEdits: true
        }, { merge: true }),
        addDoc(collection(db, 'auditLogs', String(resA.id), 'changes'), {
          reservationId: String(resA.id),
          changedBy: changedByEmail,
          timestamp: serverTimestamp(),
          action: 'booking_details_changed',
          changedFields: {
            vehicleId: {
              oldValue: resA.vehicleId !== undefined ? resA.vehicleId : null,
              newValue: resB.vehicleId !== undefined ? resB.vehicleId : null
            }
          }
        }),
        // Audit Log for resB
        setDoc(doc(db, 'auditLogs', String(resB.id)), {
          reservationId: String(resB.id),
          updatedAt: serverTimestamp(),
          hasNonStatusEdits: true
        }, { merge: true }),
        addDoc(collection(db, 'auditLogs', String(resB.id), 'changes'), {
          reservationId: String(resB.id),
          changedBy: changedByEmail,
          timestamp: serverTimestamp(),
          action: 'booking_details_changed',
          changedFields: {
            vehicleId: {
              oldValue: resB.vehicleId !== undefined ? resB.vehicleId : null,
              newValue: resA.vehicleId !== undefined ? resA.vehicleId : null
            }
          }
        })
      ]);
      setEditedReservationIds(prev => {
        const next = new Set(prev);
        next.add(String(resA.id));
        next.add(String(resB.id));
        return next;
      });
      setNonStatusEditIds(prev => {
        const next = new Set(prev);
        next.add(String(resA.id));
        next.add(String(resB.id));
        return next;
      });
      setReservationIdToSwap(null);
      } catch (err) {
        console.error("Error swapping reservations:", err);
      }
    }
  }, [isEditMode, reservationIdToSwap, userReservations]);

  const handleCarSelect = useCallback(async (carId: number | string) => {
    if (!isEditMode) return;
    
    if (!carIdToMove) {
      setCarIdToMove(carId);
    } else {
      if (carId === carIdToMove) {
        setCarIdToMove(null);
        return;
      }

      // Perform SWAP logic
      const currentList = [...dbVehicles]
        .filter((v: Vehicle) => !v.isRetired && (v.country || 'Macedonia') === activeCountry)
        .sort((a, b) => {
          const isExtraA = !!(a.isExtra || a.name === 'EXTRA' || String(a.id).startsWith('extra-'));
          const isExtraB = !!(b.isExtra || b.name === 'EXTRA' || String(b.id).startsWith('extra-'));
          if (isExtraA && !isExtraB) return 1;
          if (!isExtraA && isExtraB) return -1;

          const orderA = a.displayOrder ?? (typeof a.id === 'number' ? a.id : 0);
          const orderB = b.displayOrder ?? (typeof b.id === 'number' ? b.id : 0);
          if (orderA !== orderB) return orderA - orderB;
          return String(a.id).localeCompare(String(b.id));
        });
      
      const sourceCar = currentList.find(v => String(v.id) === String(carIdToMove));
      const targetCar = currentList.find(v => String(v.id) === String(carId));

      if (!sourceCar || !targetCar) {
        setCarIdToMove(null);
        return;
      }

      // Use current sort keys for swapping
      let sourceOrder = sourceCar.displayOrder ?? (typeof sourceCar.id === 'number' ? sourceCar.id : 0);
      let targetOrder = targetCar.displayOrder ?? (typeof targetCar.id === 'number' ? targetCar.id : 0);

      // If they are exactly the same (e.g. both 0), we must force a difference to swap
      if (sourceOrder === targetOrder) {
        sourceOrder = currentList.indexOf(sourceCar);
        targetOrder = currentList.indexOf(targetCar);
      }

      try {
        await Promise.all([
          updateDoc(doc(db, 'vehicles', String(sourceCar.id)), { 
            displayOrder: targetOrder, 
            updatedAt: Date.now() 
          }),
          updateDoc(doc(db, 'vehicles', String(targetCar.id)), { 
            displayOrder: sourceOrder, 
            updatedAt: Date.now() 
          })
        ]);
        setCarIdToMove(null);
      } catch (err) {
        console.error("Error swapping vehicles:", err);
      }
    }
  }, [isEditMode, carIdToMove, dbVehicles, activeCountry]);

  const toggleTyre = useCallback((e: React.MouseEvent, vehicleId: number | string) => {
    e.stopPropagation();
    setTyreTypes(prev => ({
      ...prev,
      [vehicleId]: (prev[vehicleId] === 'winter' ? 'summer' : 'winter') as 'summer' | 'winter'
    }));
  }, []);

  const incomingFleetCount = useMemo(() => {
    return dbVehicles.filter(v => {
      const isExtra = v.isExtra || v.name === 'EXTRA' || String(v.id).startsWith('extra-');
      if (v.isRetired || isExtra) return false;
      const homeCountry = v.country || 'Macedonia';
      if (homeCountry === activeCountry) return false;

      return userReservations.some(r => 
        String(r.vehicleId) === String(v.id) && 
        (r.status === 'UPCOMING' || r.status === 'ON RENT') &&
        r.toLocation?.toLowerCase().includes(activeCountry.toLowerCase())
      );
    }).length;
  }, [dbVehicles, userReservations, activeCountry]);

  const [selectedClientBooking, setSelectedClientBooking] = useState<null | {
    id: string;
    client: string;
    email?: string;
    phone?: string;
    vehicleCountry?: string;
    vehicle: string;
    plate: string;
    chassisNumber?: string;
    passportId?: string;
    driverLicenseId?: string;
    start: string;
    end: string;
    days: string | number;
    price: string | number;
    status: string;
    statusColor?: string;
    processedBy?: string;
    fromLocation?: string;
    toLocation?: string;
    countries?: string[];
    note?: string;
    wasActive?: boolean;
    carColor?: string;
  }>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedSeal, setSelectedSeal] = useState<'momo' | 'skp' | 'go' | 'ks' | 'alb' | null>(null);

  // Reset selected seal when the selection changes or modal is closed
  useEffect(() => {
    setSelectedSeal(null);
  }, [selectedClientBooking]);

  const handleDownloadPDF = async () => {
    if (!selectedClientBooking) return;
    const element = document.getElementById('booking-print-card');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: isDarkMode ? '#1A1614' : '#F2EFE9',
        ignoreElements: (el) => {
          return el.classList.contains('no-print') || el.tagName === 'BUTTON';
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const pdfWidth = 210;
      const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      const sanitizedClientName = selectedClientBooking.client.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Reservation_${sanitizedClientName}_${selectedClientBooking.id}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleHoverDay = useCallback((e: React.MouseEvent, dayBookings: DayBooking[], isFirstRow: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('show-booking-tooltip', {
        detail: {
          bookings: dayBookings,
          x: rect.left + rect.width / 2,
          y: isFirstRow ? rect.bottom : rect.top,
          isFirstRow
        }
      }));
    }
  }, []);

  const handleLeaveDay = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hide-booking-tooltip'));
    }
  }, []);

  const [extraDetailsModal, setExtraDetailsModal] = useState<{
    isOpen: boolean;
    vehicle: Vehicle | null;
    coords: { top: number; left: number; isAbove?: boolean } | null;
  }>({
    isOpen: false,
    vehicle: null,
    coords: null
  });

  const handleOpenExtraDetails = useCallback((vehicle: Vehicle, coords: { top: number; left: number; isAbove?: boolean }) => {
    setExtraDetailsModal({
      isOpen: true,
      vehicle,
      coords
    });
  }, []);

  const handleCloseExtraDetails = useCallback(() => {
    setExtraDetailsModal(prev => ({ ...prev, isOpen: false, coords: null }));
  }, []);

  const uncompletedReservationsForExtra = useMemo(() => {
    if (!extraDetailsModal.vehicle) return [];
    return userReservations.filter(r => 
      String(r.vehicleId) === String(extraDetailsModal.vehicle?.id) && 
      r.status !== 'CANCELLED' && 
      r.status !== 'COMPLETED'
    );
  }, [userReservations, extraDetailsModal.vehicle]);

  const [noteCoords, setNoteCoords] = useState<{ top: number; left: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close note on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (editingNoteId) setEditingNoteId(null);
      if (actionMenuId) setActionMenuId(null);
      if (countriesPopupId) setCountriesPopupId(null);
      if (hoveredCountriesId) setHoveredCountriesId(null);
      if (hoveredAuditId) setHoveredAuditId(null);
    };
    const currentList = listRef.current;
    if (currentList) {
      currentList.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (currentList) {
        currentList.removeEventListener('scroll', handleScroll);
      }
    };
  }, [editingNoteId, actionMenuId, countriesPopupId, hoveredCountriesId, hoveredAuditId]);

  const getLocationColor = (location: string | undefined, isDarkMode: boolean) => {
    if (!location) return isDarkMode ? "text-gray-400" : "text-gray-600";
    const loc = location.toUpperCase();
    if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA')) return "text-[#64BC61]";
    if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO')) return isDarkMode ? "text-blue-400" : "text-blue-600";
    if (loc.includes('TIRANA') || loc.includes('ALBANIA')) return isDarkMode ? "text-gray-400" : "text-gray-600";
    if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO')) return isDarkMode ? "text-orange-400" : "text-orange-600";
    if (loc.includes('SARAJEVO') || loc.includes('BOSNIA')) return isDarkMode ? "text-violet-400" : "text-violet-600";
    return "text-[#64BC61]";
  };

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

  const getAvatarColor = (name: string) => {
    if (!name) return "bg-gray-400";
    
    const colors = [
      "bg-[#FF5C35]", // Original orange
      "bg-emerald-500",
      "bg-sky-500",
      "bg-violet-500",
      "bg-rose-500",
      "bg-amber-500",
      "bg-indigo-500",
      "bg-fuchsia-500",
      "bg-cyan-500",
      "bg-teal-500",
      "bg-orange-500"
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const effectiveColor = useMemo(() => {
    const defaultLight = '#0E0C0B';
    const defaultDark = '#231F1D';
    if (isDarkMode && sidebarColor === defaultLight) return defaultDark;
    if (!isDarkMode && sidebarColor === defaultDark) return defaultLight;
    return sidebarColor;
  }, [isDarkMode, sidebarColor]);

  const isLightSidebar = useMemo(() => {
    return effectiveColor.includes('linear-gradient') && 
           !effectiveColor.includes('#A855F7') && 
           !effectiveColor.includes('#2e1065');
  }, [effectiveColor]);

  const calendarDays = useMemo(() => {
    const today = new Date(currentSystemTime || new Date());
    today.setHours(0, 0, 0, 0);
    
    if (!showFocusBlur) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysCount = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: daysCount }, (_, i) => {
        const date = new Date(year, month, i + 1);
        date.setDate(date.getDate() + escalatorOffsetDays);
        return {
          day: date.getDate(),
          weekday: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
          isToday: isSameDay(date, today),
          isPast: date < today,
          daysFromToday: date < today ? Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) : 0,
          date,
          midnightMs: date.getTime(),
          isNextMonth: date.getMonth() !== month
        } as CalendarDay;
      });
    }

    // Active Fleet Mode: "Escalator"
    // To implement the "continuous escalator" logic:
    // Every month tab shows a window of 'daysInMonthCount' size.
    // The start position of this window is relative to 'today'.
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const activeMonthDaysCount = new Date(year, month + 1, 0).getDate();
    
    // Calculate how many months ahead we are from today
    const monthsDiff = (year - today.getFullYear()) * 12 + (month - today.getMonth());
    
    let startDate = new Date(today);
    
    if (monthsDiff > 0) {
      // If we are in a future month, the start date is today + sum of days in all months between today and current
      // This ensures the "escalator" continuity the user asked for.
      for (let i = 0; i < monthsDiff; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const daysInThatMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        startDate.setDate(startDate.getDate() + daysInThatMonth);
      }
    } else if (monthsDiff < 0) {
      // Handle past month offset
      for (let i = -1; i >= monthsDiff; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const daysInThatMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        startDate.setDate(startDate.getDate() - daysInThatMonth);
      }
    } else {
      // If same month or past month (past month should have disabled blur, but handle gracefully)
      startDate = today;
    }

    // Apply the escalatorOffsetDays
    startDate.setDate(startDate.getDate() + escalatorOffsetDays);

    return Array.from({ length: activeMonthDaysCount }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isNextMonth = date.getFullYear() > startDate.getFullYear() || (date.getFullYear() === startDate.getFullYear() && date.getMonth() > startDate.getMonth());

      return {
        day: date.getDate(),
        weekday: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
        isToday: isSameDay(date, today),
        isPast: date < today,
        daysFromToday: date < today ? Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        date,
        midnightMs: date.getTime(),
        isNextMonth
      } as CalendarDay;
    });
  }, [currentDate, showFocusBlur, escalatorOffsetDays, currentSystemTime]);

  const prevMonth = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const today = new Date(currentSystemTime || new Date());
      today.setHours(0, 0, 0, 0);
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Disable blur only if we move to a month strictly before the current one
      if (showFocusBlur && newDate < startOfCurrentMonth) {
        setShowFocusBlur(false);
      }
      return newDate;
    });
    setEscalatorOffsetDays(0);
  }, [currentSystemTime, showFocusBlur]);

  const nextMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setEscalatorOffsetDays(0);
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = userReservations.find(r => String(r.id) === String(id));
      const reservationRef = doc(db, 'reservations', String(id));
      await updateDoc(reservationRef, { 
        status,
        updatedAt: Date.now(),
        note: status === 'COMPLETED' ? '' : (res?.note || '')
      });
      
      // Update stats
      if (res) {
        // --- STEP 3: Marking a Reservation as Mark Completed ---
        if (status === 'COMPLETED' && res.status !== 'COMPLETED') {
          if (res.clientId) {
            await updateDoc(doc(db, 'clients', res.clientId), {
              rentalCount: increment(1),
              totalDaysRented: increment(res.days || 0),
              totalSpent: increment(Number(res.totalPrice) || 0),
              updatedAt: Date.now()
            });
          }

          // AUTOMATIC KILOMETER ADDITION:
          // 1 day equals to 150km. Take completed reservation days, multiply by 150, adds instantly/automatically to recent km and odometer ONLY ONCE for that reservation.
          if (!res.isKilometerProcessed) {
            const daysCount = Number(res.days || 0);
            const addedDistance = daysCount * 150;
            if (addedDistance > 0) {
              const carId = String(res.vehicleId);
              const carRef = doc(db, 'cars', carId);
              try {
                const carSnap = await getDoc(carRef);
                const matchingVehicle = dbVehicles.find((v: Vehicle) => String(v.id) === carId);
                const vehiclePlate = matchingVehicle?.plate || '';
                const vehicleName = matchingVehicle?.name || res.name || 'Unknown Vehicle';

                if (carSnap.exists()) {
                  const carData = carSnap.data();
                  const currentOdometer = Number(carData.odometer ?? 0);
                  const currentRecentKm = Number(carData.recentKm ?? carData.odometer ?? 0);
                  await updateDoc(carRef, {
                    odometer: currentOdometer + addedDistance,
                    recentKm: currentRecentKm + addedDistance,
                    name: vehicleName,
                    plate: vehiclePlate
                  });
                } else {
                  // If document doesn't exist, create it with vehicle details
                  await setDoc(carRef, {
                    vehicleId: res.vehicleId,
                    name: vehicleName,
                    plate: vehiclePlate,
                    transmission: matchingVehicle?.transmission || 'Manual',
                    odometer: addedDistance,
                    recentKm: addedDistance,
                    lastOilChangeDate: format(new Date(), 'yyyy-MM-dd')
                  });
                }

                // Mark reservation as processed in DB to prevent multiple additions if someone clicks completed multiple times
                await updateDoc(reservationRef, {
                  isKilometerProcessed: true
                });

                res.isKilometerProcessed = true;
              } catch (carErr) {
                console.error("Error updating car odometer during completion:", carErr);
              }
            }
          }
        }
        await updateStatsOnStatusChange(res.status, status, res.totalPrice);

        // Write audit log
        const changedByEmail = auth.currentUser?.email || 'admin@momo.com';
        const changedFields: any = {};
        if (res.status !== status) {
          changedFields.status = {
            oldValue: res.status !== undefined ? res.status : null,
            newValue: status !== undefined ? status : null
          };
        }
        if (status === 'COMPLETED' && res.note) {
          changedFields.note = {
            oldValue: res.note !== undefined ? res.note : null,
            newValue: ''
          };
        }
        if (Object.keys(changedFields).length > 0) {
          await setDoc(doc(db, 'auditLogs', String(id)), {
            reservationId: String(id),
            updatedAt: serverTimestamp()
          }, { merge: true });
          await addDoc(collection(db, 'auditLogs', String(id), 'changes'), {
            reservationId: String(id),
            changedBy: changedByEmail,
            timestamp: serverTimestamp(),
            action: 'status_changed',
            changedFields
          });

          setEditedReservationIds(prev => {
            const next = new Set(prev);
            next.add(String(id));
            return next;
          });
        }
      }

      setActionMenuId(null);
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `reservations/${id}`);
      } else {
        console.error("Error updating status:", err);
      }
    }
  };

  const handleCancelBooking = useCallback((id: string) => {
    setReservationToCancel(id);
    setIsCancellationModalOpen(true);
    setActionMenuId(null);
  }, []);

  const handleConfirmCancellation = async (reason: string) => {
    if (!reservationToCancel) return;
    
    try {
      const res = userReservations.find(r => String(r.id) === String(reservationToCancel));
      const reservationRef = doc(db, 'reservations', String(reservationToCancel));
      await updateDoc(reservationRef, { 
        status: 'CANCELLED',
        cancellationReason: reason,
        updatedAt: Date.now()
      });

      // Update stats
      if (res) {
        await updateStatsOnStatusChange(res.status, 'CANCELLED', res.totalPrice);

        // --- STEP 4: Handling Cancellations (Smart Cleanup) ---
        if (res.clientId) {
          const clientRef = doc(db, 'clients', res.clientId);
          const clientSnap = await getDoc(clientRef);
          
          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            // If the reservation was already completed before cancellation, 
            // we might want to subtract from stats, but the instructions say:
            // "If the reservation was never completed... skip this subtraction step entirely because it never added data to client card anyway."
            // So we ONLY check for cleanup if rentalCount is 0.

            if (clientData.rentalCount === 0) {
              // BRAND NEW CLIENTS: Completely delete the client doc
              await deleteDoc(clientRef);
            }
          }
        }

        // Write audit log
        const changedByEmail = auth.currentUser?.email || 'admin@momo.com';
        const changedFields: any = {
          status: {
            oldValue: res.status !== undefined ? res.status : null,
            newValue: 'CANCELLED'
          }
        };
        if (reason) {
          changedFields.cancellationReason = {
            oldValue: '',
            newValue: reason
          };
        }
        await setDoc(doc(db, 'auditLogs', String(reservationToCancel)), {
          reservationId: String(reservationToCancel),
          updatedAt: serverTimestamp()
        }, { merge: true });
        await addDoc(collection(db, 'auditLogs', String(reservationToCancel), 'changes'), {
          reservationId: String(reservationToCancel),
          changedBy: changedByEmail,
          timestamp: serverTimestamp(),
          action: 'status_changed',
          changedFields
        });

        setEditedReservationIds(prev => {
          const next = new Set(prev);
          next.add(String(reservationToCancel));
          return next;
        });
      }

      setReservationToCancel(null);
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `reservations/${reservationToCancel}`);
      } else {
        console.error("Error updating booking status to CANCELLED:", err);
      }
    }
  };

  const handleSaveNote = useCallback(async (content: string) => {
    if (!editingNoteId) return;
    
    try {
      const reservationRef = doc(db, 'reservations', String(editingNoteId));
      await updateDoc(reservationRef, { note: content });
      setEditingNoteId(null);
      setNoteContent('');
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `reservations/${editingNoteId}`);
      } else {
        console.error("Error saving note:", err);
      }
    }
  }, [editingNoteId]);

  const handleToggleCountry = async (bookingId: string, country: string) => {
    const booking = userReservations.find(b => String(b.id) === String(bookingId));
    if (!booking) return;

    const currentCountries = booking.countries || [];
    const newCountries = currentCountries.includes(country)
      ? currentCountries.filter(c => c !== country)
      : [...currentCountries, country];

    try {
      const resRef = doc(db, 'reservations', bookingId);
      await updateDoc(resRef, {
        countries: newCountries,
        updatedAt: Date.now()
      });
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `reservations/${bookingId}`);
      } else {
        console.error("Failed to update countries:", err);
      }
    }
  };

  // Generate bookings for calendar based on userReservations
  const bookings = useMemo(() => {
    const baseBookings = dbVehicles.map(car => {
      const carBookings: DayBooking[] = [];
      
      // Filter reservations of this car chronologically
      const activeCarReservations = userReservations
        .filter(res => {
          const matchCar = String(res.vehicleId) === String(car.id);
          if (!matchCar) return false;
          if (res.status === 'CANCELLED') return false;
          // If focus blur is OFF, allow COMPLETED. Otherwise, exclude COMPLETED.
          if (res.status === 'COMPLETED' && showFocusBlur) return false;
          return true;
        });

      // Helper to compute shade assignments per status group for upcoming reservations
      const assignUpcomingShadesColors = (list: any[]) => {
        // Convert to temp structure with parsed dates
        const temp = list
          .map(res => {
            const startDate = res.start instanceof Date ? res.start : new Date(res.start);
            const endDate = res.end instanceof Date ? res.end : new Date(res.end);
            return { res, startDate, endDate };
          })
          .filter(item => !isNaN(item.startDate.getTime()) && !isNaN(item.endDate.getTime()))
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        // Group into contiguous/touching chunks
        const chunks: typeof temp[] = [];
        let currentChunk: typeof temp = [];

        const getMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

        temp.forEach(item => {
          if (currentChunk.length === 0) {
            currentChunk.push(item);
          } else {
            const lastItem = currentChunk[currentChunk.length - 1];
            const lastEnd = getMidnight(lastItem.endDate);
            const curStart = getMidnight(item.startDate);
            
            const daysGap = Math.round((curStart - lastEnd) / (1000 * 60 * 60 * 24));
            if (daysGap <= 1) {
              currentChunk.push(item);
            } else {
              chunks.push(currentChunk);
              currentChunk = [item];
            }
          }
        });
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        // Map each reservation ID to its computed color string
        const colorMap = new Map<string, string>();
        chunks.forEach(chunk => {
          if (chunk.length === 1) {
            // Only 1 instance: use the standard (index 0) shade
            const res = chunk[0].res;
            const depCountry = globalGetDestinationCountry(res.fromLocation);
            const upcomingCountry = depCountry || car.country || 'Macedonia';
            const shades = COUNTRY_SHADES[upcomingCountry] || DEFAULT_SHADES;
            colorMap.set(String(res.id), shades[0]);
          } else {
            // Multiple adjacent/contiguous reservations: alternate shades
            chunk.forEach((item, idx) => {
              const res = item.res;
              const depCountry = globalGetDestinationCountry(res.fromLocation);
              const upcomingCountry = depCountry || car.country || 'Macedonia';
              const shades = COUNTRY_SHADES[upcomingCountry] || DEFAULT_SHADES;
              colorMap.set(String(res.id), shades[idx % shades.length]);
            });
          }
        });

        return colorMap;
      };

      // Partitions for ON RENT and non-on-rent (upcoming/pending)
      const upcomingReservations = activeCarReservations.filter(r => r.status !== 'ON RENT' && r.status !== 'COMPLETED');
      const upcomingColorMap = assignUpcomingShadesColors(upcomingReservations);

      // Add user reservations for this car that are visible on calendar
      activeCarReservations.forEach(res => {
        const startDate = res.start instanceof Date ? res.start : new Date(res.start);
        const endDate = res.end instanceof Date ? res.end : new Date(res.end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

        if (!calendarDays || calendarDays.length === 0) return;

        // Check if reservation overlaps with any day in calendarDays
        const minCalendarDay = calendarDays[0].date;
        const maxCalendarDay = calendarDays[calendarDays.length - 1].date;

        // Also include the reservation if it is ON RENT but the end date is before the visible range (overdue)
        const isOverdueOnRent = res.status === 'ON RENT' && endDate < minCalendarDay;

        if ((startDate <= maxCalendarDay && endDate >= minCalendarDay) || isOverdueOnRent) {
          let color = '';
          if (res.status === 'ON RENT' || res.status === 'COMPLETED') {
            color = 'bg-[#C62828]'; // No shades for ON RENT, always solid core red
          } else {
            color = upcomingColorMap.get(String(res.id)) || 'bg-[#FF9F00]';
          }

          const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

          carBookings.push({ 
            id: res.id,
            client: res.name,
            startDate,
            endDate,
            startMs: startMidnight.getTime(),
            endMs: endMidnight.getTime(),
            status: res.status,
            color: color,
            totalPrice: res.totalPrice,
            arrivalTime: res.arrivalTime,
            departureTime: res.departureTime
          });
        }
      });

      return { carId: car.id, reservations: carBookings } as CarBooking;
    });
    return baseBookings;
  }, [userReservations, calendarDays, dbVehicles, showFocusBlur]);

  const bookingsMap = useMemo(() => {
    const map = new Map<string, CarBooking>();
    bookings.forEach(b => {
      map.set(String(b.carId), b);
    });
    return map;
  }, [bookings]);

  const { sortedHomeVehicles, sortedGuestVehicles, firstExtraIndex } = useMemo(() => {
    const getCarPhysicalLocationAndStatus = (vehicle: Vehicle, reservationsList: Reservation[]) => {
      const homeCountry = vehicle.country || 'Macedonia';
      const nowTime = (currentSystemTime || new Date()).getTime();

      let lastCompletedRes: Reservation | null = null;
      let latestEnd = -Infinity;
      for (let i = 0; i < (reservationsList || []).length; i++) {
        const r = reservationsList[i];
        if (String(r.vehicleId) === String(vehicle.id) && r.status === 'COMPLETED') {
          const sTime = parseDateSafe(r.start).getTime();
          if (sTime <= nowTime) {
            const eTime = parseDateSafe(r.end).getTime();
            if (eTime > latestEnd) {
              latestEnd = eTime;
              lastCompletedRes = r;
            }
          }
        }
      }

      const lastCompletedDestination = lastCompletedRes && lastCompletedRes.toLocation
        ? globalGetDestinationCountry(lastCompletedRes.toLocation)
        : undefined;

      const forcedPhysicalCountry = vehicle.forcedPhysicalCountry;

      let activeOnRentRes: Reservation | undefined;
      let latestOnRentStart = -Infinity;
      for (let i = 0; i < (reservationsList || []).length; i++) {
        const r = reservationsList[i];
        if (String(r.vehicleId) === String(vehicle.id) && r.status === 'ON RENT') {
          const sTime = parseDateSafe(r.start).getTime();
          if (sTime > latestOnRentStart) {
            latestOnRentStart = sTime;
            activeOnRentRes = r;
          }
        }
      }

      const activeOnRentDest = activeOnRentRes && activeOnRentRes.toLocation
        ? globalGetDestinationCountry(activeOnRentRes.toLocation)
        : undefined;

      const physicalCountry = activeOnRentDest || forcedPhysicalCountry || lastCompletedDestination || homeCountry;
      const isAway = physicalCountry !== homeCountry;

      return {
        homeCountry,
        isAway,
        physicalCountry,
        activeOnRentRes
      };
    };

    const allActiveVehicles = dbVehicles.filter((v: Vehicle) => !v.isRetired);

    const vehiclesWithLocation = allActiveVehicles.map(v => {
      const locInfo = getCarPhysicalLocationAndStatus(v, userReservations);
      return {
        ...v,
        ...locInfo
      };
    });

    const homeVehicles = vehiclesWithLocation.filter(v => v.homeCountry === activeCountry);

    const guestVehicles = vehiclesWithLocation.filter(v => {
      if (v.homeCountry === activeCountry) return false;
      if (v.activeOnRentRes) {
        const dest = v.activeOnRentRes.toLocation ? globalGetDestinationCountry(v.activeOnRentRes.toLocation) : undefined;
        return dest === activeCountry;
      }
      if (v.forcedPhysicalCountry) {
        return v.forcedPhysicalCountry === activeCountry;
      }
      return v.physicalCountry === activeCountry;
    });

    const filterAndSortList = (arr: typeof vehiclesWithLocation) => {
      const today = currentSystemTime || new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const query = debouncedFleetSearch.trim().toLowerCase();

      return arr.filter(v => {
        if (freeTodayOnly) {
          if (v.physicalCountry !== activeCountry) return false;

          const hasConflictingReservation = (userReservations || []).some(r => {
            if (String(r.vehicleId) !== String(v.id)) return false;
            if (r.status !== 'UPCOMING' && r.status !== 'ON RENT') return false;

            const startDate = r.start instanceof Date ? r.start : new Date(r.start);
            const endDate = r.end instanceof Date ? r.end : new Date(r.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;

            const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
            const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
            return todayMidnight >= startMidnight && todayMidnight <= endMidnight;
          });

          if (hasConflictingReservation) return false;
        }

        if (returningTodayOnly) {
          if (v.physicalCountry !== activeCountry) return false;

          const hasReturningReservation = (userReservations || []).some(r => {
            if (String(r.vehicleId) !== String(v.id)) return false;
            if (r.status !== 'ON RENT') return false;

            const endDate = r.end instanceof Date ? r.end : new Date(r.end);
            if (isNaN(endDate.getTime())) return false;

            const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
            return todayMidnight === endMidnight;
          });

          if (!hasReturningReservation) return false;
        }

        if (!query) return true;

        const clientNames = vehicleClientNamesMap.get(String(v.id));
        const matchesClient = clientNames ? clientNames.some(name => name.includes(query)) : false;

        return v.name.toLowerCase().includes(query) || 
               v.plate.toLowerCase().includes(query) ||
               (v.statusNote || '').toLowerCase().includes(query) ||
               (v.status || '').toLowerCase().includes(query) ||
               matchesClient;
      }).sort((a, b) => {
        const isExtraA = !!(a.isExtra || a.name === 'EXTRA' || String(a.id).startsWith('extra-'));
        const isExtraB = !!(b.isExtra || b.name === 'EXTRA' || String(b.id).startsWith('extra-'));
        if (isExtraA && !isExtraB) return 1;
        if (!isExtraA && isExtraB) return -1;

        const orderA = a.displayOrder ?? (typeof a.id === 'number' ? a.id : 0);
        const orderB = b.displayOrder ?? (typeof b.id === 'number' ? b.id : 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.id).localeCompare(String(b.id));
      });
    };

    const sortedHome = filterAndSortList(homeVehicles);
    const sortedGuest = filterAndSortList(guestVehicles);
    const extraIdx = sortedHome.findIndex(v => v.isExtra || v.name === 'EXTRA' || String(v.id).startsWith('extra-'));

    return {
      sortedHomeVehicles: sortedHome,
      sortedGuestVehicles: sortedGuest,
      firstExtraIndex: extraIdx
    };
  }, [dbVehicles, userReservations, activeCountry, currentSystemTime, debouncedFleetSearch, freeTodayOnly, returningTodayOnly, vehicleClientNamesMap]);

  // Drag/Drop placement fallback or Click empty slot to drop logic
  const handlePlaceMoveReservation = useCallback(async (carId: number | string, day: CalendarDay) => {
    if (!reservationToMove) return;

    // Get other active reservations on the target car, excluding the moving reservation itself
    const targetCarRes = userReservations.filter(r => 
      String(r.vehicleId) === String(carId) && 
      r.id !== reservationToMove.id && 
      r.status !== 'CANCELLED' &&
      r.status !== 'COMPLETED'
    );

    const startA = new Date(reservationToMove.start); startA.setHours(0,0,0,0);
    const endA = new Date(reservationToMove.end); endA.setHours(0,0,0,0);

    const collisionExists = targetCarRes.some(r => {
      const startB = new Date(r.start); startB.setHours(0,0,0,0);
      const endB = new Date(r.end); endB.setHours(0,0,0,0);
      
      const overlapStart = startA > startB ? startA : startB;
      const overlapEnd = endA < endB ? endA : endB;
      if (overlapStart > overlapEnd) {
        return false; // No overlap at all
      }

      const isOverlapExactlyOneDay = isSameDay(overlapStart, overlapEnd);
      if (isOverlapExactlyOneDay) {
        const overlapDay = overlapStart;
        const isValidCase1 = isSameDay(endB, overlapDay) && isSameDay(startA, overlapDay);
        const isValidCase2 = isSameDay(startB, overlapDay) && isSameDay(endA, overlapDay);
        if (isValidCase1 || isValidCase2) {
          return false; // Allowed handover
        }
      }
      return true; // Clash
    });

    if (collisionExists) {
      alert("Cannot change car: The target vehicle is already booked during these dates.");
      return;
    }

    try {
      const changedByEmail = auth.currentUser?.email || 'admin@momo.com';

      const targetCar = dbVehicles.find((v: any) => String(v.id) === String(carId));
      const isTargetExtra = targetCar && (targetCar.isExtra || targetCar.name === 'EXTRA' || String(targetCar.id).startsWith('extra-'));
      const moveUpdate: Record<string, any> = {
        vehicleId: carId,
        updatedAt: Date.now()
      };
      if (isTargetExtra && targetCar) {
        if (targetCar.plate) {
          moveUpdate.snapshotExtraPlate = targetCar.plate;
          moveUpdate.snapshotExtraName = targetCar.extraName || 'EXTRA';
        } else {
          moveUpdate.snapshotExtraPlate = '';
          moveUpdate.snapshotExtraName = '';
        }
      } else {
        moveUpdate.snapshotExtraPlate = '';
        moveUpdate.snapshotExtraName = '';
      }

      await updateDoc(doc(db, 'reservations', reservationToMove.id), moveUpdate);

      // Write audit log parent marker
      await setDoc(doc(db, 'auditLogs', String(reservationToMove.id)), {
        reservationId: String(reservationToMove.id),
        updatedAt: serverTimestamp(),
        hasNonStatusEdits: true
      }, { merge: true });

      // Write audit log entry
      await addDoc(collection(db, 'auditLogs', String(reservationToMove.id), 'changes'), {
        reservationId: String(reservationToMove.id),
        changedBy: changedByEmail,
        timestamp: serverTimestamp(),
        action: 'booking_details_changed',
        changedFields: {
          vehicleId: {
            oldValue: reservationToMove.vehicleId !== undefined ? reservationToMove.vehicleId : null,
            newValue: carId !== undefined ? carId : null
          }
        }
      });

      setEditedReservationIds(prev => {
        const next = new Set(prev);
        next.add(String(reservationToMove.id));
        return next;
      });
      setNonStatusEditIds(prev => {
        const next = new Set(prev);
        next.add(String(reservationToMove.id));
        return next;
      });

      setReservationToMove(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `reservations/${reservationToMove.id}`);
    }
  }, [reservationToMove, userReservations]);

  const handleGridClick = useCallback(async (carId: number | string, day: CalendarDay) => {
    if (!isSelectionEnabled && !isRelocationMode) return;

    const carBooking = bookings.find(b => String(b.carId) === String(carId));
    const dayBookings = carBooking?.reservations.filter(r => {
      const d = new Date(day.date); d.setHours(0,0,0,0);
      const s = new Date(r.startDate); s.setHours(0,0,0,0);
      const e = new Date(r.endDate); e.setHours(0,0,0,0);
      return d >= s && d <= e;
    }) || [];

    // --- CASE 1: RELOCATION MODE ACTIVE ---
    if (isRelocationMode) {
      if (reservationToMove) {
        // If user clicked exactly on the moving reservation on this day, cancel/deselect movement mode
        const clickedBookingOnThisDay = dayBookings.find(b => String(b.id) === String(reservationToMove.id));
        if (clickedBookingOnThisDay) {
          setReservationToMove(null);
          return;
        }

        // If they clicked on a completely different active reservation, switch focus to that block instead
        const clickedOtherBooking = dayBookings.find(b => String(b.id) !== String(reservationToMove.id));
        if (clickedOtherBooking && !isSameDay(clickedOtherBooking.endDate, day.date)) {
          const fullRes = userReservations.find(r => String(r.id) === String(clickedOtherBooking.id));
          if (fullRes && (fullRes.status === 'UPCOMING' || fullRes.status === 'ON RENT' || fullRes.status === 'PENDING')) {
            setReservationToMove(fullRes);
            return;
          }
        }

        // Place the reservation on the clicked vehicle (the function will check for collisions)
        await handlePlaceMoveReservation(carId, day);
        return;
      } else {
        // Find if there is an active reservation in this cell to select for relocation
        const bookingToSelect = dayBookings.find(b => {
          const fullRes = userReservations.find(r => String(r.id) === String(b.id));
          return fullRes && (fullRes.status === 'UPCOMING' || fullRes.status === 'ON RENT' || fullRes.status === 'PENDING');
        });

        if (bookingToSelect) {
          const fullRes = userReservations.find(r => String(r.id) === String(bookingToSelect.id));
          if (fullRes) {
            setReservationToMove(fullRes);
          }
        }
        return;
      }
    }

    // --- CASE 2: SELECTION MODE ACTIVE (Creating reservations) ---
    if (isSelectionEnabled) {
      // Check if we are starting selection
      if (!selectionStart) {
        // In standard selection mode, we only want to select empty slots for creating a reservation.
        const isOccupied = dayBookings.some(b => {
          if (b.status === 'COMPLETED') return false;
          // If the day is exactly the checkout day of this booking, we can allow start selection on it (handover)
          return !isSameDay(b.endDate, day.date);
        });

        if (isOccupied) {
          return; // Blocked cell
        }

        // Otherwise, start standard selection range
        setSelectionStart({ carId, date: day.date });
      } else {
        // selectionStart is active (finishing a selection)
        if (String(selectionStart.carId) !== String(carId)) {
          setSelectionStart({ carId, date: day.date });
          return;
        }

        const start = selectionStart.date < day.date ? selectionStart.date : day.date;
        const end = selectionStart.date < day.date ? day.date : selectionStart.date;
        
        // Check for any bookings in the range
        const isRangeBlocked = carBooking?.reservations.some(r => {
          if (r.status === 'COMPLETED') return false;
          const startA = new Date(start); startA.setHours(0,0,0,0);
          const endA = new Date(end); endA.setHours(0,0,0,0);
          const startB = new Date(r.startDate); startB.setHours(0,0,0,0);
          const endB = new Date(r.endDate); endB.setHours(0,0,0,0);

          const overlapStart = startA > startB ? startA : startB;
          const overlapEnd = endA < endB ? endA : endB;
          if (overlapStart > overlapEnd) {
            return false; // No overlap at all
          }

          // They overlap. Check if overlap is exactly one day and is a valid checkout/checkin handover:
          const isOverlapExactlyOneDay = isSameDay(overlapStart, overlapEnd);
          if (isOverlapExactlyOneDay) {
            const overlapDay = overlapStart;
            const isValidCase1 = isSameDay(endB, overlapDay) && isSameDay(startA, overlapDay);
            const isValidCase2 = isSameDay(startB, overlapDay) && isSameDay(endA, overlapDay);
            if (isValidCase1 || isValidCase2) {
              return false; // Allowed handover
            }
          }
          return true; // Any other overlap is blocked (clash)
        });

        if (isRangeBlocked) {
          setSelectionStart({ carId, date: day.date });
          return;
        }
        
        setEditingReservation({
          vehicleId: carId,
          start: start,
          end: end,
        } as unknown as Reservation);
        setModalMode('full');
        setIsModalOpen(true);
        
        setSelectionStart(null);
      }
    }
  }, [isSelectionEnabled, isRelocationMode, bookings, reservationToMove, userReservations, selectionStart, handlePlaceMoveReservation]);

  const headerMonth = calendarDays[0]?.date ? calendarDays[0].date.getMonth() : currentDate.getMonth();
  const headerYear = calendarDays[0]?.date ? calendarDays[0].date.getFullYear() : currentDate.getFullYear();

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar",
      isDarkMode ? "bg-[#1A1614]" : "bg-white"
    )}>
      <div className="w-full flex-1 flex flex-col gap-3 min-h-0">
        {/* First Section: Header + Schedule */}
        <div className="h-[1080px] flex flex-col mb-4 md:mb-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-[10px] pl-2 shrink-0">
            <div className="w-full md:w-[480px] shrink-0 ml-[5px] mr-[-5px]">
              <div className="flex items-center gap-3">
                <h1 className={cn(
                  "text-xl font-black tracking-tighter leading-none transition-colors",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}>BOOKING SCHEDULE</h1>
                
                <div className="flex flex-col gap-1.5 shrink-0">
                  {/* Relocation Mode Toggle */}
                  <div className={cn(
                    "flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all shadow-sm shrink-0",
                    isRelocationMode 
                      ? (isDarkMode ? "bg-[#FF5C35]/10 border-[#FF5C35]/30 shadow-[0_0_10px_rgba(255,92,53,0.15)]" : "bg-[#FF5C35]/5 border-[#FF5C35]/20")
                      : (isDarkMode ? "bg-black/20 border-white/5" : "bg-gray-100/50 border-gray-200/50")
                  )}>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest transition-colors select-none",
                      isRelocationMode ? "text-[#FF5C35]" : "text-gray-400"
                    )}>
                      Relocation Mode
                    </span>
                    <button
                      onClick={() => {
                        const nextVal = !isRelocationMode;
                        setIsRelocationMode(nextVal);
                        if (nextVal) {
                          setIsSelectionEnabled(false);
                          setSelectionStart(null);
                          setIsCarLocationMode(false);
                        }
                        setReservationToMove(null);
                      }}
                      className={cn(
                        "w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer",
                        isRelocationMode 
                          ? (isDarkMode ? "bg-[#FF5C35]/50" : "bg-[#FF5C35]") 
                          : (isDarkMode ? "bg-white/5" : "bg-black/10")
                      )}
                      title="Toggle relocation mode to move bookings to other cars"
                    >
                      <motion.div 
                        animate={{ x: isRelocationMode ? 14 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                          "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                          isDarkMode ? "bg-white" : "bg-white shadow-sm"
                        )}
                      />
                    </button>
                  </div>

                  {/* Car Location Toggle */}
                  <div className={cn(
                    "flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all shadow-sm shrink-0",
                    isCarLocationMode 
                      ? (isDarkMode ? "bg-[#10B981]/10 border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-[#10B981]/5 border-[#10B981]/20")
                      : (isDarkMode ? "bg-black/20 border-white/5" : "bg-gray-100/50 border-gray-200/50")
                  )}>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest transition-colors select-none",
                      isCarLocationMode ? "text-[#10B981]" : "text-gray-400"
                    )}>
                      Car Location
                    </span>
                    <button
                      onClick={() => {
                        const nextVal = !isCarLocationMode;
                        setIsCarLocationMode(nextVal);
                        if (nextVal) {
                          setIsSelectionEnabled(false);
                          setSelectionStart(null);
                          setIsRelocationMode(false);
                          setIsEditMode(false);
                        }
                      }}
                      className={cn(
                        "w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden cursor-pointer",
                        isCarLocationMode 
                          ? (isDarkMode ? "bg-[#10B981]/50" : "bg-[#10B981]") 
                          : (isDarkMode ? "bg-white/5" : "bg-black/10")
                      )}
                      title="Toggle car location mode to move a car to another country and reset its status"
                    >
                      <motion.div 
                        animate={{ x: isCarLocationMode ? 14 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                          "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full",
                          isDarkMode ? "bg-white" : "bg-white shadow-sm"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[7px] font-black text-gray-400 tracking-[0.2em] uppercase mt-0.5">OPERATIONAL TIMELINE</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => {
                  setModalMode('full');
                  setIsModalOpen(true);
                }}
                className={cn(
                  "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-[18px] shadow-[0_10px_20px_rgba(0,0,0,0.15)] border-b-4 transition-all hover:scale-[1.02] active:scale-95 font-black text-[9px] tracking-widest uppercase cursor-pointer",
                  isDarkMode ? "bg-[#FF5C35] text-white border-[#C84528]" : "bg-[#0E0C0B] text-white border-black/50"
                )}
              >
                <Plus className={cn("w-3.5 h-3.5", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                ADD RESERVATION
              </button>

              <div className={cn(
                "flex-1 md:flex-none flex items-center justify-between md:justify-start rounded-[18px] p-1 shadow-[0_10px_20px_rgba(0,0,0,0.15)] border-b-4 transition-all hover:scale-[1.02]",
                isDarkMode ? "border-black/50" : "border-black/50"
              )} style={{ background: effectiveColor }}>
                <button 
                  onClick={prevMonth}
                  className={cn(
                    "p-1.5 transition-all hover:scale-110 active:scale-90 cursor-pointer",
                    isLightSidebar ? "text-black/70 hover:text-[#FF5C35]" : "text-white hover:text-[#FF5C35]"
                  )}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className={cn(
                  "px-2 md:px-4 font-black text-[9px] tracking-[0.2em] min-w-[100px] md:min-w-[120px] text-center select-none",
                  isLightSidebar ? "text-black" : "text-white"
                )}>
                  {MONTHS[headerMonth]} {headerYear}
                </span>
                <button 
                  onClick={nextMonth}
                  className={cn(
                    "p-1.5 transition-all hover:scale-110 active:scale-90 cursor-pointer",
                    isLightSidebar ? "text-black/70 hover:text-[#FF5C35]" : "text-white hover:text-[#FF5C35]"
                  )}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </header>

          {/* Country Tabs & Mode Selection */}
          <FilterHeader
            isDarkMode={isDarkMode}
            isSelectionEnabled={isSelectionEnabled}
            setIsSelectionEnabled={setIsSelectionEnabled}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
            setIsRelocationMode={setIsRelocationMode}
            setSelectionStart={setSelectionStart}
            setReservationToMove={setReservationToMove}
            setCarIdToMove={setCarIdToMove}
            setReservationIdToSwap={setReservationIdToSwap}
            activeCountry={activeCountry}
            setActiveCountry={setActiveCountry}
            countryCounts={countryCounts}
            incomingFleetCount={incomingFleetCount}
            setIsIncomingFleetOpen={setIsIncomingFleetOpen}
          />

          {/* Schedule Panel */}
          <div className={cn(
            "rounded-[32px] border overflow-hidden flex flex-col flex-1 shrink-0 transition-all duration-500",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_20px_rgba(245,241,233,0.05)]" 
              : "bg-white border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_0_0_1px_rgba(245,241,233,1),0_0_30px_rgba(245,241,233,0.6)]"
          )}>
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              <div className="min-w-[1500px] md:min-w-0 md:w-full flex flex-col flex-1">
                {/* Timeline Header */}
                <div className={cn(
                  "flex border-b transition-colors shrink-0 sticky top-0 z-[40] h-[84px]",
                  isDarkMode ? "bg-[#2C2724] border-white/5" : "bg-white border-black/5"
                )}>
            <div className={cn(
              "w-[285px] px-2 border-r flex flex-col items-center justify-center gap-1.5 shadow-[inset_-2px_0_10px_rgba(0,0,0,0.02)] transition-colors h-[84.2px] mt-0 ml-0 mr-0 mb-0 sticky left-0 z-50",
              isDarkMode ? "bg-[#231F1D] border-[#231F1D]" : "bg-[#F5F1E9] border-[#F5F1E9]"
            )}
            style={{ marginTop: '0px', marginBottom: '-3px' }}
            >
              <div className={cn(
                "w-[275px] h-[32px] ml-0 mt-0 mr-0 rounded-[16px] pl-[6px] pr-[8px] flex items-center gap-2 border-2 shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_2px_rgba(0,0,0,0.03)] transition-colors relative group",
                isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-[#EBE4D9] border-white"
              )}>
                <button 
                  onClick={() => setIsAddCarModalOpen(true)}
                  className="w-5.5 h-5.5 bg-[#0E0C0B] rounded-md flex items-center justify-center shadow-xl border-b border-black/50 shrink-0 hover:scale-110 active:scale-95 transition-all cursor-pointer group"
                  title="Add New Vehicle"
                >
                  <Car className="w-3 h-3 text-[#FF5C35] group-hover:rotate-12 transition-transform" />
                </button>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    "font-black text-[9px] tracking-[0.05em] transition-colors whitespace-nowrap",
                    isDarkMode ? "text-white" : "text-[#0E0C0B]"
                  )}>ACTIVE FLEET</span>
                </div>

                {/* Focus Toggle */}
                <button
                  onClick={() => {
                    const newBlur = !showFocusBlur;
                    setShowFocusBlur(newBlur);
                    if (newBlur) {
                      const today = new Date(currentSystemTime || new Date());
                      setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    }
                  }}
                  className={cn(
                    "ml-auto w-7 h-3.5 rounded-full relative transition-all duration-300 shadow-inner overflow-hidden",
                    showFocusBlur 
                      ? (isDarkMode ? "bg-emerald-600/50" : "bg-emerald-500") 
                      : (isDarkMode ? "bg-white/5" : "bg-black/10")
                  )}
                  title={showFocusBlur ? "Focus Blur ON" : "Focus Blur OFF"}
                >
                  <motion.div 
                    animate={{ x: showFocusBlur ? 14 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={cn(
                      "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center",
                      isDarkMode ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" : "bg-white shadow-md"
                    )}
                  />
                </button>
              </div>

              {/* Search layout: Search input + Bulb toggle */}
              <div 
                className="w-[275px] flex items-center gap-1.5 ml-0 mt-0 mr-0"
                style={{ height: '32px' }}
              >
                <FleetSearchInput isDarkMode={isDarkMode} onSearch={setDebouncedFleetSearch} />

                {/* Lightbulb Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setFreeTodayOnly(!freeTodayOnly);
                    if (!freeTodayOnly) {
                      setReturningTodayOnly(false);
                    }
                  }}
                  className={cn(
                    "w-[32px] rounded-full flex items-center justify-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03)] transition-all shrink-0 hover:scale-110 active:scale-95 cursor-pointer relative",
                    freeTodayOnly
                      ? (isDarkMode 
                          ? "bg-[#FFE082]/20 border-[#FFE082]/40 text-[#FFE082] shadow-[0_0_10px_rgba(255,224,130,0.3)]" 
                          : "bg-[#FFD54F]/40 border-[#FFD54F] text-[#F57F17] shadow-[0_0_10px_rgba(251,192,45,0.3)]")
                      : (isDarkMode 
                          ? "bg-[#1A1614] border-white/5 text-gray-600 hover:text-gray-400" 
                          : "bg-[#EBE4D9] border-white text-gray-400 hover:text-gray-600")
                  )}
                  style={{ height: '32px' }}
                  title={freeTodayOnly ? "Showing Free Cars Today (Toggled ON)" : "Show Free Cars Today (Toggled OFF)"}
                >
                  <Lightbulb 
                    className={cn(
                      "w-3.5 h-3.5 transition-all",
                      freeTodayOnly ? "fill-current text-[#FFCA28]" : ""
                    )} 
                  />
                </button>

                {/* Upside-down Red Lightbulb Toggle for returning cars */}
                <button
                  type="button"
                  onClick={() => {
                    setReturningTodayOnly(!returningTodayOnly);
                    if (!returningTodayOnly) {
                      setFreeTodayOnly(false);
                    }
                  }}
                  className={cn(
                    "w-[32px] rounded-full flex items-center justify-center border-[1.5px] shadow-[0_2px_6px_rgba(0,0,0,0.03)] transition-all shrink-0 hover:scale-110 active:scale-95 cursor-pointer relative",
                    returningTodayOnly
                      ? (isDarkMode 
                          ? "bg-[#EF5350]/20 border-[#EF5350]/40 text-[#EF5350] shadow-[0_0_10px_rgba(239,83,80,0.3)]" 
                          : "bg-[#EF5350]/30 border-[#EF5350] text-[#D32F2F] shadow-[0_0_10px_rgba(239,83,80,0.3)]")
                      : (isDarkMode 
                          ? "bg-[#1A1614] border-white/5 text-gray-600 hover:text-gray-400" 
                          : "bg-[#EBE4D9] border-white text-gray-400 hover:text-gray-600")
                  )}
                  style={{ height: '32px' }}
                  title={returningTodayOnly ? "Showing Returning Cars Today (Toggled ON)" : "Show Returning Cars Today (Toggled OFF)"}
                >
                  <Lightbulb 
                    className={cn(
                      "w-3.5 h-3.5 transition-all rotate-180",
                      returningTodayOnly ? "fill-current text-[#EF5350]" : ""
                    )} 
                  />
                </button>
              </div>
            </div>
            
            <div 
              className={cn(
                "flex-1 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] transition-colors h-full flex flex-col justify-end py-2.5"
              )}
              style={{
                background: getHeaderGradient(calendarDays, isDarkMode)
              }}
            >
              <div className={cn(
                "flex w-full px-1 py-1 items-end pb-1",
                !showFocusBlur && "gap-0.5"
              )}>
                {calendarDays.map((day, idx) => {
                  const isNewMonth = idx > 0 && day.date.getMonth() !== calendarDays[idx-1].date.getMonth();

                  return (
                    <React.Fragment key={day.date.getTime()}>
                      {isNewMonth && <MonthDivider monthName={MONTHS[day.date.getMonth()]} isDarkMode={isDarkMode} showFocusBlur={showFocusBlur} isHeader={true} />}
                      <div 
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 min-w-0 h-[53.2px]"
                        )}
                        style={{ flex: '1 0 0%', marginBottom: '-10px' }}
                      >
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-tight">{day.weekday}</span>
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "text-[11px] font-black transition-all",
                            day.isToday ? "text-[#FF5C35] scale-110" : (isDarkMode ? "text-white" : "text-[#0E0C0B]")
                          )}
                          style={{
                            opacity: showFocusBlur && day.isPast ? 0.4 : 1
                          }}>
                            {day.day}
                          </span>
                          <div className={cn(
                            "w-4 h-[2px] rounded-full transition-all",
                            day.isToday ? "bg-[#FF5C35]" : "opacity-75"
                          )}
                          style={{
                            backgroundColor: day.isToday 
                              ? undefined 
                              : `rgb(${BIRTHSTONE_COLORS[day.date.getMonth()]?.rgb.join(',') || '128,128,128'})`,
                            opacity: showFocusBlur && day.isPast ? 0.2 : 1
                          }} />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fleet List & Grid */}
          <div className={cn(
            "flex-1 transition-colors relative z-20",
            isDarkMode ? "bg-[#1A1614]" : "bg-white"
          )} style={{ WebkitOverflowScrolling: 'touch', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
            {sortedHomeVehicles.map((vehicle, index) => (
              <React.Fragment key={vehicle.id}>
                {firstExtraIndex !== -1 && index === firstExtraIndex && (
                  <div className="h-1 bg-black w-full shrink-0 relative z-30" />
                )}
                <CarRow 
                  car={vehicle} 
                  carBooking={bookingsMap.get(String(vehicle.id))}
                  calendarDays={calendarDays}
                  isDarkMode={isDarkMode}
                  showFocusBlur={showFocusBlur}
                  isFirstRow={index === 0}
                  onHoverDay={handleHoverDay}
                  onLeaveDay={handleLeaveDay}
                  tyreType={tyreTypes[String(vehicle.id)]}
                  onTyreToggle={toggleTyre}
                  onStatusClick={handleStatusClick}
                  isSelectionEnabled={isSelectionEnabled}
                  isRelocationMode={isRelocationMode}
                  isCarLocationMode={isCarLocationMode}
                  isEditMode={isEditMode}
                  selectionStart={selectionStart}
                  onGridClick={handleGridClick}
                  isSelectedForMove={String(vehicle.id) === String(carIdToMove)}
                  onCarSelect={handleCarSelect}
                  onCarLocationClick={handleCarLocationClick}
                  onReservationSelect={handleReservationSelect}
                  reservationIdToSwap={reservationIdToSwap}
                  onChassisClick={handleChassisClick}
                  onColorClick={handleColorClick}
                  reservationToMoveId={reservationToMove?.id}
                  isExtraCancelMode={isExtraCancelMode}
                  onToggleExtraCancelMode={handleToggleExtraCancelMode}
                  onCancelBooking={handleCancelBooking}
                  userReservations={userReservations}
                  activeCountry={activeCountry}
                  currentSystemTime={currentSystemTime}
                  fleetSearch={debouncedFleetSearch}
                  onOverdueClick={handleOverdueClick}
                  todayMidnightMs={todayMidnightMs}
                  violationPlatesSet={violationPlatesSet}
                  onOpenExtraDetails={handleOpenExtraDetails}
                />
              </React.Fragment>
            ))}

            {/* Guest Cars section header & list mapping */}
            {sortedGuestVehicles.length > 0 && (
              <>
                <div className={cn(
                  "px-4 py-3 border-t-2 border-dashed flex items-center gap-2 relative z-30 shrink-0 mt-4",
                  isDarkMode ? "bg-[#25201E]/80 border-white/10 text-[#FF5C35]" : "bg-orange-50/75 border-black/10 text-[#FF5C35]"
                )}>
                  <ArrowUpRight className="w-4 h-4 animate-pulse shrink-0" />
                  <span className="font-extrabold text-[10px] tracking-widest uppercase">
                    Guest Cars Departing / Located in {activeCountry} ({sortedGuestVehicles.length})
                  </span>
                  <span className="text-[8px] font-bold text-gray-400 normal-case ml-2 truncate">
                    (Home country is different but currently here — bookable)
                  </span>
                </div>

                {sortedGuestVehicles.map((vehicle) => (
                  <React.Fragment key={vehicle.id}>
                    <CarRow 
                      car={vehicle} 
                      carBooking={bookingsMap.get(String(vehicle.id))}
                      calendarDays={calendarDays}
                      isDarkMode={isDarkMode}
                      showFocusBlur={showFocusBlur}
                      isFirstRow={false}
                      onHoverDay={handleHoverDay}
                      onLeaveDay={handleLeaveDay}
                      tyreType={tyreTypes[String(vehicle.id)]}
                      onTyreToggle={toggleTyre}
                      onStatusClick={handleStatusClick}
                      isSelectionEnabled={isSelectionEnabled}
                      isRelocationMode={isRelocationMode}
                      isCarLocationMode={isCarLocationMode}
                      isEditMode={isEditMode}
                      selectionStart={selectionStart}
                      onGridClick={handleGridClick}
                      isSelectedForMove={String(vehicle.id) === String(carIdToMove)}
                      onCarSelect={handleCarSelect}
                      onCarLocationClick={handleCarLocationClick}
                      onReservationSelect={handleReservationSelect}
                      reservationIdToSwap={reservationIdToSwap}
                      onChassisClick={handleChassisClick}
                      onColorClick={handleColorClick}
                      reservationToMoveId={reservationToMove?.id}
                      isExtraCancelMode={isExtraCancelMode}
                      onToggleExtraCancelMode={handleToggleExtraCancelMode}
                      onCancelBooking={handleCancelBooking}
                      userReservations={userReservations}
                      activeCountry={activeCountry}
                      currentSystemTime={currentSystemTime}
                      fleetSearch={debouncedFleetSearch}
                      onOverdueClick={handleOverdueClick}
                      todayMidnightMs={todayMidnightMs}
                      violationPlatesSet={violationPlatesSet}
                      onOpenExtraDetails={handleOpenExtraDetails}
                    />
                  </React.Fragment>
                ))}
              </>
            )}
          </div>

          </div>
          </div>
        </div>

        {/* Bottom Escalator Slide Navigation Row */}
        <div className={cn(
          "flex shrink-0 relative z-30 select-none mt-2 rounded-[20px] border overflow-hidden shadow-lg transition-all duration-500",
          isDarkMode 
            ? "bg-[#2C2724] border-white/5 text-white" 
            : "bg-white border-[#F5F1E9] text-[#0E0C0B]",
          "h-11 items-center"
        )}>
          {/* Left Column: Spacer matching vehicle info width */}
          <div className={cn(
            "w-[285px] px-4 border-r shrink-0 flex items-center justify-between transition-colors h-full",
            isDarkMode ? "border-white/5 bg-[#231F1D]" : "border-[#F5F1E9]/50 bg-[#F5F1E9]/30"
          )}>
            <span className={cn(
              "text-[8px] font-black tracking-widest uppercase",
              isDarkMode ? "text-gray-500" : "text-gray-400"
            )}>
              CALENDAR SLIDE
            </span>
            <RotateCcw 
              className={cn(
                "w-3 h-3 cursor-pointer transition-all active:scale-90",
                escalatorOffsetDays === 0
                  ? "text-gray-600/30 cursor-not-allowed"
                  : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black")
              )}
              onClick={() => {
                if (escalatorOffsetDays !== 0) {
                  setEscalatorOffsetDays(0);
                }
              }}
              title="Reset slide to today"
            />
          </div>

          {/* Right Column: Left/Right Arrow Navigation */}
          <div className={cn(
            "flex-1 flex justify-between items-center px-4 h-full relative z-30",
            isDarkMode ? "bg-[#1A1614]/50" : "bg-white/50"
          )}>
            {/* Left Arrow Button */}
            <button
              type="button"
              onClick={() => setEscalatorOffsetDays(prev => prev - 1)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border shadow-md hover:scale-105 active:scale-95",
                isDarkMode 
                  ? "bg-[#2C2724] border-white/5 text-white hover:border-[#FF5C35]/50 hover:bg-[#FF5C35]/10" 
                  : "bg-white border-black/10 text-black hover:border-[#FF5C35] hover:bg-[#FF5C35]/5"
              )}
              title="Slide calendar left by 1 day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Middle Indicator */}
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.3em] select-none",
              isDarkMode ? "text-gray-500" : "text-gray-400"
            )}>
              {escalatorOffsetDays !== 0 ? `SHIFTED ${Math.abs(escalatorOffsetDays)} DAY${Math.abs(escalatorOffsetDays) > 1 ? 'S' : ''} ${escalatorOffsetDays > 0 ? '▶' : '◀'}` : '◀ SLIDE TIMELINE ▶'}
            </span>

            {/* Right Arrow Button */}
            <button
              type="button"
              onClick={() => setEscalatorOffsetDays(prev => prev + 1)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border shadow-md hover:scale-105 active:scale-95",
                isDarkMode 
                  ? "bg-[#2C2724] border-white/5 text-white hover:border-[#FF5C35]/50 hover:bg-[#FF5C35]/10" 
                  : "bg-white border-black/10 text-black hover:border-[#FF5C35] hover:bg-[#FF5C35]/5"
              )}
              title="Slide calendar right by 1 day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Vehicle Color Picker Tooltip Pill */}
      {editingColorId && colorCoords && createPortal(
        <div className="fixed inset-0 z-[99999] pointer-events-auto flex items-start justify-start">
          <div 
            className="fixed inset-0 bg-transparent" 
            onClick={() => setEditingColorId(null)} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            className={cn(
              "fixed z-[100000] p-2.5 rounded-2xl shadow-2xl border-2 transition-all grid grid-cols-5 gap-1.5 min-w-[130px]",
              isDarkMode 
                ? "bg-[#1C1816]/95 border-[#FF5C35]/50 backdrop-blur-md" 
                : "bg-white border-[#FF5C35] text-[#0E0C0B]"
            )}
            style={{ 
              top: colorCoords.top + 30, 
              left: colorCoords.left
            }}
          >
            {MAIN_CAR_COLORS.map((color) => {
              const car = dbVehicles.find(v => String(v.id) === editingColorId);
              const isCurrent = car?.color === color.value;
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleSaveColor(color.value)}
                  title={color.name}
                  className={cn(
                    "w-5 h-5 rounded-full border transition-transform hover:scale-115 cursor-pointer shadow-sm relative overflow-hidden",
                    isCurrent 
                      ? (isDarkMode ? "border-white scale-110" : "border-black scale-110") 
                      : (isDarkMode ? "border-white/10" : "border-black/10")
                  )}
                  style={{ backgroundColor: color.value }}
                >
                  {isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Check className={cn("w-3 h-3 stroke-[3]", color.value === '#FFFFFF' ? "text-black" : "text-white")} />
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        </div>,
        document.body
      )}

      {/* Chassis Number Tooltip Pill */}
      {editingChassisId && chassisCoords && createPortal(
        <div className="fixed inset-0 z-[99999] pointer-events-auto flex items-start justify-start">
          <div 
            className="fixed inset-0 bg-transparent" 
            onClick={() => {
              setEditingChassisId(null);
              setIsEditingChassis(false);
            }} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            className={cn(
              "fixed z-[100000] flex items-center gap-2 px-3 py-1.5 rounded-full shadow-2xl border-2 transition-all min-w-[120px]",
              isDarkMode 
                ? "bg-[#1A1614] border-[#FF5C35]/50 text-white" 
                : "bg-white border-[#FF5C35] text-[#0E0C0B]"
            )}
            style={{ 
              top: chassisCoords.top - 48, 
              left: chassisCoords.left
            }}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-[9px] font-black tracking-widest text-[#FF5C35] shrink-0">VIN:</span>
              
              {isEditingChassis ? (
                <>
                  <input
                    autoFocus
                    value={chassisInput || ''}
                    onChange={(e) => setChassisInput(e.target.value)}
                    placeholder="+"
                    className={cn(
                      "bg-transparent border-none outline-none text-[11px] font-mono font-black uppercase tracking-wider w-full placeholder:text-[#FF5C35]",
                      isDarkMode ? "text-white" : "text-[#0E0C0B]"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveChassis();
                      if (e.key === 'Escape') {
                        const car = dbVehicles.find(v => String(v.id) === editingChassisId);
                        if (car?.chassisNumber) {
                          setIsEditingChassis(false);
                          setChassisInput(car.chassisNumber);
                        } else {
                          setEditingChassisId(null);
                        }
                      }
                    }}
                  />
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={handleSaveChassis}
                      className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        const car = dbVehicles.find(v => String(v.id) === editingChassisId);
                        if (car?.chassisNumber) {
                          setIsEditingChassis(false);
                          setChassisInput(car.chassisNumber);
                        } else {
                          setEditingChassisId(null);
                        }
                      }}
                      className="w-5 h-5 rounded-full bg-gray-500/20 text-gray-500 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={cn(
                    "text-[11px] font-mono font-black uppercase tracking-wider w-full truncate",
                    isDarkMode ? "text-white" : "text-[#0E0C0B]"
                  )}>
                    {chassisInput || '+'}
                  </span>
                  <button
                    onClick={() => setIsEditingChassis(true)}
                    className="w-5 h-5 rounded-full bg-[#FF5C35]/10 text-[#FF5C35] flex items-center justify-center cursor-pointer ml-1"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
            {/* Arrow */}
            <div className={cn(
              "absolute -bottom-[8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px]",
              isDarkMode ? "border-t-[#FF5C35]/50" : "border-t-[#FF5C35]"
            )} />
          </motion.div>
        </div>,
        document.body
      )}

        {/* Active Bookings Panel */}
        <ActiveBookingsPanel 
          isDarkMode={isDarkMode}
          userReservations={userReservations}
          dbVehicles={dbVehicles}
          currentSystemTime={currentSystemTime}
          reservationFilter={reservationFilter}
          setReservationFilter={setReservationFilter}
          isDataLoading={isDataLoading}
          setSelectedClientBooking={setSelectedClientBooking}
          handleAuditClick={handleAuditClick}
          nonStatusEditIds={nonStatusEditIds}
          setEditingReservation={setEditingReservation}
          setModalMode={setModalMode}
          setIsModalOpen={setIsModalOpen}
          setNoteCoords={setNoteCoords}
          setEditingNoteId={setEditingNoteId}
          setNoteContent={setNoteContent}
          setIsEditingNote={setIsEditingNote}
          setSelectedDocReservationId={setSelectedDocReservationId}
          setIsDocumentPanelOpen={setIsDocumentPanelOpen}
          sentCashflowIds={sentCashflowIds}
          setCashflowPopupCoords={setCashflowPopupCoords}
          setCashflowPopupId={setCashflowPopupId}
          fetchPaymentSummary={fetchPaymentSummary}
          setActionMenuCoords={setActionMenuCoords}
          setActionMenuId={setActionMenuId}
          setReservationToComplete={setReservationToComplete}
          setIsCompleteModalOpen={setIsCompleteModalOpen}
          countriesPopupId={countriesPopupId}
          setCountriesPopupId={setCountriesPopupId}
          setCountriesPopupCoords={setCountriesPopupCoords}
          setHoveredCountriesCoords={setHoveredCountriesCoords}
          setHoveredCountriesId={setHoveredCountriesId}
        />
      </div>

      {/* Add Car Modal */}
      {isAddCarModalOpen && (
        <AddVehicleModal
          isOpen={isAddCarModalOpen}
          onClose={() => setIsAddCarModalOpen(false)}
          isDarkMode={isDarkMode}
          dbVehicles={dbVehicles}
          userReservations={userReservations}
          tyreTypes={tyreTypes}
          handleStatusClick={handleStatusClick}
          getTextColorForBg={getTextColorForBg}
        />
      )}

      {isModalOpen && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingReservation(null);
          }}
          isDarkMode={isDarkMode}
          sidebarColor={sidebarColor}
          vehicles={dbVehicles}
          allReservations={userReservations}
          initialData={editingReservation || undefined}
          mode={modalMode}
          onSaveReservation={async (res) => {
          try {
            let currentClientId = res.clientId;

            // --- STEP 1: Handling New Reservation (Creation) ---
            const isNew = !res.id || !userReservations.some(r => String(r.id) === String(res.id));
            if (isNew) {
              const clientsRef = collection(db, 'clients');
              let clientDoc = null;
              
              const resName = (res.name || '').trim().toLowerCase();
              const resEmail = (res.email || '').trim().toLowerCase();
              const resPhone = (res.phone || '').trim();
              const resPassport = (res.passportId || '').trim().toLowerCase();
              const resLicense = (res.driverLicenseId || '').trim().toLowerCase();

              const isAllFourValid = 
                isValidMatchValue(resPhone) &&
                isValidMatchValue(resEmail) &&
                isValidMatchValue(resPassport) &&
                isValidMatchValue(resLicense);

              if (isAllFourValid) {
                // Only match if ALL 4 fields are identical. We query by passportId and verify the other 3 client-side.
                const q = query(clientsRef, where("passportId", "==", res.passportId.trim()));
                const snap = await getDocs(q);
                for (const docSnap of snap.docs) {
                  const clientData = docSnap.data();
                  const cPhone = (clientData.phone || '').trim().toLowerCase();
                  const cEmail = (clientData.email || '').trim().toLowerCase();
                  const cPassport = (clientData.passportId || '').trim().toLowerCase();
                  const cLicense = (clientData.licenseId || '').trim().toLowerCase();

                  if (
                    cPhone === resPhone.toLowerCase() &&
                    cEmail === resEmail &&
                    cPassport === resPassport &&
                    cLicense === resLicense
                  ) {
                    clientDoc = docSnap;
                    break;
                  }
                }
              }

              // Fallback match for demo/test clients with exact identical info
              if (!clientDoc) {
                const snap = await getDocs(clientsRef);
                for (const docSnap of snap.docs) {
                  const clientData = docSnap.data();
                  const cName = (clientData.name || '').trim().toLowerCase();
                  const cPhone = (clientData.phone || '').trim();
                  const cEmail = (clientData.email || '').trim().toLowerCase();
                  const cPassport = (clientData.passportId || '').trim().toLowerCase();
                  const cLicense = (clientData.licenseId || '').trim().toLowerCase();

                  if (cName === resName && cName !== '' && cName !== 'unknown') {
                    let matchesCount = 0;
                    const isNonEmptyVal = (v: string) => v.length > 1 && v !== '-' && v !== '/' && v !== 'no' && v !== 'none';
                    if (isNonEmptyVal(resPhone) && resPhone === cPhone) matchesCount++;
                    if (isNonEmptyVal(resPassport) && resPassport === cPassport) matchesCount++;
                    if (isNonEmptyVal(resLicense) && resLicense === cLicense) matchesCount++;
                    if (isNonEmptyVal(resEmail) && resEmail === cEmail) matchesCount++;

                    if (matchesCount >= 2) {
                      clientDoc = docSnap;
                      break;
                    }
                  }
                }
              }

              if (clientDoc) {
                currentClientId = clientDoc.id;
              } else {
                // STEP 1: Handling New Clients
                // Create basic profile document with metrics strictly at 0.
                
                const TOTAL_AVAILABLE_AVATARS = 3;
                
                const clientGender = guessGenderFromName(res.name || '');
                const randomAvatarIndex = Math.floor(Math.random() * TOTAL_AVAILABLE_AVATARS) + 1;
                const clientAvatarPath = `public/avatars/${clientGender}/${clientGender}${randomAvatarIndex}.png`;

                currentClientId = `client_${Date.now()}`;
                await setDoc(doc(db, 'clients', currentClientId), {
                  id: currentClientId,
                  name: res.name || '',
                  email: (res.email || '').trim().toLowerCase(),
                  phone: (res.phone || '').trim(),
                  licenseId: res.driverLicenseId || '',
                  passportId: res.passportId || '',
                  rentalCount: 0,
                  totalDaysRented: 0,
                  totalSpent: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  gender: clientGender,
                  avatar: clientAvatarPath
                });
              }

              // Create the reservation
              const id = (res.id && res.id !== 'undefined' && res.id !== 'null') ? res.id : String(Date.now());
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id: _, ...resWithoutId } = res;
              const finalTotalPrice = Number(res.totalPrice) || 0;
              
              const matchingCar = dbVehicles.find((v: any) => String(v.id) === String(res.vehicleId));
              const isExtraCar = matchingCar && (matchingCar.isExtra || matchingCar.name === 'EXTRA' || String(matchingCar.id).startsWith('extra-'));
              let snapPlate = '';
              let snapName = '';
              if (isExtraCar && matchingCar && matchingCar.plate) {
                snapPlate = matchingCar.plate;
                snapName = matchingCar.extraName || 'EXTRA';
              }

              const newRes = {
                ...resWithoutId,
                clientId: currentClientId,
                status: res.status || 'UPCOMING',
                amountPaid: finalTotalPrice,
                paymentMethod: 'cash',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                snapshotExtraPlate: snapPlate,
                snapshotExtraName: snapName
              };
              await setDoc(doc(db, 'reservations', id), newRes);

              // Automatically add 100% Cash payment in paymenthistory
              await addDoc(collection(db, 'reservations', id, 'paymentHistory'), {
                amount: finalTotalPrice,
                method: 'Cash',
                timestamp: Date.now()
              });

              // Update global stats if created as completed (rare but possible via modal)
              if (newRes.status === 'COMPLETED') {
                // If created as COMPLETED, we DO update client stats now (same as Step 3 logic)
                await updateDoc(doc(db, 'clients', currentClientId), {
                  rentalCount: increment(1),
                  totalDaysRented: increment(res.days || 0),
                  totalSpent: increment(Number(res.totalPrice) || 0),
                  updatedAt: Date.now()
                });
                await updateStatsOnStatusChange(undefined, 'COMPLETED', Number(newRes.totalPrice));
              } else if (newRes.status === 'CANCELLED') {
                await updateStatsOnStatusChange(undefined, 'CANCELLED', Number(newRes.totalPrice));
              }

            } else {
              // --- STEP 2: Modifying a Reservation (The Edit Pen Action) ---
              const oldRes = userReservations.find(r => String(r.id) === String(res.id));
              if (!oldRes) return;

              const reservationRef = doc(db, 'reservations', String(res.id));
              const updatedStatus = res.status || oldRes.status;
              
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id: _, ...resWithoutId } = res;
              // Remove undefined fields
              const updateData: Record<string, unknown> = {
                ...resWithoutId,
                updatedAt: Date.now()
              };

              const matchingCar = dbVehicles.find((v: any) => String(v.id) === String(res.vehicleId));
              const isExtraCar = matchingCar && (matchingCar.isExtra || matchingCar.name === 'EXTRA' || String(matchingCar.id).startsWith('extra-'));
              if (isExtraCar && matchingCar && matchingCar.plate) {
                updateData.snapshotExtraPlate = matchingCar.plate;
                updateData.snapshotExtraName = matchingCar.extraName || 'EXTRA';
              } else {
                updateData.snapshotExtraPlate = '';
                updateData.snapshotExtraName = '';
              }
              
              if (currentClientId || res.clientId) {
                updateData.clientId = currentClientId || res.clientId;
              }

              Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) delete updateData[key];
              });

              // Create Audit Log BEFORE actual update to avoid listener/cache race conditions
              try {
                const changedFields: Record<string, { oldValue: any; newValue: any }> = {};
                
                const getDateString = (val: any) => {
                  if (!val) return '';
                  try {
                    let d: Date | null = null;
                    if (val instanceof Date) {
                      d = val;
                    } else if (typeof val === 'object') {
                      if ('toDate' in val && typeof val.toDate === 'function') d = val.toDate();
                      else if ('seconds' in val && typeof val.seconds === 'number') d = new Date(val.seconds * 1000);
                    } else if (typeof val === 'string' || typeof val === 'number') {
                      d = new Date(val);
                    }
                    if (d && !isNaN(d.getTime())) {
                      return format(d, 'yyyy-MM-dd');
                    }
                  } catch (_) {}
                  return '';
                };

                const getComparableValue = (val: any) => {
                  if (val === null || val === undefined) return val;
                  if (val instanceof Date) return val.getTime();
                  if (typeof val === 'object') {
                    if ('toDate' in val && typeof val.toDate === 'function') return val.toDate().getTime();
                    if ('seconds' in val && typeof val.seconds === 'number') return val.seconds * 1000;
                  }
                  return val;
                };

                Object.keys(updateData).forEach(key => {
                  if (key === 'updatedAt' || key === 'uploadedDocuments') return;
                  const oldValue = oldRes[key as keyof typeof oldRes];
                  const newValue = updateData[key];
                  
                  if (key === 'start' || key === 'end') {
                    const oldDateStr = getDateString(oldValue);
                    const newDateStr = getDateString(newValue);
                    if (oldDateStr !== newDateStr) {
                      changedFields[key] = {
                        oldValue: oldValue !== undefined ? oldValue : null,
                        newValue: newValue !== undefined ? newValue : null
                      };
                    }
                    return;
                  }
                  
                  const isOldObj = typeof oldValue === 'object' && oldValue !== null;
                  const isNewObj = typeof newValue === 'object' && newValue !== null;
                  
                  if (isOldObj || isNewObj) {
                    const normOld = getComparableValue(oldValue);
                    const normNew = getComparableValue(newValue);
                    if (JSON.stringify(normOld) !== JSON.stringify(normNew)) {
                      changedFields[key] = { 
                        oldValue: oldValue !== undefined ? oldValue : null, 
                        newValue: newValue !== undefined ? newValue : null 
                      };
                    }
                  } else if (oldValue !== newValue) {
                    changedFields[key] = { 
                      oldValue: oldValue !== undefined ? oldValue : null, 
                      newValue: newValue !== undefined ? newValue : null 
                    };
                  }
                });

                if (Object.keys(changedFields).length > 0) {
                  let logAction = 'reservation_updated';
                  const changedKeys = Object.keys(changedFields);
                  if (changedKeys.includes('totalPrice') || changedKeys.includes('amountPaid')) {
                    logAction = 'price_updated';
                  } else if (changedKeys.includes('status')) {
                    logAction = 'status_changed';
                  } else if (changedKeys.includes('name') || changedKeys.includes('email') || changedKeys.includes('phone')) {
                    logAction = 'contact_info_changed';
                  } else if (
                    changedKeys.includes('start') || 
                    changedKeys.includes('end') || 
                    changedKeys.includes('fromLocation') || 
                    changedKeys.includes('toLocation') || 
                    changedKeys.includes('vehicleId') || 
                    changedKeys.includes('vehicle')
                  ) {
                    logAction = 'booking_details_changed';
                  }

                  const changedByEmail = auth.currentUser?.email || 'admin@momo.com';

                  const isNonStatusUpdate = logAction !== 'status_changed';
                  const parentData: any = {
                    reservationId: String(res.id),
                    updatedAt: serverTimestamp()
                  };
                  if (isNonStatusUpdate) {
                    parentData.hasNonStatusEdits = true;
                  }

                  // 1. Set parent marker document with reservation id
                  await setDoc(doc(db, 'auditLogs', String(res.id)), parentData, { merge: true });

                  // 2. Add change record in the changes subcollection
                  await addDoc(collection(db, 'auditLogs', String(res.id), 'changes'), {
                    reservationId: String(res.id),
                    changedBy: changedByEmail,
                    timestamp: serverTimestamp(),
                    action: logAction,
                    changedFields: changedFields
                  });

                  setEditedReservationIds(prev => {
                    const next = new Set(prev);
                    next.add(String(res.id));
                    return next;
                  });
                  if (logAction !== 'status_changed') {
                    setNonStatusEditIds(prev => {
                      const next = new Set(prev);
                      next.add(String(res.id));
                      return next;
                    });
                  }
                }
              } catch (auditErr: any) {
                console.error("Failed to write audit log:", auditErr);
                if (auditErr?.code === 'permission-denied' || auditErr?.message?.includes('permission')) {
                  handleFirestoreError(auditErr, OperationType.CREATE, `auditLogs/${String(res.id)}/changes`);
                }
              }

              await updateDoc(reservationRef, updateData);

              // Synchronize matching cashflow logs if they exist in firestore
              try {
                const getRawDate = (d: any) => {
                  if (!d) return '';
                  if (d instanceof Date) return d.toISOString();
                  if (typeof d === 'object' && typeof d.toDate === 'function') {
                    try {
                      return d.toDate().toISOString();
                    } catch (e) {
                      return '';
                    }
                  }
                  return String(d);
                };

                const cashflowUpdate: Record<string, any> = {};
                if (updateData.fromLocation !== undefined) cashflowUpdate.fromLocation = updateData.fromLocation;
                if (updateData.toLocation !== undefined) cashflowUpdate.toLocation = updateData.toLocation;
                if (updateData.start !== undefined) cashflowUpdate.start = getRawDate(updateData.start);
                if (updateData.end !== undefined) cashflowUpdate.end = getRawDate(updateData.end);
                if (updateData.arrivalTime !== undefined) cashflowUpdate.arrivalTime = updateData.arrivalTime;
                if (updateData.departureTime !== undefined) cashflowUpdate.departureTime = updateData.departureTime;
                if (res.name !== undefined) cashflowUpdate.name = res.name;
                if (updateData.vehicleId !== undefined) cashflowUpdate.vehicleId = updateData.vehicleId;
                if (updateData.days !== undefined) cashflowUpdate.days = updateData.days;
                if (updateData.totalPrice !== undefined) cashflowUpdate.totalPrice = updateData.totalPrice;
                if (updateData.amountPaid !== undefined) cashflowUpdate.amountPaid = updateData.amountPaid;

                if (Object.keys(cashflowUpdate).length > 0) {
                  cashflowUpdate.updatedAt = Date.now();
                  // Directly set/merge the cashflow document using the reservation ID as the doc ID.
                  // This is extremely fast and avoids list query permission errors.
                  await setDoc(doc(db, 'cashflow', String(res.id)), cashflowUpdate, { merge: true });
                }
              } catch (cfSyncErr) {
                console.error("Failed to sync edited reservation fields with cashflow logs in Firestore:", cfSyncErr);
              }

              // Keep the master client profile updated with any edits made during the reservation modification
              const clientId = res.clientId || oldRes.clientId;
              if (clientId) {
                const clientUpdate: Record<string, any> = {};
                if (res.name && res.name !== oldRes.name) {
                  clientUpdate.name = res.name;
                }
                if (res.email && res.email !== oldRes.email) {
                  clientUpdate.email = (res.email || '').trim().toLowerCase();
                }
                if (res.phone && res.phone !== oldRes.phone) {
                  clientUpdate.phone = (res.phone || '').trim();
                }
                if (res.passportId && res.passportId !== oldRes.passportId) {
                  clientUpdate.passportId = (res.passportId || '').trim();
                }
                if (res.driverLicenseId && res.driverLicenseId !== oldRes.driverLicenseId) {
                  clientUpdate.licenseId = (res.driverLicenseId || '').trim();
                }

                if (Object.keys(clientUpdate).length > 0) {
                  clientUpdate.updatedAt = Date.now();
                  try {
                    await updateDoc(doc(db, 'clients', clientId), clientUpdate);
                  } catch (clientErr) {
                    console.error("Failed to sync master client profile:", clientErr);
                  }
                }
              }

              // Invalidate audit logs cache for this reservation so it will refetch on next hover
              setAuditLogsMap(prev => {
                const next = { ...prev };
                delete next[String(res.id)];
                return next;
              });

              // Logic Requirement for Editing:
              // If reservation status is "Completed", added days and price should be added to client card.
              if (updatedStatus === 'COMPLETED') {
                const clientId = res.clientId || oldRes.clientId;
                if (clientId) {
                  const wasCompleted = oldRes.status === 'COMPLETED';
                  
                  if (!wasCompleted) {
                    // Just became completed: increment rentalCount and add full values
                    await updateDoc(doc(db, 'clients', clientId), {
                      rentalCount: increment(1),
                      totalDaysRented: increment(res.days || 0),
                      totalSpent: increment(Number(res.totalPrice) || 0),
                      updatedAt: Date.now()
                    });
                  } else {
                    // Was already completed: update with difference
                    const diffDays = (res.days || 0) - (oldRes.days || 0);
                    const diffPrice = (Number(res.totalPrice) || 0) - (Number(oldRes.totalPrice) || 0);

                    if (diffDays !== 0 || diffPrice !== 0) {
                      await updateDoc(doc(db, 'clients', clientId), {
                        totalDaysRented: increment(diffDays),
                        totalSpent: increment(diffPrice),
                        updatedAt: Date.now()
                      });
                    }
                  }
                }
              }

              // Update global stats
              if (oldRes.status !== updatedStatus || Number(res.totalPrice) !== oldRes.totalPrice) {
                await updateStatsOnStatusChange(oldRes.status, updatedStatus, Number(res.totalPrice) || oldRes.totalPrice);
              }
            }
          } catch (err: unknown) {
            const error = err as { code?: string, message?: string };
            console.error("Detailed Reservation Save Error:", err);
            if (error.code === 'permission-denied' || error.message?.includes('permission')) {
              handleFirestoreError(err, res.id ? OperationType.UPDATE : OperationType.CREATE, `reservations/${res.id || 'new_id_attempt'}`);
            } else {
              alert("Failed to save reservation: " + error.message);
              throw err;
            }
          }
        }}
      />
      )}

      {isCancellationModalOpen && (
        <CancellationModal
          isOpen={isCancellationModalOpen}
          onClose={() => {
            setIsCancellationModalOpen(false);
            setReservationToCancel(null);
          }}
          onConfirm={handleConfirmCancellation}
          isDarkMode={isDarkMode}
        />
      )}

      {isCompleteModalOpen && (
        <CompleteConfirmationModal
          isOpen={isCompleteModalOpen}
          onClose={() => {
            setIsCompleteModalOpen(false);
            setReservationToComplete(null);
          }}
          onConfirm={() => {
            if (reservationToComplete) {
              handleUpdateStatus(reservationToComplete.id, 'COMPLETED');
            }
          }}
          isDarkMode={isDarkMode}
          clientName={reservationToComplete?.client}
          vehicleName={reservationToComplete?.vehicle}
          startDate={reservationToComplete?.start}
          endDate={reservationToComplete?.end}
        />
      )}

      {/* Car Relocation / Country Update Modal */}
      {selectedCarForLocationUpdate && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setSelectedCarForLocationUpdate(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "relative w-full max-w-md rounded-[32px] shadow-2xl border p-6 flex flex-col overflow-hidden",
              isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-150"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                  TAG CAR LOCATION
                </h2>
                <p className="text-[9px] font-bold text-emerald-500 tracking-[0.2em] uppercase mt-1">
                  TAG VEHICLE LOCATION
                </p>
              </div>
              <button 
                onClick={() => setSelectedCarForLocationUpdate(null)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:rotate-90 cursor-pointer",
                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={cn(
              "p-4 rounded-2xl mb-5 border",
              isDarkMode ? "bg-[#1E1B1A]/80 border-white/5" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vehicle</span>
                  <span className={cn("text-xs font-black uppercase", isDarkMode ? "text-white" : "text-black")}>
                    {selectedCarForLocationUpdate.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Plate Number</span>
                  <span className="font-mono text-xs font-bold text-gray-700 bg-gray-200/50 px-1.5 py-0.5 rounded">
                    {selectedCarForLocationUpdate.plate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Home Country</span>
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COUNTRY_COLORS[selectedCarForLocationUpdate.country || 'Macedonia'] }}
                    />
                    <span className={cn("text-xs font-black uppercase", isDarkMode ? "text-white" : "text-black")}>
                      {selectedCarForLocationUpdate.country || 'Macedonia'}
                    </span>
                  </div>
                </div>
                {selectedCarForLocationUpdate.forcedPhysicalCountry && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Tag</span>
                    <span className={cn("text-xs font-black uppercase text-emerald-500", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                      IN {selectedCarForLocationUpdate.forcedPhysicalCountry.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>



            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3 text-center">
              Select a country to set location tag:
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {(() => {
                const home = selectedCarForLocationUpdate.country || 'Macedonia';
                const options = VEHICLE_COUNTRIES;
                return options.map((country) => {
                  const isHome = country === home;
                  return (
                    <button
                      key={country}
                      onClick={() => handleRelocateCar(country)}
                      className={cn(
                        "group p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.03] hover:shadow-md cursor-pointer relative",
                        isDarkMode 
                          ? "bg-[#1E1B1A]/80 border-white/5 hover:border-emerald-500 hover:bg-emerald-500/5" 
                          : "bg-white border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20"
                      )}
                    >
                      {isHome && (
                        <span className="absolute top-1.5 right-1.5 px-1 py-px text-[7px] font-black uppercase bg-emerald-500 text-white rounded">
                          HOME
                        </span>
                      )}
                      <div 
                        className="w-4 h-4 rounded-full border border-black/10 flex items-center justify-center"
                        style={{ backgroundColor: COUNTRY_COLORS[country] }}
                      />
                      <span className={cn(
                        "text-xs font-extrabold uppercase tracking-wider group-hover:text-emerald-500 transition-colors",
                        isDarkMode ? "text-white" : "text-black"
                      )}>
                        {country}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>

            <p className="text-[9px] text-gray-400 text-center uppercase tracking-wide">
              * Setting location tag automatically sets its status to <span className="font-bold text-emerald-500">AVAILABLE</span> and keeps status notes/colors.
            </p>
          </motion.div>
        </div>
      )}

      {/* Portals for tooltips */}
      {hoveredCountriesId && hoveredCountriesCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: hoveredCountriesCoords.top,
            left: hoveredCountriesCoords.left,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }}
        >
          {(() => {
            const booking = userReservations.find(b => String(b.id) === String(hoveredCountriesId));
            if (!booking || !booking.countries || !booking.countries.length) return null;
            return (
              <div className={cn(
                "p-2 rounded-xl border shadow-2xl min-w-[120px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200",
                isDarkMode 
                  ? "bg-[#2C2724]/90 border-white/10 text-white" 
                  : "bg-white/90 border-black/5 text-[#0E0C0B]"
              )}>
                <p className="text-[8px] font-black tracking-widest uppercase mb-1 opacity-50">Authorized Countries</p>
                <div className="flex flex-wrap gap-1">
                  {booking.countries.map((country, idx) => (
                    <span key={idx} className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
                      isDarkMode ? "bg-white/10" : "bg-black/5"
                    )}>
                      {country}
                    </span>
                  ))}
                </div>
                <div className={cn(
                  "absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent",
                  isDarkMode ? "border-t-[#2C2724]/90" : "border-t-white/90"
                )} />
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Audit Log Tooltip Portal */}
      {hoveredAuditId && hoveredAuditCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-auto"
          style={{
            top: hoveredAuditCoords.top,
            left: hoveredAuditCoords.left,
            transform: hoveredAuditCoords.align === 'right' 
              ? `translate(12px, calc(-50% + ${auditAdjustY}px))` 
              : `translate(calc(-100% - 12px), calc(-50% + ${auditAdjustY}px))`
          }}
        >
          {(() => {
            const state = auditLogsMap[hoveredAuditId];
            if (!state) return null;
            
            const visibleLogs = (state.logs || []).filter((log: any) => {
              if (log.action === 'status_changed') return false;
              if (log.changedFields) {
                const keys = Object.keys(log.changedFields).filter(k => k !== 'status' && k !== 'uploadedDocuments');
                return keys.length > 0;
              }
              return true;
            });
            
            const renderVal = (v: any) => {
              if (v === null || v === undefined) return 'None';
              
              // Handle Firestore Timestamp
              if (typeof v === 'object' && v !== null && 'seconds' in v) {
                try {
                  const d = new Date(v.seconds * 1000);
                  return format(d, 'yyyy-MM-dd');
                } catch (_) {}
              }
              
              // Handle Date objects
              if (v instanceof Date) {
                return format(v, 'yyyy-MM-dd');
              }
              
              // Handle arrays
              if (Array.isArray(v)) {
                return v.join(', ') || 'Empty';
              }
              
              // Handle insurance or custom objects
              if (typeof v === 'object' && v !== null) {
                if ('type' in v) return `Type ${v.type} (€${v.price ?? ''})`;
                return v.name || JSON.stringify(v);
              }
              
              return String(v);
            };

            return (
              <div 
                ref={auditPanelRef}
                className={cn(
                  "audit-log-panel p-5 rounded-3xl border shadow-2xl w-[540px] max-w-[95vw] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 text-left pointer-events-auto relative",
                  isDarkMode 
                    ? "bg-[#2C2724]/95 border-white/10 text-white" 
                    : "bg-white/95 border-neutral-200 text-neutral-900"
                )}
              >
                <div className={cn(
                  "flex items-center justify-between mb-4 border-b pb-2",
                  isDarkMode ? "border-white/10" : "border-neutral-200"
                )}>
                  <p className="text-[14px] font-black tracking-widest uppercase font-sans">
                    Reservation Audit Log
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoveredAuditId(null);
                    }}
                    className={cn(
                      "text-xl font-bold leading-none select-none p-1 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer",
                      isDarkMode 
                        ? "text-white/60 hover:bg-white/10 hover:text-white" 
                        : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                  >
                    ×
                  </button>
                </div>
                
                {state.loading ? (
                  <div className={cn(
                    "flex items-center gap-2 py-8 justify-center text-sm font-bold",
                    isDarkMode ? "text-white" : "text-neutral-900"
                  )}>
                    <Loader2 className="w-5 h-5 animate-spin text-[#FF5C35]" />
                    <span>Loading audit records...</span>
                  </div>
                ) : state.error ? (
                  <p className="text-sm font-bold text-red-500 py-6 text-center">Failed to load logs</p>
                ) : visibleLogs.length === 0 ? (
                  <p className={cn(
                    "text-sm font-bold py-6 text-center uppercase tracking-wider opacity-60",
                    isDarkMode ? "text-white" : "text-neutral-900"
                  )}>No changes recorded</p>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1 pb-1 w-full custom-scrollbar scroll-smooth">
                    {visibleLogs.map((log) => {
                      const actionLabels: Record<string, string> = {
                        'price_updated': 'Price Updated',
                        'status_changed': 'Status Changed',
                        'contact_info_changed': 'Contact Changed',
                        'booking_details_changed': 'Details Changed',
                        'reservation_updated': 'Reservation Updated'
                      };
                      const actionLabel = actionLabels[log.action] || log.action;
                      
                      return (
                        <div 
                          key={log.id} 
                          className={cn(
                            "w-full border rounded-2xl p-4 flex flex-col justify-between shadow-sm",
                            isDarkMode 
                              ? "bg-white/5 border-white/10 text-white" 
                              : "bg-neutral-50 border-neutral-200 text-neutral-900"
                          )}
                        >
                          <div>
                            <div className={cn(
                              "flex items-center justify-between gap-1 mb-2 border-b pb-1.5",
                              isDarkMode ? "border-white/10" : "border-neutral-200"
                            )}>
                              <span className="text-sm font-black text-[#FF5C35] uppercase truncate flex-1 min-w-0 pr-1">
                                {actionLabel}
                              </span>
                              <span className={cn(
                                "text-xs font-bold font-mono flex-shrink-0",
                                isDarkMode ? "text-white/60" : "text-neutral-500"
                              )}>
                                {log.formattedTime.split(' ')[1] || log.formattedTime}
                              </span>
                            </div>
                            <div className={cn(
                              "flex flex-col gap-1.5 text-xs font-sans font-medium mb-3 pb-2 border-b",
                              isDarkMode ? "text-white/80 border-white/5" : "text-neutral-700 border-neutral-200/50"
                            )}>
                              <div className="flex items-center gap-2">
                                <span className="text-[#FF5C35] font-bold text-[10.5px] uppercase tracking-wider w-11 shrink-0">BY:</span> 
                                <span className={cn("font-extrabold text-[11.5px]", isDarkMode ? "text-white" : "text-neutral-900")}>
                                  {log.changedBy}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#FF5C35] font-bold text-[10.5px] uppercase tracking-wider w-11 shrink-0">DATE:</span> 
                                <span className={cn("font-extrabold text-[11.5px]", isDarkMode ? "text-white" : "text-neutral-900")}>
                                  {log.formattedTime.split(' ')[0]}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                              {log.changedFields && Object.keys(log.changedFields).filter(field => field !== 'status' && field !== 'uploadedDocuments').map((field) => {
                                const oldVal = log.changedFields[field]?.oldValue;
                                const newVal = log.changedFields[field]?.newValue;
                                
                                const getFieldLabel = (rawField: string) => {
                                  const mapping: Record<string, string> = {
                                    'totalPrice': 'Total Price',
                                    'amountPaid': 'Amount Paid',
                                    'status': 'Status',
                                    'name': 'Client Name',
                                    'email': 'Client Email',
                                    'phone': 'Client Phone',
                                    'start': 'Start Date',
                                    'end': 'End Date',
                                    'fromLocation': 'From Loc',
                                    'toLocation': 'To Loc',
                                    'vehicleId': 'Vehicle Name',
                                    'vehicle': 'Vehicle Name',
                                    'note': 'Notes',
                                    'countries': 'Countries',
                                    'insurance': 'Insurance'
                                  };
                                  return mapping[rawField] || rawField;
                                };
   
                                const isPriceField = field === 'totalPrice' || field === 'amountPaid';
                                
                                let displayOld = '';
                                let displayNew = '';
                                
                                if ((field === 'vehicleId' || field === 'vehicle') && dbVehicles) {
                                  const foundOld = dbVehicles.find(veh => 
                                    String(veh.id) === String(oldVal) || 
                                    veh.name?.toLowerCase() === String(oldVal).toLowerCase()
                                  );
                                  const foundNew = dbVehicles.find(veh => 
                                    String(veh.id) === String(newVal) || 
                                    veh.name?.toLowerCase() === String(newVal).toLowerCase()
                                  );
                                  displayOld = foundOld ? `${foundOld.name} (${foundOld.plate})` : String(oldVal || 'Unknown');
                                  displayNew = foundNew ? `${foundNew.name} (${foundNew.plate})` : String(newVal || 'Unknown');
                                } else {
                                  displayOld = isPriceField && typeof oldVal === 'number' ? `€${oldVal}` : renderVal(oldVal);
                                  displayNew = isPriceField && typeof newVal === 'number' ? `€${newVal}` : renderVal(newVal);
                                }
   
                                return (
                                  <div key={field} className="text-xs pl-2.5 border-l-2 border-[#FF5C35] flex flex-col gap-1.5 py-1 leading-snug text-left">
                                    <span className="font-extrabold uppercase tracking-wider text-[11px] text-[#FF5C35]">{getFieldLabel(field)}</span>
                                    <div className="flex flex-col gap-1.5 font-mono text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-[10px] font-black uppercase tracking-wider w-11 shrink-0",
                                          isDarkMode ? "text-white/60" : "text-neutral-500"
                                        )}>FROM:</span>
                                        <span className={cn(
                                          "line-through font-extrabold px-2 py-0.5 rounded truncate max-w-[360px]",
                                          isDarkMode ? "bg-red-500/15 text-red-500 font-bold" : "bg-red-50 text-red-700 border border-red-100/80 font-bold"
                                        )} title={displayOld}>
                                          {displayOld}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-[10px] font-black uppercase tracking-wider w-11 shrink-0",
                                          isDarkMode ? "text-white/60" : "text-neutral-500"
                                        )}>TO:</span>
                                        <span className={cn(
                                          "font-extrabold px-2 py-0.5 rounded truncate max-w-[360px]",
                                          isDarkMode ? "bg-emerald-500/15 text-emerald-400 font-bold" : "bg-emerald-50 text-emerald-700 border border-emerald-100/80 font-bold"
                                        )} title={displayNew}>
                                          {displayNew}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div 
                  className={cn(
                    "audit-arrow absolute top-1/2 -translate-y-1/2 border-[6px] border-transparent",
                    hoveredAuditCoords.align === 'right'
                      ? "left-0 -translate-x-full " + (isDarkMode ? "border-r-[#2C2724]/95" : "border-r-white/95")
                      : "right-0 translate-x-full " + (isDarkMode ? "border-l-[#2C2724]/95" : "border-l-white/95")
                  )} 
                  style={{
                    top: `calc(50% - ${auditAdjustY}px)`,
                    transform: 'translateY(-50%)'
                  }}
                />
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      <StatusNotePopup
        editingStatusId={editingStatusId}
        statusCoords={statusCoords}
        initialNote={statusNote}
        initialColor={statusColor}
        isDarkMode={isDarkMode}
        onClose={() => setEditingStatusId(null)}
        onSave={handleSaveStatus}
        onReset={handleResetStatus}
      />

      <ReservationNotePopup
        editingNoteId={editingNoteId}
        noteCoords={noteCoords}
        initialNote={noteContent}
        isDarkMode={isDarkMode}
        onClose={() => setEditingNoteId(null)}
        onSave={handleSaveNote}
      />

      {actionMenuId && actionMenuCoords && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setActionMenuId(null)} />
          <div 
            style={{
              position: 'fixed',
              top: actionMenuCoords.top,
              left: actionMenuCoords.left - 8,
              transform: actionMenuCoords.top > (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600) 
                ? 'translate(-100%, -100%)' 
                : 'translate(-100%, 0)',
            }}
            className="pointer-events-none z-[10000]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className={cn(
                "p-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border pointer-events-auto flex flex-col gap-1 min-w-[140px]",
                isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => handleUpdateStatus(actionMenuId, 'ON RENT')} className={cn("px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", isDarkMode ? "bg-[#C62828]/20 text-[#EF5350] hover:bg-[#C62828]/40" : "bg-[#FFEBEE] text-[#C62828] hover:bg-[#FFCDD2]")}>On rent</button>
              <button onClick={() => handleUpdateStatus(actionMenuId, 'UPCOMING')} className={cn("px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", isDarkMode ? "bg-[#00FF00]/20 text-[#00FF00] hover:bg-[#00FF00]/40" : "bg-[#00FF00]/10 text-black hover:bg-[#00FF00]/20")}>Upcoming</button>
              <div className={cn("h-px w-full my-1", isDarkMode ? "bg-white/5" : "bg-gray-100")} />
              <button 
                onClick={() => handleCancelBooking(actionMenuId!)} 
                className={cn(
                  "px-4 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer", 
                  isDarkMode 
                    ? "bg-white/10 text-gray-400 hover:bg-white/20" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Cancel Reservation
              </button>
            </motion.div>
          </div>
        </div>,
        document.body
      )}

      <CashflowNotificationPopup
        cashflowPopupId={cashflowPopupId}
        cashflowPopupCoords={cashflowPopupCoords}
        isDarkMode={isDarkMode}
        userReservations={userReservations}
        dbVehicles={dbVehicles}
        cashflowPaymentSummary={cashflowPaymentSummary}
        cashflowHandledBy={cashflowHandledBy}
        setCashflowHandledBy={setCashflowHandledBy}
        cashflowNote={cashflowNote}
        setCashflowNote={setCashflowNote}
        cashflowFile={cashflowFile}
        setCashflowFile={setCashflowFile}
        handleCloseCashflowPopup={handleCloseCashflowPopup}
        handleCashflowNotify={handleCashflowNotify}
        isCashflowSending={isCashflowSending}
      />

      {countriesPopupId && countriesPopupCoords && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setCountriesPopupId(null)} />
          <div 
            style={{
              position: 'fixed',
              top: countriesPopupCoords.top,
              left: countriesPopupCoords.left,
              transform: 'translate(0, -50%)',
            }}
            className="pointer-events-none z-[10000]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={cn(
                "p-3 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border pointer-events-auto flex flex-col gap-2 min-w-[140px] max-h-[400px] overflow-y-auto",
                isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 border-b pb-2 mb-1" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <Flag className="w-3 h-3 text-gray-500" />
                <span className="text-[9px] font-black tracking-widest uppercase opacity-60">Countries</span>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                {(() => {
                  const bookingObj = userReservations.find(b => String(b.id) === String(countriesPopupId));
                  if (!bookingObj) return <span className="text-[10px] italic text-gray-400 font-bold uppercase tracking-widest text-center py-2">Select client</span>;
                  
                  return AVAILABLE_COUNTRIES.map(c => {
                    const isSelected = (bookingObj.countries || []).includes(c);
                    return (
                      <button 
                        key={c} 
                        onClick={() => handleToggleCountry(bookingObj.id, c)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer group",
                          isSelected 
                            ? (isDarkMode ? "bg-[#FF5C35]/20" : "bg-[#FF5C35]/10") 
                            : "hover:bg-gray-500/10"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: COUNTRY_COLORS[c] || '#ccc' }} />
                          <span className={cn(
                            "text-xs font-black tracking-tight", 
                            isSelected 
                              ? (isDarkMode ? "text-[#FF5C35]" : "text-[#FF5C35]") 
                              : (isDarkMode ? "text-gray-400" : "text-gray-500")
                          )}>
                            {c}
                          </span>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                          isSelected 
                            ? "bg-[#FF5C35] border-[#FF5C35]" 
                            : (isDarkMode ? "border-white/10" : "border-black/10")
                        )}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </div>
        </div>,
        document.body
      )}



      {/* Client Detail Popup Overlay */}
      {createPortal(
        <AnimatePresence>
          {selectedClientBooking && (
            <div id="booking-print-overlay" className="fixed inset-0 z-[101] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClientBooking(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md no-print"
              />
              
              {/* On-screen Modal Card */}
              <motion.div
                id="booking-print-card"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={cn(
                  "relative w-full rounded-[32px] shadow-2xl overflow-hidden border print-card-container w-full max-w-[750px]",
                  isDarkMode ? "bg-[#1A1614] border-white/10" : "bg-[#F2EFE9] border-black/10"
                )}
              >
                {/* Header Section */}
                <div className={cn(
                  "px-8 py-3 border-b flex items-center justify-between mt-[70px] min-h-[90px] h-auto",
                  isDarkMode ? "border-white/5" : "border-black/5"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md",
                      getAvatarColor(selectedClientBooking.client)
                    )}>
                      {selectedClientBooking.client.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <h2 className={cn("text-2xl font-black tracking-tight leading-none", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                      {selectedClientBooking.client}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-2 no-print">
                    {/* Seal Choice Buttons: Square, MOMO (orange), SKP (blue), GO (yellow), KS (black) and ALB (red) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSeal(selectedSeal === 'momo' ? null : 'momo')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                          selectedSeal === 'momo'
                            ? "bg-[#ff5c35] text-white ring-4 ring-orange-300 scale-105"
                            : "bg-[#ff5c35] hover:bg-[#ff6c45] text-white opacity-80 hover:opacity-100"
                        )}
                        title="Click to apply MOMO stamp/seal"
                      >
                        MOMO
                      </button>
                      <button
                        onClick={() => setSelectedSeal(selectedSeal === 'skp' ? null : 'skp')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                          selectedSeal === 'skp'
                            ? "bg-blue-600 text-white ring-4 ring-blue-300 scale-105"
                            : "bg-blue-500 hover:bg-blue-600 text-white opacity-80 hover:opacity-100"
                        )}
                        title="Click to apply SKP stamp/seal"
                      >
                        SKP
                      </button>
                      <button
                        onClick={() => setSelectedSeal(selectedSeal === 'go' ? null : 'go')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                          selectedSeal === 'go'
                            ? "bg-yellow-400 text-zinc-900 ring-4 ring-yellow-200 scale-105"
                            : "bg-yellow-400 hover:bg-yellow-500 text-zinc-900 opacity-80 hover:opacity-100"
                        )}
                        title="Click to apply GO stamp/seal"
                      >
                        GO
                      </button>
                      <button
                        onClick={() => setSelectedSeal(selectedSeal === 'ks' ? null : 'ks')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                          selectedSeal === 'ks'
                            ? "bg-black text-white ring-4 ring-neutral-400 scale-105"
                            : "bg-black hover:bg-neutral-900 text-white opacity-80 hover:opacity-100"
                        )}
                        title="Click to apply KS stamp/seal"
                      >
                        KS
                      </button>
                      <button
                        onClick={() => setSelectedSeal(selectedSeal === 'alb' ? null : 'alb')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                          selectedSeal === 'alb'
                            ? "bg-red-600 text-white ring-4 ring-red-300 scale-105"
                            : "bg-red-600 hover:bg-red-700 text-white opacity-80 hover:opacity-100"
                        )}
                        title="Click to apply ALB stamp/seal"
                      >
                        ALB
                      </button>
                    </div>

                    {/* Process / Close Actions */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className={cn(
                          "px-4 h-10 rounded-2xl flex items-center gap-2 transition-all hover:scale-110 active:scale-95 text-[#FF5C35] font-black text-xs uppercase cursor-pointer disabled:opacity-50",
                          isDarkMode ? "bg-[#FF5C35]/15 hover:bg-[#FF5C35]/25" : "bg-[#FF5C35]/10 hover:bg-[#FF5C35]/20"
                        )}
                        title="Download PDF"
                      >
                        {isGeneratingPDF ? (
                          <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                        ) : (
                          <FileDown className="w-4 h-4 text-[#FF5C35]" />
                        )}
                        <span>{isGeneratingPDF ? 'Generating...' : 'PDF'}</span>
                      </button>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.print(); }}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-[#FF5C35]",
                          isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"
                        )}
                        title="Print Booking Card"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedClientBooking(null)}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                          isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                        )}
                      >
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-8 space-y-6 h-[686.4px] mt-0 ml-0 mr-0 mb-[20px]">
                  {/* Info Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-[-30px]">
                    {/* Column 1: Client Contact Card */}
                    <div className={cn(
                      "p-6 rounded-2xl border space-y-4 mt-0",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-[#fdf0e1]/60 border-orange-100"
                    )}>
                      <h3 className="text-xs font-black text-[#FF5C35] tracking-widest uppercase">Client Information</h3>
                      <div className="space-y-3" style={{ width: '275px' }}>
                        {selectedClientBooking.phone && (
                          <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-[#FF5C35] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                                {selectedClientBooking.phone}
                              </span>
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Phone</span>
                            </div>
                          </div>
                        )}
                        {selectedClientBooking.email && (
                          <div className="flex items-center gap-2.5" style={{ width: '280px' }}>
                            <Mail className="w-4 h-4 text-[#FF5C35] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                                {selectedClientBooking.email}
                              </span>
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Email</span>
                            </div>
                          </div>
                        )}
                        {selectedClientBooking.driverLicenseId && (
                          <div className="flex items-center gap-2.5">
                            <Contact className="w-4 h-4 text-[#FF5C35] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span 
                                className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}
                                style={{ fontFamily: 'Verdana, sans-serif' }}
                              >
                                {selectedClientBooking.driverLicenseId}
                              </span>
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">License ID</span>
                            </div>
                          </div>
                        )}
                        {selectedClientBooking.passportId && (
                          <div className="flex items-center gap-2.5">
                            <CreditCard className="w-4 h-4 text-[#FF5C35] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                                {selectedClientBooking.passportId}
                              </span>
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Passport ID</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Booking Details Card */}
                    <div className={cn(
                      "p-6 rounded-2xl border space-y-4",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-black/[0.02] border-black/5"
                    )}>
                      <h3 className="text-xs font-black text-[#FF5C35] tracking-widest uppercase">Rental Details</h3>
                      <div className="space-y-4">
                        <div className="flex items-start gap-2.5">
                          <Car className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                              {selectedClientBooking.vehicle}
                            </span>
                            <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Vehicle</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <CarFront className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                          <div className="flex flex-col min-w-0">
                            <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2.5 py-1 shadow-md h-7 shrink-0 text-black hover:scale-105 transition-transform">
                              <div className="bg-[#1565C0] w-[4px] h-4 rounded-[1px] -ml-2.5 mr-1.5" />
                              <span className="font-mono font-black text-xs md:text-sm tracking-widest uppercase leading-none select-all">
                                {selectedClientBooking.plate}
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-1">License Plate</span>
                          </div>
                        </div>

                        {selectedClientBooking.chassisNumber && (
                          <div className="flex items-start gap-2.5">
                            <FileText className={cn("w-4 h-4 mt-1.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                            <div className="flex flex-col min-w-0">
                              <div className={cn(
                                "relative h-8 rounded-full flex items-center px-4 overflow-hidden border transition-all",
                                isDarkMode 
                                  ? "bg-[#0E0C0B] border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]" 
                                  : "bg-[#E3DFD5] border-black/5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.15)]"
                              )}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF5C35] shadow-[0_0_6px_rgba(255,92,53,0.8),0_0_12px_rgba(255,92,53,0.5)] shrink-0" />
                                  <span className={cn(
                                    "text-[10px] font-mono font-black tracking-[0.15em] truncate select-all",
                                    isDarkMode ? "text-white" : "text-[#0e0c0b]"
                                  )}>
                                    {selectedClientBooking.chassisNumber}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-1">VIN Number</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2.5">
                          <BookOpen className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                          <div className="flex flex-col min-w-0">
                            <p className={cn("font-bold text-xs truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                              {selectedClientBooking.start} — {selectedClientBooking.end}
                            </p>
                            <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">
                              Period ({selectedClientBooking.days} Days)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Arrival Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-[-20px] h-[115px]">
                    {/* Left: Price and Arrival/Departure details */}
                    <div className={cn(
                      "p-5 rounded-2xl border flex flex-col justify-between",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-emerald-500/5 border-emerald-500/10"
                    )}>
                      <div className="flex-grow flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase mb-1">Total Cost</span>
                        <p className={cn("text-2xl font-black", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                          {selectedClientBooking.price}
                        </p>
                      </div>
                      
                      {(selectedClientBooking.arrivalTime || selectedClientBooking.departureTime) && (
                        <div className="mt-2 pt-1.5 border-t border-dashed border-emerald-500/20 flex flex-col gap-0.5 text-[10px]">
                          {selectedClientBooking.arrivalTime && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 uppercase tracking-wider text-[8px] font-bold">Arrival:</span>
                              <span className="font-mono font-black text-[#FF5C35]">{selectedClientBooking.arrivalTime}</span>
                            </div>
                          )}
                          {selectedClientBooking.departureTime && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 uppercase tracking-wider text-[8px] font-bold">Departure:</span>
                              <span className="font-mono font-black text-blue-500">{selectedClientBooking.departureTime}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: From / To */}
                    <div className={cn(
                      "p-5 rounded-2xl border flex flex-col justify-center space-y-3 mr-0",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-black/[0.02] border-black/5"
                    )}>
                      {/* FROM (top) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-500">
                          <ArrowUpRight className="w-5 h-5 shrink-0" />
                          <span className="text-[10px] font-black tracking-widest uppercase">From</span>
                        </div>
                        <p className={cn("text-xs font-black uppercase text-right truncate max-w-[150px]", isDarkMode ? "text-white" : "text-black")}>
                          {selectedClientBooking.fromLocation || 'N/A'}
                        </p>
                      </div>
                      
                      <div className={cn("border-t border-dashed", isDarkMode ? "border-white/10" : "border-black/5")} />

                      {/* TO (below) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-500">
                          <ArrowDownRight className="w-5 h-5 shrink-0" />
                          <span className="text-[10px] font-black tracking-widest uppercase">To</span>
                        </div>
                        <p className={cn("text-xs font-black uppercase text-right truncate max-w-[150px]", isDarkMode ? "text-white" : "text-black")}>
                          {selectedClientBooking.toLocation || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Countries Section */}
                  <div className="space-y-3 mt-[-20px]">
                    <div className="flex items-center gap-2">
                       <Flag className="w-4 h-4 text-[#FF5C35]" style={{ marginTop: '40px' }} />
                       <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase mt-[40px]" style={{ marginTop: '40px' }}>Authorized Countries</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedClientBooking.countries && selectedClientBooking.countries.length > 0 ? (
                        selectedClientBooking.countries.map((c: string) => (
                          <div 
                            key={c}
                            style={{ 
                              backgroundColor: `${COUNTRY_COLORS[c]}20`,
                              border: `1px solid ${COUNTRY_COLORS[c]}40`,
                              color: COUNTRY_COLORS[c]
                            }}
                            className="px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COUNTRY_COLORS[c] }} />
                            <span className="text-xs font-black tracking-widest uppercase">{c}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs font-bold text-gray-500/40 italic uppercase tracking-widest bg-gray-500/5 px-4 py-2 rounded-xl">
                          No countries specified
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agreement Terms Section */}
                  <div className="space-y-1.5 mt-[-10px] shrink-0 relative w-full">
                    <h4 className={cn(
                      "text-[9px] font-black uppercase tracking-widest leading-none",
                      isDarkMode ? "text-[#FF5C35]/85" : "text-[#FF5C35]"
                    )}>
                      Agreement Terms
                    </h4>
                    <p className={cn(
                      "text-[10px] leading-relaxed text-justify font-medium",
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {"By signing this agreement, I confirm that I have read and accepted all terms herein, authorize payment by credit or charge card for all amounts due, and remain personally liable until full settlement. Damage to the underside, oil sump, windows, and any loss or theft are excluded from SCDW coverage and remain the driver's responsibility. In the event of an accident, a valid police report is mandatory under applicable law; failure to provide one results in full liability. The vehicle is equipped with a GPS tracking device for security, fleet management, and theft recovery in compliance with data protection regulations. All traffic violations and fines, including those issued by safety cameras in North Macedonia and other countries traveled, are the sole responsibility of the driver. Any complaints must be reported before the end of the rental period."}
                    </p>

                    {/* Dynamic Seal / Stamp */}
                    {selectedSeal && (
                      <div className="absolute right-6 bottom-[-80px] z-10 w-36 h-36 pointer-events-none hover:scale-105 transition-all">
                        <Image
                          src={
                            selectedSeal === 'momo'
                              ? '/seal/momo.png'
                              : selectedSeal === 'skp'
                                ? '/seal/skp.png'
                                : selectedSeal === 'go'
                                  ? '/seal/go.png'
                                  : selectedSeal === 'ks'
                                    ? '/seal/ks.png'
                                    : '/seal/alb.png'
                          }
                          alt={`${selectedSeal.toUpperCase()} Seal`}
                          width={144}
                          height={144}
                          className="object-contain animate-fade-in"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 4: Empty space for now */}
                  <div className="h-10 shrink-0 select-none pb-4" />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <IncomingFleetPanel
        isIncomingFleetOpen={isIncomingFleetOpen}
        setIsIncomingFleetOpen={setIsIncomingFleetOpen}
        isDarkMode={isDarkMode}
        activeCountry={activeCountry}
        dbVehicles={dbVehicles}
        userReservations={userReservations}
        tyreTypes={tyreTypes}
      />

      <style jsx global>{`
        @keyframes green-glow {
          0% { background-color: #00FF00; box-shadow: 0 0 8px rgba(0, 255, 0, 0.6), 0 0 15px rgba(0, 255, 0, 0.4); color: #000; }
          50% { background-color: #33FF33; box-shadow: 0 0 15px rgba(51, 255, 51, 0.8), 0 0 30px rgba(51, 255, 51, 0.6); color: #000; }
          100% { background-color: #00FF00; box-shadow: 0 0 8px rgba(0, 255, 0, 0.6), 0 0 15px rgba(0, 255, 0, 0.4); color: #000; }
        }
        @keyframes red-glow {
          0% { background-color: #C62828; box-shadow: 0 0 8px rgba(198, 40, 40, 0.6), 0 0 15px rgba(198, 40, 40, 0.4); color: #fff; }
          50% { background-color: #E53935; box-shadow: 0 0 15px rgba(229, 57, 53, 0.8), 0 0 30px rgba(229, 57, 53, 0.6); color: #fff; }
          100% { background-color: #C62828; box-shadow: 0 0 8px rgba(198, 40, 40, 0.6), 0 0 15px rgba(198, 40, 40, 0.4); color: #fff; }
        }
        .animate-green-glow {
          animation: green-glow 2s infinite ease-in-out;
        }
        .animate-red-glow {
          animation: red-glow 2s infinite ease-in-out;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? '#231F1D' : '#f1f1f1'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#3D3632' : '#ddd'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#4D443F' : '#ccc'};
        }
      `}</style>


      {isDocumentPanelOpen && (
        <DocumentPanel 
          isOpen={isDocumentPanelOpen}
          onClose={() => setIsDocumentPanelOpen(false)}
          reservationId={selectedDocReservationId || ''}
          reservation={userReservations.find(r => String(r.id) === String(selectedDocReservationId))}
          isDarkMode={isDarkMode}
        />
      )}

      <CarExtraDetailsModal 
        isOpen={extraDetailsModal.isOpen}
        onClose={handleCloseExtraDetails}
        vehicle={extraDetailsModal.vehicle}
        coords={extraDetailsModal.coords}
        isDarkMode={isDarkMode}
        uncompletedReservations={uncompletedReservationsForExtra}
      />

      <CountriesHoverTooltip />

      <BookingGridTooltip />
    </div>
  );
}
