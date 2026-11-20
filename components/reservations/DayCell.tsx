import React, { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, Check } from 'lucide-react';
import { CalendarDay, CarBooking, DayBooking } from './types';

interface DayCellProps {
  day: CalendarDay;
  isDarkMode: boolean;
  carBooking: CarBooking | undefined;
  showFocusBlur: boolean;
  clientSearchQuery?: string;
  isFirstRow?: boolean;
  onHover: (e: React.MouseEvent, bookings: DayBooking[], isFirstRow: boolean) => void;
  onLeave: () => void;
  isSelectionEnabled?: boolean;
  isRelocationMode?: boolean;
  isSelected?: boolean;
  isSelectionInRange?: boolean;
  vehicleId?: number | string;
  onGridClick?: (carId: number | string, day: CalendarDay) => void;
  onClick?: () => void;
  isEditMode?: boolean;
  onReservationSelect?: (resId: string) => void;
  reservationIdToSwap?: string | null;
  reservationToMoveId?: string | null;
  isExtraRow?: boolean;
  isExtraCancelMode?: boolean;
  onCancelBooking?: (id: string) => void;
  onOverdueClick?: (resId: string) => void;
  todayMidnightMs?: number;
  precomputedDayBookings?: DayBooking[];
  precomputedOverdueRes?: any;
}

