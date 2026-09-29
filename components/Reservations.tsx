'use client';

import React, { useState, useMemo, useRef, useEffect, memo, useCallback, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronLeft, ChevronRight, Clock, Car, Search, FileText, BookOpen, Pencil, Trash2, User, ArrowUpRight, ArrowDownRight, Pin, Flag, Check, CreditCard, Contact, Sun, Snowflake, RotateCcw, X, ArrowUpDown, Printer, Loader2, Coins, CircleUser, CarFront, Phone, Mail, MapPin, FileDown, AlertTriangle, Lightbulb, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, guessGenderFromName, parseDateSafe, isValidMatchValue } from '@/lib/utils';
import { format, isSameDay, addYears } from 'date-fns';
import Image from 'next/image';
import ReservationModal from './ReservationModal';
import CancellationModal from './CancellationModal';
import CompleteConfirmationModal from './CompleteConfirmationModal';
import { OnRentConflictModal } from './OnRentConflictModal';
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
import { InvoiceModal } from './InvoiceModal';
import { ClientBookingDetailModal, SelectedClientBooking } from './ClientBookingDetailModal';
import {
  CarRow,
  DayCell,
  MonthDivider,
  CalendarDay,
  CarBooking,
  DayBooking,
  BIRTHSTONE_COLORS,
  getTextColorForBg,
  globalGetDestinationCountry,
  ReservationsToolbar,
  TimelineLeftHeader,
  TimelineHeaderDays,
  FleetListGrid,
  TimelineSlideNavigation,
  VehicleColorPickerPopup,
  ChassisNumberPopup,
  CarLocationModal,
  ActionMenuPopup,
  AuditLogTooltip,
  CountriesSelectionPopup
} from './reservations';
export { globalGetDestinationCountry } from './reservations';
export type { CalendarDay, CarBooking, DayBooking } from './reservations';
import { functions, db, auth, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateStatsOnStatusChange } from '@/lib/stats';
import { setDoc, doc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, addDoc, Timestamp, serverTimestamp, increment, getDoc, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Reservation, Vehicle } from '@/types';
import { COUNTRY_COLORS, AVAILABLE_COUNTRIES, VEHICLE_COUNTRIES, INSURANCE_OPTIONS } from '@/lib/constants';
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

interface FleetSearchInputProps {
  isDarkMode: boolean;
  value: string;
  onChange: (val: string) => void;
}

