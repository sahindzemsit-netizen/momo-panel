'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, CircleUser, CarFront, Coins, Check, FileText, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle } from '@/types';

interface CashflowNotificationPopupProps {
  cashflowPopupId: string | null;
  cashflowPopupCoords: { top: number; left: number } | null;
  isDarkMode: boolean;
  userReservations: any[];
  dbVehicles: Vehicle[];
  cashflowPaymentSummary: string;
  cashflowHandledBy: string;
  setCashflowHandledBy: (val: string) => void;
  cashflowNote: string;
  setCashflowNote: (val: string) => void;
  cashflowFile: File | null;
  setCashflowFile: (val: File | null) => void;
  handleCloseCashflowPopup: () => void;
  handleCashflowNotify: (booking: any) => void;
  isCashflowSending: boolean;
}

export const CashflowNotificationPopup = memo(({
  cashflowPopupId,
  cashflowPopupCoords,
  isDarkMode,
  userReservations,
  dbVehicles,
  cashflowPaymentSummary,
  cashflowHandledBy,
  setCashflowHandledBy,
  cashflowNote,
  setCashflowNote,
  cashflowFile,
  setCashflowFile,
  handleCloseCashflowPopup,
  handleCashflowNotify,
  isCashflowSending,
}: CashflowNotificationPopupProps) => {
  if (!cashflowPopupId || !cashflowPopupCoords || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none" onClick={handleCloseCashflowPopup} />
      <div 
        style={typeof window !== 'undefined' && window.innerWidth < 768 ? {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : {
          style: {
            position: 'fixed',
            top: cashflowPopupCoords.top,
            left: cashflowPopupCoords.left - 12,
            transform: cashflowPopupCoords.top > (typeof window !== 'undefined' ? window.innerHeight * 0.65 : 600)
              ? 'translate(-100%, -85%)'
              : 'translate(-100%, -50%)',
          }
        }.style}
        className="pointer-events-none z-[10000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className={cn(
            "w-72 p-5 rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 pointer-events-auto relative",
            isDarkMode ? "bg-[#2C2724] border-white/10 text-white" : "bg-white border-black/5 text-[#0E0C0B]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-500">
                <span className="text-[10px] font-black tracking-[0.2em] uppercase">NOTIFY TO CASHFLOW 💰</span>
              </div>
              <button onClick={handleCloseCashflowPopup} className="opacity-40 hover:opacity-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const rawBooking = userReservations.find(b => b.id === cashflowPopupId);
              if (!rawBooking) return null;
              const booking = {
                ...rawBooking,
                client: rawBooking.name,
              };

              const vehicle = dbVehicles.find((v: Vehicle) => String(v.id) === String(booking.vehicleId));

              return (
                <div className="flex flex-col gap-3">
                  <div className="space-y-1 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">CLIENT NAME</p>
                      <p className="text-sm font-black tracking-tight uppercase">{booking.client}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <CircleUser className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>

                  <div className="space-y-1 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">CAR</p>
                      {vehicle ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-black tracking-tight uppercase">{vehicle.name}</span>
                          <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2 py-0.5 shadow-md shrink-0 text-black relative overflow-hidden">
                            <div className="w-[3.5px] h-3 bg-blue-700 rounded-l-[1px] -ml-2 mr-1.5 shrink-0" />
                            <span className={cn(
                              "text-xs font-mono font-black tracking-wider uppercase leading-none",
                              vehicle.color ? "pr-[14px]" : ""
                            )}>
                              {vehicle.plate}
                            </span>
                            {vehicle.color && (
                              <div 
                                className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                                style={{ 
                                  width: '12px',
                                  backgroundColor: vehicle.color
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-black tracking-tight uppercase">Unknown</p>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CarFront className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">ID</p>
                      <p className="text-[10px] font-black opacity-60 truncate max-w-[100px]" title={booking.id}>{booking.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">DAYS</p>
                      <p className="text-[10px] font-black opacity-60">{typeof booking.days === 'string' ? booking.days.replace('d', '') : booking.days} Days 🛣️</p>
                    </div>
                  </div>

                  <div className="space-y-1 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">AMOUNT</p>
                      <p className="text-sm font-black tracking-tight">
                        {cashflowPaymentSummary} / {booking.totalPrice}€
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">PAID TO</p>
                      <Check className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="relative">
                      <input 
                        type="text"
                        value={cashflowHandledBy}
                        onChange={(e) => setCashflowHandledBy(e.target.value)}
                        placeholder="Enter name..."
                        className={cn(
                          "w-full px-4 py-2.5 rounded-2xl text-[11px] font-black outline-none border focus:border-emerald-500/50 transition-all",
                          isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/5 text-black"
                        )}
                      />
                      {cashflowHandledBy && <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">NOTE</p>
                      <FileText className="w-3 h-3 text-blue-500" />
                    </div>
                    <div className="relative">
                      <textarea 
                        value={cashflowNote}
                        onChange={(e) => setCashflowNote(e.target.value)}
                        placeholder="Add optional note..."
                        className={cn(
                          "w-full px-4 py-2.5 rounded-2xl text-[11px] font-black outline-none border focus:border-emerald-500/50 transition-all min-h-[60px] resize-none",
                          isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/5 text-black"
                        )}
                      />
                    </div>
                    <div className="relative mt-2">
                       <input type="file" accept="image/*" onChange={(e) => setCashflowFile(e.target.files?.[0] || null)} className="hidden" id="cashflowFilePopup" />
                       <label htmlFor="cashflowFilePopup" className={cn(
                          "w-full px-4 py-2.5 rounded-2xl text-[11px] font-black outline-none border transition-all cursor-pointer flex items-center justify-center gap-2",
                          cashflowFile 
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                            : (isDarkMode ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-black/5 border-black/5 text-black hover:bg-black/10")
                       )}>
                         <Upload className="w-3.5 h-3.5 shrink-0" />
                         {cashflowFile ? cashflowFile.name : "Upload Image"}
                       </label>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCashflowNotify(booking)}
                    disabled={isCashflowSending || !cashflowPaymentSummary || !cashflowHandledBy}
                    className={cn(
                      "w-full py-4 mt-2 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer",
                      isDarkMode ? "bg-emerald-500 text-white" : "bg-emerald-600 text-white"
                    )}
                  >
                    {isCashflowSending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Check className="w-4 h-4 text-white stroke-[4]" />}
                    {isCashflowSending ? 'SENDING...' : 'CONFIRM & SEND'}
                  </button>
                </div>
              );
            })()}
          </div>
          {/* Bubble Arrow */}
          <div 
            className={cn(
              "hidden md:block absolute left-full border-[8px] border-transparent border-l transition-all duration-300",
              isDarkMode ? "border-l-[#2C2724]" : "border-l-white"
            )}
            style={{
              top: cashflowPopupCoords.top > (typeof window !== 'undefined' ? window.innerHeight * 0.65 : 600) ? '85%' : '50%',
              transform: 'translateY(-50%)',
            }}
          />
        </motion.div>
      </div>
    </div>,
    document.body
  );
});

CashflowNotificationPopup.displayName = 'CashflowNotificationPopup';