export const DayCell = memo(({ 
  day, 
  isDarkMode, 
  carBooking, 
  showFocusBlur, 
  clientSearchQuery, 
  isFirstRow, 
  onHover, 
  onLeave, 
  isSelectionEnabled, 
  isRelocationMode, 
  isSelected, 
  isSelectionInRange, 
  vehicleId,
  onGridClick,
  onClick, 
  isEditMode, 
  onReservationSelect, 
  reservationIdToSwap, 
  reservationToMoveId, 
  isExtraRow, 
  isExtraCancelMode, 
  onCancelBooking, 
  onOverdueClick, 
  todayMidnightMs,
  precomputedDayBookings,
  precomputedOverdueRes
}: DayCellProps) => {
  const dayBookings = useMemo(() => {
    if (precomputedDayBookings !== undefined) {
      return precomputedDayBookings;
    }
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
  }, [precomputedDayBookings, carBooking?.reservations, day.midnightMs, day.date]);

  const isBooked = dayBookings.length > 0;

  const overdueRentRes = useMemo(() => {
    if (precomputedOverdueRes !== undefined) {
      if (!precomputedOverdueRes) return null;
      const dMs = day.midnightMs ?? day.date.getTime();
      const todayMs = todayMidnightMs ?? Date.now();
      const eMs = precomputedOverdueRes.endMs ?? precomputedOverdueRes.endDate?.getTime?.() ?? 0;
      return todayMs > eMs && dMs > eMs && dMs <= todayMs ? precomputedOverdueRes : null;
    }
    if (!carBooking?.reservations) return null;
    const dMs = day.midnightMs ?? day.date.getTime();
    const todayMs = todayMidnightMs ?? Date.now();

    return carBooking.reservations.find((r: any) => {
      if (r.status !== 'ON RENT') return false;
      const eMs = r.endMs ?? r.endDate.getTime();
      return todayMs > eMs && dMs > eMs && dMs <= todayMs;
    });
  }, [precomputedOverdueRes, carBooking?.reservations, day.midnightMs, day.date, todayMidnightMs]);

  const isOverdue = !isBooked && !isExtraRow && !!overdueRentRes;

  const isHandover = dayBookings.length > 1;
  const isResSelectedForSwap = dayBookings.some(b => String(b.id) === String(reservationIdToSwap));
  const isResSelectedForMove = reservationToMoveId && dayBookings.some(b => String(b.id) === String(reservationToMoveId));
  const isDirectCancelActive = !!(isExtraRow && isExtraCancelMode && isBooked);

  const isClientSearchMatch = useMemo(() => {
    if (!clientSearchQuery || dayBookings.length === 0) return false;
    const q = clientSearchQuery.trim().toLowerCase();
    if (q.length < 2) return false;
    return dayBookings.some(b => {
      const name = (b.client || '').toLowerCase();
      if (!name) return false;
      if (name.includes(q)) return true;
      const parts = q.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        return parts.every(p => name.includes(p));
      }
      return false;
    });
  }, [clientSearchQuery, dayBookings]);

  const isPastBlur = showFocusBlur && day.isPast;

  return (
    <div 
      className={cn(
        "flex justify-center items-center relative min-w-0 h-full group/cell hover:z-[100] contain-layout-style",
        !showFocusBlur && "flex-1",
        (isSelectionEnabled || isRelocationMode || isBooked || isDirectCancelActive || isOverdue) && "cursor-pointer"
      )}
      style={{ flex: '1 0 0%' }}
      onMouseEnter={(e) => isBooked && !isDirectCancelActive && onHover(e, dayBookings, !!isFirstRow)}
      onMouseLeave={onLeave}
      onClick={() => {
        if (isDirectCancelActive && onCancelBooking) {
          onCancelBooking(dayBookings[0].id);
        } else if (isOverdue && onOverdueClick && overdueRentRes) {
          onOverdueClick(overdueRentRes.id);
        } else if (isEditMode && isBooked && onReservationSelect) {
          onReservationSelect(dayBookings[0].id);
        } else if (onGridClick && vehicleId !== undefined) {
          onGridClick(vehicleId, day);
        } else {
          onClick?.();
        }
      }}
    >
      <div 
        className={cn(
          "w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[11px] font-black relative z-10 overflow-hidden rounded-full select-none",
          isPastBlur && "opacity-35",
          // Booked (Single Reservation) - Flat 2D Solid Color Circle
          isBooked && !isHandover && cn(
            "text-white",
            dayBookings[0].color,
            day.isToday
              ? (isDarkMode ? "ring-2 ring-white ring-offset-1 ring-offset-[#171412]" : "ring-2 ring-[#0E0C0B] ring-offset-1 ring-offset-white")
              : "ring-1 ring-black/10"
          ),
          // Booked (Handover / Dual Reservation) - Flat 2D Split Circle
          isHandover && cn(
            "text-white",
            day.isToday
              ? (isDarkMode ? "ring-2 ring-white ring-offset-1 ring-offset-[#171412]" : "ring-2 ring-[#0E0C0B] ring-offset-1 ring-offset-white")
              : "ring-1 ring-black/10"
          ),
          // Overdue Warning - Flat 2D
          isOverdue && "border border-amber-500 bg-amber-500/15 text-amber-600 dark:text-yellow-400",
          // Empty / Unbooked - Simple Flat 2D Circle
          !isBooked && !isHandover && !isOverdue && cn(
            isDarkMode
              ? "bg-[#221E1C] text-neutral-400 border border-white/10"
              : "bg-[#EFEAE1] text-gray-600 border border-black/10",
            day.isToday && (isDarkMode ? "border-2 border-white text-white" : "border-2 border-[#0E0C0B] text-[#0E0C0B]")
          ),
          isResSelectedForSwap && "ring-3 ring-inset ring-white scale-110 !z-[110]",
          isResSelectedForMove && "ring-3 ring-inset ring-[#FF5C35] scale-110 !z-[110]",
          isDirectCancelActive && "ring-2 ring-red-500 scale-105 !z-[110]",
          isClientSearchMatch && "ring-2 ring-[#FACC15] ring-offset-1 ring-offset-black/30 scale-110 !z-[120]"
        )}
        title={isOverdue && overdueRentRes ? `Overdue ON RENT: ${overdueRentRes.client}` : undefined}
      >
        {isHandover ? (
          <>
            {/* Split halves */}
            <div className={cn("absolute inset-0", dayBookings[0].color)} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
            <div className={cn("absolute inset-0", dayBookings[1].color)} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-[141%] h-[1.5px] bg-white/50 rotate-[-45deg]" />
            </div>
            <span className="relative z-30 text-[11px] font-black leading-none text-white">
              {day.day}
            </span>
          </>
        ) : (
          <>
            {isDirectCancelActive ? (
              <Trash2 className="w-3 h-3 text-white relative z-20" />
            ) : isOverdue ? (
              <span className="text-amber-600 dark:text-yellow-400 font-extrabold text-[12px] select-none relative z-20">!</span>
            ) : isBooked ? (
              <span className="relative z-20 font-black text-white text-[11px] leading-none">
                {day.day}
              </span>
            ) : (
              <span className="relative z-10 font-black text-[11px] leading-none">
                {day.day}
              </span>
            )}

            {/* Selection Overlays */}
            {isSelected && (
              <div className="absolute inset-0 bg-[#FF5C35] flex items-center justify-center z-30">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            {isSelectionInRange && !isSelected && (
              <div className="absolute inset-0 bg-[#FF5C35]/40 z-30" />
            )}
          </>
        )}
      </div>
    </div>
  );
});

DayCell.displayName = 'DayCell';