const FleetSearchInput = memo(({ isDarkMode, value, onChange }: FleetSearchInputProps) => {
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-full bg-transparent pl-8 pr-7 text-[10px] font-extrabold tracking-wide uppercase transition-all duration-300 outline-none border-none",
          isDarkMode ? "text-white placeholder:text-gray-600" : "text-[#0E0C0B] placeholder:text-gray-400"
        )}
        style={{ height: '28px' }}
      />
      {value && (
        <button 
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-[#FF5C35] cursor-pointer z-10 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});
FleetSearchInput.displayName = 'FleetSearchInput';

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

  // Pre-computed search index map for lightning-fast 0ms searching across vehicles, plates, status, and all client reservations
  const vehicleSearchIndexMap = useMemo(() => {
    const map = new Map<string, string>();
    
    const resDataPerVehicle = new Map<string, string[]>();
    (userReservations || []).forEach(r => {
      if (r.status === 'CANCELLED') return;
      if (!r.vehicleId) return;
      const vId = String(r.vehicleId);
      let list = resDataPerVehicle.get(vId);
      if (!list) {
        list = [];
        resDataPerVehicle.set(vId, list);
      }
      if (r.name) list.push(r.name.toLowerCase());
      if (r.note) list.push(r.note.toLowerCase());
      if (r.fromLocation) list.push(r.fromLocation.toLowerCase());
      if (r.toLocation) list.push(r.toLocation.toLowerCase());
      if (r.processedBy) list.push(r.processedBy.toLowerCase());
    });

    (dbVehicles || []).forEach((v: Vehicle) => {
      const vId = String(v.id);
      const parts: string[] = [
        (v.name || '').toLowerCase(),
        (v.plate || '').toLowerCase(),
        (v.extraName || '').toLowerCase(),
        (v.statusNote || '').toLowerCase(),
        (v.status || '').toLowerCase(),
        (v.country || '').toLowerCase(),
        (v.chassisNumber || '').toLowerCase(),
        (v.color || '').toLowerCase(),
        (v.transmission || '').toLowerCase(),
      ];
      const resParts = resDataPerVehicle.get(vId);
      if (resParts) {
        parts.push(...resParts);
      }
      map.set(vId, parts.join(' '));
    });

    return map;
  }, [dbVehicles, userReservations]);
  const [escalatorOffsetDays, setEscalatorOffsetDays] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [reservationToComplete, setReservationToComplete] = useState<any | null>(null);
  const [isOnRentConflictModalOpen, setIsOnRentConflictModalOpen] = useState(false);
  const [onRentConflictData, setOnRentConflictData] = useState<{
    targetReservation: Reservation | null;
    conflictingReservations: Reservation[];
    vehicle: Vehicle | null;
  } | null>(null);
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
  const deferredFleetSearch = useDeferredValue(fleetSearch);
  const [freeTodayOnly, setFreeTodayOnly] = useState(false);
  const [returningTodayOnly, setReturningTodayOnly] = useState(false);
  const [returningTomorrowOnly, setReturningTomorrowOnly] = useState(false);

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
        const matchingRes = userReservations.find(r => String(r.id) === String(booking.id));
        const isExt = !!(booking.isExtension || matchingRes?.isExtension);
        const origId = booking.originalReservationId || matchingRes?.originalReservationId || null;

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
          isExtension: isExt,
          originalReservationId: origId,
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

  const [selectedClientBooking, setSelectedClientBooking] = useState<SelectedClientBooking | null>(null);
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState<any | null>(null);

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
      if (!res) return;

      // Prevent duplicate ON RENT for the same vehicle
      if (status === 'ON RENT' && res.status !== 'ON RENT') {
        const targetVehicleId = String(res.vehicleId || '');
        const targetVehicle = dbVehicles.find(v => String(v.id) === targetVehicleId) || null;
        const targetPlate = (
          targetVehicle?.plate || 
          (res as any).plate || 
          (res as any).deletedExtraPlate || 
          ''
        ).replace(/\s+/g, '').toUpperCase();

        const conflictingOnRent = userReservations.filter(r => {
          if (String(r.id) === String(id)) return false;
          if (r.status !== 'ON RENT') return false;
          
          if (String(r.vehicleId) === targetVehicleId) return true;
          if (targetPlate) {
            const rVehicle = dbVehicles.find(v => String(v.id) === String(r.vehicleId));
            const rPlate = (
              rVehicle?.plate || 
              (r as any).plate || 
              (r as any).deletedExtraPlate || 
              ''
            ).replace(/\s+/g, '').toUpperCase();
            if (rPlate && rPlate === targetPlate) return true;
          }
          return false;
        });

        if (conflictingOnRent.length > 0) {
          setActionMenuId(null);
          setOnRentConflictData({
            targetReservation: res,
            conflictingReservations: conflictingOnRent,
            vehicle: targetVehicle || {
              id: targetVehicleId,
              name: (res as any).vehicle || (res as any).deletedExtraName || 'Unknown Vehicle',
              plate: targetPlate || (res as any).plate || 'NO PLATE',
            } as Vehicle
          });
          setIsOnRentConflictModalOpen(true);
          return;
        }
      }

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

        // If this cancelled reservation is an extension, update the original reservation document if no other active extensions exist
        if (res.isExtension && res.originalReservationId) {
          const otherActiveExtensions = userReservations.filter(r =>
            r.isExtension &&
            String(r.originalReservationId) === String(res.originalReservationId) &&
            String(r.id) !== String(res.id) &&
            r.status !== 'CANCELLED'
          );
          if (otherActiveExtensions.length === 0) {
            try {
              const origRef = doc(db, 'reservations', String(res.originalReservationId));
              await updateDoc(origRef, {
                hasExtension: false,
                updatedAt: Date.now()
              });
            } catch (origErr) {
              console.warn("Failed to reset hasExtension on original reservation:", origErr);
            }
          }
        }

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

    // Pre-index busy and returning vehicle IDs in a single O(N) pass for instant 0ms bulb toggle checks
    const today = currentSystemTime || new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const tomorrowMidnight = todayMidnight + 86400000;

    const busyCarIdsTodaySet = new Set<string>();
    const returningTodayCarIdsSet = new Set<string>();
    const returningTomorrowCarIdsSet = new Set<string>();

    for (let i = 0; i < (userReservations || []).length; i++) {
      const r = userReservations[i];
      if (!r.vehicleId) continue;
      const vId = String(r.vehicleId);

      const startDate = r.start instanceof Date ? r.start : new Date(r.start);
      const endDate = r.end instanceof Date ? r.end : new Date(r.end);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      if (isNaN(startMs) || isNaN(endMs)) continue;

      const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
      const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

      // 1. Busy today (UPCOMING or ON RENT covering today)
      if (r.status === 'UPCOMING' || r.status === 'ON RENT') {
        if (todayMidnight >= startMidnight && todayMidnight <= endMidnight) {
          busyCarIdsTodaySet.add(vId);
        }
      }

      // 2. Returning today or tomorrow (ON RENT ending today / tomorrow)
      if (r.status === 'ON RENT') {
        if (todayMidnight === endMidnight) {
          returningTodayCarIdsSet.add(vId);
        }
        if (tomorrowMidnight === endMidnight) {
          returningTomorrowCarIdsSet.add(vId);
        }
      }
    }

    const filterAndSortList = (arr: typeof vehiclesWithLocation) => {
      const query = (deferredFleetSearch || '').trim().toLowerCase();

      return arr.filter(v => {
        const vIdStr = String(v.id);

        if (freeTodayOnly) {
          if (v.physicalCountry !== activeCountry) return false;
          if (busyCarIdsTodaySet.has(vIdStr)) return false;
        }

        if (returningTodayOnly) {
          if (v.physicalCountry !== activeCountry) return false;
          if (!returningTodayCarIdsSet.has(vIdStr)) return false;
        }

        if (returningTomorrowOnly) {
          if (v.physicalCountry !== activeCountry) return false;
          if (!returningTomorrowCarIdsSet.has(vIdStr)) return false;
        }

        if (!query) return true;

        const searchIndex = vehicleSearchIndexMap.get(vIdStr);
        return searchIndex ? searchIndex.includes(query) : false;
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
  }, [dbVehicles, userReservations, activeCountry, currentSystemTime, deferredFleetSearch, freeTodayOnly, returningTodayOnly, returningTomorrowOnly, vehicleSearchIndexMap]);

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
        
        const default800Insurance = INSURANCE_OPTIONS.find(opt => opt.type === '800') || INSURANCE_OPTIONS[0];
        setEditingReservation({
          vehicleId: carId,
          start: start,
          end: end,
          insurance: default800Insurance,
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
          <ReservationsToolbar
            isDarkMode={isDarkMode}
            isRelocationMode={isRelocationMode}
            isCarLocationMode={isCarLocationMode}
            effectiveColor={effectiveColor}
            isLightSidebar={isLightSidebar}
            headerMonth={headerMonth}
            headerYear={headerYear}
            onToggleRelocationMode={() => {
              const nextVal = !isRelocationMode;
              setIsRelocationMode(nextVal);
              if (nextVal) {
                setIsSelectionEnabled(false);
                setSelectionStart(null);
                setIsCarLocationMode(false);
              }
              setReservationToMove(null);
            }}
            onToggleCarLocationMode={() => {
              const nextVal = !isCarLocationMode;
              setIsCarLocationMode(nextVal);
              if (nextVal) {
                setIsSelectionEnabled(false);
                setSelectionStart(null);
                setIsRelocationMode(false);
                setIsEditMode(false);
              }
            }}
            onOpenAddReservationModal={() => {
              setModalMode('full');
              setIsModalOpen(true);
            }}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />

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
                    <TimelineLeftHeader
                      isDarkMode={isDarkMode}
                      showFocusBlur={showFocusBlur}
                      fleetSearch={fleetSearch}
                      freeTodayOnly={freeTodayOnly}
                      returningTodayOnly={returningTodayOnly}
                      returningTomorrowOnly={returningTomorrowOnly}
                      onOpenAddCarModal={() => setIsAddCarModalOpen(true)}
                      onToggleFocusBlur={() => {
                        const newBlur = !showFocusBlur;
                        setShowFocusBlur(newBlur);
                        if (newBlur) {
                          const today = new Date(currentSystemTime || new Date());
                          setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
                        }
                      }}
                      onFleetSearchChange={setFleetSearch}
                      onToggleFreeToday={() => {
                        setFreeTodayOnly(!freeTodayOnly);
                        if (!freeTodayOnly) {
                          setReturningTodayOnly(false);
                          setReturningTomorrowOnly(false);
                        }
                      }}
                      onToggleReturningToday={() => {
                        setReturningTodayOnly(!returningTodayOnly);
                        if (!returningTodayOnly) {
                          setFreeTodayOnly(false);
                          setReturningTomorrowOnly(false);
                        }
                      }}
                      onToggleReturningTomorrow={() => {
                        setReturningTomorrowOnly(!returningTomorrowOnly);
                        if (!returningTomorrowOnly) {
                          setFreeTodayOnly(false);
                          setReturningTodayOnly(false);
                        }
                      }}
                    />
                    
                    <TimelineHeaderDays
                      calendarDays={calendarDays}
                      isDarkMode={isDarkMode}
                      showFocusBlur={showFocusBlur}
                    />
          </div>

          {/* Fleet List & Grid */}
          <FleetListGrid
            sortedHomeVehicles={sortedHomeVehicles}
            sortedGuestVehicles={sortedGuestVehicles}
            bookingsMap={bookingsMap}
            calendarDays={calendarDays}
            isDarkMode={isDarkMode}
            showFocusBlur={showFocusBlur}
            tyreTypes={tyreTypes}
            firstExtraIndex={firstExtraIndex}
            activeCountry={activeCountry}
            isSelectionEnabled={isSelectionEnabled}
            isRelocationMode={isRelocationMode}
            isCarLocationMode={isCarLocationMode}
            isEditMode={isEditMode}
            selectionStart={selectionStart}
            carIdToMove={carIdToMove}
            reservationIdToSwap={reservationIdToSwap}
            reservationToMoveId={reservationToMove?.id}
            isExtraCancelMode={isExtraCancelMode}
            userReservations={userReservations}
            currentSystemTime={currentSystemTime}
            todayMidnightMs={todayMidnightMs}
            violationPlatesSet={violationPlatesSet}
            onHoverDay={handleHoverDay}
            onLeaveDay={handleLeaveDay}
            onTyreToggle={toggleTyre}
            onStatusClick={handleStatusClick}
            onGridClick={handleGridClick}
            onCarSelect={handleCarSelect}
            onCarLocationClick={handleCarLocationClick}
            onReservationSelect={handleReservationSelect}
            onChassisClick={handleChassisClick}
            onColorClick={handleColorClick}
            onToggleExtraCancelMode={handleToggleExtraCancelMode}
            onCancelBooking={handleCancelBooking}
            onOverdueClick={handleOverdueClick}
            onOpenExtraDetails={handleOpenExtraDetails}
          />

          </div>
          </div>
        </div>

        {/* Bottom Escalator Slide Navigation Row */}
        <TimelineSlideNavigation
          isDarkMode={isDarkMode}
          escalatorOffsetDays={escalatorOffsetDays}
          onReset={() => {
            if (escalatorOffsetDays !== 0) {
              setEscalatorOffsetDays(0);
            }
          }}
          onPrevDay={() => setEscalatorOffsetDays(prev => prev - 1)}
          onNextDay={() => setEscalatorOffsetDays(prev => prev + 1)}
        />
      </div>

      {/* Vehicle Color Picker Tooltip Pill */}
      <VehicleColorPickerPopup
        editingColorId={editingColorId}
        colorCoords={colorCoords}
        isDarkMode={isDarkMode}
        dbVehicles={dbVehicles}
        onClose={() => setEditingColorId(null)}
        onSaveColor={handleSaveColor}
      />

      {/* Chassis Number Tooltip Pill */}
      <ChassisNumberPopup
        editingChassisId={editingChassisId}
        chassisCoords={chassisCoords}
        isDarkMode={isDarkMode}
        dbVehicles={dbVehicles}
        isEditingChassis={isEditingChassis}
        chassisInput={chassisInput}
        setIsEditingChassis={setIsEditingChassis}
        setChassisInput={setChassisInput}
        onClose={() => {
          setEditingChassisId(null);
          setIsEditingChassis(false);
        }}
        onSaveChassis={handleSaveChassis}
      />

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

              // If an extension was updated to CANCELLED, reset original reservation hasExtension if needed
              if (updateData.status === 'CANCELLED' && (res as any).isExtension && (res as any).originalReservationId) {
                const origId = (res as any).originalReservationId;
                const otherActiveExtensions = userReservations.filter(r =>
                  r.isExtension &&
                  String(r.originalReservationId) === String(origId) &&
                  String(r.id) !== String(res.id) &&
                  r.status !== 'CANCELLED'
                );
                if (otherActiveExtensions.length === 0) {
                  try {
                    const origRef = doc(db, 'reservations', String(origId));
                    await updateDoc(origRef, {
                      hasExtension: false,
                      updatedAt: Date.now()
                    });
                  } catch (origErr) {
                    console.warn("Failed to reset hasExtension on original reservation:", origErr);
                  }
                }
              }

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

      {isOnRentConflictModalOpen && (
        <OnRentConflictModal
          isOpen={isOnRentConflictModalOpen}
          onClose={() => {
            setIsOnRentConflictModalOpen(false);
            setOnRentConflictData(null);
          }}
          isDarkMode={isDarkMode}
          targetReservation={onRentConflictData?.targetReservation || null}
          conflictingReservations={onRentConflictData?.conflictingReservations || []}
          vehicle={onRentConflictData?.vehicle || null}
          dbVehicles={dbVehicles}
        />
      )}

      {/* Car Relocation / Country Update Modal */}
      <CarLocationModal
        selectedCarForLocationUpdate={selectedCarForLocationUpdate}
        isDarkMode={isDarkMode}
        onClose={() => setSelectedCarForLocationUpdate(null)}
        onRelocateCar={handleRelocateCar}
      />

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
      <AuditLogTooltip
        hoveredAuditId={hoveredAuditId}
        hoveredAuditCoords={hoveredAuditCoords}
        auditAdjustY={auditAdjustY}
        auditPanelRef={auditPanelRef}
        auditLogsMap={auditLogsMap}
        isDarkMode={isDarkMode}
        dbVehicles={dbVehicles}
        onClose={() => setHoveredAuditId(null)}
      />

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

      <ActionMenuPopup
        actionMenuId={actionMenuId}
        actionMenuCoords={actionMenuCoords}
        isDarkMode={isDarkMode}
        onClose={() => setActionMenuId(null)}
        onUpdateStatus={handleUpdateStatus}
        onCancelBooking={handleCancelBooking}
      />

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

      <CountriesSelectionPopup
        countriesPopupId={countriesPopupId}
        countriesPopupCoords={countriesPopupCoords}
        isDarkMode={isDarkMode}
        userReservations={userReservations}
        onClose={() => setCountriesPopupId(null)}
        onToggleCountry={handleToggleCountry}
      />



      {/* Client Detail Popup Overlay */}
      <ClientBookingDetailModal
        isOpen={!!selectedClientBooking}
        onClose={() => setSelectedClientBooking(null)}
        booking={selectedClientBooking}
        isDarkMode={isDarkMode}
        userReservations={userReservations}
        vehicles={dbVehicles}
        onOpenInvoice={(booking) => {
          setSelectedInvoiceBooking(booking);
        }}
      />

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

      {/* Client Invoice Modal */}
      {selectedInvoiceBooking && (
        <InvoiceModal
          isOpen={!!selectedInvoiceBooking}
          onClose={() => setSelectedInvoiceBooking(null)}
          booking={selectedInvoiceBooking}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
