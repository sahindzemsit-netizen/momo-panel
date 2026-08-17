'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback, useDeferredValue } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Search, 
  FileText, 
  Flag, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Pencil, 
  Plus, 
  User, 
  Check, 
  BookOpen, 
  Coins, 
  Calendar, 
  RotateCcw 
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import PriceLabel from './PriceLabel';
import WhatsAppButton from './WhatsAppButton';
import { Reservation, Vehicle } from '@/types';
import { COUNTRY_COLORS, VEHICLE_COUNTRIES } from '@/lib/constants';
import { globalGetDestinationCountry } from './Reservations';
import { useAppState } from '@/lib/context';

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
    }, 150);
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

const getAvatarColor = (name: string) => {
  if (!name) return "bg-gray-400";
  const colors = [
    "bg-[#FF5C35]",
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

const getPlateColorByPlate = (plateStr: string, vehiclesList: Vehicle[]) => {
  if (!plateStr || !vehiclesList) return null;
  const clean = plateStr.replace(/\s+/g, '').toUpperCase();
  const found = vehiclesList.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
  return found?.color || null;
};

const getLocationPillStyles = (location: string | undefined) => {
  if (!location) return { bg: 'transparent', text: '#000000' };
  const loc = location.toUpperCase();
  if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA')) return { bg: '#64BC61', text: '#000000' };
  if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO')) return { bg: '#3B82F6', text: '#000000' };
  if (loc.includes('TIRANA') || loc.includes('ALBANIA')) return { bg: '#EC4899', text: '#FFFFFF' };
  if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO')) return { bg: '#FF9F00', text: '#000000' };
  if (loc.includes('SARAJEVO') || loc.includes('BOSNIA')) return { bg: '#8B5CF6', text: '#000000' };
  return { bg: '#64BC61', text: '#000000' };
};

interface ActiveBookingRowProps {
  booking: any;
  isDarkMode: boolean;
  todayStr: string;
  hasViolation: boolean;
  plateColor: string | null;
  isNonStatusEdit: boolean;
  isSentCashflow: boolean;
  onSelectClient: (booking: any) => void;
  onAuditClick: (e: React.MouseEvent, bookingId: string) => void;
  onEdit: (bookingId: string) => void;
  onOpenNote: (e: React.MouseEvent, bookingId: string, note: string) => void;
  onOpenDocs: (bookingId: string) => void;
  onNotifyCashflow: (e: React.MouseEvent, bookingId: string) => void;
  onOpenStatusMenu: (e: React.MouseEvent, bookingId: string) => void;
  onCompleteBooking: (e: React.MouseEvent, booking: any) => void;
  onCountriesMouseEnter: (e: React.MouseEvent, bookingId: string) => void;
  onCountriesMouseLeave: () => void;
  onCountriesClick: (e: React.MouseEvent, bookingId: string) => void;
}

const ActiveBookingRow = React.memo<ActiveBookingRowProps>(({
  booking,
  isDarkMode,
  todayStr,
  hasViolation,
  plateColor,
  isNonStatusEdit,
  isSentCashflow,
  onSelectClient,
  onAuditClick,
  onEdit,
  onOpenNote,
  onOpenDocs,
  onNotifyCashflow,
  onOpenStatusMenu,
  onCompleteBooking,
  onCountriesMouseEnter,
  onCountriesMouseLeave,
  onCountriesClick,
}) => {
  const isDueToday = booking.status === 'UPCOMING' && booking.start === todayStr;
  const isReturnToday = booking.status === 'ON RENT' && booking.end === todayStr;

  return (
    <div className={cn(
      "px-4 py-2.5 flex items-center border-b transition-colors",
      isDarkMode ? "border-black/40" : "border-black/10"
    )}>
      <div className="w-[21%] flex items-center gap-3">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelectClient(booking);
          }}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md ring-2 ring-offset-2 cursor-pointer",
            getAvatarColor(booking.client),
            isDarkMode ? "ring-offset-[#1A1614] ring-white/10" : "ring-offset-white ring-black/10"
          )}
        >
          {booking.client.split(' ').map((n: string) => n[0]).join('')}
        </button>
        <div className="truncate">
          <div className="flex items-center gap-1.5 max-w-full">
            <p className={cn("font-black text-sm truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.client}</p>
            <button
              onClick={(e) => onAuditClick(e, booking.id)}
              className={cn(
                "audit-log-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black select-none cursor-pointer shrink-0 border",
                isNonStatusEdit
                  ? "bg-red-500 text-white border-red-600 shadow-sm"
                  : (isDarkMode 
                      ? "bg-[#3A3532]/80 text-[#FF5C35] border-white/10" 
                      : "bg-orange-50 text-[#FF5C35] border-orange-200"
                    )
              )}
              title="View Audit Trail"
            >
              !
            </button>
          </div>
          <p className="text-[10px] font-bold text-gray-400 truncate">{booking.email}</p>
          <WhatsAppButton phone={booking.phone || ''} country={booking.vehicleCountry} />
        </div>
      </div>
      <div className="w-[9%] flex items-center justify-center pr-2">
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
              "inline-flex items-center rounded-md border-2 px-1.5 py-0.5 shadow-md shrink-0 relative overflow-hidden",
              hasViolation
                ? "bg-red-100 border-red-500 shadow-inner"
                : "bg-white border-black/30",
              booking.isDeletedExtra && "opacity-75 bg-gray-100 border-gray-300"
            )}
            style={{ height: '20px' }}
          >
            <div className="w-[3px] h-3 bg-blue-700 rounded-l-[1px] -ml-1.5 mr-1 shrink-0" />
            <span 
              className={cn(
                "font-mono font-black text-black tracking-wider uppercase leading-none select-all",
                plateColor ? "pr-[11px]" : "",
                booking.isDeletedExtra && "line-through text-gray-500"
              )}
              style={{ fontSize: '11px' }}
            >
              {booking.plate}
            </span>
            {plateColor && (
              <div 
                className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                style={{ 
                  width: '9px',
                  backgroundColor: plateColor
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="w-[12%] flex flex-col items-center justify-center gap-1.5 py-1">
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
        {!booking.fromLocation && !booking.toLocation && (
          <span className="text-[9px] font-black text-gray-400/40 italic">N/A</span>
        )}
      </div>
      <div className="w-[8%] flex justify-center">
        <div className="relative group">
          <button
            onMouseEnter={(e) => onCountriesMouseEnter(e, booking.id)}
            onMouseLeave={onCountriesMouseLeave}
            onClick={(e) => onCountriesClick(e, booking.id)}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shadow-sm border",
              booking.countries && booking.countries.length > 0
                ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-emerald-50 border-emerald-500/30 text-emerald-600")
                : (isDarkMode ? "bg-[#1A1614] border-white/10 text-gray-500" : "bg-white border-black/10 text-gray-400"),
              "group cursor-pointer"
            )}
          >
            <Flag className={cn(
              "w-3.5 h-3.5",
              booking.countries && booking.countries.length > 0 ? "fill-current" : ""
            )} />
          </button>
        </div>
      </div>
      <div className="w-[10%] flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.start}</p>
          {booking.arrivalTime && (
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-[#FF5C35]" />
              <p className="text-[10px] font-black text-[#FF5C35] leading-none">{booking.arrivalTime}</p>
            </div>
          )}
        </div>
        <div className="h-px w-4 bg-gray-200 dark:bg-white/10 my-1" />
        <div className="text-center">
          <p className="text-[13px] font-black tracking-tight text-gray-400 leading-tight">{booking.end}</p>
          {booking.departureTime && (
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-blue-500" />
              <p className="text-[10px] font-black text-blue-500 leading-none">{booking.departureTime}</p>
            </div>
          )}
        </div>
      </div>
      <div className="w-[5%] text-center">
        <p className={cn("font-black text-sm", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{booking.days}</p>
      </div>
      <div className="w-[8%] flex justify-center">
        <PriceLabel 
          reservationId={booking.id}
          totalPrice={booking.totalPrice}
          amountPaid={booking.amountPaid}
          status={booking.status}
          isDarkMode={isDarkMode}
          cashflowNotificationSent={booking.cashflowNotificationSent}
          insurance={booking.insurance}
          paymentMethod={booking.paymentMethod}
        />
      </div>
      <div className="w-[9%] flex flex-col items-center justify-center gap-1.5 py-1">
        <div className="flex items-center gap-1.5">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(booking.id);
            }}
            className={cn(
              "w-6 h-6 rounded-full border flex items-center justify-center shadow-sm cursor-pointer",
              isDarkMode ? "border-[#FF5C35]/50 text-[#FF5C35]" : "border-[#FF5C35]/50 text-[#FF5C35]"
            )}
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => onOpenNote(e, booking.id, booking.note || '')}
            className={cn(
              "w-6 h-6 rounded-full border flex items-center justify-center shadow-sm cursor-pointer",
              booking.note 
                ? "bg-[#9C27B0] border-[#7B1FA2] text-white" 
                : (isDarkMode ? "border-[#9C27B0]/50 text-[#9C27B0]" : "border-[#9C27B0]/50 text-[#9C27B0]")
            )}
            title="Note"
          >
            {booking.note ? <BookOpen className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onOpenDocs(booking.id);
            }}
            className={cn(
              "w-5 h-5 rounded-md border flex items-center justify-center shadow-md group cursor-pointer",
              booking.uploadedDocuments && booking.uploadedDocuments.length > 0
                ? "bg-cyan-500 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : (isDarkMode 
                  ? "bg-[#1F1B19] border-white/10 text-white" 
                  : "bg-white border-black/5 text-[#0E0C0B]")
            )}
            title="Documents"
          >
            <FileText className="w-3 h-3" />
          </button>
          <button 
            disabled={booking.cashflowNotificationSent || isSentCashflow}
            onClick={(e) => onNotifyCashflow(e, booking.id)}
            className={cn(
              "w-5 h-5 rounded-md border flex items-center justify-center shadow-sm cursor-pointer overflow-hidden p-1",
              (booking.cashflowNotificationSent || isSentCashflow)
                ? "bg-emerald-500 border-emerald-400 cursor-not-allowed opacity-70 text-white"
                : (isDarkMode ? "bg-[#1F1B19] border-white/10 text-emerald-400 hover:bg-white/5" : "bg-white border-black/5 text-emerald-600 hover:bg-black/5")
            )}
            title="Notify to Cashflow"
          >
            {booking.cashflowNotificationSent || isSentCashflow ? (
              <Check className="w-3 h-3" />
            ) : (
              <Coins className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
      <div className="w-[8%] flex justify-center relative">
        <button 
          onClick={(e) => onOpenStatusMenu(e, booking.id)}
          className={cn(
            "px-3 py-1 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1.5 cursor-pointer",
            isDueToday ? "animate-green-glow border-none" : (isReturnToday ? "animate-red-glow border-none" : booking.statusColor)
          )}
        >
          <div className={cn("w-1.5 h-1.5 rounded-full", (isDueToday || isReturnToday) ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" : (booking.status === 'ON RENT' ? "bg-[#C62828]" : "bg-[#00FF00]"))} />
          {booking.status}
        </button>
      </div>
      <div className="w-[10%] flex flex-col items-center justify-center gap-1.5 py-1">
        <div className="flex items-center justify-center gap-1.5 w-full">
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border flex items-center gap-2",
            isDarkMode 
              ? "border-amber-900/40 text-amber-400 bg-amber-900/20" 
              : "border-amber-200 text-amber-700 bg-amber-50"
          )}>
            <User className="w-3 h-3 text-amber-500" />
            {booking.processedBy || 'System'}
          </div>
          {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
            <button
              onClick={(e) => onCompleteBooking(e, booking)}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shadow-sm cursor-pointer border shrink-0 transition-colors",
                !(booking.cashflowNotificationSent || isSentCashflow)
                  ? (isDarkMode
                      ? "bg-amber-500/10 hover:bg-amber-500/25 text-amber-500 border-amber-500/30"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200")
                  : (isDarkMode 
                      ? "bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30" 
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-300")
              )}
              title={
                !(booking.cashflowNotificationSent || isSentCashflow)
                  ? "Notify to Cashflow first before completing"
                  : "Mark Completed"
              }
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}
        </div>
        {booking.paidTo && (
          <div className={cn(
            "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border flex items-center gap-1",
            isDarkMode
              ? "border-emerald-900/40 text-emerald-400 bg-emerald-900/20"
              : "border-emerald-200 text-emerald-700 bg-emerald-50"
          )}>
            <span className="text-[10px]" role="img" aria-label="paid-to">💰</span>
            <span>{booking.paidTo}</span>
          </div>
        )}
      </div>
    </div>
  );
});
ActiveBookingRow.displayName = 'ActiveBookingRow';

interface ActiveBookingMobileCardProps {
  booking: any;
  isDarkMode: boolean;
  todayStr: string;
  hasViolation: boolean;
  plateColor: string | null;
  isNonStatusEdit: boolean;
  isSentCashflow: boolean;
  onSelectClient: (booking: any) => void;
  onAuditClick: (e: React.MouseEvent, bookingId: string) => void;
  onEdit: (bookingId: string) => void;
  onOpenNote: (e: React.MouseEvent, bookingId: string, note: string) => void;
  onOpenDocs: (bookingId: string) => void;
  onNotifyCashflow: (e: React.MouseEvent, bookingId: string) => void;
  onOpenStatusMenu: (e: React.MouseEvent, bookingId: string) => void;
}

const ActiveBookingMobileCard = React.memo<ActiveBookingMobileCardProps>(({
  booking,
  isDarkMode,
  todayStr,
  hasViolation,
  plateColor,
  isNonStatusEdit,
  isSentCashflow,
  onSelectClient,
  onAuditClick,
  onEdit,
  onOpenNote,
  onOpenDocs,
  onNotifyCashflow,
  onOpenStatusMenu,
}) => {
  const isDueToday = booking.status === 'UPCOMING' && booking.start === todayStr;
  const isReturnToday = booking.status === 'ON RENT' && booking.end === todayStr;
  const clientInitials = booking.client.split(' ').map((n: string) => n[0]).join('');

  return (
    <div 
      className={cn(
        "p-5 rounded-[24px] border-2 transition-all flex flex-col gap-4",
        isDarkMode ? "bg-[#1E1B1A] border-white/5" : "bg-white border-gray-100 shadow-sm"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectClient(booking);
            }}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-lg cursor-pointer shrink-0",
              getAvatarColor(booking.client)
            )}
            title="Open Client Card"
          >
            {clientInitials}
          </button>
          <div>
            <div className="flex items-center gap-1.5 max-w-[150px]">
              <h4 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClient(booking);
                }}
                className={cn("font-black text-sm truncate cursor-pointer hover:underline text-left", isDarkMode ? "text-white" : "text-[#0E0C0B]")}
                title="Open Client Card"
              >
                {booking.client}
              </h4>
              <button
                onClick={(e) => onAuditClick(e, booking.id)}
                className={cn(
                  "audit-log-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black select-none cursor-pointer shrink-0 border",
                  isNonStatusEdit
                    ? "bg-red-500 text-white border-red-600 shadow-sm"
                    : (isDarkMode 
                        ? "bg-[#3A3532]/80 text-[#FF5C35] border-white/10" 
                        : "bg-orange-50 text-[#FF5C35] border-orange-200"
                      )
                )}
                title="View Audit Trail"
              >
                !
              </button>
            </div>
            <WhatsAppButton phone={booking.phone || ''} country={booking.vehicleCountry} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button 
            onClick={(e) => onOpenStatusMenu(e, booking.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1.5 border",
              isDueToday ? "animate-green-glow border-none" : (isReturnToday ? "animate-red-glow border-none" : booking.statusColor)
            )}
          >
            {booking.status}
          </button>
          <PriceLabel 
            reservationId={booking.id}
            totalPrice={booking.totalPrice}
            amountPaid={booking.amountPaid}
            status={booking.status}
            isDarkMode={isDarkMode}
            cashflowNotificationSent={booking.cashflowNotificationSent}
            insurance={booking.insurance}
            paymentMethod={booking.paymentMethod}
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">VEHICLE</span>
            <p className={cn(
              "font-black text-sm", 
              isDarkMode ? "text-white" : "text-black",
              booking.isDeletedExtra && "line-through text-red-500/85 decoration-red-500/80 decoration-2"
            )}>
              {booking.vehicle?.toUpperCase()}
            </p>
            <div 
              className={cn(
                "inline-flex items-center rounded-md border-2 px-2 py-0.5 mt-1.5 shadow-md w-fit shrink-0 relative overflow-hidden",
                hasViolation
                  ? "bg-red-100 border-red-500 shadow-inner"
                  : "bg-white border-black/30",
                booking.isDeletedExtra && "opacity-75 bg-gray-100 border-gray-300"
              )}
              style={{ height: '25px' }}
            >
              <div className="w-[4px] h-4.5 bg-blue-700 rounded-l-[1px] -ml-2 mr-1.5 shrink-0" />
              <span 
                className={cn(
                  "font-mono font-black text-black tracking-wider uppercase leading-none select-all",
                  plateColor ? "pr-[14px]" : "",
                  booking.isDeletedExtra && "line-through text-gray-500"
                )}
                style={{ fontSize: '13px' }}
              >
                {booking.plate}
              </span>
              {plateColor && (
                <div 
                  className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                  style={{ 
                    width: '12px',
                    backgroundColor: plateColor
                  }}
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(booking.id);
              }}
              className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FF5C35] flex items-center justify-center cursor-pointer"
              title="Edit"
            >
              <Pencil className="w-5 h-5" />
            </button>

            <button 
              onClick={(e) => onOpenNote(e, booking.id, booking.note || '')}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border",
                booking.note 
                  ? "bg-[#9C27B0] border-[#7B1FA2] text-white shadow-md shadow-[#9C27B0]/20" 
                  : "bg-[#9C27B0]/10 border-[#9C27B0]/20 text-[#9C27B0]"
              )}
              title="Notes"
            >
              {booking.note ? <BookOpen className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onOpenDocs(booking.id);
              }}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border",
                booking.uploadedDocuments && booking.uploadedDocuments.length > 0
                  ? "bg-cyan-500 border-cyan-400 text-white shadow-md shadow-cyan-500/20"
                  : "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
              )}
              title="Documents"
            >
              <FileText className="w-5 h-5" />
            </button>

            <button 
              disabled={booking.cashflowNotificationSent || isSentCashflow}
              onClick={(e) => onNotifyCashflow(e, booking.id)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer p-2 border",
                (booking.cashflowNotificationSent || isSentCashflow)
                  ? "bg-emerald-500 border-emerald-400 cursor-not-allowed opacity-70 text-white"
                  : (isDarkMode ? "bg-white/5 border-white/10 text-emerald-400" : "bg-white border-black/5 text-emerald-600")
              )}
              title="Notify to Cashflow"
            >
              {booking.cashflowNotificationSent || isSentCashflow ? (
                <Check className="w-5 h-5 pointer-events-none" />
              ) : (
                <Coins className="w-5 h-5 pointer-events-none" />
              )}
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex justify-between items-center text-center">
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">START</span>
            <p className={cn("text-xs font-black", isDarkMode ? "text-white" : "text-black")}>{booking.start}</p>
            {booking.arrivalTime && (
              <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FF5C35]/10 mt-1 self-center">
                <Clock className="w-2.5 h-2.5 text-[#FF5C35]" />
                <span className="text-[10px] font-black text-[#FF5C35]">{booking.arrivalTime}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 border-x border-gray-200 dark:border-white/10">
            <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">DAYS</span>
            <p className={cn("text-xs font-black", isDarkMode ? "text-white" : "text-black")}>{booking.days}</p>
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">END</span>
            <p className={cn("text-xs font-black", isDarkMode ? "text-white" : "text-black")}>{booking.end}</p>
            {booking.departureTime && (
              <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 mt-1 self-center">
                <Clock className="w-2.5 h-2.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-500">{booking.departureTime}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
ActiveBookingMobileCard.displayName = 'ActiveBookingMobileCard';

export interface TransformedBooking extends Reservation {
  client: string;
  vehicle: string;
  plate: string;
  vehicleCountry?: string;
  rawStart: Date;
  rawEnd: Date;
  price: string;
}

interface ActiveBookingsPanelProps {
  isDarkMode: boolean;
  userReservations: Reservation[];
  dbVehicles: Vehicle[];
  currentSystemTime?: Date;
  reservationFilter: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null;
  setReservationFilter: (val: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null) => void;
  isDataLoading: boolean;

  // Actions from parent
  setSelectedClientBooking: (booking: any) => void;
  handleAuditClick: (e: React.MouseEvent, bookingId: string) => void;
  nonStatusEditIds: Set<string>;
  setEditingReservation: (res: Reservation | null) => void;
  setModalMode: (mode: 'full' | 'dates') => void;
  setIsModalOpen: (isOpen: boolean) => void;
  setNoteCoords: (coords: { top: number; left: number }) => void;
  setEditingNoteId: (id: string | null) => void;
  setNoteContent: (note: string) => void;
  setIsEditingNote: (isEditing: boolean) => void;
  setSelectedDocReservationId: (id: string | null) => void;
  setIsDocumentPanelOpen: (isOpen: boolean) => void;
  sentCashflowIds: string[];
  setCashflowPopupCoords: (coords: { top: number; left: number }) => void;
  setCashflowPopupId: (id: string | null) => void;
  fetchPaymentSummary: (id: string) => void;
  setActionMenuCoords: (coords: { top: number; left: number }) => void;
  setActionMenuId: (id: string | null) => void;
  setReservationToComplete: (booking: any) => void;
  setIsCompleteModalOpen: (isOpen: boolean) => void;
  countriesPopupId: string | null;
  setCountriesPopupId: (id: string | null) => void;
  setCountriesPopupCoords: (coords: { top: number; left: number }) => void;
  setHoveredCountriesCoords: (coords: { top: number; left: number } | null) => void;
  setHoveredCountriesId: (id: string | null) => void;
}

const parseDateToObj = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  if (typeof dateVal === 'number') return new Date(dateVal);
  if (typeof dateVal === 'string') {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d;
    // Try parsing 'dd/MM/yyyy'
    const parts = dateVal.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const customD = new Date(year, month, day);
      if (!isNaN(customD.getTime())) return customD;
    }
    // Try parsing 'yyyy-MM-dd'
    const dashParts = dateVal.split('-');
    if (dashParts.length === 3) {
      const year = parseInt(dashParts[0], 10);
      const month = parseInt(dashParts[1], 10) - 1;
      const day = parseInt(dashParts[2], 10);
      const customD = new Date(year, month, day);
      if (!isNaN(customD.getTime())) return customD;
    }
  }
  if (dateVal && typeof dateVal.toDate === 'function') {
    try {
      const d = dateVal.toDate();
      if (!isNaN(d.getTime())) return d;
    } catch {
      return null;
    }
  }
  return null;
};

export const ActiveBookingsPanel: React.FC<ActiveBookingsPanelProps> = ({
  isDarkMode,
  userReservations,
  dbVehicles,
  currentSystemTime,
  reservationFilter,
  setReservationFilter,
  isDataLoading,
  setSelectedClientBooking,
  handleAuditClick,
  nonStatusEditIds,
  setEditingReservation,
  setModalMode,
  setIsModalOpen,
  setNoteCoords,
  setEditingNoteId,
  setNoteContent,
  setIsEditingNote,
  setSelectedDocReservationId,
  setIsDocumentPanelOpen,
  sentCashflowIds,
  setCashflowPopupCoords,
  setCashflowPopupId,
  fetchPaymentSummary,
  setActionMenuCoords,
  setActionMenuId,
  setReservationToComplete,
  setIsCompleteModalOpen,
  countriesPopupId,
  setCountriesPopupId,
  setCountriesPopupCoords,
  setHoveredCountriesCoords,
  setHoveredCountriesId
}) => {
  const { violations = [], user } = useAppState();

  const isAuthorizedToSeeAmounts = useMemo(() => {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase().trim();
    return email === 'mrbulimomo@gmail.com' || email === 'sahindzemsit@gmail.com';
  }, [user]);

  const hasViolation = useMemo(() => {
    const activePlates = new Set(
      violations
        .filter(v => v.status === 'waiting')
        .map(v => (v.plate || '').replace(/[^A-Z0-9]/gi, '').toUpperCase())
    );
    return (plate: string) => {
      if (!plate) return false;
      const cleanPlate = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      return activePlates.has(cleanPlate);
    };
  }, [violations]);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeDepartureCountryFilter, setActiveDepartureCountryFilter] = useState<string | null>(null);
  const [showOnlyEdits, setShowOnlyEdits] = useState(false);
  const [activePage, setActivePage] = useState(1);

  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    setActivePage(1);
  }, []);

  const handleStatusFilterChange = useCallback((status: string | null) => {
    setStatusFilter(status);
    setActivePage(1);
  }, []);

  const handleReservationFilterChange = useCallback((filter: string | null) => {
    setReservationFilter(filter);
    setActivePage(1);
  }, [setReservationFilter]);

  const handleDepartureCountryFilterChange = useCallback((country: string | null) => {
    setActiveDepartureCountryFilter(country);
    setActivePage(1);
  }, []);

  const handleToggleEdits = useCallback(() => {
    setShowOnlyEdits(prev => !prev);
    setActivePage(1);
  }, []);

  // New states for show upcoming amounts and date filters
  const [showUpcomingAmounts, setShowUpcomingAmounts] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'all' | 'single' | 'range'>('all');
  const [calendarSingleDate, setCalendarSingleDate] = useState<string>(''); // 'yyyy-MM-dd'
  const [calendarRangeStart, setCalendarRangeStart] = useState<string>(''); // 'yyyy-MM-dd'
  const [calendarRangeEnd, setCalendarRangeEnd] = useState<string>(''); // 'yyyy-MM-dd'

  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => {
    const dateToUse = calendarSingleDate || calendarRangeStart;
    if (dateToUse) {
      const parts = dateToUse.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      }
    }
    return new Date();
  });

  useEffect(() => {
    const dateToUse = calendarSingleDate || calendarRangeStart;
    if (dateToUse) {
      const parts = dateToUse.split('-');
      if (parts.length === 3) {
        setCalendarViewDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1));
      }
    }
  }, [calendarSingleDate, calendarRangeStart]);

  const renderEnglishCalendar = (
    mode: 'single' | 'range',
    value: string,
    endValue: string = '',
    onChange: (start: string, end?: string) => void
  ) => {
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

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const d = prevMonthDays - i;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysGrid.push({ day: d, isCurrentMonth: false, dateStr });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysGrid.push({ day: d, isCurrentMonth: true, dateStr });
    }

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
      if (mode === 'single') {
        onChange(dateStr, '');
      } else {
        if (!value || (value && endValue)) {
          onChange(dateStr, '');
        } else {
          if (dateStr < value) {
            onChange(dateStr, '');
          } else {
            onChange(value, dateStr);
          }
        }
      }
    };

    const isSelected = (dateStr: string) => {
      if (mode === 'single') {
        return value === dateStr;
      } else {
        return value === dateStr || endValue === dateStr;
      }
    };

    const isInRange = (dateStr: string) => {
      if (mode === 'range' && value && endValue) {
        return dateStr > value && dateStr < endValue;
      }
      return false;
    };

    const handleToday = () => {
      const today = new Date();
      const yStr = today.getFullYear();
      const mStr = String(today.getMonth() + 1).padStart(2, '0');
      const dStr = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yStr}-${mStr}-${dStr}`;
      setCalendarViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
      if (mode === 'single') {
        onChange(todayStr, '');
      } else {
        onChange(todayStr, '');
      }
    };

    const handleClear = () => {
      onChange('', '');
    };

    let selectedText = 'No date selected';
    if (mode === 'single' && value) {
      selectedText = `Selected: ${value}`;
    } else if (mode === 'range' && value) {
      selectedText = endValue ? `Range: ${value} to ${endValue}` : `Starts: ${value}`;
    }

    return (
      <div className="w-full select-none pt-1">
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={cn(
              "p-1 rounded-lg border transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800",
              isDarkMode ? "border-white/10 text-white" : "border-gray-200 text-gray-700"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-black uppercase tracking-wider">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className={cn(
              "p-1 rounded-lg border transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800",
              isDarkMode ? "border-white/10 text-white" : "border-gray-200 text-gray-700"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
          <div>Sun</div>
        </div>

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
                  "h-7 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  !isCurrentMonth && "opacity-25",
                  selected
                    ? "bg-[#FF5C35] text-white font-black scale-105 shadow-sm"
                    : inRange
                      ? "bg-[#FF5C35]/15 text-[#FF5C35] rounded-none first:rounded-l-lg last:rounded-r-lg"
                      : isDarkMode
                        ? "text-white hover:bg-neutral-800"
                        : "text-gray-800 hover:bg-neutral-100"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-center">
          <span className="text-[10px] font-black tracking-widest uppercase text-[#FF5C35]">
            {selectedText}
          </span>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-dashed border-gray-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest">
          <button
            type="button"
            onClick={handleClear}
            className="text-red-500 hover:underline cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="text-[#FF5C35] hover:underline cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>
    );
  };

  const matchesCalendarFilter = React.useCallback((bookingRawStart: any) => {
    if (calendarMode === 'all') return true;
    const startObj = parseDateToObj(bookingRawStart);
    if (!startObj) return false;

    // Reset hours, minutes, seconds, ms for precise comparison
    const bookingDate = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());

    if (calendarMode === 'single') {
      if (!calendarSingleDate) return true;
      const parts = calendarSingleDate.split('-');
      if (parts.length !== 3) return true;
      const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return bookingDate.getTime() === targetDate.getTime();
    }

    if (calendarMode === 'range') {
      let pass = true;
      if (calendarRangeStart) {
        const parts = calendarRangeStart.split('-');
        if (parts.length === 3) {
          const targetStart = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          pass = pass && bookingDate.getTime() >= targetStart.getTime();
        }
      }
      if (calendarRangeEnd) {
        const parts = calendarRangeEnd.split('-');
        if (parts.length === 3) {
          const targetEnd = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          pass = pass && bookingDate.getTime() <= targetEnd.getTime();
        }
      }
      return pass;
    }

    return true;
  }, [calendarMode, calendarSingleDate, calendarRangeStart, calendarRangeEnd]);

  const toggleUpcomingAmounts = () => {
    const newVal = !showUpcomingAmounts;
    setShowUpcomingAmounts(newVal);
    if (newVal) {
      setStatusFilter('UPCOMING');
    } else {
      setStatusFilter(null);
    }
  };
  const itemsPerPage = 5;
  const listRef = useRef<HTMLDivElement>(null);

  const getAvatarColor = (name: string) => {
    if (!name) return "bg-gray-400";
    const colors = [
      "bg-[#FF5C35]",
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

  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    dbVehicles.forEach(v => {
      map.set(String(v.id), v);
    });
    return map;
  }, [dbVehicles]);

  const plateColorMap = useMemo(() => {
    const map = new Map<string, string | null>();
    dbVehicles.forEach(v => {
      if (v.plate) {
        map.set(v.plate.replace(/\s+/g, '').toUpperCase(), v.color || null);
      }
    });
    return map;
  }, [dbVehicles]);

  const reservationsById = useMemo(() => {
    const map = new Map<string, Reservation>();
    userReservations.forEach(r => {
      map.set(String(r.id), r);
    });
    return map;
  }, [userReservations]);

  const baseActiveBookings = useMemo(() => {
    const sortedReservations = [...userReservations].sort((a, b) => {
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

      const createA = getTS(a.createdAt);
      const createB = getTS(b.createdAt);
      if (createA !== createB && createA > 0 && createB > 0) {
        return createB - createA;
      }

      const startA = getTS(a.start);
      const startB = getTS(b.start);
      if (startA !== startB && startA > 0 && startB > 0) {
        return startB - startA;
      }

      const numA = typeof a.id === 'string' && !isNaN(Number(a.id)) ? Number(a.id) : 0;
      const numB = typeof b.id === 'string' && !isNaN(Number(b.id)) ? Number(b.id) : 0;
      if (numA !== numB && numA > 0 && numB > 0) {
        return numB - numA;
      }

      return String(b.id).localeCompare(String(a.id));
    });

    const formatDateSafe = (date: string | number | Date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return isNaN(d.getTime()) ? 'Invalid Date' : format(d, 'dd/MM/yyyy');
    };

    return sortedReservations
      .filter(res => {
        if (res.status === 'COMPLETED' || res.status === 'CANCELLED') return false;
        const car = vehicleMap.get(String(res.vehicleId));
        if (car?.name === 'EXTRA' || car?.isExtra) {
          if (!car?.plate) return false;
        }
        return true;
      })
      .map(res => {
        const car = vehicleMap.get(String(res.vehicleId));

        let statusColor = 'bg-[#dcffdc] text-black border border-[#00FF00]/40 font-black';
        if (res.status === 'ON RENT') {
          statusColor = 'bg-[#FFEBEE] text-black border border-red-200/50 font-black';
        } else if (res.status === 'COMPLETED') {
          statusColor = 'bg-emerald-600 text-white';
        } else if (res.status === 'CANCELLED') {
          statusColor = 'bg-gray-150 text-gray-400';
        }

        const vehicleName = ((res as any).deletedExtraPlate || (res as any).deletedExtraName)
          ? ((res as any).deletedExtraName || 'EXTRA')
          : (car?.name === 'EXTRA' || car?.isExtra)
            ? (car?.extraName || 'EXTRA')
            : (car?.name || 'Unknown');

        const plateName = ((res as any).deletedExtraPlate)
          ? (res as any).deletedExtraPlate
          : (car?.plate || '');

        const clientName = res.name || '';
        const fromLoc = res.fromLocation || '';
        const depCountry = globalGetDestinationCountry(fromLoc);

        return {
          id: res.id,
          client: clientName,
          email: res.email,
          phone: res.phone,
          vehicleCountry: car?.country,
          isDeletedExtra: !!((res as any).deletedExtraPlate || (res as any).deletedExtraName),
          vehicle: vehicleName,
          plate: plateName,
          searchClient: clientName.toLowerCase(),
          searchVehicle: vehicleName.toLowerCase(),
          searchPlate: plateName.toLowerCase(),
          departureCountry: depCountry,
          chassisNumber: car?.chassisNumber || '',
          passportId: res.passportId || '',
          driverLicenseId: res.driverLicenseId || '',
          start: formatDateSafe(res.start),
          end: formatDateSafe(res.end),
          days: `${res.days}d`,
          price: `€${res.totalPrice}`,
          totalPrice: typeof res.totalPrice === 'number' ? res.totalPrice : (Number(res.totalPrice) || 0),
          amountPaid: res.amountPaid || 0,
          status: (res.status === 'PENDING' || !res.status) ? 'UPCOMING' : res.status,
          statusColor: statusColor,
          isUser: true,
          note: res.note || '',
          arrivalTime: res.arrivalTime || '',
          departureTime: res.departureTime || '',
          vehicleId: res.vehicleId,
          rawStart: res.start,
          rawEnd: res.end,
          processedBy: res.processedBy || '',
          paidTo: res.paidTo || (res as any).cashflowHandledBy || '',
          fromLocation: fromLoc,
          toLocation: res.toLocation || '',
          countries: res.countries || [],
          insurance: res.insurance,
          uploadedDocuments: res.uploadedDocuments || [],
          carColor: car?.color,
          cashflowNotificationSent: res.cashflowNotificationSent === true || String(res.cashflowNotificationSent) === 'true',
          paymentMethod: res.paymentMethod || 'cash',
        };
      });
  }, [userReservations, vehicleMap]);

  const { activeFilteredBookings, activeDepartureCountryCounts } = useMemo(() => {
    const activeDepartureCountryCounts: Record<string, number> = {
      Macedonia: 0,
      Kosovo: 0,
      Albania: 0,
      Bosnia: 0,
      Montenegro: 0
    };

    const query = deferredSearchQuery.trim().toLowerCase();
    const todayStr = format(currentSystemTime || new Date(), 'dd/MM/yyyy');

    const filtered = baseActiveBookings.filter(b => {
      if (showOnlyEdits && !nonStatusEditIds.has(String(b.id))) {
        return false;
      }

      if (reservationFilter === 'TODAY' && (b.start !== todayStr || b.status !== 'UPCOMING')) {
        return false;
      } else if (reservationFilter === 'TODAY_ON_RENT' && (b.start !== todayStr || b.status !== 'ON RENT')) {
        return false;
      } else if (reservationFilter === 'LAST_DAY' && (b.end !== todayStr || b.status !== 'ON RENT')) {
        return false;
      } else if (statusFilter && b.status !== statusFilter) {
        return false;
      }

      if (calendarMode !== 'all' && !matchesCalendarFilter(b.rawStart)) {
        return false;
      }

      if (activeDepartureCountryFilter && b.departureCountry !== activeDepartureCountryFilter) {
        return false;
      }

      if (query) {
        const matches = b.searchClient.includes(query) || 
                        b.searchVehicle.includes(query) ||
                        b.searchPlate.includes(query);
        if (!matches) return false;
      }

      if (b.departureCountry && b.departureCountry in activeDepartureCountryCounts) {
        activeDepartureCountryCounts[b.departureCountry]++;
      }

      return true;
    });

    return {
      activeFilteredBookings: filtered,
      activeDepartureCountryCounts
    };
  }, [baseActiveBookings, deferredSearchQuery, statusFilter, reservationFilter, activeDepartureCountryFilter, currentSystemTime, showOnlyEdits, nonStatusEditIds, calendarMode, matchesCalendarFilter]);

  // Compute total upcoming reservations total amount for each country and total grand sum
  const { upcomingSums, upcomingGrandTotal } = useMemo(() => {
    const sums: Record<string, number> = {
      Macedonia: 0,
      Kosovo: 0,
      Albania: 0,
      Bosnia: 0,
      Montenegro: 0
    };
    let grandTotal = 0;

    const allActiveUpcoming = userReservations.map(res => {
      const car = vehicleMap.get(String(res.vehicleId));
      return {
        ...res,
        totalPrice: typeof res.totalPrice === 'number' ? res.totalPrice : (Number(res.totalPrice) || 0),
        status: (res.status === 'PENDING' || !res.status) ? 'UPCOMING' : res.status,
        isExtra: car?.name === 'EXTRA' || car?.isExtra,
        carPlate: car?.plate || ''
      };
    }).filter(b => {
      if (b.status === 'COMPLETED' || b.status === 'CANCELLED') return false;
      if (b.isExtra && !b.carPlate) return false;
      if (b.status !== 'UPCOMING') return false;
      return true;
    });

    allActiveUpcoming.forEach(b => {
      // Apply calendar filter to sums
      if (!matchesCalendarFilter(b.start)) return;

      const depCountry = globalGetDestinationCountry(b.fromLocation);
      if (depCountry && depCountry in sums) {
        sums[depCountry] += b.totalPrice;
        grandTotal += b.totalPrice;
      }
    });

    return { upcomingSums: sums, upcomingGrandTotal: grandTotal };
  }, [userReservations, vehicleMap, matchesCalendarFilter]);

  const { totalActivePages, paginatedActive, safeActivePage } = useMemo(() => {
    const totalA = Math.max(1, Math.ceil(activeFilteredBookings.length / itemsPerPage));
    const safePage = Math.min(Math.max(1, activePage), totalA);
    const startA = (safePage - 1) * itemsPerPage;

    return {
      paginatedActive: activeFilteredBookings.slice(startA, startA + itemsPerPage),
      totalActivePages: totalA,
      safeActivePage: safePage
    };
  }, [activeFilteredBookings, activePage]);

  // Stable event handlers for rows/cards
  const handleEditBooking = useCallback((bookingId: string) => {
    const res = reservationsById.get(String(bookingId)) || null;
    setEditingReservation(res);
    setModalMode('full');
    setIsModalOpen(true);
  }, [reservationsById, setEditingReservation, setModalMode, setIsModalOpen]);

  const handleOpenNoteModal = useCallback((e: React.MouseEvent, bookingId: string, note: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setNoteCoords({ top: rect.top, left: rect.left });
    setEditingNoteId(bookingId);
    setNoteContent(note || '');
    setIsEditingNote(!note);
  }, [setNoteCoords, setEditingNoteId, setNoteContent, setIsEditingNote]);

  const handleOpenDocsModal = useCallback((bookingId: string) => {
    setSelectedDocReservationId(bookingId);
    setIsDocumentPanelOpen(true);
  }, [setSelectedDocReservationId, setIsDocumentPanelOpen]);

  const handleNotifyCashflowAction = useCallback((e: React.MouseEvent, bookingId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCashflowPopupCoords({ top: rect.top, left: rect.left });
    setCashflowPopupId(bookingId);
    fetchPaymentSummary(bookingId);
  }, [setCashflowPopupCoords, setCashflowPopupId, fetchPaymentSummary]);

  const handleOpenStatusActionMenu = useCallback((e: React.MouseEvent, bookingId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuCoords({ top: rect.top, left: rect.left });
    setActionMenuId(bookingId);
  }, [setActionMenuCoords, setActionMenuId]);

  const handleCompleteBookingAction = useCallback((e: React.MouseEvent, booking: any) => {
    const isNotified = booking.cashflowNotificationSent || sentCashflowIds.includes(booking.id);
    if (!isNotified) {
      alert("⚠️ PLEASE NOTIFY TO CASHFLOW FIRST before marking this reservation as COMPLETED!");
      return;
    }
    setReservationToComplete(booking);
    setIsCompleteModalOpen(true);
  }, [sentCashflowIds, setReservationToComplete, setIsCompleteModalOpen]);

  const handleCountriesMouseEnter = useCallback((e: React.MouseEvent, bookingId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCountriesCoords({ top: rect.top, left: rect.left + rect.width / 2 });
    setHoveredCountriesId(bookingId);
  }, [setHoveredCountriesCoords, setHoveredCountriesId]);

  const handleCountriesMouseLeave = useCallback(() => {
    setHoveredCountriesId(null);
  }, [setHoveredCountriesId]);

  const handleCountriesClick = useCallback((e: React.MouseEvent, bookingId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const popupEstimatedHeight = 350;
    let top = rect.top + rect.height / 2;
    
    if (typeof window !== 'undefined') {
      const padding = 20;
      const halfHeight = popupEstimatedHeight / 2;
      if (top + halfHeight > window.innerHeight - padding) {
        top = window.innerHeight - halfHeight - padding;
      }
      if (top - halfHeight < padding) {
        top = halfHeight + padding;
      }
    }

    setCountriesPopupCoords({ 
      top, 
      left: rect.right + 12 
    });
    setCountriesPopupId(countriesPopupId === bookingId ? null : bookingId);
    setHoveredCountriesId(null);
  }, [countriesPopupId, setCountriesPopupCoords, setCountriesPopupId, setHoveredCountriesId]);

  return (
    <div className={cn(
      "rounded-[32px] border overflow-hidden flex flex-col h-auto min-h-[400px] shrink-0 transition-all duration-500 mb-6",
      isDarkMode 
        ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_20px_rgba(245,241,233,0.05)]" 
        : "bg-[#FCFAF5] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_0_0_1px_rgba(245,241,233,1),0_0_30px_rgba(245,241,233,0.6)]"
    )}>
      {/* Bookings Header */}
      <div 
        className={cn(
          "px-4 md:px-8 py-4 flex flex-wrap lg:flex-nowrap items-center gap-4 border-b transition-colors",
          isDarkMode ? "border-white/5" : "border-[#F2EFE9]"
        )}
      >
        {/* Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shadow-md transition-colors shrink-0",
            isDarkMode ? "bg-[#1A1614] text-[#FF5C35]" : "bg-[#F5F1E9] text-[#FF5C35]"
          )}>
            <FileText className="w-5 h-5" />
          </div>
          <h2 className={cn(
            "text-xl font-black tracking-tight transition-colors whitespace-nowrap",
            isDarkMode ? "text-white" : "text-[#0E0C0B]"
          )}>Active Bookings</h2>
        </div>

        {/* LAST UPDATED Filter Button */}
        <button
          onClick={handleToggleEdits}
          className={cn(
            "h-[38px] px-4 rounded-xl text-xs font-black tracking-wider uppercase cursor-pointer flex items-center gap-2 border select-none shrink-0 transition-all duration-300",
            showOnlyEdits
              ? "bg-[#00FFFF] border-[#00E5E5] text-black shadow-[0_0_12px_rgba(0,255,255,0.4)] font-black"
              : isDarkMode
                ? "bg-[#1A1614] border-white/5 text-neutral-400 hover:border-[#00FFFF]/40"
                : "bg-gray-50 border-gray-100 text-neutral-500 hover:border-[#00FFFF]/40"
          )}
        >
          <span>LAST UPDATED</span>
          {showOnlyEdits ? (
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
          )}
        </button>

        {/* Search using user proposed input */}
        <SearchInput 
          isDarkMode={isDarkMode}
          onSearch={handleSearch}
          initialValue={searchQuery}
        />

        {/* Status Filters (Upcoming / On Rent + TODAY / LAST DAY) */}
        <div className="flex items-center gap-4 shrink-0 lg:ml-auto flex-wrap sm:flex-nowrap">
          {/* Group 1: TODAY (green) + UPCOMING */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* TODAY (green, upcoming) */}
            <button
              onClick={() => handleReservationFilterChange(reservationFilter === 'TODAY' ? null : 'TODAY')}
              className={cn(
                "px-3 py-1 rounded-full font-black text-[10px] tracking-widest uppercase border-b-2 cursor-pointer select-none shrink-0",
                reservationFilter === 'TODAY' 
                  ? "bg-[#00FF00]/60 border-[#00DD00] text-black" 
                  : isDarkMode 
                    ? "bg-neutral-800/60 border-neutral-700 text-neutral-500" 
                    : "bg-neutral-100 border-neutral-300 text-neutral-400"
              )}
            >
              TODAY
            </button>

            {/* Upcoming Badge button */}
            {(() => {
              const count = userReservations.filter(r => {
                const status = (r.status === 'PENDING' || !r.status) ? 'UPCOMING' : r.status;
                return status === 'UPCOMING';
              }).length;
              const isActive = statusFilter === 'UPCOMING';
              return (
                <button
                  onClick={() => handleStatusFilterChange(isActive ? null : 'UPCOMING')}
                  className={cn(
                    "h-[38px] px-4 rounded-xl text-xs font-black tracking-wider uppercase cursor-pointer flex items-center gap-2 border select-none shrink-0",
                    isActive 
                      ? "border-transparent text-black" 
                      : "border-transparent text-neutral-400 dark:text-neutral-500"
                  )}
                  style={{ 
                    backgroundColor: isActive 
                      ? '#96f096' 
                      : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <span>Upcoming</span>
                  <span 
                    className={cn(
                      "text-[9px] font-black leading-none px-1.5 rounded-full flex items-center justify-center transition-colors",
                      isActive 
                        ? "text-black" 
                        : "text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-800/60"
                    )}
                    style={{ 
                      height: '20px',
                      ...(isActive ? { backgroundColor: '#6ebe50' } : {})
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* Slash/Divider or spacer */}
          <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700/80 shrink-0 self-center mx-1" />

          {/* Group 2: ON RENT + TODAY (red) + LAST DAY */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* On Rent Badge button */}
            {(() => {
              const count = userReservations.filter(r => {
                const status = (r.status === 'PENDING' || !r.status) ? 'UPCOMING' : r.status;
                return status === 'ON RENT';
              }).length;
              const isActive = statusFilter === 'ON RENT';
              return (
                <button
                  onClick={() => handleStatusFilterChange(isActive ? null : 'ON RENT')}
                  className={cn(
                    "h-[38px] px-4 rounded-xl text-xs font-black tracking-wider uppercase cursor-pointer flex items-center gap-2 border select-none shrink-0",
                    isActive 
                      ? "border-transparent text-black" 
                      : "border-transparent text-neutral-400 dark:text-neutral-500"
                  )}
                  style={{ 
                    backgroundColor: isActive 
                      ? '#f09696' 
                      : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <span>On Rent</span>
                  <span 
                    className={cn(
                      "text-[9px] font-black leading-none px-1.5 rounded-full flex items-center justify-center transition-colors",
                      isActive 
                        ? "text-black" 
                        : "text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-800/60"
                    )}
                    style={{ 
                      height: '20px',
                      ...(isActive ? { backgroundColor: '#be6e50' } : {})
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })()}

            {/* TODAY (red, on rent) */}
            <button
              onClick={() => handleReservationFilterChange(reservationFilter === 'TODAY_ON_RENT' ? null : 'TODAY_ON_RENT')}
              className={cn(
                "px-3 py-1 rounded-full font-black text-[10px] tracking-widest uppercase border-b-2 cursor-pointer select-none shrink-0",
                reservationFilter === 'TODAY_ON_RENT' 
                  ? "bg-red-500 border-red-600 text-white" 
                  : isDarkMode 
                    ? "bg-neutral-800/60 border-[#ef4444] text-neutral-400" 
                    : "bg-neutral-100 border-neutral-300 text-neutral-400"
              )}
            >
              TODAY
            </button>

            {/* LAST DAY button */}
            <button
              onClick={() => handleReservationFilterChange(reservationFilter === 'LAST_DAY' ? null : 'LAST_DAY')}
              className={cn(
                "px-3 py-1 rounded-full font-black text-[10px] tracking-widest uppercase border-b-2 cursor-pointer select-none shrink-0",
                reservationFilter === 'LAST_DAY' 
                  ? "bg-red-300 border-red-500 text-black" 
                  : isDarkMode 
                    ? "bg-neutral-800/60 border-neutral-700 text-neutral-500" 
                    : "bg-neutral-100 border-neutral-300 text-neutral-400"
              )}
            >
              LAST DAY
            </button>
          </div>
        </div>
      </div>

      {/* Country Departure Filter Sub-Bar */}
      <div className={cn(
        "px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 border-b text-xs transition-colors overflow-visible relative z-30",
        isDarkMode ? "bg-[#231F1D] border-white/5" : "bg-[#F2EFE9]/30 border-[#F2EFE9]"
      )}>
        <div className="flex items-center gap-2 flex-nowrap min-w-0 mr-2 overflow-visible">
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest shrink-0",
            isDarkMode ? "text-neutral-500" : "text-gray-400"
          )}>
            Departed from:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-nowrap min-w-0 pr-1">
            {VEHICLE_COUNTRIES.map((country) => {
              const isSelected = activeDepartureCountryFilter === country;
              const color = COUNTRY_COLORS[country];
              const count = activeDepartureCountryCounts[country] || 0;
              const sum = upcomingSums[country] || 0;
              
              return (
                <button
                  key={country}
                  onClick={() => {
                    handleDepartureCountryFilterChange(isSelected ? null : country);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase cursor-pointer flex items-center gap-2 select-none border shrink-0",
                    isSelected
                      ? "border-transparent text-white"
                      : isDarkMode
                        ? "bg-neutral-800/40 border-neutral-700/60 text-neutral-400"
                        : "bg-gray-100 border-gray-200 text-gray-500"
                  )}
                  style={{
                    backgroundColor: isSelected ? color : undefined,
                    borderColor: isSelected ? color : undefined,
                    color: isSelected ? (['Macedonia'].includes(country) ? '#000000' : '#ffffff') : undefined
                  }}
                >
                  <span>{country}</span>
                  <div className="flex items-center gap-1">
                    <span 
                      className={cn(
                        "text-[9px] font-black leading-none px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4",
                        isSelected 
                          ? (['Macedonia'].includes(country) ? "bg-black/20 text-black" : "bg-white/20 text-white")
                          : (isDarkMode ? "bg-neutral-900 text-neutral-400" : "bg-white text-gray-500 shadow-sm")
                      )}
                    >
                      {count}
                    </span>
                    {showUpcomingAmounts && isAuthorizedToSeeAmounts && (
                      <span 
                        className={cn(
                          "text-[10px] font-extrabold font-mono leading-none px-1 py-0.5 rounded-md flex items-center justify-center transition-colors",
                          isSelected
                            ? (['Macedonia', 'Montenegro'].includes(country) ? "text-red-700 font-extrabold" : "text-red-100 font-extrabold")
                            : "text-red-500 dark:text-red-400"
                        )}
                      >
                        €{sum.toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          {isAuthorizedToSeeAmounts && (
            <div className="w-[1px] h-5 bg-neutral-300 dark:bg-neutral-700/60 mx-1 self-center shrink-0" />
          )}

          {/* Action buttons (Euro, Calendar, Reset) - placed outside the scrollable container so popover is fully visible */}
          {isAuthorizedToSeeAmounts && (
            <div className="flex items-center gap-1.5 shrink-0 overflow-visible">
              {/* Euro Sign Button */}
              <button
                onClick={toggleUpcomingAmounts}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border text-xs font-black shadow-sm shrink-0",
                  showUpcomingAmounts
                    ? "bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                    : isDarkMode
                      ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
                      : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
                )}
                title="Toggle Upcoming Booking Total Amounts"
              >
                €
              </button>

              {/* Calendar Icon Button with Popover */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border shadow-sm shrink-0",
                    calendarMode !== 'all'
                      ? "bg-[#FF5C35]/15 border-[#FF5C35] text-[#FF5C35] shadow-[0_0_8px_rgba(255,92,53,0.25)]"
                      : isDarkMode
                        ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
                        : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
                  )}
                  title={
                    calendarMode === 'all' 
                      ? "Filter Upcoming by Date" 
                      : calendarMode === 'single'
                        ? `Filtered by: ${calendarSingleDate}`
                        : `Filtered by range: ${calendarRangeStart} to ${calendarRangeEnd}`
                  }
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>

                {isCalendarOpen && (
                  <div 
                    className={cn(
                      "absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-50 w-72 p-4 rounded-2xl border shadow-2xl transition-all duration-300",
                      isDarkMode 
                        ? "bg-[#25201E] border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
                        : "bg-white border-gray-200 text-[#0E0C0B] shadow-[0_10px_30px_rgba(0,0,0,0.1)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3 border-b pb-2 border-dashed border-gray-200 dark:border-white/10">
                      <span className="text-xs font-black uppercase tracking-wider">Date Filter</span>
                      <button 
                        onClick={() => setIsCalendarOpen(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Mode Selector */}
                    <div className="grid grid-cols-3 gap-1 mb-3.5 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl">
                      {(['all', 'single', 'range'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCalendarMode(mode)}
                          className={cn(
                            "py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                            calendarMode === mode
                              ? "bg-[#FF5C35] text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          {mode === 'all' ? 'All' : mode === 'single' ? 'Single' : 'Range'}
                        </button>
                      ))}
                    </div>

                    {/* Calendar Widget */}
                    {calendarMode === 'all' && (
                      <div className="py-6 text-center text-xs text-neutral-400 font-bold leading-relaxed">
                        All dates are shown.<br />
                        Select <span className="text-[#FF5C35]">Single</span> or <span className="text-[#FF5C35]">Range</span> above to filter.
                      </div>
                    )}
                    
                    {calendarMode === 'single' && (
                      <div className="mb-1">
                        {renderEnglishCalendar('single', calendarSingleDate, '', (start) => setCalendarSingleDate(start))}
                      </div>
                    )}

                    {calendarMode === 'range' && (
                      <div className="mb-1">
                        {renderEnglishCalendar('range', calendarRangeStart, calendarRangeEnd, (start, end) => {
                          setCalendarRangeStart(start);
                          if (end !== undefined) setCalendarRangeEnd(end || '');
                        })}
                      </div>
                    )}

                    {/* Selected Info & Close Button */}
                    <div className="flex items-center justify-between mt-4 pt-2 border-t border-dashed border-gray-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarMode('all');
                          setCalendarSingleDate('');
                          setCalendarRangeStart('');
                          setCalendarRangeEnd('');
                        }}
                        className="text-[9px] font-black tracking-widest uppercase text-red-500 hover:underline cursor-pointer"
                      >
                        Clear Filters
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setIsCalendarOpen(false)}
                        className="px-3 py-1 bg-[#FF5C35] hover:bg-[#FF451C] text-white rounded-lg text-[9px] font-black tracking-widest uppercase transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reset Button next to Calendar (always present to preserve layout width and avoid jumping) */}
              <button
                onClick={() => {
                  if (activeDepartureCountryFilter || calendarMode !== 'all') {
                    setActiveDepartureCountryFilter(null);
                    setCalendarMode('all');
                    setCalendarSingleDate('');
                    setCalendarRangeStart('');
                    setCalendarRangeEnd('');
                  }
                }}
                disabled={!activeDepartureCountryFilter && calendarMode === 'all'}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all border shadow-sm shrink-0",
                  (activeDepartureCountryFilter || calendarMode !== 'all')
                    ? isDarkMode
                      ? "bg-[#2D201C] border-[#FF5C35]/30 text-[#FF5C35] hover:bg-[#FF5C35]/20 hover:text-white cursor-pointer"
                      : "bg-red-50 border-red-200 text-red-500 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                    : "opacity-0 pointer-events-none cursor-default"
                )}
                title="Reset All Active Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto shrink-0 flex-nowrap">
          {showUpcomingAmounts && isAuthorizedToSeeAmounts && (
            <div className={cn(
              "px-3 py-1.5 rounded-xl font-black text-[10px] tracking-widest uppercase border flex items-center gap-1.5 shadow-md shrink-0",
              isDarkMode 
                ? "bg-black border-neutral-800 text-neutral-400" 
                : "bg-neutral-950 border-neutral-900 text-neutral-300"
            )}>
              <span>TOTAL:</span>
              <span className="font-mono text-xs text-white font-black">
                €{upcomingGrandTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Table Content (Scrollable) */}
      <div className="overflow-x-auto custom-scrollbar flex-1 md:block hidden">
        <div className="min-w-[1100px] flex flex-col">
          {/* Table Header */}
          <div className={cn(
            "px-4 py-3 flex items-center transition-colors",
            isDarkMode ? "bg-[#231F1D]" : "bg-[#F2EFE9]/60"
          )}>
            <div className="w-[21%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">CLIENT</div>
            <div className="w-[9%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">VEHICLE</div>
            <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">LOCATION</div>
            <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">AUTHORIZED COUNTRIES</div>
            <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PERIOD</div>
            <div className="w-[5%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">DAYS</div>
            <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">PRICE</div>
            <div className="w-[9%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">ACTIONS</div>
            <div className="w-[8%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">STATUS</div>
            <div className="w-[10%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center flex flex-col items-center">
              <span>TEAMMATE</span>
              <span className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">PAID TO</span>
            </div>
          </div>

          {/* Bookings List */}
          <div 
            ref={listRef}
            className={cn(
              "flex-1 transition-colors",
              isDarkMode ? "bg-[#1A1614]" : "bg-transparent"
            )}
          >
            {isDataLoading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-10 h-10 animate-spin text-[#FF5C35] mb-4" />
                <p className="font-black text-xs tracking-widest uppercase text-gray-400 animate-pulse">
                  Synchronizing bookings...
                </p>
              </div>
            ) : activeFilteredBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <Search className="w-12 h-12 mb-4" />
                <p className="font-black text-sm tracking-widest uppercase font-mono">No active bookings found</p>
              </div>
            ) : (
              paginatedActive.map((booking) => {
                const todayStr = format(currentSystemTime || new Date(), 'dd/MM/yyyy');
                const plateClean = (booking.plate || '').replace(/\s+/g, '').toUpperCase();
                const plateColor = plateColorMap.get(plateClean) || null;
                const isNonStatusEdit = nonStatusEditIds.has(String(booking.id));
                const isSentCashflow = booking.cashflowNotificationSent || sentCashflowIds.includes(booking.id);

                return (
                  <ActiveBookingRow
                    key={booking.id}
                    booking={booking}
                    isDarkMode={isDarkMode}
                    todayStr={todayStr}
                    hasViolation={hasViolation(booking.plate)}
                    plateColor={plateColor}
                    isNonStatusEdit={isNonStatusEdit}
                    isSentCashflow={isSentCashflow}
                    onSelectClient={setSelectedClientBooking}
                    onAuditClick={handleAuditClick}
                    onEdit={handleEditBooking}
                    onOpenNote={handleOpenNoteModal}
                    onOpenDocs={handleOpenDocsModal}
                    onNotifyCashflow={handleNotifyCashflowAction}
                    onOpenStatusMenu={handleOpenStatusActionMenu}
                    onCompleteBooking={handleCompleteBookingAction}
                    onCountriesMouseEnter={handleCountriesMouseEnter}
                    onCountriesMouseLeave={handleCountriesMouseLeave}
                    onCountriesClick={handleCountriesClick}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mobile Card List - Active */}
      <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isDataLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF5C35] mb-3" />
            <p className="font-black text-[10px] tracking-widest uppercase text-gray-400 animate-pulse">
              Synchronizing bookings...
            </p>
          </div>
        ) : activeFilteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Search className="w-12 h-12 mb-4" />
            <p className="font-black text-sm tracking-widest uppercase">No bookings found</p>
          </div>
        ) : (
          paginatedActive.map((booking) => {
            const todayStr = format(currentSystemTime || new Date(), 'dd/MM/yyyy');
            const plateClean = (booking.plate || '').replace(/\s+/g, '').toUpperCase();
            const plateColor = plateColorMap.get(plateClean) || null;
            const isNonStatusEdit = nonStatusEditIds.has(String(booking.id));
            const isSentCashflow = booking.cashflowNotificationSent || sentCashflowIds.includes(booking.id);

            return (
              <ActiveBookingMobileCard
                key={booking.id}
                booking={booking}
                isDarkMode={isDarkMode}
                todayStr={todayStr}
                hasViolation={hasViolation(booking.plate)}
                plateColor={plateColor}
                isNonStatusEdit={isNonStatusEdit}
                isSentCashflow={isSentCashflow}
                onSelectClient={setSelectedClientBooking}
                onAuditClick={handleAuditClick}
                onEdit={handleEditBooking}
                onOpenNote={handleOpenNoteModal}
                onOpenDocs={handleOpenDocsModal}
                onNotifyCashflow={handleNotifyCashflowAction}
                onOpenStatusMenu={handleOpenStatusActionMenu}
              />
            );
          })
        )}
      </div>

      {/* Active Pagination Controls */}
      {totalActivePages > 1 && (
        <div className={cn(
          "px-8 py-4 border-t flex items-center justify-between shrink-0 transition-colors",
          isDarkMode ? "border-white/5 bg-[#1F1B19]" : "border-[#F2EFE9] bg-[#F9F7F2]"
        )}>
          <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
            Page {safeActivePage} of {totalActivePages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={safeActivePage === 1}
              onClick={() => setActivePage(p => Math.max(1, p - 1))}
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
                let endPage = totalActivePages;
                if (totalActivePages > 5) {
                  startPage = Math.max(1, Math.min(safeActivePage - 2, totalActivePages - 4));
                  endPage = startPage + 4;
                }
                return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setActivePage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                      safeActivePage === pageNum
                        ? "bg-[#FF5C35] text-white shadow-lg shadow-[#FF5C35]/20"
                        : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100")
                    )}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
            </div>
            <button
              disabled={safeActivePage === totalActivePages}
              onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))}
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
  );
};
ActiveBookingsPanel.displayName = 'ActiveBookingsPanel';
