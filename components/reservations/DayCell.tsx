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
          "w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[11px] font-black relative z-10 overflow-hidden rounded-full transition-none select-none",
          // Booked (Single Reservation) - 3D Enamel Bead with Top Specular Shine and Base Shadow
          isBooked && !isHandover && cn(
            "text-white border border-black/20",
            dayBookings[0].color,
            "shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.45),inset_0_-1.5px_2px_rgba(0,0,0,0.32),0_2px_4px_rgba(0,0,0,0.2)]",
            day.isToday ? "ring-2 ring-white ring-offset-1 ring-offset-black/30" : ""
          ),
          // Booked (Handover / Dual Reservation) - 3D Split Bead
          isHandover && cn(
            "text-white border border-black/20",
            "shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.45),inset_0_-1.5px_2px_rgba(0,0,0,0.32),0_2px_4px_rgba(0,0,0,0.2)]",
            day.isToday ? "ring-2 ring-white ring-offset-1 ring-offset-black/30" : ""
          ),
          // Overdue Warning
          isOverdue && cn(
            "border border-amber-500/80 bg-gradient-to-b from-amber-400/25 to-amber-600/25 text-amber-600 dark:text-yellow-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.15)]"
          ),
          // Empty / Unbooked - Tactile Carved / Recessed Socket Look
          !isBooked && !isHandover && !isOverdue && cn(
            "border",
            isDarkMode
              ? "bg-[#171412] border-white/5 text-neutral-400 shadow-[inset_0_2px_3px_rgba(0,0,0,0.7),inset_0_-1px_1px_rgba(255,255,255,0.04)]"
              : "bg-[#EAE4DC] border-black/10 text-gray-600 shadow-[inset_0_2px_3px_rgba(0,0,0,0.13),inset_0_-1px_1px_rgba(255,255,255,0.7),0_1px_0_rgba(255,255,255,0.6)]",
            day.isToday && (isDarkMode ? "border-2 border-white ring-2 ring-white/30 ring-offset-1 ring-offset-[#171412]" : "border-2 border-[#0E0C0B] ring-2 ring-black/15 ring-offset-1 ring-offset-[#EAE4DC]")
          ),
          isResSelectedForSwap && "ring-4 ring-inset ring-white scale-110 !z-[110]",
          isResSelectedForMove && "ring-4 ring-inset ring-[#FF5C35] scale-110 !z-[110]",
          isDirectCancelActive && "ring-2 ring-red-500 scale-105 shadow-[0_0_8px_rgba(239,68,68,0.5)] !z-[110]",
          isClientSearchMatch && "ring-[2.5px] ring-[#FACC15] ring-offset-1 ring-offset-black/30 shadow-[0_0_16px_rgba(250,204,21,1)] scale-110 !z-[120]"
        )}
        style={{
          transform: 'translateZ(0)',
          opacity: isPastBlur ? 0.35 : 1
        }}
        title={isOverdue && overdueRentRes ? `Overdue ON RENT: ${overdueRentRes.client}` : undefined}
      >
        {isHandover ? (
          <>
            {/* Split halves */}
            <div className={cn("absolute inset-0", dayBookings[0].color)} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
            <div className={cn("absolute inset-0", dayBookings[1].color)} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-[141%] h-[1.5px] bg-black/40 rotate-[-45deg]" />
            </div>
            <span className="relative z-30 text-[11px] font-black leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
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
              <span className="relative z-20 font-black text-white text-[11px] leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
                {day.day}
              </span>
            ) : (
              <span className={cn(
                "relative z-10 font-black text-[11px] leading-none",
                isDarkMode ? "[text-shadow:0_-1px_0_rgba(0,0,0,0.85)]" : "[text-shadow:0_1px_0_rgba(255,255,255,0.85)]"
              )}>
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
