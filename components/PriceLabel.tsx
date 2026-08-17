'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Banknote, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  increment, 
  addDoc,
  deleteDoc,
  setDoc,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { Payment } from '@/types';
import { createPortal } from 'react-dom';
import { ShieldCheck } from 'lucide-react';

interface PriceLabelProps {
  reservationId: string;
  totalPrice: number;
  amountPaid: number;
  status: string;
  isDarkMode: boolean;
  cashflowNotificationSent?: boolean;
  insurance?: {
    type: string;
    price: number;
    squares: number;
    color: string;
    label: string;
  };
  readOnly?: boolean;
  paymentMethod?: string;
  changedByEmail?: string;
}

export default function PriceLabel({ 
  reservationId, 
  totalPrice, 
  amountPaid, 
  status, 
  isDarkMode,
  cashflowNotificationSent = false,
  insurance,
  readOnly = false,
  paymentMethod,
  changedByEmail
}: PriceLabelProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{ top: number; left: number } | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ top: number; left: number } | null>(null);
  const [insuranceHoverCoords, setInsuranceHoverCoords] = useState<{ top: number; left: number } | null>(null);
  const [cashAmountState, setCashAmountState] = useState<string>('0');
  const [cardAmountState, setCardAmountState] = useState<string>('0');
  const [totalPriceState, setTotalPriceState] = useState<string>('0');
  const [isAdding, setIsAdding] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [isInsuranceHovering, setIsInsuranceHovering] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState<number>(320);

  useEffect(() => {
    if (isTooltipOpen && popoverRef.current) {
      const h = popoverRef.current.offsetHeight;
      if (h > 0 && Math.abs(h - popoverHeight) > 2) {
        setPopoverHeight(h);
      }
    }
  }, [isTooltipOpen, totalPriceState, cashAmountState, cardAmountState, popoverHeight]);

  const popoverPos = useMemo(() => {
    if (!tooltipCoords) return null;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const buttonCenterY = tooltipCoords.top;
    const idealTop = buttonCenterY - popoverHeight / 2;
    const minTop = 16;
    const maxTop = Math.max(minTop, windowHeight - popoverHeight - 16);
    const clampedTop = Math.max(minTop, Math.min(maxTop, idealTop));
    const rawArrowTop = buttonCenterY - clampedTop;
    const clampedArrowTop = Math.max(20, Math.min(popoverHeight - 20, rawArrowTop));

    return {
      top: clampedTop,
      left: tooltipCoords.left - 8,
      arrowTop: clampedArrowTop
    };
  }, [tooltipCoords, popoverHeight]);

  const remainingBalance = totalPrice - amountPaid;
  const isSettled = amountPaid >= totalPrice;
  const progress = Math.min((amountPaid / totalPrice) * 100, 100);
  const isLocked = status === 'CANCELLED' || cashflowNotificationSent || readOnly;

  const [historyLoading, setHistoryLoading] = useState(false);

  // Lazy load payment history for the hover and split summary only when hovered or opened
  const fetchPaymentHistory = async () => {
    if (!reservationId || historyLoading) return;
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, 'reservations', reservationId, 'paymentHistory'),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      setPaymentHistory(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (reservationId) {
      fetchPaymentHistory();
    }
  }, [reservationId]);

  useEffect(() => {
    if (isTooltipOpen || isHovering || isInsuranceHovering) {
      fetchPaymentHistory();
    }
  }, [isTooltipOpen, isHovering, isInsuranceHovering, reservationId]);

  const paymentTypeComponent = useMemo(() => {
    // 1. If we have raw paymentMethod string (passed from reservation/parent), parse it first for instant styling
    if (paymentMethod) {
      const upper = paymentMethod.toUpperCase();
      if (upper === 'CASH/CARD' || upper === 'SPLIT' || (upper.includes('CASH') && upper.includes('CARD'))) {
        return 'split';
      }
      if (upper.includes('CARD')) return 'card';
      if (upper.includes('CASH')) return 'cash';
    }

    // 2. Fallback: If we have payment history loaded, use that
    if (paymentHistory && paymentHistory.length > 0) {
      const hasCash = paymentHistory.some(p => p.method === 'Cash' && p.amount > 0);
      const hasCard = paymentHistory.some(p => p.method === 'Card' && p.amount > 0);
      if (hasCash && hasCard) return 'split';
      if (hasCard) return 'card';
      if (hasCash) return 'cash';
    }

    // Default fallback
    return 'cash';
  }, [paymentHistory, paymentMethod]);

  const themeStyles = useMemo(() => {
    const isUnpaid = amountPaid === 0;
    
    if (isUnpaid) {
      return {
        buttonClass: isDarkMode
          ? "bg-red-500/10 border-red-500/25 text-red-500"
          : "bg-red-50 border-red-100 text-red-600",
        textClass: isDarkMode ? "text-red-400" : "text-red-600",
        bottomBarClass: isDarkMode ? "bg-red-500" : "bg-red-500",
        progressColor: "#ef4444"
      };
    }

    if (paymentTypeComponent === 'card') {
      return {
        buttonClass: isSettled
          ? (isDarkMode 
              ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
              : "bg-purple-50 border-purple-100 text-purple-600")
          : (isDarkMode
              ? "bg-purple-500/5 border-purple-500/20 text-purple-400"
              : "bg-purple-50/50 border-purple-100 text-purple-600"),
        textClass: isDarkMode ? "text-purple-400" : "text-purple-600",
        bottomBarClass: isDarkMode ? "bg-purple-500" : "bg-purple-500",
        progressColor: "#a855f7"
      };
    }

    if (paymentTypeComponent === 'split') {
      return {
        buttonClass: isSettled
          ? (isDarkMode 
              ? "bg-orange-500/10 border-orange-500/30 text-orange-400" 
              : "bg-orange-50 border-orange-100 text-orange-600")
          : (isDarkMode
              ? "bg-orange-500/5 border-orange-500/20 text-orange-400"
              : "bg-orange-50/50 border-orange-100 text-orange-600"),
        textClass: isDarkMode ? "text-orange-400" : "text-orange-600",
        bottomBarClass: isDarkMode ? "bg-orange-500" : "bg-orange-500",
        progressColor: "#f97316"
      };
    }

    // Default 'cash' / green
    return {
      buttonClass: isSettled
        ? (isDarkMode 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-emerald-50 border border-emerald-100 text-emerald-600")
        : (isDarkMode
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
            : "bg-emerald-50/50 border-emerald-100 text-emerald-600"),
      textClass: isDarkMode ? "text-emerald-400" : "text-emerald-600",
      bottomBarClass: isDarkMode ? "bg-emerald-500" : "bg-emerald-500",
      progressColor: "#10b981"
    };
  }, [isDarkMode, isSettled, paymentTypeComponent, amountPaid]);

  // Hook to initialize cash and card states when the tooltip opens
  useEffect(() => {
    if (isTooltipOpen) {
      setTotalPriceState(String(totalPrice));
      let cashTotal = 0;
      let cardTotal = 0;
      paymentHistory.forEach(p => {
        if (p.method === 'Cash') {
          cashTotal += p.amount;
        } else if (p.method === 'Card') {
          cardTotal += p.amount;
        }
      });
      setCashAmountState(String(cashTotal));
      setCardAmountState(String(cardTotal));
    }
  }, [isTooltipOpen, paymentHistory, totalPrice]);

  const handleOpenTooltip = (e: React.MouseEvent) => {
    if (isLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({
      top: rect.top + rect.height / 2,
      left: rect.left
    });
    setIsTooltipOpen(true);
  };

  const handleUpdateSplit = async () => {
    if (isLocked) {
      console.warn("Editing is locked.");
      return;
    }
    const newTotal = parseFloat(totalPriceState) || 0;
    const cash = parseFloat(cashAmountState) || 0;
    const card = parseFloat(cardAmountState) || 0;
    const newTotalPaid = cash + card;

    setIsAdding(true);
    try {
      const resRef = doc(db, 'reservations', reservationId);
      const historyRef = collection(db, 'reservations', reservationId, 'paymentHistory');

      // 1. Delete all existing payments in history
      const deletePromises = paymentHistory.map(p => {
        if (p.id) {
          return deleteDoc(doc(db, 'reservations', reservationId, 'paymentHistory', p.id));
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);

      // 2. Add new Cash payment if cash > 0
      if (cash > 0) {
        await addDoc(historyRef, {
          amount: cash,
          method: 'Cash',
          timestamp: Date.now()
        });
      }

      // 3. Add new Card payment if card > 0
      if (card > 0) {
        await addDoc(historyRef, {
          amount: card,
          method: 'Card',
          timestamp: Date.now()
        });
      }

      // 4. Update the main reservation total payment amount with 'cash', 'card', or 'cash/card'
      let calculatedPaymentMethod = 'cash';
      if (cash > 0 && card > 0) {
        calculatedPaymentMethod = 'cash/card';
      } else if (card > 0) {
        calculatedPaymentMethod = 'card';
      } else {
        calculatedPaymentMethod = 'cash';
      }

      await updateDoc(resRef, {
        totalPrice: newTotal,
        amountPaid: newTotalPaid,
        paymentMethod: calculatedPaymentMethod,
        cashAmount: cash,
        cardAmount: card,
        updatedAt: Date.now()
      });

      // Synchronize matching cashflow logs if they exist in firestore
      try {
        await setDoc(doc(db, 'cashflow', reservationId), {
          totalPrice: newTotal,
          amountPaid: newTotalPaid,
          paymentMethod: calculatedPaymentMethod,
          cashAmount: cash,
          cardAmount: card,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (cfErr) {
        console.error("Failed to update matching cashflow document:", cfErr);
      }

      // 5. Add to auditLog
      if (amountPaid !== newTotalPaid || totalPrice !== newTotal) {
        try {
          await setDoc(doc(db, 'auditLogs', reservationId), {
            reservationId: reservationId,
            updatedAt: serverTimestamp()
          }, { merge: true });

          const changedFields: any = {};
          if (amountPaid !== newTotalPaid) {
            changedFields.amountPaid = {
              oldValue: amountPaid,
              newValue: newTotalPaid
            };
          }
          if (totalPrice !== newTotal) {
            changedFields.totalPrice = {
              oldValue: totalPrice,
              newValue: newTotal
            };
          }

          await addDoc(collection(db, 'auditLogs', reservationId, 'changes'), {
            reservationId: reservationId,
            changedBy: changedByEmail || auth.currentUser?.email || 'Teammate',
            timestamp: serverTimestamp(),
            action: 'price_changed',
            changedFields
          });
        } catch (auditErr) {
          console.error("Failed to write audit logs for payment change:", auditErr);
          handleFirestoreError(auditErr, OperationType.CREATE, `auditLogs/${reservationId}/changes`);
        }
      }

      await fetchPaymentHistory();

      setIsTooltipOpen(false);
    } catch (error) {
      console.error("Error updating payment split:", error);
      handleFirestoreError(error, OperationType.UPDATE, `reservations/${reservationId}`);
    } finally {
      setIsAdding(false);
    }
  };

  const paymentSummary = useMemo(() => {
    const totals = paymentHistory.reduce((acc, curr) => {
      acc[curr.method] = (acc[curr.method] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(totals)
      .map(([method, total]) => `€${total} ${method}`)
      .join(' | ');
  }, [paymentHistory]);

  const handleHoverEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverCoords({
      top: rect.bottom,
      left: rect.left + rect.width / 2
    });
    setIsHovering(true);
  };

  if (status === 'CANCELLED') {
    return (
      <div className={cn(
        "px-4 py-2 rounded-full font-black text-sm",
        isDarkMode ? "bg-white/5 text-white/40" : "bg-gray-100 text-gray-400"
      )}>
        €{totalPrice}
      </div>
    );
  }

  return (
    <>
      <div 
        className="flex flex-col items-center gap-1 group/price relative"
        onMouseEnter={handleHoverEnter}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Insurance Icon in top right */}
        {insurance && (
          <div 
            className="absolute -top-1.5 -right-1.5 z-20 group/ins hover:scale-110 transition-transform cursor-help"
            onMouseEnter={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setInsuranceHoverCoords({ top: rect.top, left: rect.left + rect.width / 2 });
              setIsInsuranceHovering(true);
            }}
            onMouseLeave={() => setIsInsuranceHovering(false)}
          >
             <div className="bg-emerald-500 rounded-full p-0.5 shadow-lg shadow-emerald-500/20 border border-white dark:border-[#2C2724]">
                <ShieldCheck className="w-3 h-3 text-white" />
             </div>
          </div>
        )}

        <button
          onClick={handleOpenTooltip}
          disabled={isLocked}
          className={cn(
            "relative px-3 py-1.5 rounded-[20px] font-black shadow-sm transition-all flex flex-col items-center min-w-[90px] overflow-hidden pb-5 pt-2 border",
            isLocked
              ? "cursor-default opacity-90"
              : "cursor-pointer hover:shadow-lg active:scale-95",
            themeStyles.buttonClass
          )}
        >
          <div className="flex flex-col items-center gap-0">
            <span className={cn(
              "text-base leading-tight tracking-normal",
              themeStyles.textClass
            )}>
              €{totalPrice}
            </span>
            {!isSettled && (
              <span className={cn("text-[9px] leading-none -mt-0.5 opacity-80 tracking-normal", themeStyles.textClass)}>
                 €{amountPaid} &nbsp; PAID
              </span>
            )}
          </div>
          
          {/* Progress Bar with Numbers */}
          {!isSettled && (
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-black/10 overflow-hidden flex items-center justify-center">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ 
                  width: `${progress}%`,
                  backgroundColor: themeStyles.progressColor
                }}
                className="absolute inset-y-0 left-0"
              />
              <span className="relative z-10 text-[8px] text-white font-black drop-shadow-sm">
                {Math.round(progress)}%
              </span>
            </div>
          )}
          {isSettled && (
             <div className={cn("absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center", themeStyles.bottomBarClass)}>
                <span className="text-[8px] text-white font-black drop-shadow-sm uppercase tracking-tighter">
                  Paid 100%
                </span>
             </div>
          )}
        </button>
      </div>

      {/* View-Only Summary Indicator Portal */}
      {(isSettled || cashflowNotificationSent || readOnly) && isHovering && paymentSummary && hoverCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: hoverCoords.top,
            left: hoverCoords.left,
            transform: 'translate(-50%, 8px)'
          }}
        >
          <div className={cn(
            "whitespace-nowrap px-3 py-1.5 rounded-xl border shadow-2xl text-[10px] font-black tracking-wider uppercase animate-in fade-in slide-in-from-top-1",
            isDarkMode ? "bg-[#2C2724] border-white/10 text-white" : "bg-white border-black/5 text-[#0E0C0B]"
          )}>
            <div className={cn(
              "absolute bottom-full left-1/2 -translate-x-1/2 border-[4px] border-transparent",
              isDarkMode ? "border-b-[#2C2724]" : "border-b-white"
            )} />
            Total Paid: {paymentSummary}
          </div>
        </div>,
        document.body
      )}

      {/* Insurance Info Tooltip Portal */}
      {isInsuranceHovering && insurance && insuranceHoverCoords && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[99999] pointer-events-none"
          style={{
            top: insuranceHoverCoords.top,
            left: insuranceHoverCoords.left,
            transform: 'translate(-50%, -100%) translateY(-8px)'
          }}
        >
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
              "px-4 py-3 rounded-[24px] border shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-bottom-1",
              isDarkMode ? "bg-[#2C2724] border-white/10 text-white" : "bg-white border-black/5 text-[#0E0C0B]"
            )}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-50">INSURANCE</span>
              </div>
              <p className="text-sm font-black tracking-tight">{insurance.label}</p>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: insurance.squares }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2.5 h-2.5 rounded-[1px]" 
                    style={{ backgroundColor: insurance.color }} 
                  />
                ))}
              </div>
            </div>
            {/* Arrow */}
            <div className={cn(
              "absolute top-full left-1/2 -track-x-1/2 border-[6px] border-transparent mt-[-1px]",
              isDarkMode ? "border-t-[#2C2724]" : "border-t-white"
            )} style={{ left: '50%', marginLeft: '-6px' }} />
          </motion.div>
        </div>,
        document.body
      )}

      {/* Tooltip Portal */}
      <AnimatePresence>
        {isTooltipOpen && tooltipCoords && popoverPos && (
          <>
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => setIsTooltipOpen(false)} 
            />
            {createPortal(
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, scale: 0.95, x: "-95%", y: 0 }}
                animate={{ opacity: 1, scale: 1, x: "-100%", y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: "-95%", y: 0 }}
                className={cn(
                  "fixed z-[9999] p-3 rounded-[20px] border shadow-2xl min-w-[210px] pointer-events-auto",
                  isDarkMode ? "bg-[#231F1D] border-white/10" : "bg-white border-black/5"
                )}
                style={{
                  top: popoverPos.top,
                  left: popoverPos.left,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <h4 className={cn("text-[9px] font-black uppercase tracking-widest opacity-50", isDarkMode ? "text-white" : "text-black")}>Payment Details</h4>
                    <button onClick={() => setIsTooltipOpen(false)} className="opacity-50 hover:opacity-100"><Loader2 className="w-2.5 h-2.5 rotate-45" /></button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className={cn("p-1.5 rounded-xl border flex flex-col items-center justify-center transition-colors", isDarkMode ? "bg-white/5 border-white/5 focus-within:border-[#FF5C35]" : "bg-gray-50 border-black/5 focus-within:border-[#FF5C35]")}>
                      <span className="text-[7px] font-bold opacity-50 uppercase">Total</span>
                      <div className="flex items-center gap-0.5 w-full justify-center">
                        <span className={cn("text-[11px] font-black opacity-60", isDarkMode ? "text-white" : "text-black")}>€</span>
                        <input 
                          type="number"
                          value={totalPriceState}
                          onChange={(e) => setTotalPriceState(e.target.value)}
                          className={cn(
                            "w-full text-[11px] font-black bg-transparent outline-none text-center p-0 m-0",
                            isDarkMode ? "text-white focus:text-[#FF5C35]" : "text-black focus:text-[#FF5C35]"
                          )}
                        />
                      </div>
                    </div>
                    <div className={cn("p-1.5 rounded-xl border flex flex-col items-center justify-center", isDarkMode ? "bg-[#10b981]/10 border-[#10b981]/10" : "bg-emerald-50/50 border-emerald-100")}>
                      <span className="text-[7px] font-bold text-emerald-500 uppercase">Paid</span>
                      <span className="text-[11px] font-black text-emerald-500">€{((parseFloat(cashAmountState) || 0) + (parseFloat(cardAmountState) || 0))}</span>
                    </div>
                    <div className={cn("p-1.5 rounded-xl border flex flex-col items-center justify-center", isDarkMode ? "bg-red-500/10 border-red-500/15" : "bg-red-50/50 border-red-100")}>
                      <span className="text-[7px] font-bold text-red-500 uppercase">Due</span>
                      <span className="text-[11px] font-black text-red-500">€{Math.max(0, (parseFloat(totalPriceState) || 0) - ((parseFloat(cashAmountState) || 0) + (parseFloat(cardAmountState) || 0)))}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[7px] font-bold uppercase opacity-50 flex items-center gap-1">
                          <Banknote className="w-3 h-3 text-emerald-500" /> CASH RECEIVED
                        </span>
                      </div>
                      <input 
                        type="number"
                        placeholder="0"
                        value={cashAmountState}
                        onChange={(e) => setCashAmountState(e.target.value)}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-xl border outline-none font-bold text-xs transition-all",
                          isDarkMode 
                            ? "bg-white/5 border-white/5 focus:border-[#FF5631] text-white" 
                            : "bg-gray-50 border-gray-100 focus:border-[#FF5631] text-black"
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[7px] font-bold uppercase opacity-50 flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-blue-500" /> CARD RECEIVED
                        </span>
                      </div>
                      <input 
                        type="number"
                        placeholder="0"
                        value={cardAmountState}
                        onChange={(e) => setCardAmountState(e.target.value)}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-xl border outline-none font-bold text-xs transition-all",
                          isDarkMode 
                            ? "bg-white/5 border-white/5 focus:border-[#FF5C35] text-white" 
                            : "bg-gray-50 border-gray-100 focus:border-[#FF5C35] text-black"
                        )}
                      />
                    </div>

                    {/* Quick fill options */}
                    <div className="grid grid-cols-3 gap-1">
                      <button 
                        onClick={() => {
                          const activeTotal = parseFloat(totalPriceState) || totalPrice;
                          setCashAmountState(String(activeTotal));
                          setCardAmountState('0');
                        }}
                        className={cn(
                          "py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[7px] font-bold tracking-tighter uppercase transition-all",
                          isDarkMode ? "text-white/70" : "text-black/70"
                        )}
                      >
                        100% CASH
                      </button>
                      <button 
                        onClick={() => {
                          const activeTotal = parseFloat(totalPriceState) || totalPrice;
                          setCashAmountState('0');
                          setCardAmountState(String(activeTotal));
                        }}
                        className={cn(
                          "py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[7px] font-bold tracking-tighter uppercase transition-all",
                          isDarkMode ? "text-white/70" : "text-black/70"
                        )}
                      >
                        100% CARD
                      </button>
                      <button 
                        onClick={() => {
                          const activeTotal = parseFloat(totalPriceState) || totalPrice;
                          const half = activeTotal / 2;
                          setCashAmountState(String(half));
                          setCardAmountState(String(half));
                        }}
                        className={cn(
                          "py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[7px] font-bold tracking-tighter uppercase transition-all",
                          isDarkMode ? "text-white/70" : "text-black/70"
                        )}
                      >
                        50/50 SPLIT
                      </button>
                    </div>

                    <button 
                      onClick={handleUpdateSplit}
                      disabled={isAdding}
                      className={cn(
                        "w-full py-2 rounded-xl font-black text-[9px] tracking-[0.2em] uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-1",
                        isDarkMode ? "bg-[#FF5C35] text-white hover:bg-[#FF5C35]/90" : "bg-[#0E0C0B] text-white hover:bg-[#0E0C0B]/90"
                      )}
                    >
                      {isAdding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                      SAVE PAYMENT SPLIT
                    </button>
                  </div>
                </div>

                {/* Arrow */}
                <div 
                  className={cn(
                    "absolute left-full border-[6px] border-transparent -translate-y-1/2 pointer-events-none",
                    isDarkMode ? "border-l-[#231F1D]" : "border-l-white"
                  )} 
                  style={{ top: `${popoverPos.arrowTop}px` }}
                />
              </motion.div>,
              document.body
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
