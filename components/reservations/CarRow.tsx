import React, { memo, useCallback, useMemo } from 'react';
import { cn, parseDateSafe } from '@/lib/utils';
import { isSameDay } from 'date-fns';
import { Plus, Pencil, Trash2, ArrowUpDown, Sun, Snowflake, MapPin } from 'lucide-react';
import { Vehicle, Reservation } from '@/types';
import { COUNTRY_COLORS } from '@/lib/constants';
import { CalendarDay, CarBooking, DayBooking, globalGetDestinationCountry, getTextColorForBg } from './types';
import { DayCell } from './DayCell';
import { MonthDivider } from './MonthDivider';

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

export interface CarRowProps {
  car: Vehicle;
  carBooking: CarBooking | undefined;
  calendarDays: CalendarDay[];
  isDarkMode: boolean;
  showFocusBlur: boolean;
  isFirstRow?: boolean;
  onHoverDay: (e: React.MouseEvent, bookings: DayBooking[], isFirstRow: boolean) => void;
  onLeaveDay: () => void;
  tyreType?: 'summer' | 'winter';
  onTyreToggle: (e: React.MouseEvent, vehicleId: number | string) => void;
  onStatusClick: (e: React.MouseEvent, car: Vehicle) => void;
  isSelectionEnabled?: boolean;
  isRelocationMode?: boolean;
  isCarLocationMode?: boolean;
  isEditMode?: boolean;
  selectionStart?: { carId: number | string; date: Date } | null;
  onGridClick: (carId: number | string, day: CalendarDay) => void;
  isSelectedForMove?: boolean;
  onCarSelect?: (carId: number | string) => void;
  onCarLocationClick?: (car: Vehicle) => void;
  onReservationSelect?: (resId: string) => void;
  reservationIdToSwap?: string | null;
  onChassisClick?: (e: React.MouseEvent, car: Vehicle) => void;
  onColorClick?: (e: React.MouseEvent, car: Vehicle) => void;
  reservationToMoveId?: string | null;
  isExtraCancelMode?: boolean;
  onToggleExtraCancelMode?: () => void;
  onCancelBooking?: (id: string) => void;
  userReservations?: Reservation[];
  activeCountry?: string;
  currentSystemTime?: Date;
  onOverdueClick?: (resId: string) => void;
  todayMidnightMs?: number;
  violationPlatesSet?: Set<string>;
  onOpenExtraDetails?: (vehicle: Vehicle, coords: { top: number; left: number; isAbove?: boolean }) => void;
}

export const CarRow = memo(({ 
  car: vehicle, 
  carBooking, 
  calendarDays, 
  isDarkMode, 
  showFocusBlur, 
  isFirstRow, 
  onHoverDay, 
  onLeaveDay, 
  tyreType, 
  onTyreToggle, 
  onStatusClick, 
  isSelectionEnabled, 
  isRelocationMode, 
  isCarLocationMode, 
  isEditMode, 
  selectionStart, 
  onGridClick, 
  isSelectedForMove, 
  onCarSelect, 
  onCarLocationClick, 
  onReservationSelect, 
  reservationIdToSwap, 
  onChassisClick, 
  onColorClick, 
  reservationToMoveId, 
  isExtraCancelMode, 
  onToggleExtraCancelMode, 
  onCancelBooking, 
  userReservations, 
  activeCountry, 
  currentSystemTime, 
  onOverdueClick, 
  todayMidnightMs, 
  violationPlatesSet, 
  onOpenExtraDetails 
}: CarRowProps) => {
  const hasViolation = useCallback((plate?: string) => {
    if (!plate || !violationPlatesSet) return false;
    const cleanPlate = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return violationPlatesSet.has(cleanPlate);
  }, [violationPlatesSet]);

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
  const currentDisplayedCountry = isGuestView ? homeCountry : currentCountry;
  const badgeCountry = isGuestView ? homeCountry : (displayedAwayCountry || 'Macedonia');

  const styles = getRowStyles(homeCountry);

  if (!vehicle || !vehicle.id) return null;

  return (
    <div 
      className={cn(
        "flex border-b group relative hover:z-[100]",
        isDarkMode ? "border-neutral-700/80" : "border-gray-300"
      )}
      style={{ 
        height: '37px',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
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
                    className="inline-flex items-center justify-center rounded-md border border-black/20 shadow-sm shrink-0 relative overflow-hidden bg-white text-black font-mono font-black tracking-wide uppercase leading-none pl-[4px] pr-[2px]"
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
                      ? "shadow-md opacity-100 ring-1 ring-black/10" 
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
                  {/* Full fallback tooltip */}
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
