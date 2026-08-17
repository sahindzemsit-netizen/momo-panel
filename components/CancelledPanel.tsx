'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronLeft, ChevronRight, User, Flag, ArrowUpRight, ArrowDownRight, Landmark, FileText, Printer, BookOpen, Plus, Car } from 'lucide-react';
import { cn, parseDateSafe } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, Vehicle } from '@/types';
import PriceLabel from './PriceLabel';
import { COUNTRY_COLORS } from '@/lib/constants';

import WhyIcon from './WhyIcon';
import SummaryPanel from './SummaryPanel';
import DocumentPanel from './DocumentPanel';

interface CancelledPanelProps {
  isDarkMode: boolean;
  userReservations: Reservation[];
  dbVehicles: Vehicle[];
}

interface MappedBooking extends Omit<Reservation, 'start' | 'end'> {
  start: string;
  end: string;
  client: string;
  vehicle: string;
  plate: string;
  price: string;
  chassisNumber?: string;
}

export default function CancelledPanel({ isDarkMode, userReservations, dbVehicles }: CancelledPanelProps) {
  const getPlateColorByPlate = (plateStr: string) => {
    if (!plateStr || !dbVehicles) return null;
    const clean = plateStr.replace(/\s+/g, '').toUpperCase();
    const found = dbVehicles.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
    return found?.color || null;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [selectedDocReservationId, setSelectedDocReservationId] = useState<string | null>(null);
  const [selectedClientBooking, setSelectedClientBooking] = useState<MappedBooking | null>(null);
  const [activeReasonPopupId, setActiveReasonPopupId] = useState<string | number | null>(null);
  const [reasonPopupCoords, setReasonPopupCoords] = useState<{ top: number; left: number } | null>(null);
  const [countriesPopupId, setCountriesPopupId] = useState<string | number | null>(null);
  const [countriesPopupCoords, setCountriesPopupCoords] = useState<{ top: number; left: number } | null>(null);
  const [hoveredCountriesId, setHoveredCountriesId] = useState<string | null>(null);
  const [hoveredCountriesCoords, setHoveredCountriesCoords] = useState<{ top: number; left: number } | null>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 5;

  const formatDateSafe = (date: Date | string | number | null | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isNaN(d.getTime()) ? 'Invalid Date' : format(d, 'dd/MM/yyyy');
  };

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
      "bg-[#FF5C35]", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-rose-500",
      "bg-amber-500", "bg-indigo-500", "bg-fuchsia-500", "bg-cyan-500", "bg-teal-500", "bg-orange-500"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
       hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const historyFilteredBookings = useMemo(() => {
    const getTS = (v: unknown) => {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'string') {
        const parsed = Date.parse(v);
        return isNaN(parsed) ? 0 : parsed;
      }
      const pt = v as { toDate?: () => { getTime: () => number } };
      if (pt && typeof pt.toDate === 'function') {
        try {
          return pt.toDate().getTime();
        } catch {
          return 0;
        }
      }
      return 0;
    };

    const history = userReservations
      .filter(res => res.status === 'COMPLETED')
      .sort((a, b) => {
        // 1. Sort by when it was marked completed / updated (updatedAt) descending
        const updateA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0);
        const updateB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0);
        if (updateA !== updateB && updateA > 0 && updateB > 0) {
          return updateB - updateA;
        }

        // 2. Sort by rental end date (end) descending (latest completed period)
        const endA = parseDateSafe(a.end).getTime();
        const endB = parseDateSafe(b.end).getTime();
        if (endA !== endB) {
          return endB - endA;
        }

        // 3. Sort by rental start date (start) descending
        const startA = parseDateSafe(a.start).getTime();
        const startB = parseDateSafe(b.start).getTime();
        if (startA !== startB) {
          return startB - startA;
        }

        // 4. Sort by creation timestamp (createdAt) descending
        const createA = getTS(a.createdAt);
        const createB = getTS(b.createdAt);
        if (createA !== createB && createA > 0 && createB > 0) {
          return createB - createA;
        }

        // 5. Sort by numeric ID if both are numeric (represents creation time)
        const numA = typeof a.id === 'string' && !isNaN(Number(a.id)) ? Number(a.id) : 0;
        const numB = typeof b.id === 'string' && !isNaN(Number(b.id)) ? Number(b.id) : 0;
        if (numA !== numB && numA > 0 && numB > 0) {
          return numB - numA;
        }

        // 6. Stable fallback comparison on ID lexicographically
        return String(b.id).localeCompare(String(a.id));
      })
      .map(res => {
        const car = dbVehicles.find(c => String(c.id) === String(res.vehicleId));
        const isDeletedExtra = !!((res as any).deletedExtraPlate || (res as any).deletedExtraName);
        const vehicle = isDeletedExtra
          ? ((res as any).deletedExtraName || 'EXTRA')
          : (car?.name === 'EXTRA' || car?.isExtra)
            ? (car?.extraName || 'EXTRA')
            : (car?.name || 'Unknown');
        const plate = isDeletedExtra
          ? ((res as any).deletedExtraPlate || '')
          : (car?.plate || '');
        return {
          id: res.id,
          client: res.name,
          email: res.email,
          phone: res.phone,
          isDeletedExtra,
          vehicle,
          plate,
          chassisNumber: car?.chassisNumber || '',
          start: formatDateSafe(res.start),
          end: formatDateSafe(res.end),
          days: `${res.days}d`,
          price: `€${res.totalPrice}`,
          totalPrice: res.totalPrice,
          amountPaid: res.amountPaid || 0,
          status: 'COMPLETED',
          vehicleId: res.vehicleId,
          processedBy: res.processedBy || '',
          fromLocation: res.fromLocation || '',
          toLocation: res.toLocation || '',
          countries: res.countries || [],
          insurance: res.insurance,
          paymentMethod: res.paymentMethod || 'cash',
        };
      });

    if (!historySearchQuery.trim()) return history;
    const query = historySearchQuery.toLowerCase();
    return history.filter(b => 
      b.client.toLowerCase().includes(query) || 
      b.vehicle.toLowerCase().includes(query) ||
      b.plate.toLowerCase().includes(query)
    );
  }, [userReservations, dbVehicles, historySearchQuery]);

  const { paginatedHistory, totalHistoryPages } = useMemo(() => {
    const totalH = Math.ceil(historyFilteredBookings.length / itemsPerPage);
    const startH = (historyPage - 1) * itemsPerPage;
    return {
      paginatedHistory: historyFilteredBookings.slice(startH, startH + itemsPerPage),
      totalHistoryPages: totalH || 1
    };
  }, [historyFilteredBookings, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchQuery]);

  const selectedReservation = useMemo(() => {
    if (!selectedDocReservationId) return undefined;
    return userReservations.find(r => r.id === selectedDocReservationId);
  }, [selectedDocReservationId, userReservations]);

  const cancelledBookings = useMemo(() => {
    const getTS = (v: unknown) => {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'string') {
        const parsed = Date.parse(v);
        return isNaN(parsed) ? 0 : parsed;
      }
      const pt = v as { toDate?: () => { getTime: () => number } };
      if (pt && typeof pt.toDate === 'function') {
        try {
          return pt.toDate().getTime();
        } catch {
          return 0;
        }
      }
      return 0;
    };

    return userReservations
      .filter(res => res.status === 'CANCELLED')
      .sort((a, b) => {
        // 1. Sort by creation timestamp (createdAt)
        const createA = getTS(a.createdAt);
        const createB = getTS(b.createdAt);
        if (createA !== createB && createA > 0 && createB > 0) {
          return createB - createA;
        }

        // 2. Sort by start date (start)
        const startA = getTS(a.start);
        const startB = getTS(b.start);
        if (startA !== startB && startA > 0 && startB > 0) {
          return startB - startA;
        }

        // 3. Sort by numeric ID if both are numeric (represents creation time)
        const numA = typeof a.id === 'string' && !isNaN(Number(a.id)) ? Number(a.id) : 0;
        const numB = typeof b.id === 'string' && !isNaN(Number(b.id)) ? Number(b.id) : 0;
        if (numA !== numB && numA > 0 && numB > 0) {
          return numB - numA;
        }

        // 4. Stable fallback comparison on ID lexicographically
        return String(b.id).localeCompare(String(a.id));
      })
      .map(res => {
        const car = dbVehicles.find(c => String(c.id) === String(res.vehicleId));
        const isDeletedExtra = !!((res as any).deletedExtraPlate || (res as any).deletedExtraName);
        const vehicle = isDeletedExtra
          ? ((res as any).deletedExtraName || 'EXTRA')
          : (car?.name === 'EXTRA' || car?.isExtra)
            ? (car?.extraName || 'EXTRA')
            : (car?.name || 'Unknown');
        const plate = isDeletedExtra
          ? ((res as any).deletedExtraPlate || '')
          : (car?.plate || '');

        return {
          id: res.id,
          client: res.name,
          email: res.email,
          isDeletedExtra,
          vehicle,
          plate,
          chassisNumber: car?.chassisNumber || '',
          start: formatDateSafe(res.start),
          end: formatDateSafe(res.end),
          days: `${res.days}d`,
          price: `€${res.totalPrice}`,
          totalPrice: res.totalPrice,
          amountPaid: res.amountPaid || 0,
          status: 'CANCELLED',
          processedBy: res.processedBy || '',
          fromLocation: res.fromLocation || '',
          toLocation: res.toLocation || '',
          countries: res.countries || [],
          insurance: res.insurance,
          cancellationReason: res.cancellationReason || 'No reason provided.',
          paymentMethod: res.paymentMethod || 'cash',
        };
      });
  }, [userReservations, dbVehicles]);

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return cancelledBookings;
    const query = searchQuery.toLowerCase();
    return cancelledBookings.filter(b => 
      b.client.toLowerCase().includes(query) || 
      b.vehicle.toLowerCase().includes(query) ||
      b.plate.toLowerCase().includes(query)
    );
  }, [cancelledBookings, searchQuery]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(start, start + itemsPerPage);
  }, [filteredBookings, currentPage]);

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-hidden",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="w-full flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto no-scrollbar pb-10 pr-2">
        {/* Summary Statistics */}
        <SummaryPanel isDarkMode={isDarkMode} />

        {/* Completed Reservations Panel */}
        <div className={cn(
          "rounded-[32px] border flex flex-col h-auto min-h-[450px] shrink-0 transition-all duration-500 mb-6 relative z-10",
          isDarkMode 
            ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
            : "bg-[#FCFAF5] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
        )}>
          {/* Completed Reservations Header */}
          <div className={cn(
            "min-h-[70px] px-4 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b transition-colors",
            isDarkMode ? "border-white/5" : "border-[#F2EFE9]"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors",
                isDarkMode ? "bg-[#009966] text-white" : "bg-[#009966] text-white"
              )}>
                <Landmark className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                <h2 className={cn(
                  "text-xl md:text-2xl font-black tracking-tight transition-colors",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}>Completed Reservations</h2>
              </div>
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search completed reservations..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                  isDarkMode 
                    ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                    : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                )}
              />
            </div>
          </div>

          {/* Table Content - Desktop */}
          <div className="flex-1 md:block hidden">
            <div className="min-w-[1100px] flex flex-col">
              <div className={cn(
                "px-4 py-3 flex items-center transition-colors",
                isDarkMode ? "bg-[#231F1D]" : "bg-[#F2EFE9]/60"
              )}>
                <div className="w-[15%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">CLIENT</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">VEHICLE</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">LOCATION</div>
                <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">COUNTRIES</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PERIOD</div>
                <div className="w-[5%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">DAYS</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PRICE</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">STATUS</div>
                <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">TEAMMATE</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">ACTIONS</div>
              </div>

              <div 
                ref={historyListRef}
                className={cn(
                  "flex-1 transition-colors",
                  isDarkMode ? "bg-[#1A1614]" : "bg-transparent"
                )}
              >
                {historyFilteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Landmark className="w-12 h-12 mb-4" />
                    <p className="font-black text-sm tracking-widest uppercase">No completed reservations found</p>
                  </div>
                ) : (
                  paginatedHistory.map((booking) => {
                    const clientInitials = booking.client
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('') || '?';

                    return (
                      <div key={booking.id} className={cn(
                        "px-4 py-2.5 flex items-center border-b transition-colors",
                        isDarkMode ? "border-black/40 hover:bg-white/5" : "border-black/10 hover:bg-black/5"
                      )}>
                        <div className="w-[15%] flex items-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientBooking(booking);
                            }}
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md bg-[#009966] ring-2 ring-offset-2 transition-transform hover:scale-110 active:scale-95 cursor-pointer",
                              isDarkMode ? "ring-offset-[#1A1614] ring-white/10" : "ring-offset-white ring-black/10"
                            )}>
                            {clientInitials}
                          </button>
                          <div className="truncate">
                            <p className={cn("font-black text-sm truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.client}</p>
                            <p className="text-[10px] font-bold text-gray-400 truncate">{booking.email}</p>
                          </div>
                        </div>
                        <div className="w-[10%] flex items-center justify-center pr-2">
                          <div className="w-full flex flex-col items-center justify-center text-center">
                            <p className={cn(
                              "font-black text-sm truncate mb-1 w-full text-center", 
                              isDarkMode ? "text-white" : "text-[#0E0C0B]",
                              booking.isDeletedExtra && "line-through text-red-500/85 decoration-red-500/80 decoration-2"
                            )}>
                              {booking.vehicle?.toUpperCase()}
                            </p>
                            <div 
                              className={cn(
                                "inline-flex items-center rounded-md border-2 px-1.5 py-0.5 shadow-md hover:scale-105 transition-transform shrink-0 relative overflow-hidden",
                                booking.isDeletedExtra ? "opacity-75 bg-gray-100 border-gray-300" : "border-black/30 bg-white"
                              )}
                              style={{ height: '20px' }}
                            >
                              <div className="w-[3px] h-3 bg-blue-700 rounded-l-[1px] -ml-1.5 mr-1 shrink-0" />
                              <span 
                                className={cn(
                                  "font-mono font-black text-black tracking-wider uppercase leading-none select-all",
                                  getPlateColorByPlate(booking.plate) ? "pr-[11px]" : "",
                                  booking.isDeletedExtra && "line-through text-gray-500"
                                )}
                                style={{ fontSize: '11px' }}
                              >
                                {booking.plate}
                              </span>
                              {(() => {
                                const col = getPlateColorByPlate(booking.plate);
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
                        </div>
                        <div className="w-[10%] flex flex-col items-center justify-center gap-1.5 py-1">
                          {booking.fromLocation && (() => {
                            const pill = getLocationPillStyles(booking.fromLocation);
                            return (
                              <div 
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                                style={{ backgroundColor: pill.bg }}
                              >
                                <ArrowUpRight className="w-3 h-3 text-black shrink-0" />
                                <span className="text-black truncate">
                                  {booking.fromLocation}
                                </span>
                              </div>
                            );
                          })()}
                          {booking.toLocation && (() => {
                            const pill = getLocationPillStyles(booking.toLocation);
                            return (
                              <div 
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                                style={{ backgroundColor: pill.bg }}
                              >
                                <ArrowDownRight className="w-3 h-3 text-black shrink-0" />
                                <span className="text-black truncate">
                                  {booking.toLocation}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="w-[8%] flex justify-center">
                          <div className="relative group">
                            <div 
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredCountriesCoords({ top: rect.top, left: rect.left + rect.width / 2 });
                                setHoveredCountriesId(booking.id);
                              }}
                              onMouseLeave={() => setHoveredCountriesId(null)}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-help",
                                booking.countries && booking.countries.length > 0
                                  ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-emerald-50 border-emerald-500/30 text-emerald-600")
                                  : (isDarkMode ? "bg-[#1A1614] border-white/10 text-gray-500" : "bg-white border-black/10 text-gray-400")
                              )}>
                              <Flag className={cn("w-3.5 h-3.5", booking.countries && booking.countries.length > 0 && "fill-current")} />
                            </div>
                          </div>
                        </div>
                        <div className="w-[10%] text-center">
                          <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.start}</p>
                          <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.end}</p>
                        </div>
                        <div className="w-[5%] text-center">
                          <p className={cn("font-black text-sm", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.days}</p>
                        </div>
                        <div className="w-[10%] flex justify-center">
                          <PriceLabel 
                            reservationId={booking.id}
                            totalPrice={booking.totalPrice}
                            amountPaid={booking.amountPaid}
                            status={booking.status}
                            isDarkMode={isDarkMode}
                            insurance={booking.insurance}
                            readOnly={true}
                            paymentMethod={booking.paymentMethod}
                          />
                        </div>
                        <div className="w-[10%] flex justify-center">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1.5 border uppercase shadow-sm",
                            "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            {booking.status}
                          </div>
                        </div>
                        <div className="w-[12%] flex justify-center">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1.5 border uppercase shadow-sm bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                             <span className="truncate max-w-[65px]">{booking.processedBy || 'System'}</span>
                          </div>
                        </div>
                        <div className="w-[10%] flex justify-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocReservationId(booking.id);
                              setIsDocumentPanelOpen(true);
                            }}
                            className={cn(
                              "w-8 h-8 rounded-xl border flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md text-white border-transparent",
                              "bg-[#009966]"
                            )}
                            title="View Documents"
                          >
                            <FileText className="w-4 h-4 cursor-pointer" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Table Content - Mobile */}
          <div className="flex-1 md:hidden">
            {historyFilteredBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40 px-6 text-center">
                <Landmark className="w-12 h-12 mb-4" />
                <p className="font-black text-sm tracking-widest uppercase">No completed reservations found</p>
              </div>
            ) : (
              <div className="grid gap-3 p-3">
                {paginatedHistory.map((booking) => (
                  <div key={booking.id} className={cn(
                    "rounded-3xl border p-4 transition-all active:scale-[0.98] relative overflow-hidden",
                    isDarkMode ? "bg-black/20 border-white/5" : "bg-white border-black/5 shadow-sm"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClientBooking(booking);
                          }}
                          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 bg-[#009966] shadow-lg shadow-[#009966]/20 active:scale-95 transition-transform cursor-pointer"
                        >
                          {booking.client?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </button>
                        <div className="truncate max-w-[150px]">
                           <p className={cn("font-black text-sm truncate uppercase", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.client}</p>
                           <p className={cn(
                             "text-[10px] font-bold text-[#FF5C35] uppercase",
                             booking.isDeletedExtra && "line-through text-red-500/80 decoration-red-500/80"
                           )}>{booking.vehicle}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                           <p className={cn("font-black text-sm", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>{booking.price}</p>
                           <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">{booking.days}</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDocReservationId(booking.id);
                            setIsDocumentPanelOpen(true);
                          }}
                          className={cn(
                            "w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm active:scale-95 transition-all text-white border-transparent",
                            "bg-[#009966]"
                          )}
                        >
                          <FileText className="w-4 h-4 cursor-pointer" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Reservations Pagination */}
          {totalHistoryPages > 1 && (
            <div className={cn(
              "px-4 md:px-8 py-4 border-t flex items-center justify-between shrink-0 transition-colors",
              isDarkMode ? "border-white/5 bg-[#1F1B19]" : "border-[#F2EFE9] bg-[#F9F7F2]"
            )}>
              <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Page {historyPage} of {totalHistoryPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={historyPage === 1}
                  onClick={() => {
                    setHistoryPage(p => Math.max(1, p - 1));
                    historyListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {(() => {
                    let startPage = 1;
                    let endPage = totalHistoryPages;
                    if (totalHistoryPages > 5) {
                      startPage = Math.max(1, Math.min(historyPage - 2, totalHistoryPages - 4));
                      endPage = startPage + 4;
                    }
                    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setHistoryPage(pageNum);
                          historyListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={cn(
                          "w-8 h-8 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                          historyPage === pageNum
                            ? "bg-[#009966] text-white shadow-lg shadow-[#009966]/20"
                            : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100")
                        )}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>
                <button
                  disabled={historyPage === totalHistoryPages}
                  onClick={() => {
                    setHistoryPage(p => Math.min(totalHistoryPages, p + 1));
                    historyListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cn(
          "rounded-[32px] border flex flex-col flex-1 shrink-0 transition-all duration-500 mb-6 relative z-10",
          isDarkMode 
            ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
            : "bg-[#FCFAF5] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
        )}>
          {/* Header */}
          <div className={cn(
            "min-h-[70px] px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b transition-colors",
            isDarkMode ? "border-white/5" : "border-[#F2EFE9]"
          )}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                  {/* Outer circle */}
                  <circle cx="50" cy="50" r="40" stroke="#FF5C35" strokeWidth="10" />
                  <circle cx="50" cy="50" r="32" fill="white" />
                  
                  {/* Diagonal Bar */}
                  <rect x="5" y="42" width="90" height="16" rx="8" fill="#FF5C35" transform="rotate(-45 50 50)" />
                  
                  {/* HISTORY Text */}
                  <text 
                    x="50" 
                    y="55" 
                    fill="black" 
                    fontSize="11" 
                    fontWeight="900" 
                    fontFamily="Inter, sans-serif" 
                    textAnchor="middle" 
                    transform="rotate(-45 50 50)"
                    letterSpacing="0.05em"
                  >
                    CANCELLED
                  </text>

                  {/* Decorative dots/accents from the original image */}
                  <circle cx="42" cy="30" r="1.5" fill="#000" />
                  <circle cx="48" cy="28" r="1.5" fill="#000" />
                  <rect x="28" y="28" width="6" height="1.5" fill="#000" transform="rotate(-45 28 28)" />
                  <rect x="68" y="68" width="6" height="1.5" fill="#000" transform="rotate(-45 68 68)" />
                </svg>
              </div>
              <h2 className={cn(
                "text-2xl font-black tracking-tight",
                isDarkMode ? "text-white" : "text-[#0E0C0B]"
              )}>Cancelled Reservations</h2>
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search cancelled reservations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                  isDarkMode 
                    ? "bg-[#1A1614] border-white/5 text-white focus:border-gray-500" 
                    : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-gray-400"
                )}
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1">
            <div className="min-w-[1100px] flex flex-col">
              <div className={cn(
                "px-4 py-3 flex items-center transition-colors",
                isDarkMode ? "bg-[#231F1D]" : "bg-[#F2EFE9]/60"
              )}>
                <div className="w-[15%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">CLIENT</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">VEHICLE</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">LOCATION</div>
                <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">AUTHORIZED COUNTRIES</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PERIOD</div>
                <div className="w-[5%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">DAYS</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PRICE</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">STATUS</div>
                <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">REASON</div>
                <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">TEAMMATE</div>
              </div>

              <div className={cn(
                "flex-1 transition-colors",
                isDarkMode ? "bg-[#1A1614]" : "bg-transparent"
              )}>
                {filteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <div className="w-20 h-20 mb-4 opacity-50">
                      <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" />
                        <rect x="5" y="44" width="90" height="12" rx="6" fill="currentColor" transform="rotate(-45 50 50)" />
                        <text x="50" y="55" fill="black" fontSize="8" fontWeight="900" textAnchor="middle" transform="rotate(-45 50 50)">CANCELLED</text>
                      </svg>
                    </div>
                    <p className="font-black text-sm tracking-widest uppercase">No cancelled reservations found</p>
                  </div>
                ) : (
                  paginatedBookings.map((booking) => (
                    <div key={booking.id} className={cn(
                      "px-4 py-2.5 flex items-center border-b transition-colors",
                      isDarkMode ? "border-white/5 hover:bg-white/5" : "border-black/5 hover:bg-black/5"
                    )}>
                      <div className="w-[15%] flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md bg-gray-400"
                        )}>
                          {booking.client.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className={cn("font-black text-sm truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.client}</p>
                          <p className="text-[10px] font-bold text-gray-500 truncate">{booking.email}</p>
                        </div>
                      </div>

                      <div className="w-[10%] flex items-center justify-center pr-2">
                        <div className="w-full flex flex-col items-center justify-center text-center">
                          <p className={cn(
                            "font-black text-sm truncate mb-1 w-full text-center", 
                            isDarkMode ? "text-white" : "text-[#0E0C0B]",
                            booking.isDeletedExtra && "line-through text-red-500/85 decoration-red-500/80 decoration-2"
                          )}>
                            {booking.vehicle?.toUpperCase()}
                          </p>
                          <div 
                            className={cn(
                              "inline-flex items-center rounded-md border-2 px-1.5 py-0.5 shadow-md hover:scale-105 transition-transform shrink-0 relative overflow-hidden",
                              booking.isDeletedExtra ? "opacity-75 bg-gray-100 border-gray-300" : "border-black/30 bg-white"
                            )}
                            style={{ height: '20px' }}
                          >
                            <div className="w-[3px] h-3 bg-blue-700 rounded-l-[1px] -ml-1.5 mr-1 shrink-0" />
                            <span 
                              className={cn(
                                "font-mono font-black text-black tracking-wider uppercase leading-none select-all",
                                getPlateColorByPlate(booking.plate) ? "pr-[11px]" : "",
                                booking.isDeletedExtra && "line-through text-gray-500"
                              )}
                              style={{ fontSize: '11px' }}
                            >
                              {booking.plate}
                            </span>
                            {(() => {
                              const col = getPlateColorByPlate(booking.plate);
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
                      </div>

                      <div className="w-[10%] flex flex-col items-center justify-center gap-1.5 py-1">
                        {booking.fromLocation && (() => {
                          const pill = getLocationPillStyles(booking.fromLocation);
                          return (
                            <div 
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                              style={{ backgroundColor: pill.bg }}
                            >
                              <ArrowUpRight className="w-3 h-3 text-black shrink-0" />
                              <span className="text-black truncate">
                                {booking.fromLocation}
                              </span>
                            </div>
                          );
                        })()}
                        {booking.toLocation && (() => {
                          const pill = getLocationPillStyles(booking.toLocation);
                          return (
                            <div 
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider select-all border border-black/10 shadow-sm max-w-full"
                              style={{ backgroundColor: pill.bg }}
                            >
                              <ArrowDownRight className="w-3 h-3 text-black shrink-0" />
                              <span className="text-black truncate">
                                {booking.toLocation}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="w-[8%] flex justify-center">
                        <div className="relative group">
                          <div 
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setCountriesPopupCoords({ top: rect.top, left: rect.left + rect.width / 2 });
                              setCountriesPopupId(booking.id);
                            }}
                            onMouseLeave={() => setCountriesPopupId(null)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-help",
                              booking.countries.length > 0 
                                ? (isDarkMode ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-black/5 border-black/5 text-gray-500 hover:bg-black/10") 
                                : "bg-transparent border-gray-100 text-gray-300 opacity-50"
                            )}>
                            <Flag className={cn("w-3.5 h-3.5", booking.countries.length > 0 && "fill-current")} />
                          </div>
                        </div>
                      </div>

                      <div className="w-[10%] text-center">
                        <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.start}</p>
                        <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.end}</p>
                      </div>

                      <div className="w-[5%] text-center">
                        <p className={cn("font-black text-sm", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.days}</p>
                      </div>

                      <div className="w-[10%] flex justify-center">
                        <PriceLabel 
                          reservationId={booking.id}
                          totalPrice={booking.totalPrice}
                          amountPaid={booking.amountPaid}
                          status={booking.status}
                          isDarkMode={isDarkMode}
                          insurance={booking.insurance}
                          paymentMethod={booking.paymentMethod}
                        />
                      </div>

                      <div className="w-[10%] flex justify-center">
                        <div className="px-3 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1.5 bg-gray-100 text-gray-400 inline-flex border border-gray-200/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          {booking.status}
                        </div>
                      </div>

                      <div className="w-[12%] flex justify-center">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setReasonPopupCoords({ top: rect.top, left: rect.left + rect.width / 2 });
                              setActiveReasonPopupId(activeReasonPopupId === booking.id ? null : booking.id);
                            }}
                            className="transition-transform duration-200 hover:scale-110 active:scale-95 relative flex items-center justify-center"
                          >
                            <WhyIcon className="w-10 h-10" />
                          </button>
                        </div>
                      </div>

                      <div className="w-[10%] flex justify-center">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border flex items-center gap-2",
                          isDarkMode ? "border-gray-800 text-gray-500 bg-gray-900/40" : "border-gray-200 text-gray-500 bg-gray-50"
                        )}>
                          <User className="w-3 h-3 text-gray-400" />
                          {booking.processedBy || 'System'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={cn(
              "px-8 py-4 border-t flex items-center justify-between shrink-0 transition-colors",
              isDarkMode ? "border-white/5 bg-[#1F1B19]" : "border-[#F2EFE9] bg-[#F9F7F2]"
            )}>
              <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {(() => {
                    let startPage = 1;
                    let endPage = totalPages;
                    if (totalPages > 5) {
                      startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                      endPage = startPage + 4;
                    }
                    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                          currentPage === pageNum
                            ? "bg-gray-400 text-white shadow-lg"
                            : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100")
                        )}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Portals for tooltips */}
      {countriesPopupId && countriesPopupCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: countriesPopupCoords.top,
            left: countriesPopupCoords.left,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }}
        >
          {(() => {
            const booking = cancelledBookings.concat(historyFilteredBookings).find(b => b.id === countriesPopupId);
            if (!booking || !booking.countries.length) return null;
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
            const booking = historyFilteredBookings.find(b => b.id === hoveredCountriesId);
            if (!booking || !booking.countries.length) return null;
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

      {activeReasonPopupId && reasonPopupCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9998]"
          onClick={() => setActiveReasonPopupId(null)}
        >
          <div 
            className="absolute pointer-events-auto"
            style={{
              top: reasonPopupCoords.top,
              left: reasonPopupCoords.left,
              transform: 'translate(-50%, calc(-100% - 8px))'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const booking = cancelledBookings.find(b => b.id === activeReasonPopupId);
              if (!booking) return null;
              return (
                <div className={cn(
                  "p-3 rounded-2xl border shadow-2xl min-w-[200px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200",
                  isDarkMode 
                    ? "bg-[#2C2724]/95 border-white/10 text-white" 
                    : "bg-white/95 border-black/5 text-[#0E0C0B]"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-6 bg-[#FF5C35] rounded-full" />
                    <p className="text-[10px] font-black tracking-widest uppercase opacity-50">Cancellation Reason</p>
                  </div>
                  <div className={cn(
                    "p-2.5 rounded-xl text-xs font-bold leading-relaxed",
                    isDarkMode ? "bg-white/5" : "bg-black/5"
                  )}>
                    {booking.cancellationReason}
                  </div>
                  <div className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent",
                    isDarkMode ? "border-t-[#2C2724]/95" : "border-t-white/95"
                  )} />
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Client Details Popup */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedClientBooking && (
            <div id="booking-print-overlay" className="fixed inset-0 z-[500] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClientBooking(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md no-print"
              />
              <motion.div 
                id="booking-print-card"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={cn(
                  "w-full max-w-lg rounded-[40px] shadow-2xl border relative z-10 overflow-hidden print-card-container",
                  isDarkMode ? "bg-[#231F1D] border-white/10" : "bg-white border-gray-200"
                )}
              >
                <div className="p-8 border-b border-black/5 bg-gradient-to-br from-[#FF5C35]/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center font-black text-white text-xl shadow-xl", getAvatarColor(selectedClientBooking.client))}>
                        {selectedClientBooking.client.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h2 className={cn("text-2xl font-black uppercase tracking-tight leading-none", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                          {selectedClientBooking.client}
                        </h2>
                        <div className="flex items-center gap-2">
                           <span className={cn(
                             "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                             "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                           )}>
                             Completed Reservation
                           </span>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{selectedClientBooking.id}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 no-print">
                      <button 
                        onClick={() => {
                          window.print();
                        }}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer",
                          isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                        )}
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedClientBooking(null)}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer",
                          isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                        )}
                      >
                        <Plus className="w-5 h-5 rotate-45" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {/* Grid 1: Basic Info */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <div>
                         <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase pb-1 block">Vehicle</span>
                         <div className="flex items-center gap-2">
                           <Car className={cn("w-4 h-4", isDarkMode ? "text-white" : "text-black")} />
                           <p className={cn("font-bold text-base", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                             {selectedClientBooking.isDeletedExtra ? <span className="line-through text-red-500/80 decoration-red-500/80">{selectedClientBooking.vehicle}</span> : selectedClientBooking.vehicle}
                           </p>
                         </div>
                       </div>
                       <div>
                         <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase pb-1 block">License Plate</span>
                         <div className={cn(
                           "inline-flex items-center rounded-md border text-[11px] font-black tracking-widest overflow-hidden shadow-sm",
                           isDarkMode ? "bg-black/20 border-white/10 text-white" : "bg-white border-black/10 text-black", selectedClientBooking.isDeletedExtra && "opacity-75 bg-gray-150/50"
                         )}>
                           <div className="bg-[#1565C0] w-2.5 self-stretch" />
                           <span className="px-3 py-1 uppercase">{selectedClientBooking.isDeletedExtra ? <span className="line-through text-gray-500">{selectedClientBooking.plate}</span> : selectedClientBooking.plate}</span>
                         </div>
                          {selectedClientBooking.chassisNumber && (
                            <div className="mt-4">
                              <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase pb-1 block">VIN Number</span>
                              <div className={cn(
                                "inline-flex items-center rounded-full border-2 text-[10px] font-mono font-black tracking-widest shadow-sm px-4 py-1.5",
                                isDarkMode 
                                  ? "bg-black/40 border-white/10 text-white" 
                                  : "bg-white border-black/15 text-black"
                              )}>
                                {selectedClientBooking.chassisNumber}
                              </div>
                            </div>
                          )}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div>
                         <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase pb-1 block">Period</span>
                         <div className="flex items-center gap-2">
                           <BookOpen className={cn("w-4 h-4", isDarkMode ? "text-white" : "text-black")} />
                           <p className={cn("font-bold text-sm", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                             {selectedClientBooking.start} — {selectedClientBooking.end}
                           </p>
                         </div>
                         <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-widest">
                           Total: {selectedClientBooking.days}
                         </p>
                       </div>
                       <div>
                         <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase pb-1 block">Price</span>
                         <p className={cn("text-xl font-black", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                           {selectedClientBooking.price}
                         </p>
                       </div>
                    </div>
                  </div>

                  {/* Route & Locations */}
                  <div className={cn(
                    "p-6 rounded-[30px] border flex items-center justify-between",
                    isDarkMode ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"
                  )}>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <ArrowUpRight className="w-5 h-5" />
                        <span className="text-[10px] font-black tracking-widest uppercase">From</span>
                      </div>
                      <p className={cn("text-sm font-black uppercase text-center w-full truncate", isDarkMode ? "text-white" : "text-black")}>
                        {selectedClientBooking.fromLocation || 'N/A'}
                      </p>
                    </div>
                    <div className="px-6 flex flex-col items-center opacity-30">
                      <div className="w-px h-8 bg-gray-500" />
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-red-500">
                        <ArrowDownRight className="w-5 h-5" />
                        <span className="text-[10px] font-black tracking-widest uppercase">To</span>
                      </div>
                      <p className={cn("text-sm font-black uppercase text-center w-full truncate", isDarkMode ? "text-white" : "text-black")}>
                        {selectedClientBooking.toLocation || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Countries Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <Flag className="w-4 h-4 text-[#FF5C35]" style={{ marginTop: '40px' }} />
                       <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">Authorized Countries</span>
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
                            className="px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-sm"
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
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}



      {/* Document Panel - View Only */}
      <DocumentPanel 
        isOpen={isDocumentPanelOpen}
        onClose={() => {
          setIsDocumentPanelOpen(false);
          setSelectedDocReservationId(null);
        }}
        reservationId={selectedDocReservationId || ''}
        reservation={selectedReservation}
        isDarkMode={isDarkMode}
        viewOnly={true}
      />

      <style jsx global>{`
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
    </div>
  );
}
