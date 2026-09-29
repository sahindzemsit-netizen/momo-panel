import React, { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, Check } from 'lucide-react';
import { CalendarDay, CarBooking, DayBooking } from './types';

interface DayCellProps {
  day: CalendarDay;
  isDarkMode: boolean;
  carBooking: CarBooking | undefined;
  showFocusBlur: boolean;
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
}

export const DayCell = memo(({ 
  day, 
  isDarkMode, 
  carBooking, 
  showFocusBlur, 
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
  todayMidnightMs 
}: DayCellProps) => {
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
          isDirectCancelActive && "ring-2 ring-red-500 scale-105 shadow-[0_0_8px_rgba(239,68,68,0.5)] !z-[110]"
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
