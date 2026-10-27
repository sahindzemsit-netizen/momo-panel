'use client';

import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export interface CarExtraDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any | null;
  coords: { top: number; left: number; isAbove?: boolean } | null;
  isDarkMode: boolean;
  uncompletedReservations: any[];
}

export const CarExtraDetailsModal = memo(({
  isOpen,
  onClose,
  vehicle,
  coords,
  isDarkMode,
  uncompletedReservations
}: CarExtraDetailsModalProps) => {
  const [plateInputValue, setPlateInputValue] = useState('');
  const [extraNameInputValue, setExtraNameInputValue] = useState('');
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingPlate, setPendingPlate] = useState('');
  const [pendingExtraName, setPendingExtraName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && vehicle) {
      setPlateInputValue(vehicle.plate || '');
      setExtraNameInputValue(vehicle.extraName || '');
      setShowAddConfirm(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle || typeof document === 'undefined') {
    return null;
  }

  const handleSave = async () => {
    if (!vehicle) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'vehicles', String(vehicle.id)), {
        plate: pendingPlate.toUpperCase(),
        extraName: pendingExtraName.toUpperCase(),
        updatedAt: Date.now()
      });
      setShowAddConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to save car details:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetire = async () => {
    if (!vehicle) return;
    setIsProcessing(true);
    try {
      const originalPlate = vehicle.plate || '';
      const originalExtraName = vehicle.extraName || 'EXTRA';
      const vId = String(vehicle.id);

      if (originalPlate || originalExtraName !== 'EXTRA') {
        // Find and update all reservations with this vehicleId
        try {
          const reservationsRef = collection(db, 'reservations');
          const qRes = query(reservationsRef, where('vehicleId', '==', vId));
          const resSnap = await getDocs(qRes);
          for (const docSnap of resSnap.docs) {
            const resData = docSnap.data();
            const snapshotPlate = resData.snapshotExtraPlate || '';
            const snapshotName = resData.snapshotExtraName || '';
            const deletedPlate = resData.deletedExtraPlate || '';

            // Freeze this reservation if it belonged to the active car we are deleting.
            if (snapshotPlate === originalPlate || (!deletedPlate && (!snapshotPlate || snapshotPlate === originalPlate))) {
              await updateDoc(doc(db, 'reservations', docSnap.id), {
                deletedExtraPlate: originalPlate,
                deletedExtraName: originalExtraName,
                snapshotExtraPlate: originalPlate,
                snapshotExtraName: originalExtraName,
                updatedAt: Date.now()
              });
            }
          }
        } catch (resErr) {
          console.error("Failed to snapshot extra details for reservations:", resErr);
        }
      }

      // Compute the next 'past X' index from the current vehicle document in Firestore
      let nextPastIndex = 1;
      const vDocRef = doc(db, 'vehicles', vId);
      try {
        const vSnap = await getDoc(vDocRef);
        if (vSnap.exists()) {
          const vData = vSnap.data();
          while (vData[`past ${nextPastIndex}`] !== undefined || vData[`past_${nextPastIndex}`] !== undefined) {
            nextPastIndex++;
          }
        }
      } catch (vErr) {
        console.error("Failed to fetch vehicle to compute history:", vErr);
      }

      const pastValue = `${originalExtraName} (${originalPlate})`;

      await updateDoc(vDocRef, {
        plate: '',
        extraName: '',
        country: 'Macedonia',
        updatedAt: Date.now(),
        [`past ${nextPastIndex}`]: pastValue
      });
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to retire plate:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasPlate = !!(vehicle.plate && vehicle.plate.trim());

  return createPortal(
    <div className="fixed inset-0 z-[100000] pointer-events-auto">
      {/* Backdrop for closing */}
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={() => {
          if (!showAddConfirm && !showDeleteConfirm) {
            onClose();
          }
        }} 
      />

      {/* Main Input Popover */}
      {coords && !showAddConfirm && !showDeleteConfirm && (
        <div 
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.isAbove ? 'translateY(-100%)' : 'none'
          }}
          className="pointer-events-none z-[10000]"
        >
          <div 
            className={cn(
              "w-[260px] p-3.5 rounded-2xl border-2 shadow-2xl flex flex-col gap-3 animate-fade-in pointer-events-auto",
              isDarkMode 
                ? "bg-[#25201E] border-[#FF5C35]/50 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
                : "bg-white border-[#FF5C35] text-[#0E0C0B] shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dashed border-black/10 dark:border-white/10 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5C35]">Extra Car Details</span>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Plate field */}
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Plate Number</label>
              <input
                type="text"
                placeholder="PLATE..."
                value={plateInputValue}
                onChange={(e) => setPlateInputValue(e.target.value.toUpperCase())}
                className="bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-black rounded-lg border border-black/10 dark:border-white/10 px-2.5 py-1.5 outline-none uppercase placeholder:text-gray-400 dark:placeholder:text-gray-500 text-black dark:text-white focus:border-[#FF5C35]/50 focus:ring-1 focus:ring-[#FF5C35]/20"
                autoFocus
              />
            </div>

            {/* Car Name field */}
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Car's Name</label>
              <input
                type="text"
                placeholder="CAR NAME (e.g. GOLF 7)..."
                value={extraNameInputValue}
                onChange={(e) => setExtraNameInputValue(e.target.value.toUpperCase())}
                className="bg-neutral-100 dark:bg-neutral-800 text-xs font-sans font-black rounded-lg border border-black/10 dark:border-white/10 px-2.5 py-1.5 outline-none uppercase placeholder:text-gray-400 dark:placeholder:text-gray-500 text-black dark:text-white focus:border-[#FF5C35]/50 focus:ring-1 focus:ring-[#FF5C35]/20"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-1 border-t border-dashed border-black/10 dark:border-white/10 pt-2.5">
              <button
                onClick={onClose}
                className="flex-1 py-1.5 rounded-lg bg-gray-400 hover:bg-gray-500 text-white font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              {hasPlate && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-2 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer text-center"
                  title="Retire extra car plate and archive details"
                >
                  Retire
                </button>
              )}
              <button
                onClick={() => {
                  if (plateInputValue.trim()) {
                    setPendingPlate(plateInputValue.trim());
                    setPendingExtraName(extraNameInputValue.trim());
                    setShowAddConfirm(true);
                  }
                }}
                className="flex-1 py-1.5 rounded-lg bg-[#FF5C35] hover:bg-[#FF451C] text-white font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer text-center shadow-md shadow-[#FF5C35]/25"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Add Details Modal */}
      {showAddConfirm && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center pointer-events-auto">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowAddConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "relative z-10 w-full max-w-sm p-6 rounded-2xl shadow-2xl border-2 flex flex-col gap-4 text-center",
              isDarkMode 
                ? "bg-[#231F1D] border-[#FF5C35]/50 text-white" 
                : "bg-white border-[#FF5C35] text-[#0E0C0B]"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#FF5C35]">Save Car Details</h3>
              <p className={cn("text-xs mt-2 font-medium leading-relaxed", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Are you sure you want to save the following details to this EXTRA row?
              </p>
              <div className="mt-3 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-left flex flex-col gap-1.5 border border-black/5 dark:border-white/5">
                <p className="text-[10px] font-bold text-gray-400">PLATE: <span className="font-mono font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase ml-1">{pendingPlate}</span></p>
                {pendingExtraName && <p className="text-[10px] font-bold text-gray-400">NAME: <span className="font-sans font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase ml-1">{pendingExtraName}</span></p>}
                <p className="text-[10px] font-bold text-gray-400">COUNTRY: <span className="font-sans font-black text-[#FF5C35] ml-1">{(vehicle.country || 'Macedonia').toUpperCase()}</span></p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowAddConfirm(false)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border cursor-pointer active:scale-95 transition-all",
                  isDarkMode 
                    ? "bg-transparent border-white/10 text-gray-400 hover:bg-white/5" 
                    : "bg-transparent border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-[#FF5C35] hover:bg-[#FF451C] text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-[#FF5C35]/25 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : 'Yes, Save'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirm Retire Plate Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center pointer-events-auto">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowDeleteConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "relative z-10 w-full max-w-sm p-6 rounded-2xl shadow-2xl border-2 flex flex-col gap-4 text-center",
              uncompletedReservations.length > 0
                ? (isDarkMode ? "bg-[#231F1D] border-red-500/50 text-white" : "bg-white border-red-500 text-[#0E0C0B]")
                : (isDarkMode ? "bg-[#231F1D] border-amber-500/50 text-white" : "bg-white border-amber-500 text-[#0E0C0B]")
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
              uncompletedReservations.length > 0 
                ? "bg-red-500/10 text-red-500" 
                : "bg-amber-500/10 text-amber-500"
            )}>
              {uncompletedReservations.length > 0 ? (
                <AlertTriangle className="w-6 h-6 stroke-[3]" />
              ) : (
                <X className="w-6 h-6 stroke-[3]" />
              )}
            </div>
            {uncompletedReservations.length > 0 ? (
              <>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-red-500">Retire Blocked</h3>
                  <p className={cn("text-xs mt-2 font-medium leading-relaxed", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                    You cannot retire plate <span className="font-mono font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase">{vehicle.plate}</span> yet.
                  </p>
                  <p className={cn("text-xs mt-2 font-medium leading-relaxed", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    There are active reservations for this extra car that must be marked as COMPLETED first:
                  </p>
                  <div className={cn(
                    "mt-3 text-left max-h-36 overflow-y-auto rounded-lg p-2 text-[11px] font-semibold border flex flex-col gap-1.5",
                    isDarkMode ? "bg-[#1E1B1A] border-white/5 text-gray-300" : "bg-gray-50 border-gray-100 text-gray-700"
                  )}>
                    {uncompletedReservations.map(res => {
                      const dateStr = `${res.start instanceof Date ? format(res.start, 'dd/MM') : '??'} - ${res.end instanceof Date ? format(res.end, 'dd/MM') : '??'}`;
                      return (
                        <div key={res.id} className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-2 py-1.5 rounded">
                          <span className="font-bold truncate max-w-[150px]">{res.name}</span>
                          <span className="font-mono text-gray-400 text-[10px] shrink-0">{dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all text-white",
                      isDarkMode 
                        ? "bg-red-500/30 hover:bg-red-500/40 text-red-200" 
                        : "bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25"
                    )}
                  >
                    Okay, I will complete them first
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Retire Car Details</h3>
                  <p className={cn("text-xs mt-2 font-medium leading-relaxed", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                    Are you sure you want to retire plate <span className="font-mono font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">{vehicle.plate}</span> ({vehicle.extraName || 'EXTRA'})? This row will revert back to standard EXTRA and current details will be archived.
                  </p>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setShowDeleteConfirm(false)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border cursor-pointer active:scale-95 transition-all",
                      isDarkMode 
                        ? "bg-transparent border-white/10 text-gray-400 hover:bg-white/5" 
                        : "bg-transparent border-gray-200 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleRetire}
                    className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-amber-500/25 disabled:opacity-50"
                  >
                    {isProcessing ? 'Retiring...' : 'Yes, Retire'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>,
    document.body
  );
});

CarExtraDetailsModal.displayName = 'CarExtraDetailsModal';
