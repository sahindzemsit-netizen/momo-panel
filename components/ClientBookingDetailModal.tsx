'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { COUNTRY_COLORS } from '@/lib/constants';
import { Reservation, Vehicle } from '@/types';
import ReservationExtensionModal from './ReservationExtensionModal';
import {
  Plus,
  Loader2,
  Check,
  X,
  Pencil,
  Trash2,
  FileDown,
  Printer,
  CalendarPlus,
  Phone,
  Mail,
  Contact,
  CreditCard,
  Car,
  CarFront,
  FileText,
  BookOpen,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Flag
} from 'lucide-react';

export interface SelectedClientBooking {
  id: string;
  client: string;
  secondDriver?: string;
  email?: string;
  phone?: string;
  vehicleCountry?: string;
  vehicle: string;
  plate: string;
  chassisNumber?: string;
  passportId?: string;
  driverLicenseId?: string;
  start: string;
  end: string;
  days: string | number;
  price: string | number;
  status: string;
  statusColor?: string;
  processedBy?: string;
  fromLocation?: string;
  toLocation?: string;
  countries?: string[];
  note?: string;
  wasActive?: boolean;
  carColor?: string;
  arrivalTime?: string;
  departureTime?: string;
  insurance?: {
    type: '800' | '2000' | '5000' | 'full' | string;
    price: number;
    squares?: number;
    color?: string;
    label?: string;
    name?: string;
  };
  vehicleId?: string | number;
  clientId?: string;
  isExtension?: boolean;
  hasExtension?: boolean;
  originalReservationId?: string;
  extensionReservationId?: string;
}

export interface ClientBookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: SelectedClientBooking | null;
  isDarkMode: boolean;
  userReservations?: Reservation[];
  vehicles?: Vehicle[];
  onOpenInvoice?: (booking: SelectedClientBooking) => void;
  onExtensionCreated?: (newExtensionId: string) => void;
}

