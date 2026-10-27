'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ShieldAlert, 
  Car, 
  Calendar, 
  User, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Reservation, Vehicle } from '@/types';
import WhatsAppButton from './WhatsAppButton';

interface OnRentConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  targetReservation: Reservation | null;
  conflictingReservations: Reservation[];
  vehicle: Vehicle | null;
  dbVehicles?: Vehicle[];
}

const formatDateSafe = (dateVal: any): string => {
  if (!dateVal) return 'N/A';
  if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
    try {
      const d = dateVal.toDate();
      if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
    } catch {}
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? String(dateVal) : format(d, 'dd/MM/yyyy');
};

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

export const OnRentConflictModal: React.FC<OnRentConflictModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  targetReservation,
  conflictingReservations,
  vehicle,
  dbVehicles
}) => {
  if (!isOpen) return null;

  const vehicleName = vehicle?.name || (targetReservation as any)?.vehicle || 'Unknown Vehicle';
  const vehiclePlate = vehicle?.plate || (targetReservation as any)?.plate || '';
  const plateColor = vehicle?.color || null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            "relative w-full max-w-xl rounded-[32px] shadow-2xl border p-6 md:p-7 z-10 flex flex-col gap-5 max-h-[90vh] overflow-y-auto",
            isDarkMode ? "bg-[#221D1A] border-white/10 text-white" : "bg-white border-gray-200 text-[#0E0C0B]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-sm">
                <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                  Car Already On Rent!
                </h2>
                <p className="text-xs font-bold text-gray-400">
                  Cannot make this car on rent twice simultaneously
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0",
                isDarkMode ? "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vehicle Information Banner */}
          <div className={cn(
            "px-4 py-3 rounded-2xl border flex items-center justify-between gap-3",
            isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-gray-50 border-gray-100"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FF5C35] flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block leading-none mb-0.5">
                  SELECTED VEHICLE
                </span>
                <p className={cn("font-black text-sm uppercase truncate", isDarkMode ? "text-white" : "text-black")}>
                  {vehicleName}
                </p>
              </div>
            </div>

            {vehiclePlate && (
              <div 
                className="inline-flex items-center rounded-md border-2 px-2 py-0.5 shadow-md shrink-0 relative overflow-hidden bg-white border-black/30"
                style={{ height: '26px' }}
              >
                <div className="w-[3px] h-3.5 bg-blue-700 rounded-l-[1px] -ml-2 mr-1.5 shrink-0" />
                <span 
                  className={cn(
                    "font-mono font-black text-black tracking-wider uppercase leading-none select-all",
                    plateColor ? "pr-[12px]" : ""
                  )}
                  style={{ fontSize: '12px' }}
                >
                  {vehiclePlate}
                </span>
                {plateColor && (
                  <div 
                    className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                    style={{ 
                      width: '10px',
                      backgroundColor: plateColor
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Explanatory Warning Message */}
          <div className="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold leading-relaxed">
            <span className="font-extrabold uppercase tracking-wide block mb-1">
              ⚠️ Attention Needed:
            </span>
            This car already has an active <span className="font-black underline">ON RENT</span> status for another customer. A car cannot physically be on rent twice at the same time. Please complete or cancel the active rental first before putting this one on rent.
          </div>

          {/* Attempted Reservation info */}
          {targetReservation && (
            <div className={cn(
              "p-3.5 rounded-2xl border text-xs flex flex-col gap-1.5",
              isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  ATTEMPTED ON RENT FOR:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#00FF00]/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  REMAINS UPCOMING
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className={isDarkMode ? "text-white" : "text-black"}>
                  {targetReservation.name || 'Client'}
                </span>
                <span className="text-gray-400 font-mono text-[11px]">
                  {formatDateSafe(targetReservation.start)} → {formatDateSafe(targetReservation.end)}
                </span>
              </div>
            </div>
          )}

          {/* Conflicting Active Rental(s) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Active Rental(s) To Deal With First ({conflictingReservations.length}):
              </span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {conflictingReservations.map((conflict, idx) => {
                const clientName = conflict.name || 'Unknown Client';
                const conflictVehicle = dbVehicles?.find(v => String(v.id) === String(conflict.vehicleId));
                const fromLoc = conflict.fromLocation;
                const toLoc = conflict.toLocation;

                return (
                  <div
                    key={conflict.id || idx}
                    className={cn(
                      "p-4 rounded-2xl border flex flex-col gap-3 transition-all",
                      isDarkMode 
                        ? "bg-[#2C211E]/80 border-red-500/30 hover:border-red-500/50" 
                        : "bg-red-50/70 border-red-200 hover:border-red-300"
                    )}
                  >
                    {/* Top row: Client info & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm",
                          getAvatarColor(clientName)
                        )}>
                          {clientName.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("font-black text-sm truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                            {clientName}
                          </p>
                          {conflict.phone && (
                            <div className="mt-0.5">
                              <WhatsAppButton phone={conflict.phone} country={conflictVehicle?.country} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-[#C62828] text-white flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          ON RENT
                        </span>
                      </div>
                    </div>

                    {/* Middle row: Dates & Locations */}
                    <div className={cn(
                      "grid grid-cols-2 gap-2 p-2.5 rounded-xl border text-[11px]",
                      isDarkMode ? "bg-black/20 border-white/5" : "bg-white/80 border-red-100"
                    )}>
                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-400 block mb-0.5">
                          RENTAL PERIOD
                        </span>
                        <div className="flex items-center gap-1 font-black">
                          <Calendar className="w-3 h-3 text-[#FF5C35] shrink-0" />
                          <span>{formatDateSafe(conflict.start)}</span>
                          <span className="text-gray-400">→</span>
                          <span>{formatDateSafe(conflict.end)}</span>
                        </div>
                        {(conflict.arrivalTime || conflict.departureTime) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-bold">
                            {conflict.arrivalTime && (
                              <span className="flex items-center gap-1 text-[#FF5C35]">
                                <Clock className="w-2.5 h-2.5" /> {conflict.arrivalTime}
                              </span>
                            )}
                            {conflict.departureTime && (
                              <span className="flex items-center gap-1 text-blue-500">
                                <Clock className="w-2.5 h-2.5" /> {conflict.departureTime}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-400 block mb-0.5">
                          ROUTE / LOCATIONS
                        </span>
                        <div className="flex flex-col gap-1">
                          {fromLoc && (() => {
                            const pill = getLocationPillStyles(fromLoc);
                            return (
                              <div 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-black/10 w-fit max-w-full truncate"
                                style={{ backgroundColor: pill.bg }}
                              >
                                <ArrowUpRight className="w-2.5 h-2.5 text-black shrink-0" />
                                <span className="text-black truncate">{fromLoc}</span>
                              </div>
                            );
                          })()}
                          {toLoc && (() => {
                            const pill = getLocationPillStyles(toLoc);
                            return (
                              <div 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-black/10 w-fit max-w-full truncate"
                                style={{ backgroundColor: pill.bg }}
                              >
                                <ArrowDownRight className="w-2.5 h-2.5 text-black shrink-0" />
                                <span className="text-black truncate">{toLoc}</span>
                              </div>
                            );
                          })()}
                          {!fromLoc && !toLoc && (
                            <span className="text-gray-400 italic text-[10px]">No location specified</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: Processed by */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                        <User className="w-3 h-3 text-amber-500" />
                        <span>Processed by: <strong className={isDarkMode ? "text-white" : "text-black"}>{conflict.processedBy || 'System'}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5">
            <button
              onClick={onClose}
              className={cn(
                "w-full py-3 px-5 rounded-2xl font-black text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2",
                isDarkMode 
                  ? "bg-white/10 hover:bg-white/15 text-white border border-white/10" 
                  : "bg-gray-100 hover:bg-gray-200 text-[#0E0C0B] border border-gray-200"
              )}
            >
              Understood, Deal With Previous Rental First
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OnRentConflictModal;
