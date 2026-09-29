'use client';

import React, { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle, Reservation } from '@/types';
import { CalendarDay, CarBooking, DayBooking } from './types';
import { CarRow } from './CarRow';

interface FleetListGridProps {
  sortedHomeVehicles: Vehicle[];
  sortedGuestVehicles: Vehicle[];
  bookingsMap: Map<string, CarBooking>;
  calendarDays: CalendarDay[];
  isDarkMode: boolean;
  showFocusBlur: boolean;
  tyreTypes: Record<string, 'summer' | 'winter'>;
  firstExtraIndex: number;
  activeCountry: string;
  isSelectionEnabled: boolean;
  isRelocationMode: boolean;
  isCarLocationMode: boolean;
  isEditMode: boolean;
  selectionStart: { carId: number | string; date: Date } | null;
  carIdToMove: number | string | null;
  reservationIdToSwap: string | null;
  reservationToMoveId?: string | null;
  isExtraCancelMode: boolean;
  userReservations: Reservation[];
  currentSystemTime?: Date;
  todayMidnightMs: number;
  violationPlatesSet: Set<string>;
  onHoverDay: (e: React.MouseEvent, bookings: DayBooking[], isFirstRow: boolean) => void;
  onLeaveDay: () => void;
  onTyreToggle: (e: React.MouseEvent, vehicleId: number | string) => void;
  onStatusClick: (e: React.MouseEvent, car: Vehicle) => void;
  onGridClick: (carId: number | string, day: CalendarDay) => void;
  onCarSelect: (carId: number | string) => void;
  onCarLocationClick: (car: Vehicle) => void;
  onReservationSelect: (resId: string) => void;
  onChassisClick: (e: React.MouseEvent, car: Vehicle) => void;
  onColorClick: (e: React.MouseEvent, car: Vehicle) => void;
  onToggleExtraCancelMode: () => void;
  onCancelBooking: (id: string) => void;
  onOverdueClick: (resId: string) => void;
  onOpenExtraDetails: (vehicle: Vehicle, coords: { top: number; left: number; isAbove?: boolean }) => void;
}

export const FleetListGrid = memo(({
  sortedHomeVehicles,
  sortedGuestVehicles,
  bookingsMap,
  calendarDays,
  isDarkMode,
  showFocusBlur,
  tyreTypes,
  firstExtraIndex,
  activeCountry,
  isSelectionEnabled,
  isRelocationMode,
  isCarLocationMode,
  isEditMode,
  selectionStart,
  carIdToMove,
  reservationIdToSwap,
  reservationToMoveId,
  isExtraCancelMode,
  userReservations,
  currentSystemTime,
  todayMidnightMs,
  violationPlatesSet,
  onHoverDay,
  onLeaveDay,
  onTyreToggle,
  onStatusClick,
  onGridClick,
  onCarSelect,
  onCarLocationClick,
  onReservationSelect,
  onChassisClick,
  onColorClick,
  onToggleExtraCancelMode,
  onCancelBooking,
  onOverdueClick,
  onOpenExtraDetails
}: FleetListGridProps) => {
  return (
    <div 
      className={cn(
        "flex-1 transition-colors relative z-20",
        isDarkMode ? "bg-[#1A1614]" : "bg-white"
      )} 
      style={{ WebkitOverflowScrolling: 'touch', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
    >
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
            onHoverDay={onHoverDay}
            onLeaveDay={onLeaveDay}
            tyreType={tyreTypes[String(vehicle.id)]}
            onTyreToggle={onTyreToggle}
            onStatusClick={onStatusClick}
            isSelectionEnabled={isSelectionEnabled}
            isRelocationMode={isRelocationMode}
            isCarLocationMode={isCarLocationMode}
            isEditMode={isEditMode}
            selectionStart={selectionStart}
            onGridClick={onGridClick}
            isSelectedForMove={String(vehicle.id) === String(carIdToMove)}
            onCarSelect={onCarSelect}
            onCarLocationClick={onCarLocationClick}
            onReservationSelect={onReservationSelect}
            reservationIdToSwap={reservationIdToSwap}
            onChassisClick={onChassisClick}
            onColorClick={onColorClick}
            reservationToMoveId={reservationToMoveId}
            isExtraCancelMode={isExtraCancelMode}
            onToggleExtraCancelMode={onToggleExtraCancelMode}
            onCancelBooking={onCancelBooking}
            userReservations={userReservations}
            activeCountry={activeCountry}
            currentSystemTime={currentSystemTime}
            onOverdueClick={onOverdueClick}
            todayMidnightMs={todayMidnightMs}
            violationPlatesSet={violationPlatesSet}
            onOpenExtraDetails={onOpenExtraDetails}
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
                onHoverDay={onHoverDay}
                onLeaveDay={onLeaveDay}
                tyreType={tyreTypes[String(vehicle.id)]}
                onTyreToggle={onTyreToggle}
                onStatusClick={onStatusClick}
                isSelectionEnabled={isSelectionEnabled}
                isRelocationMode={isRelocationMode}
                isCarLocationMode={isCarLocationMode}
                isEditMode={isEditMode}
                selectionStart={selectionStart}
                onGridClick={onGridClick}
                isSelectedForMove={String(vehicle.id) === String(carIdToMove)}
                onCarSelect={onCarSelect}
                onCarLocationClick={onCarLocationClick}
                onReservationSelect={onReservationSelect}
                reservationIdToSwap={reservationIdToSwap}
                onChassisClick={onChassisClick}
                onColorClick={onColorClick}
                reservationToMoveId={reservationToMoveId}
                isExtraCancelMode={isExtraCancelMode}
                onToggleExtraCancelMode={onToggleExtraCancelMode}
                onCancelBooking={onCancelBooking}
                userReservations={userReservations}
                activeCountry={activeCountry}
                currentSystemTime={currentSystemTime}
                onOverdueClick={onOverdueClick}
                todayMidnightMs={todayMidnightMs}
                violationPlatesSet={violationPlatesSet}
                onOpenExtraDetails={onOpenExtraDetails}
              />
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
});

FleetListGrid.displayName = 'FleetListGrid';
