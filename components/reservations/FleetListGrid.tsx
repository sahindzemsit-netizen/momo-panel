'use client';

import React, { memo } from 'react';
import { ArrowUpRight, Car } from 'lucide-react';
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
  clientSearchQuery?: string;
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
  onTyreToggle: (e: React.MouseEvent, car: Vehicle) => void;
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
  vehicleStatusMap?: Map<string, { lastCompletedRes: Reservation | null; onRentReservation: Reservation | null }>;
}

export const FleetListGrid = memo(({
  sortedHomeVehicles,
  sortedGuestVehicles,
  bookingsMap,
  calendarDays,
  isDarkMode,
  showFocusBlur,
  clientSearchQuery,
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
  onOpenExtraDetails,
  vehicleStatusMap
}: FleetListGridProps) => {
  return (
    <div 
      className={cn(
        "flex-1 transition-colors relative z-20",
        isDarkMode ? "bg-[#1A1614]" : "bg-white"
      )} 
      style={{ 
        WebkitOverflowScrolling: 'touch', 
        backfaceVisibility: 'hidden', 
        transform: 'translateZ(0)',
        contain: 'layout paint'
      }}
    >
      {sortedHomeVehicles.length === 0 && sortedGuestVehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border shadow-sm",
            isDarkMode ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-400"
          )}>
            <Car className="w-6 h-6 opacity-60" />
          </div>
          <p className={cn(
            "font-extrabold text-[11px] uppercase tracking-wider",
            isDarkMode ? "text-gray-400" : "text-gray-500"
          )}>
            No vehicles matching current filter
          </p>
          <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
            Try toggling off the bulb or clearing the search
          </p>
        </div>
      )}

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
            clientSearchQuery={clientSearchQuery}
            isFirstRow={index === 0}
            onHoverDay={onHoverDay}
            onLeaveDay={onLeaveDay}
            tyreType={tyreTypes[String(vehicle.id)] || vehicle.tyreType || 'summer'}
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
            vehicleStatusRes={vehicleStatusMap?.get(String(vehicle.id))}
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
                clientSearchQuery={clientSearchQuery}
                isFirstRow={false}
                onHoverDay={onHoverDay}
                onLeaveDay={onLeaveDay}
                tyreType={tyreTypes[String(vehicle.id)] || vehicle.tyreType || 'summer'}
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
                vehicleStatusRes={vehicleStatusMap?.get(String(vehicle.id))}
              />
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
});

FleetListGrid.displayName = 'FleetListGrid';
