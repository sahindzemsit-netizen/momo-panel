'use client';

import React, { useState, useEffect, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DayBooking } from '@/types';

interface HoveredBookingData {
  bookings: DayBooking[];
  x: number;
  y: number;
  isFirstRow: boolean;
}

export const BookingGridTooltip = memo(() => {
  const [hoveredBooking, setHoveredBooking] = useState<HoveredBookingData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);

    const showHandler = (e: Event) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setHoveredBooking((e as CustomEvent).detail);
      setIsVisible(true);
    };

    const hideHandler = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 40);
    };

    window.addEventListener('show-booking-tooltip', showHandler);
    window.addEventListener('hide-booking-tooltip', hideHandler);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      window.removeEventListener('show-booking-tooltip', showHandler);
      window.removeEventListener('hide-booking-tooltip', hideHandler);
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const hasData = isVisible && hoveredBooking && hoveredBooking.bookings && hoveredBooking.bookings.length > 0;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: hoveredBooking ? (hoveredBooking.isFirstRow ? hoveredBooking.y + 6 : hoveredBooking.y - 6) : 0,
        left: hoveredBooking ? hoveredBooking.x : 0,
        transform: hoveredBooking?.isFirstRow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        opacity: hasData ? 1 : 0,
        transition: 'opacity 60ms ease-out',
        willChange: 'transform, opacity',
        pointerEvents: 'none'
      }}
      className="pointer-events-none z-[10000] flex flex-col items-center"
    >
      {hoveredBooking && (
        <>
          {hoveredBooking.isFirstRow && (
            <div className="w-2 h-2 rotate-45 -mb-[5px] bg-[#FCFAF5] border-l border-t border-[#E5E1D8] z-20" />
          )}

          <div className="px-3 py-2 rounded-xl bg-[#FCFAF5] border border-[#E5E1D8] shadow-[0_10px_40px_rgba(0,0,0,0.12)] whitespace-nowrap flex flex-col gap-1">
            {hoveredBooking.bookings.map((b, idx) => (
              <div key={b.id + idx} className="flex flex-col gap-0.5 py-0.5 border-b border-[#E5E1D8] last:border-b-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", b.color)} />
                  <span className="text-[10px] font-black tracking-widest text-[#0E0C0B] uppercase truncate max-w-[150px]">
                    {b.client}
                  </span>
                  <span className="text-[12px] font-mono font-black text-emerald-600 shrink-0 ml-1.5">
                    €{b.totalPrice}
                  </span>
                </div>
                {b.arrivalTime || b.departureTime ? (
                  <div className="pl-3 mt-1.5 flex flex-col gap-1.5 text-[10px] font-mono font-black tracking-wider text-[#0E0C0B]">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[#8E9AA6] font-bold">{format(b.startDate, 'dd/MM/yyyy')}</div>
                      {b.arrivalTime && (
                        <div className="flex items-center gap-1 text-[#FF5C35]">
                          <Clock className="w-3 h-3 text-[#FF5C35] shrink-0" />
                          <span>{b.arrivalTime}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[#8E9AA6] font-bold">{format(b.endDate, 'dd/MM/yyyy')}</div>
                      {b.departureTime && (
                        <div className="flex items-center gap-1 text-blue-500">
                          <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>{b.departureTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pl-3 text-[9px] font-mono font-black tracking-wider text-[#0E0C0B]">
                    {format(b.startDate, 'dd/MM/yyyy')} — {format(b.endDate, 'dd/MM/yyyy')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!hoveredBooking.isFirstRow && (
            <div className="w-2 h-2 rotate-45 -mt-[5px] bg-[#FCFAF5] border-r border-b border-[#E5E1D8]" />
          )}
        </>
      )}
    </div>,
    document.body
  );
});

BookingGridTooltip.displayName = 'BookingGridTooltip';