const getAvatarColor = (name: string) => {
  if (!name) return "bg-gray-400";
  
  const colors = [
    "bg-[#FF5C35]", // Original orange
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

export const ClientBookingDetailModal: React.FC<ClientBookingDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  isDarkMode,
  userReservations = [],
  vehicles = [],
  onOpenInvoice,
  onExtensionCreated,
}) => {
  const [selectedSeal, setSelectedSeal] = useState<'momo' | 'skp' | 'go' | 'ks' | 'alb' | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  // Second driver state for active bookings client details popup
  const [isEditingSecondDriver, setIsEditingSecondDriver] = useState(false);
  const [secondDriverInput, setSecondDriverInput] = useState('');
  const [isSavingSecondDriver, setIsSavingSecondDriver] = useState(false);
  const [localSecondDriver, setLocalSecondDriver] = useState<string | undefined>(undefined);

  // Reset selected seal and second driver edit state when modal is closed or selection changes
  useEffect(() => {
    setSelectedSeal(null);
    setIsEditingSecondDriver(false);
    setSecondDriverInput('');
    setLocalSecondDriver(undefined);
  }, [booking?.id, isOpen]);

  const activeReservationSecondDriver = useMemo(() => {
    if (!booking) return '';
    if (localSecondDriver !== undefined) return localSecondDriver;
    const orig = userReservations.find(r => String(r.id) === String(booking.id));
    return (booking.secondDriver !== undefined ? booking.secondDriver : orig?.secondDriver) || '';
  }, [booking, userReservations, localSecondDriver]);

  const handleSaveSecondDriver = async () => {
    if (!booking) return;
    const trimmed = secondDriverInput.trim();
    setIsSavingSecondDriver(true);
    try {
      const resRef = doc(db, 'reservations', String(booking.id));
      await updateDoc(resRef, {
        secondDriver: trimmed,
        updatedAt: Date.now()
      });
      setLocalSecondDriver(trimmed);
      setIsEditingSecondDriver(false);
    } catch (err) {
      console.error('Error saving second driver:', err);
    } finally {
      setIsSavingSecondDriver(false);
    }
  };

  const handleRemoveSecondDriver = async () => {
    if (!booking) return;
    setIsSavingSecondDriver(true);
    try {
      const resRef = doc(db, 'reservations', String(booking.id));
      await updateDoc(resRef, {
        secondDriver: '',
        updatedAt: Date.now()
      });
      setLocalSecondDriver('');
      setIsEditingSecondDriver(false);
      setSecondDriverInput('');
    } catch (err) {
      console.error('Error removing second driver:', err);
    } finally {
      setIsSavingSecondDriver(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!booking) return;
    const element = document.getElementById('booking-print-card');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: isDarkMode ? '#1A1614' : '#F2EFE9',
        ignoreElements: (el) => {
          return el.classList.contains('no-print') || el.tagName === 'BUTTON';
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const pdfWidth = 210;
      const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      const sanitizedClientName = booking.client.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Reservation_${sanitizedClientName}_${booking.id}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
    <AnimatePresence>
      {isOpen && booking && (
        <div id="booking-print-overlay" className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md no-print"
          />
          
          {/* On-screen Modal Card */}
          <motion.div
            id="booking-print-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full rounded-[32px] shadow-2xl overflow-hidden border print-card-container w-full max-w-[750px]",
              isDarkMode ? "bg-[#1A1614] border-white/10" : "bg-[#F2EFE9] border-black/10"
            )}
          >
            {/* Header Section */}
            <div className={cn(
              "px-8 py-3 border-b flex items-center justify-between mt-[70px] min-h-[90px] h-auto",
              isDarkMode ? "border-white/5" : "border-black/5"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md shrink-0",
                  getAvatarColor(booking.client)
                )}>
                  {booking.client.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div className="flex flex-col items-start justify-center gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className={cn("text-2xl font-black tracking-tight leading-none", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                      {booking.client}
                    </h2>
                    {!activeReservationSecondDriver && !isEditingSecondDriver && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSecondDriverInput('');
                          setIsEditingSecondDriver(true);
                        }}
                        className="w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-sm hover:scale-110 active:scale-95 no-print cursor-pointer shrink-0"
                        title="Add Second Driver"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    )}
                  </div>

                  {/* Second driver controls: displayed underneath the first driver name in black */}
                  {isEditingSecondDriver ? (
                    <div className="flex items-center gap-1.5 no-print mt-0.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={secondDriverInput}
                        onChange={(e) => setSecondDriverInput(e.target.value)}
                        placeholder="Second driver..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveSecondDriver();
                          if (e.key === 'Escape') setIsEditingSecondDriver(false);
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-lg border outline-none uppercase transition-all min-w-[150px] max-w-[220px]",
                          isDarkMode 
                            ? "bg-[#0E0C0B] border-white/20 text-white placeholder:text-gray-500 focus:border-white/40 focus:ring-1 focus:ring-white/40" 
                            : "bg-white border-black/20 text-[#0E0C0B] placeholder:text-gray-400 focus:border-black/50 focus:ring-1 focus:ring-black/20"
                        )}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveSecondDriver}
                        disabled={isSavingSecondDriver}
                        className="w-6 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                        title="Save Second Driver"
                      >
                        {isSavingSecondDriver ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingSecondDriver(false)}
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0",
                          isDarkMode ? "bg-white/10 hover:bg-white/20 text-gray-300" : "bg-black/10 hover:bg-black/20 text-gray-600"
                        )}
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : activeReservationSecondDriver ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-base font-black uppercase tracking-tight leading-tight",
                        isDarkMode ? "text-white" : "text-[#0E0C0B]"
                      )}>
                        2nd Driver: {activeReservationSecondDriver}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSecondDriverInput(activeReservationSecondDriver);
                          setIsEditingSecondDriver(true);
                        }}
                        className="w-5 h-5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:hover:text-white flex items-center justify-center transition-all no-print cursor-pointer"
                        title="Edit Second Driver"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSecondDriver();
                        }}
                        className="w-5 h-5 rounded-md hover:bg-red-500/10 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all no-print cursor-pointer"
                        title="Remove Second Driver"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 no-print">
                {/* Seal Choice Buttons: Square, MOMO (orange), SKP (blue), GO (yellow), KS (black) and ALB (red) */}
                <div className="flex items-center gap-2">
                  {/* Plus icon to open Client Invoice */}
                  <button
                    onClick={() => {
                      if (onOpenInvoice && booking) {
                        const orig = userReservations.find(r => String(r.id) === String(booking.id));
                        onOpenInvoice({
                          ...booking,
                          insurance: orig?.insurance || booking.insurance
                        });
                      }
                      onClose();
                    }}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all border",
                      isDarkMode 
                        ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" 
                        : "bg-white hover:bg-neutral-100 border-black/10 text-[#0E0C0B]"
                    )}
                    title="Open Client Invoice / Factura"
                  >
                    <Plus className="w-5 h-5 text-[#FF5C35]" />
                  </button>
                  <button
                    onClick={() => setSelectedSeal(selectedSeal === 'momo' ? null : 'momo')}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                      selectedSeal === 'momo'
                        ? "bg-[#ff5c35] text-white ring-4 ring-orange-300 scale-105"
                        : "bg-[#ff5c35] hover:bg-[#ff6c45] text-white opacity-80 hover:opacity-100"
                    )}
                    title="Click to apply MOMO stamp/seal"
                  >
                    MOMO
                  </button>
                  <button
                    onClick={() => setSelectedSeal(selectedSeal === 'skp' ? null : 'skp')}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                      selectedSeal === 'skp'
                        ? "bg-blue-600 text-white ring-4 ring-blue-300 scale-105"
                        : "bg-blue-500 hover:bg-blue-600 text-white opacity-80 hover:opacity-100"
                    )}
                    title="Click to apply SKP stamp/seal"
                  >
                    SKP
                  </button>
                  <button
                    onClick={() => setSelectedSeal(selectedSeal === 'go' ? null : 'go')}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                      selectedSeal === 'go'
                        ? "bg-yellow-400 text-zinc-900 ring-4 ring-yellow-200 scale-105"
                        : "bg-yellow-400 hover:bg-yellow-500 text-zinc-900 opacity-80 hover:opacity-100"
                    )}
                    title="Click to apply GO stamp/seal"
                  >
                    GO
                  </button>
                  <button
                    onClick={() => setSelectedSeal(selectedSeal === 'ks' ? null : 'ks')}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                      selectedSeal === 'ks'
                        ? "bg-black text-white ring-4 ring-neutral-400 scale-105"
                        : "bg-black hover:bg-neutral-900 text-white opacity-80 hover:opacity-100"
                    )}
                    title="Click to apply KS stamp/seal"
                  >
                    KS
                  </button>
                  <button
                    onClick={() => setSelectedSeal(selectedSeal === 'alb' ? null : 'alb')}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm active:scale-95 cursor-pointer tracking-wider transition-all",
                      selectedSeal === 'alb'
                        ? "bg-red-600 text-white ring-4 ring-red-300 scale-105"
                        : "bg-red-600 hover:bg-red-700 text-white opacity-80 hover:opacity-100"
                    )}
                    title="Click to apply ALB stamp/seal"
                  >
                    ALB
                  </button>
                </div>

                {/* Process / Close Actions */}
                <div className="flex items-center gap-2">
                  {/* Purple Reservation Extension Button */}
                  <button 
                    onClick={() => setIsExtensionModalOpen(true)}
                    className={cn(
                      "px-4 h-10 rounded-2xl flex items-center gap-2 transition-all hover:scale-110 active:scale-95 text-white font-black text-xs uppercase cursor-pointer shadow-md",
                      "bg-purple-600 hover:bg-purple-700 active:bg-purple-800"
                    )}
                    title="Extend this reservation (Starts at current end date)"
                  >
                    <CalendarPlus className="w-4 h-4 text-white" />
                    <span>Extend</span>
                  </button>

                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPDF}
                    className={cn(
                      "px-4 h-10 rounded-2xl flex items-center gap-2 transition-all hover:scale-110 active:scale-95 text-[#FF5C35] font-black text-xs uppercase cursor-pointer disabled:opacity-50",
                      isDarkMode ? "bg-[#FF5C35]/15 hover:bg-[#FF5C35]/25" : "bg-[#FF5C35]/10 hover:bg-[#FF5C35]/20"
                    )}
                    title="Download PDF"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                    ) : (
                      <FileDown className="w-4 h-4 text-[#FF5C35]" />
                    )}
                    <span>{isGeneratingPDF ? 'Generating...' : 'PDF'}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.print(); }}
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-[#FF5C35]",
                      isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"
                    )}
                    title="Print Booking Card"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={onClose}
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                      isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                    )}
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-8 space-y-6 h-[686.4px] mt-0 ml-0 mr-0 mb-[20px]">
              {/* Info Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-[-30px]">
                {/* Column 1: Client Contact Card */}
                <div className={cn(
                  "p-6 rounded-2xl border space-y-4 mt-0",
                  isDarkMode ? "bg-white/5 border-white/5" : "bg-[#fdf0e1]/60 border-orange-100"
                )}>
                  <h3 className="text-xs font-black text-[#FF5C35] tracking-widest uppercase">Client Information</h3>
                  <div className="space-y-3" style={{ width: '275px' }}>
                    {booking.phone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-[#FF5C35] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                            {booking.phone}
                          </span>
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Phone</span>
                        </div>
                      </div>
                    )}
                    {booking.email && (
                      <div className="flex items-center gap-2.5" style={{ width: '280px' }}>
                        <Mail className="w-4 h-4 text-[#FF5C35] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                            {booking.email}
                          </span>
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Email</span>
                        </div>
                      </div>
                    )}
                    {booking.driverLicenseId && (
                      <div className="flex items-center gap-2.5">
                        <Contact className="w-4 h-4 text-[#FF5C35] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span 
                            className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}
                            style={{ fontFamily: 'Verdana, sans-serif' }}
                          >
                            {booking.driverLicenseId}
                          </span>
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">License ID</span>
                        </div>
                      </div>
                    )}
                    {booking.passportId && (
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="w-4 h-4 text-[#FF5C35] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                            {booking.passportId}
                          </span>
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Passport ID</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Booking Details Card */}
                <div className={cn(
                  "p-6 rounded-2xl border space-y-4",
                  isDarkMode ? "bg-white/5 border-white/5" : "bg-black/[0.02] border-black/5"
                )}>
                  <h3 className="text-xs font-black text-[#FF5C35] tracking-widest uppercase">Rental Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-2.5">
                      <Car className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                      <div className="flex flex-col min-w-0">
                        <span className={cn("text-xs font-bold truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                          {booking.vehicle}
                        </span>
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">Vehicle</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <CarFront className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                      <div className="flex flex-col min-w-0">
                        <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2.5 py-1 shadow-md h-7 shrink-0 text-black hover:scale-105 transition-transform">
                          <div className="bg-[#1565C0] w-[4px] h-4 rounded-[1px] -ml-2.5 mr-1.5" />
                          <span className="font-mono font-black text-xs md:text-sm tracking-widest uppercase leading-none select-all">
                            {booking.plate}
                          </span>
                        </div>
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-1">License Plate</span>
                      </div>
                    </div>

                    {booking.chassisNumber && (
                      <div className="flex items-start gap-2.5">
                        <FileText className={cn("w-4 h-4 mt-1.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                        <div className="flex flex-col min-w-0">
                          <div className={cn(
                            "relative h-8 rounded-full flex items-center px-4 overflow-hidden border transition-all",
                            isDarkMode 
                              ? "bg-[#0E0C0B] border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]" 
                              : "bg-[#E3DFD5] border-black/5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.15)]"
                          )}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5C35] shadow-[0_0_6px_rgba(255,92,53,0.8),0_0_12px_rgba(255,92,53,0.5)] shrink-0" />
                              <span className={cn(
                                "text-[10px] font-mono font-black tracking-[0.15em] truncate select-all",
                                isDarkMode ? "text-white" : "text-[#0e0c0b]"
                              )}>
                                {booking.chassisNumber}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-1">VIN Number</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <BookOpen className={cn("w-4 h-4 mt-0.5 text-[#FF5C35] shrink-0", isDarkMode ? "text-white" : "text-[#FF5C35]")} />
                      <div className="flex flex-col min-w-0">
                        <p className={cn("font-bold text-xs truncate", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                          {booking.start} — {booking.end}
                        </p>
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mt-0.5">
                          Period ({booking.days} Days)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing and Arrival Section */}
              {(() => {
                const clientBookingInsurance = booking.insurance || userReservations.find(r => String(r.id) === String(booking.id))?.insurance;
                const hasInsurance = !!clientBookingInsurance;
                const insType = String(clientBookingInsurance?.type || '').toLowerCase();
                const insLabel = String(clientBookingInsurance?.label || '').toLowerCase();
                const insName = String((clientBookingInsurance as any)?.name || '').toLowerCase();
                const isFullInsur = insType === 'full' || insType === 'full_insurance' || insLabel.includes('full') || insName.includes('full');

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-[-20px] h-[115px]">
                    {/* Left: Price and Insurance or Arrival details */}
                    {hasInsurance ? (
                      <div className="flex flex-col gap-1.5 h-full">
                        {/* Top: Total Cost (Dominant, clear primary focus) */}
                        <div className={cn(
                          "px-4 py-2 rounded-2xl border flex flex-col items-center justify-center flex-1 transition-all",
                          isDarkMode ? "bg-white/5 border-white/5" : "bg-emerald-500/5 border-emerald-500/10"
                        )}>
                          <span className="text-[9px] font-black text-[#FF5C35] tracking-widest uppercase mb-0.5 leading-none">Total Cost</span>
                          <p className={cn("text-xl font-black leading-tight", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                            {booking.price}
                          </p>
                          {(booking.arrivalTime || booking.departureTime) && (
                            <div className="flex items-center gap-2 text-[8px] mt-0.5 opacity-80">
                              {booking.arrivalTime && (
                                <span className="font-mono font-bold text-[#FF5C35]">Arr: {booking.arrivalTime}</span>
                              )}
                              {booking.arrivalTime && booking.departureTime && <span>•</span>}
                              {booking.departureTime && (
                                <span className="font-mono font-bold text-blue-500">Dep: {booking.departureTime}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom: Insurance Details (Compact, non-intimidating slim bar) */}
                        {isFullInsur ? (
                          <div className={cn(
                            "px-3 rounded-xl border flex items-center justify-between h-[28px] shrink-0 transition-all",
                            isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          )}>
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="text-[8px] font-bold uppercase tracking-wider">Insurance</span>
                            </div>
                            <span className="text-[10px] font-black uppercase">
                              Full Insurance
                            </span>
                          </div>
                        ) : (
                          <div className={cn(
                            "px-3 rounded-xl border flex items-center justify-between h-[28px] shrink-0 transition-all",
                            isDarkMode ? "bg-white/[0.04] border-white/5" : "bg-neutral-500/[0.04] border-neutral-200"
                          )}>
                            <div className="flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {Array.from({ length: clientBookingInsurance?.squares || (insType === '800' ? 1 : 2) }).map((_, i) => (
                                  <div 
                                    key={i} 
                                    className="w-2 h-2 rounded-[1px]" 
                                    style={{ backgroundColor: clientBookingInsurance?.color || '#F97316' }} 
                                  />
                                ))}
                              </div>
                              <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
                                Franchise Insurance
                              </span>
                            </div>
                            <span className={cn("text-[11px] font-black", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                              {clientBookingInsurance?.label || (clientBookingInsurance?.price ? `€ ${clientBookingInsurance.price.toLocaleString('de-DE')}` : (insType === '800' ? '€ 800' : '€ 2.000'))}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Full Height Total Cost when no insurance */
                      <div className={cn(
                        "p-5 rounded-2xl border flex flex-col justify-between h-full",
                        isDarkMode ? "bg-white/5 border-white/5" : "bg-emerald-500/5 border-emerald-500/10"
                      )}>
                        <div className="flex-grow flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase mb-1">Total Cost</span>
                          <p className={cn("text-2xl font-black", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>
                            {booking.price}
                          </p>
                        </div>
                        
                        {(booking.arrivalTime || booking.departureTime) && (
                          <div className="mt-2 pt-1.5 border-t border-dashed border-emerald-500/20 flex flex-col gap-0.5 text-[10px]">
                            {booking.arrivalTime && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 uppercase tracking-wider text-[8px] font-bold">Arrival:</span>
                                <span className="font-mono font-black text-[#FF5C35]">{booking.arrivalTime}</span>
                              </div>
                            )}
                            {booking.departureTime && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 uppercase tracking-wider text-[8px] font-bold">Departure:</span>
                                <span className="font-mono font-black text-blue-500">{booking.departureTime}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Right: From / To */}
                    <div className={cn(
                      "p-5 rounded-2xl border flex flex-col justify-center space-y-3 mr-0 h-full",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-black/[0.02] border-black/5"
                    )}>
                      {/* FROM (top) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-500">
                          <ArrowUpRight className="w-5 h-5 shrink-0" />
                          <span className="text-[10px] font-black tracking-widest uppercase">From</span>
                        </div>
                        <p className={cn("text-xs font-black uppercase text-right truncate max-w-[150px]", isDarkMode ? "text-white" : "text-black")}>
                          {booking.fromLocation || 'N/A'}
                        </p>
                      </div>
                      
                      <div className={cn("border-t border-dashed", isDarkMode ? "border-white/10" : "border-black/5")} />

                      {/* TO (below) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-500">
                          <ArrowDownRight className="w-5 h-5 shrink-0" />
                          <span className="text-[10px] font-black tracking-widest uppercase">To</span>
                        </div>
                        <p className={cn("text-xs font-black uppercase text-right truncate max-w-[150px]", isDarkMode ? "text-white" : "text-black")}>
                          {booking.toLocation || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Countries Section */}
              <div className="space-y-3 mt-[-20px]">
                <div className="flex items-center gap-2">
                   <Flag className="w-4 h-4 text-[#FF5C35]" style={{ marginTop: '40px' }} />
                   <span className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase mt-[40px]" style={{ marginTop: '40px' }}>Authorized Countries</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {booking.countries && booking.countries.length > 0 ? (
                    booking.countries.map((c: string) => (
                      <div 
                        key={c}
                        style={{ 
                          backgroundColor: `${COUNTRY_COLORS[c]}20`,
                          border: `1px solid ${COUNTRY_COLORS[c]}40`,
                          color: COUNTRY_COLORS[c]
                        }}
                        className="px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COUNTRY_COLORS[c] }} />
                        <span className="text-xs font-black tracking-widest uppercase">{c}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs font-bold text-gray-500/40 italic uppercase tracking-widest bg-gray-500/5 px-4 py-2 rounded-xl">
                      No countries specified
                    </div>
                  )}
                </div>
              </div>

              {/* Agreement Terms Section */}
              <div className="space-y-1.5 mt-[-10px] shrink-0 relative w-full">
                <h4 className={cn(
                  "text-[9px] font-black uppercase tracking-widest leading-none",
                  isDarkMode ? "text-[#FF5C35]/85" : "text-[#FF5C35]"
                )}>
                  Agreement Terms
                </h4>
                <p className={cn(
                  "text-[10px] leading-relaxed text-justify font-medium",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {"By signing this agreement, I confirm that I have read and accepted all terms herein, authorize payment by credit or charge card for all amounts due, and remain personally liable until full settlement. Damage to the underside, oil sump, windows, and any loss or theft are excluded from SCDW coverage and remain the driver's responsibility. In the event of an accident, a valid police report is mandatory under applicable law; failure to provide one results in full liability. The vehicle is equipped with a GPS tracking device for security, fleet management, and theft recovery in compliance with data protection regulations. All traffic violations and fines, including those issued by safety cameras in North Macedonia and other countries traveled, are the sole responsibility of the driver. Any complaints must be reported before the end of the rental period."}
                </p>

                {/* Dynamic Seal / Stamp */}
                {selectedSeal && (
                  <div className="absolute right-6 bottom-[-80px] z-10 w-36 h-36 pointer-events-none hover:scale-105 transition-all">
                    <Image
                      src={
                        selectedSeal === 'momo'
                          ? '/seal/momo.png'
                          : selectedSeal === 'skp'
                            ? '/seal/skp.png'
                            : selectedSeal === 'go'
                              ? '/seal/go.png'
                              : selectedSeal === 'ks'
                                ? '/seal/ks.png'
                                : '/seal/alb.png'
                      }
                      alt={`${selectedSeal.toUpperCase()} Seal`}
                      width={144}
                      height={144}
                      className="object-contain animate-fade-in"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              {/* Row 4: Empty space for now */}
              <div className="h-10 shrink-0 select-none pb-4" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Reservation Extension Modal */}
    <ReservationExtensionModal
      isOpen={isExtensionModalOpen}
      onClose={() => setIsExtensionModalOpen(false)}
      booking={booking}
      userReservations={userReservations}
      vehicles={vehicles}
      isDarkMode={isDarkMode}
      onExtensionCreated={(newExtensionId) => {
        setIsExtensionModalOpen(false);
        onExtensionCreated?.(newExtensionId);
      }}
    />
    </>,
    document.body
  );
};

export default ClientBookingDetailModal;
