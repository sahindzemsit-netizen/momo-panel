"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  CalendarPlus,
  Lock,
  Calendar,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  CreditCard,
  Banknote,
  CheckCircle2,
  FileText,
  Loader2,
  ArrowRight
} from "lucide-react";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { cn, parseDateSafe } from "@/lib/utils";
import { Reservation, Vehicle } from "@/types";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, updateDoc, arrayUnion, collection, addDoc } from "firebase/firestore";
import { SelectedClientBooking } from "./ClientBookingDetailModal";

interface ReservationExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: SelectedClientBooking | null;
  userReservations: Reservation[];
  vehicles?: Vehicle[];
  isDarkMode: boolean;
  onExtensionCreated?: (newExtensionId: string) => void;
}

export default function ReservationExtensionModal({
  isOpen,
  onClose,
  booking,
  userReservations,
  vehicles = [],
  isDarkMode,
  onExtensionCreated,
}: ReservationExtensionModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>("10:00");
  const [price, setPrice] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "split">("cash");
  const [cashAmount, setCashAmount] = useState<string>("0");
  const [cardAmount, setCardAmount] = useState<string>("0");
  const [amountPaid, setAmountPaid] = useState<string>("0");
  const [handledBy, setHandledBy] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Find the exact reservation object from userReservations for full metadata
  const originalReservation = useMemo(() => {
    if (!booking) return null;
    return userReservations.find((r) => String(r.id) === String(booking.id)) || null;
  }, [booking, userReservations]);

  // Derive target vehicle ID
  const vehicleId = useMemo(() => {
    if (originalReservation?.vehicleId) return originalReservation.vehicleId;
    if (booking?.vehicleId) return booking.vehicleId;
    const foundVehicle = vehicles.find(
      (v) =>
        v.plate?.trim().toUpperCase() === booking?.plate?.trim().toUpperCase() ||
        v.name?.trim().toUpperCase() === booking?.vehicle?.trim().toUpperCase()
    );
    return foundVehicle ? foundVehicle.id : "";
  }, [originalReservation, booking, vehicles]);

  // Calculate start date of the extension (MUST be locked to the end date of current reservation)
  const extStartDate = useMemo(() => {
    if (!booking) return new Date();
    if (originalReservation?.end) {
      return parseDateSafe(originalReservation.end);
    }
    if (booking.end) {
      return parseDateSafe(booking.end);
    }
    return new Date();
  }, [booking, originalReservation]);

  const startDateFormatted = useMemo(() => {
    try {
      return format(extStartDate, "dd/MM/yyyy");
    } catch {
      return "";
    }
  }, [extStartDate]);

  // Default end date to 1 day after start date when modal opens
  useEffect(() => {
    if (isOpen && extStartDate && !isNaN(extStartDate.getTime())) {
      const defaultEnd = addDays(extStartDate, 1);
      const yyyy = defaultEnd.getFullYear();
      const mm = String(defaultEnd.getMonth() + 1).padStart(2, "0");
      const dd = String(defaultEnd.getDate()).padStart(2, "0");
      setNewEndDate(`${yyyy}-${mm}-${dd}`);
      setPrice("0");
      setAmountPaid("0");
      setCashAmount("0");
      setCardAmount("0");
      setPaymentMethod("cash");
      setSuccessMessage(null);
      setHandledBy(
        booking?.processedBy ||
        originalReservation?.processedBy ||
        auth.currentUser?.displayName ||
        ""
      );
      setDepartureTime(booking?.departureTime || originalReservation?.departureTime || "10:00");
      setNote("");
    }
  }, [isOpen, extStartDate, booking, originalReservation]);

  // Parsed chosen end date
  const parsedEndDate = useMemo(() => {
    if (!newEndDate) return null;
    const [y, m, d] = newEndDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }, [newEndDate]);

  // Extension duration in days
  const extensionDays = useMemo(() => {
    if (!parsedEndDate || isNaN(parsedEndDate.getTime())) return 0;
    const diff = differenceInCalendarDays(startOfDay(parsedEndDate), startOfDay(extStartDate));
    return Math.max(diff, 0);
  }, [parsedEndDate, extStartDate]);

  // Quick day adder helper
  const handleQuickAddDays = (daysToAdd: number) => {
    const calculated = addDays(extStartDate, daysToAdd);
    const yyyy = calculated.getFullYear();
    const mm = String(calculated.getMonth() + 1).padStart(2, "0");
    const dd = String(calculated.getDate()).padStart(2, "0");
    setNewEndDate(`${yyyy}-${mm}-${dd}`);
  };

  // Car Availability Conflict Check (Conflict Prevention)
  const conflictingBooking = useMemo(() => {
    if (!parsedEndDate || !vehicleId || !booking) return null;

    const startCheck = startOfDay(extStartDate);
    const endCheck = startOfDay(parsedEndDate);

    return (
      userReservations.find((res) => {
        // Exclude current original booking
        if (String(res.id) === String(booking.id)) return false;
        // Exclude cancelled bookings
        if (res.status === "CANCELLED") return false;
        // Match vehicle
        if (String(res.vehicleId) !== String(vehicleId)) return false;

        const resStart = startOfDay(parseDateSafe(res.start));
        const resEnd = startOfDay(parseDateSafe(res.end));

        if (isNaN(resStart.getTime()) || isNaN(resEnd.getTime())) return false;

        // Overlap: (resStart < endCheck && resEnd > startCheck)
        return resStart < endCheck && resEnd > startCheck;
      }) || null
    );
  }, [parsedEndDate, vehicleId, booking, extStartDate, userReservations]);

  // Handle price update & auto-sync payment amount
  const handlePriceChange = (val: string) => {
    setPrice(val);
    if (paymentMethod !== "split") {
      setAmountPaid(val);
      if (paymentMethod === "cash") {
        setCashAmount(val);
        setCardAmount("0");
      } else {
        setCardAmount(val);
        setCashAmount("0");
      }
    }
  };

  // Handle payment method change
  const handlePaymentMethodSelect = (method: "cash" | "card" | "split") => {
    setPaymentMethod(method);
    const numPrice = price || "0";
    if (method === "cash") {
      setCashAmount(numPrice);
      setCardAmount("0");
      setAmountPaid(numPrice);
    } else if (method === "card") {
      setCardAmount(numPrice);
      setCashAmount("0");
      setAmountPaid(numPrice);
    } else {
      // Split defaults: split equally
      const half = (Number(numPrice) / 2).toFixed(0);
      const otherHalf = (Number(numPrice) - Number(half)).toString();
      setCashAmount(half);
      setCardAmount(otherHalf);
      setAmountPaid(numPrice);
    }
  };

  // Handle Split Amounts change
  const handleSplitCashChange = (val: string) => {
    setCashAmount(val);
    const c = Number(val) || 0;
    const cr = Number(cardAmount) || 0;
    setAmountPaid(String(c + cr));
  };

  const handleSplitCardChange = (val: string) => {
    setCardAmount(val);
    const c = Number(cashAmount) || 0;
    const cr = Number(val) || 0;
    setAmountPaid(String(c + cr));
  };

  // Save the extension
  const handleSaveExtension = async () => {
    if (!booking || !parsedEndDate || extensionDays <= 0 || Boolean(conflictingBooking)) return;

    setIsSubmitting(true);
    try {
      const newExtensionId = String(Date.now());
      const nowTs = Date.now();

      const numPrice = Number(price) || 0;
      const numPaid = Number(amountPaid) || 0;
      const numCash = paymentMethod === "split" ? (Number(cashAmount) || 0) : (paymentMethod === "cash" ? numPaid : 0);
      const numCard = paymentMethod === "split" ? (Number(cardAmount) || 0) : (paymentMethod === "card" ? numPaid : 0);

      const rawInsurance = booking.insurance || originalReservation?.insurance;
      const cleanInsurance = rawInsurance ? {
        type: rawInsurance.type || "800",
        price: Number(rawInsurance.price) || 0,
        ...(rawInsurance.squares !== undefined ? { squares: rawInsurance.squares } : {}),
        ...(rawInsurance.color !== undefined ? { color: rawInsurance.color } : {}),
        ...(rawInsurance.label !== undefined ? { label: rawInsurance.label } : {}),
        ...(rawInsurance.name !== undefined ? { name: rawInsurance.name } : {}),
      } : null;

      // Create new extension reservation doc in Firestore
      const newReservationData: Partial<Reservation> = {
        id: newExtensionId,
        vehicleId: vehicleId || booking.vehicleId || "",
        name: booking.client || originalReservation?.name || "Client",
        email: booking.email || originalReservation?.email || "",
        phone: booking.phone || originalReservation?.phone || "",
        passportId: booking.passportId || originalReservation?.passportId || "",
        driverLicenseId: booking.driverLicenseId || originalReservation?.driverLicenseId || "",
        secondDriver: booking.secondDriver || originalReservation?.secondDriver || "",
        start: extStartDate,
        end: parsedEndDate,
        days: extensionDays,
        totalPrice: numPrice,
        amountPaid: numPaid,
        status: "UPCOMING", // Explicit user mandate: automatically UPCOMING
        paymentMethod: paymentMethod,
        cashAmount: numCash,
        cardAmount: numCard,
        processedBy: handledBy.trim().toUpperCase(),
        paidTo: "",
        cashflowHandledBy: "",
        fromLocation: originalReservation?.fromLocation || booking.fromLocation || "",
        toLocation: originalReservation?.toLocation || booking.toLocation || "",
        countries: booking.countries || originalReservation?.countries || [],
        ...(cleanInsurance ? { insurance: cleanInsurance } : {}),
        note: note.trim() ? note.trim() : "",
        departureTime: departureTime,
        arrivalTime: booking.arrivalTime || originalReservation?.arrivalTime || "10:00",
        isExtension: true,
        originalReservationId: String(booking.id),
        createdAt: nowTs,
        updatedAt: nowTs,
        ...(booking.clientId ? { clientId: booking.clientId } : originalReservation?.clientId ? { clientId: originalReservation.clientId } : {}),
      };

      // 1. Write the new extension reservation
      await setDoc(doc(db, "reservations", newExtensionId), newReservationData);

      // 2. Add payment record into paymentHistory subcollection so Payment Details immediately displays it
      if (numPaid > 0) {
        const historyRef = collection(db, "reservations", newExtensionId, "paymentHistory");
        if (paymentMethod === "split") {
          if (numCash > 0) {
            await addDoc(historyRef, {
              amount: numCash,
              method: "Cash",
              timestamp: nowTs,
            });
          }
          if (numCard > 0) {
            await addDoc(historyRef, {
              amount: numCard,
              method: "Card",
              timestamp: nowTs,
            });
          }
        } else if (paymentMethod === "card") {
          await addDoc(historyRef, {
            amount: numPaid,
            method: "Card",
            timestamp: nowTs,
          });
        } else {
          // cash
          await addDoc(historyRef, {
            amount: numPaid,
            method: "Cash",
            timestamp: nowTs,
          });
        }
      }

      // 3. Update the original reservation document to link it
      const originalDocRef = doc(db, "reservations", String(booking.id));
      await updateDoc(originalDocRef, {
        hasExtension: true,
        extensionReservationId: newExtensionId,
        extensionReservationIds: arrayUnion(newExtensionId),
        updatedAt: nowTs,
      });

      setSuccessMessage(`Extension created successfully with ID #${newExtensionId}`);
      setTimeout(() => {
        setIsSubmitting(false);
        onExtensionCreated?.(newExtensionId);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Failed to create reservation extension:", err);
      alert(`Failed to save extension: ${err.message || "Unknown error"}`);
      setIsSubmitting(false);
    }
  };

  if (!isMounted || !isOpen || !booking) return null;

  // Min selectable date in YYYY-MM-DD format (must be at least 1 day after extStartDate)
  const minDateStr = (() => {
    const nextDay = addDays(extStartDate, 1);
    const yyyy = nextDay.getFullYear();
    const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
    const dd = String(nextDay.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col z-10",
            isDarkMode ? "bg-[#1A1614] border-purple-500/30 text-white" : "bg-white border-purple-200 text-gray-900"
          )}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-purple-600/10 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-600/20 border border-purple-500/30 text-purple-400 font-black text-[10px] tracking-wider uppercase">
                    Reservation Extension
                  </span>
                  <span className="text-[11px] font-mono opacity-60">#{booking.id}</span>
                </div>
                <h3 className="font-black text-lg sm:text-xl tracking-tight mt-0.5">
                  {booking.client}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer",
                isDarkMode ? "bg-white/5 hover:bg-white/10 text-gray-400" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Overlay */}
          {successMessage && (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-3 bg-purple-600/10 backdrop-blur-md">
              <CheckCircle2 className="w-14 h-14 text-purple-500 animate-bounce" />
              <h4 className="text-lg font-black tracking-tight">{successMessage}</h4>
              <p className="text-xs text-gray-400">Added to Active Bookings as UPCOMING with purple badge.</p>
            </div>
          )}

          {/* Modal Content */}
          {!successMessage && (
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              {/* Vehicle & Current Booking Summary Card */}
              <div
                className={cn(
                  "p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs",
                  isDarkMode ? "bg-black/30 border-white/5" : "bg-purple-50/50 border-purple-100"
                )}
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Vehicle</span>
                  <div className="font-black text-sm mt-0.5">{booking.vehicle?.toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Plate Number</span>
                  <div className="font-mono font-black text-sm mt-0.5 bg-black/20 px-2 py-0.5 rounded border border-white/10 inline-block">
                    {booking.plate}
                  </div>
                </div>
              </div>

              {/* Date Extension Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                    Extension Dates
                  </label>
                  {extensionDays > 0 && (
                    <span className="text-xs font-black text-purple-500 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      +{extensionDays} {extensionDays === 1 ? "Day" : "Days"} Extension
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Start Date: LOCKED to end of original booking */}
                  <div
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-between relative overflow-hidden",
                      isDarkMode ? "bg-black/40 border-white/5 opacity-80" : "bg-gray-100/80 border-gray-200 opacity-90"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Start Date (Locked)
                      </span>
                      <Lock className="w-3 h-3 text-purple-400" />
                    </div>
                    <div className="font-mono font-black text-sm text-purple-400">
                      {startDateFormatted || booking.end}
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1">
                      Automatically continues from original end date
                    </span>
                  </div>

                  {/* New End Date: USER SELECTED ONWARDS */}
                  <div
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-between",
                      isDarkMode ? "bg-black/20 border-purple-500/30" : "bg-white border-purple-300 shadow-sm"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">
                        New End Date *
                      </span>
                      <Calendar className="w-3 h-3 text-purple-500" />
                    </div>
                    <input
                      type="date"
                      min={minDateStr}
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className={cn(
                        "w-full bg-transparent font-mono font-black text-sm outline-none border-b border-purple-500/40 pb-1 focus:border-purple-500 transition-colors",
                        isDarkMode ? "text-white" : "text-black"
                      )}
                    />
                    <div className="flex items-center justify-between mt-1.5 text-[9px] text-gray-400">
                      <span>Select onwards</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <input
                          type="text"
                          value={departureTime}
                          onChange={(e) => setDepartureTime(e.target.value)}
                          placeholder="10:00"
                          className="w-12 bg-transparent text-right outline-none font-mono text-[10px] border-b border-white/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-400 mr-1">Quick add:</span>
                  {[1, 2, 3, 5, 7, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleQuickAddDays(d)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all hover:scale-105 active:scale-95 cursor-pointer border",
                        extensionDays === d
                          ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30"
                          : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-purple-50"
                      )}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Car Availability Alert (Conflict Prevention) */}
              {conflictingBooking && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all",
                    isDarkMode
                      ? "border-red-500/70 bg-red-950/40 text-red-200"
                      : "border-red-300 bg-red-50 text-gray-900 shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className={cn("w-5 h-5 shrink-0 mt-0.5", isDarkMode ? "text-red-400" : "text-red-600")} />
                    <div className="text-xs">
                      <div className={cn("font-black uppercase tracking-wider", isDarkMode ? "text-red-400" : "text-red-700")}>
                        Car Availability Alert (Conflict Detected)
                      </div>
                      <p className={cn("mt-1.5 leading-relaxed text-[12px]", isDarkMode ? "text-gray-200" : "text-gray-900 font-medium")}>
                        This vehicle is already reserved by{" "}
                        <strong className={cn("font-extrabold underline", isDarkMode ? "text-white" : "text-black")}>
                          {conflictingBooking.name}
                        </strong>{" "}
                        from{" "}
                        <strong className={cn("font-extrabold", isDarkMode ? "text-white" : "text-black")}>
                          {format(parseDateSafe(conflictingBooking.start), "dd/MM/yyyy")}
                        </strong>{" "}
                        to{" "}
                        <strong className={cn("font-extrabold", isDarkMode ? "text-white" : "text-black")}>
                          {format(parseDateSafe(conflictingBooking.end), "dd/MM/yyyy")}
                        </strong>{" "}
                        (Status:{" "}
                        <span className={cn("font-black", isDarkMode ? "text-red-300" : "text-red-700")}>
                          {conflictingBooking.status}
                        </span>).
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Pricing & Cash/Card Split Section */}
              <div className="space-y-3 pt-1">
                <label className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                  Extension Price & Payment
                </label>

                {/* Price input - STARTS AT 0 */}
                <div
                  className={cn(
                    "p-3 rounded-2xl border flex items-center justify-between gap-3",
                    isDarkMode ? "bg-black/20 border-white/10" : "bg-white border-gray-200 shadow-sm"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Extension Price (€)
                    </span>
                    <span className="text-[9px] text-purple-400 font-bold">Starts at €0 (enter amount)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-lg font-black text-purple-500">€</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={price}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className={cn(
                        "w-28 text-right font-mono text-xl font-black bg-transparent outline-none border-b-2 border-purple-500/40 focus:border-purple-500 transition-colors",
                        isDarkMode ? "text-white" : "text-black"
                      )}
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card", "split"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handlePaymentMethodSelect(method)}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border cursor-pointer",
                        paymentMethod === method
                          ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30"
                          : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {method === "cash" && <Banknote className="w-3.5 h-3.5" />}
                      {method === "card" && <CreditCard className="w-3.5 h-3.5" />}
                      {method === "split" && <DollarSign className="w-3.5 h-3.5" />}
                      <span>{method}</span>
                    </button>
                  ))}
                </div>

                {/* Split inputs if SPLIT is selected */}
                {paymentMethod === "split" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="grid grid-cols-2 gap-3 p-3 rounded-2xl border border-purple-500/20 bg-purple-500/5"
                  >
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Cash Portion (€)
                      </span>
                      <div className="flex items-center gap-1 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10">
                        <span className="text-xs font-mono text-purple-400 font-bold">€</span>
                        <input
                          type="number"
                          min="0"
                          value={cashAmount}
                          onChange={(e) => handleSplitCashChange(e.target.value)}
                          className="w-full bg-transparent font-mono text-sm font-black outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Card Portion (€)
                      </span>
                      <div className="flex items-center gap-1 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10">
                        <span className="text-xs font-mono text-purple-400 font-bold">€</span>
                        <input
                          type="number"
                          min="0"
                          value={cardAmount}
                          onChange={(e) => handleSplitCardChange(e.target.value)}
                          className="w-full bg-transparent font-mono text-sm font-black outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Handled By / Processed By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-between",
                      isDarkMode ? "bg-black/20 border-white/10" : "bg-white border-gray-200"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      Processed By
                    </span>
                    <input
                      type="text"
                      placeholder="Teammate name"
                      value={handledBy}
                      onChange={(e) => setHandledBy(e.target.value)}
                      className={cn(
                        "w-full bg-transparent font-black text-xs uppercase outline-none border-b border-white/10 pb-1 focus:border-purple-500",
                        isDarkMode ? "text-white" : "text-black"
                      )}
                    />
                  </div>

                  <div
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col justify-between",
                      isDarkMode ? "bg-black/20 border-white/10" : "bg-white border-gray-200"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      Extension Note (Optional)
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Flight delayed, client called"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={cn(
                        "w-full bg-transparent text-xs outline-none border-b border-white/10 pb-1 focus:border-purple-500",
                        isDarkMode ? "text-white" : "text-black"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          {!successMessage && (
            <div className="p-4 sm:p-5 border-t border-purple-500/20 bg-black/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                  isDarkMode ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveExtension}
                disabled={isSubmitting || extensionDays <= 0 || !parsedEndDate || Boolean(conflictingBooking)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg",
                  conflictingBooking
                    ? isDarkMode
                      ? "bg-zinc-800 text-zinc-500 border border-zinc-700/60 cursor-not-allowed shadow-none"
                      : "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none"
                    : extensionDays <= 0
                    ? "bg-purple-900/40 text-purple-300/40 cursor-not-allowed border border-purple-800/30"
                    : "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-600/30 hover:scale-[1.02] active:scale-95 cursor-pointer"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Extension...</span>
                  </>
                ) : conflictingBooking ? (
                  <>
                    <AlertTriangle className={cn("w-4 h-4", isDarkMode ? "text-red-400" : "text-red-500")} />
                    <span>Car Unavailable (Conflict)</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4" />
                    <span>Save Extension</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
