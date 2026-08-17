'use client';

import React, { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDownRight, Plus, Snowflake, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { cn, parseDateSafe } from '@/lib/utils';
import { COUNTRY_COLORS } from '@/lib/constants';
import { Vehicle } from '@/types';
import { globalGetDestinationCountry } from './Reservations';
import { useAppState } from '@/lib/context';

interface IncomingFleetPanelProps {
  isIncomingFleetOpen: boolean;
  setIsIncomingFleetOpen: (val: boolean) => void;
  isDarkMode: boolean;
  activeCountry: string;
  dbVehicles: Vehicle[];
  userReservations: any[];
  tyreTypes: Record<string, 'summer' | 'winter'>;
}

export const IncomingFleetPanel = memo(({
  isIncomingFleetOpen,
  setIsIncomingFleetOpen,
  isDarkMode,
  activeCountry,
  dbVehicles,
  userReservations,
  tyreTypes,
}: IncomingFleetPanelProps) => {
  const { violations = [] } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);

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

  return createPortal(
    <AnimatePresence>
      {isIncomingFleetOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsIncomingFleetOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "w-full max-w-xl rounded-[40px] shadow-2xl border relative z-10 overflow-hidden flex flex-col max-h-[85vh]",
              isDarkMode ? "bg-[#2C2724] border-white/10 text-white" : "bg-white border-gray-200 text-[#0E0C0B]"
            )}
          >
            <div className="p-8 border-b border-black/5 bg-gradient-to-br from-[#FF5C35]/10 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FF5C35] rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF5C35]/20">
                    <ArrowDownRight className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Incoming Fleet</h2>
                    <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Cars heading to {activeCountry}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsIncomingFleetOpen(false)}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </div>

            {/* Search and Filters Toolbar */}
            <div className={cn(
              "px-8 py-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between",
              isDarkMode ? "bg-[#25211E] border-white/5" : "bg-gray-50 border-gray-100"
            )}>
              {/* Search Bar */}
              <div className="relative w-full sm:flex-1">
                <input
                  type="text"
                  placeholder="Search client or plate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all focus:outline-none focus:ring-2",
                    isDarkMode 
                      ? "bg-[#1C1816] border-white/10 text-white placeholder-gray-500 focus:border-[#FF5C35] focus:ring-[#FF5C35]/20" 
                      : "bg-white border-gray-200 text-[#0E0C0B] placeholder-gray-400 focus:border-[#FF5C35] focus:ring-[#FF5C35]/20"
                  )}
                />
                <svg
                  className={cn("absolute left-3 top-2.5 w-4 h-4", isDarkMode ? "text-gray-500" : "text-gray-400")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Today Toggle Button */}
              <button
                onClick={() => setTodayOnly(prev => !prev)}
                className={cn(
                  "w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 border shadow-sm",
                  todayOnly 
                    ? "bg-[#FF5C35] hover:bg-[#FF5C35]/90 text-white border-transparent" 
                    : isDarkMode 
                      ? "bg-[#1C1816] hover:bg-[#25211E] text-gray-300 border-white/10" 
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", todayOnly ? "bg-white animate-pulse" : "bg-gray-400")} />
                Today
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {(() => {
                const baseIncoming = dbVehicles.filter(v => {
                  const isExtra = v.isExtra || v.name === 'EXTRA' || String(v.id).startsWith('extra-');
                  if (v.isRetired || isExtra) return false;
                  const homeCountry = v.country || 'Macedonia';
                  if (homeCountry === activeCountry) return false;

                  return userReservations.some(r => 
                    String(r.vehicleId) === String(v.id) && 
                    (r.status === 'UPCOMING' || r.status === 'ON RENT') &&
                    r.toLocation?.toLowerCase().includes(activeCountry.toLowerCase())
                  );
                });

                const incomingWithReservations = baseIncoming.map(v => {
                  const nextArrival = [...userReservations]
                    .filter(r => String(r.vehicleId) === String(v.id) && (r.status === 'UPCOMING' || r.status === 'ON RENT') && r.toLocation?.toLowerCase().includes(activeCountry.toLowerCase()))
                    .sort((a, b) => parseDateSafe(a.start).getTime() - parseDateSafe(b.start).getTime())[0];
                  return { vehicle: v, nextArrival };
                });

                const filteredIncoming = incomingWithReservations.filter(({ vehicle, nextArrival }) => {
                  if (todayOnly) {
                    if (!nextArrival) return false;
                    const endDate = parseDateSafe(nextArrival.end);
                    const today = new Date();
                    const isSameDay = endDate.getFullYear() === today.getFullYear() &&
                                      endDate.getMonth() === today.getMonth() &&
                                      endDate.getDate() === today.getDate();
                    if (!isSameDay) return false;
                  }

                  if (searchQuery.trim()) {
                    const queryClean = searchQuery.toLowerCase().trim();
                    const plateClean = (vehicle.plate || '').toLowerCase();
                    const clientClean = (nextArrival?.name || '').toLowerCase();
                    const nameClean = (vehicle.name || '').toLowerCase();
                    if (!plateClean.includes(queryClean) && !clientClean.includes(queryClean) && !nameClean.includes(queryClean)) {
                      return false;
                    }
                  }

                  return true;
                });

                if (filteredIncoming.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                      <ArrowDownRight className="w-12 h-12 mb-4" />
                      <p className="font-black text-sm tracking-widest uppercase">No matching incoming cars</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3">
                    {filteredIncoming.map(({ vehicle: v, nextArrival }) => {
                      const destCountry = nextArrival?.toLocation ? (globalGetDestinationCountry(nextArrival.toLocation) || activeCountry) : activeCountry;
                      const countryColor = COUNTRY_COLORS[destCountry] || '#FF9F00';
                      const originCountry = nextArrival?.fromLocation || v.country || 'Macedonia';
                      const originCountryColor = COUNTRY_COLORS[originCountry] || '#FF9F00';

                      return (
                        <div 
                          key={v.id}
                          className={cn(
                            "group p-4 rounded-[28px] border-2 transition-all hover:scale-[1.02] relative overflow-hidden",
                            isDarkMode ? "hover:border-white/20" : "hover:border-black/10"
                          )}
                          style={{ 
                            backgroundColor: isDarkMode ? `${countryColor}25` : `${countryColor}12`,
                            borderColor: isDarkMode ? `${countryColor}30` : `${countryColor}20`
                          }}
                        >
                          <div className="flex flex-col gap-2 relative z-10">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1.5">
                                {/* Row 1: Tyre Icon + Name */}
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded-full flex items-center justify-center shadow-sm shrink-0 border border-white/10",
                                      tyreTypes[String(v.id)] === 'winter' 
                                        ? "bg-blue-500 text-white" 
                                        : "bg-[#FF9F00] text-white"
                                    )}
                                  >
                                    {tyreTypes[String(v.id)] === 'winter' ? <Snowflake className="w-2.5 h-2.5 fill-current" /> : <Sun className="w-2.5 h-2.5 fill-current" />}
                                  </div>
                                  <h4 className="font-black text-[13px] uppercase tracking-tight leading-none">{v.name}</h4>
                                </div>

                                {/* Row 2: Plate + Transmission + Country */}
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "flex items-center rounded-md border-2 px-2 py-0.5 shadow-md shrink-0 text-black relative overflow-hidden",
                                    hasViolation(v.plate)
                                      ? "bg-red-100 border-red-500 shadow-inner"
                                      : "bg-white border-black/30"
                                  )}>
                                    <div className="w-[3.5px] h-3 bg-blue-700 rounded-l-[1px] -ml-2 mr-1.5 shrink-0" />
                                    <span className={cn(
                                      "text-xs font-mono font-black tracking-wider uppercase leading-none",
                                      v.color ? "pr-[14px]" : ""
                                    )}>
                                      {v.plate}
                                    </span>
                                    {v.color && (
                                      <div 
                                        className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                                        style={{ 
                                          width: '12px',
                                          backgroundColor: v.color
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div className="w-5 h-5 rounded-full bg-white border border-black/10 flex items-center justify-center shadow-sm shrink-0">
                                    <span className="font-black text-[10px] text-black leading-none">
                                      {v.transmission === 'Manual' ? 'M' : 'A'}
                                    </span>
                                  </div>
                                  <span 
                                    className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest"
                                    style={{ backgroundColor: `${originCountryColor}20`, color: originCountryColor }}
                                  >
                                    {originCountry}
                                  </span>
                                </div>

                                {/* Row 3: VIN */}
                                {v.chassisNumber && (
                                  <p className="text-[8px] font-mono opacity-80 uppercase tracking-widest leading-none truncate ml-0.5" title={v.chassisNumber}>
                                    VIN: {v.chassisNumber}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                <div 
                                  className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                    nextArrival?.status === 'ON RENT' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                    nextArrival?.status === 'COMPLETED' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                    ""
                                  )}
                                  style={
                                    nextArrival?.status === 'ON RENT' ? undefined :
                                    nextArrival?.status === 'COMPLETED' ? undefined :
                                    {
                                      backgroundColor: `${countryColor}15`,
                                      color: countryColor,
                                      borderColor: `${countryColor}30`
                                    }
                                  }
                                >
                                  {nextArrival?.status || 'UPCOMING'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-black/5">
                              <div className="flex flex-col gap-1">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Client</p>
                                <p className="font-black text-xs uppercase tracking-tight">{nextArrival?.name || 'N/A'}</p>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Reservation Period</p>
                                <div className={cn(
                                  "px-3 py-1.5 rounded-xl font-mono text-[10px] font-black shadow-sm flex items-center gap-2",
                                  isDarkMode ? "bg-black/40 text-white" : "bg-white text-black"
                                )}>
                                  <span>{nextArrival ? format(new Date(nextArrival.start), 'dd MMM') : '-'}</span>
                                  <div className="w-1.5 h-0.5 rounded-full" style={{ backgroundColor: `${countryColor}40` }} />
                                  <span>{nextArrival ? format(new Date(nextArrival.end), 'dd MMM yyyy') : '-'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="absolute top-0 right-0 p-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <ArrowDownRight className="w-32 h-32 rotate-[-15deg] -translate-y-6" style={{ color: countryColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-8 border-t border-black/5 bg-gray-50/10">
               <button 
                onClick={() => setIsIncomingFleetOpen(false)}
                className="w-full py-4 rounded-[20px] bg-[#0E0C0B] text-white font-black text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-xl border-b-4 border-black/50 cursor-pointer"
               >
                 Got it
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
});

IncomingFleetPanel.displayName = 'IncomingFleetPanel';
