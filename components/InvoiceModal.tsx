'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { 
  X, 
  Printer, 
  FileDown, 
  Loader2, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Contact, 
  Car, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Receipt,
  FileCheck2,
  Sparkles
} from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    client: string;
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
    status?: string;
    fromLocation?: string;
    toLocation?: string;
    countries?: string[];
    insurance?: {
      type: '800' | '2000' | '5000';
      price: number;
      squares: number;
      color: string;
    };
    note?: string;
  } | null;
  isDarkMode: boolean;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  booking,
  isDarkMode
}) => {
  const [selectedSeal, setSelectedSeal] = useState<'bih' | 'momo' | 'skp' | 'go' | 'ks' | 'alb' | null>('momo');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Editable company / client billing details (saved in state for live edits)
  const [companyName, setCompanyName] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('Payment settled in full for vehicle rental service. Thank you for choosing our rental company.');

  // Set default values whenever a new booking is opened
  useEffect(() => {
    if (booking) {
      setInvoiceNumber(`INV-${String(booking.id).padStart(6, '0')}`);
      setInvoiceDate(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      setSelectedSeal('momo');
    }
  }, [booking]);

  if (!isOpen || !booking || typeof document === 'undefined') return null;

  const numDays = Number(booking.days) || 1;
  const totalPrice = typeof booking.price === 'number' 
    ? booking.price 
    : Number(String(booking.price || '0').replace(/[^0-9.]/g, '')) || 0;
  
  const dailyRate = (totalPrice / numDays).toFixed(2);
  const vatRate = 18; // standard VAT percentage
  const netSubtotal = (totalPrice / (1 + vatRate / 100)).toFixed(2);
  const vatAmount = (totalPrice - Number(netSubtotal)).toFixed(2);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // 1. Pre-gather all CSS rules synchronously/asynchronously BEFORE html2canvas runs
      let allCssRules = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules && sheet.cssRules.length > 0) {
            for (const rule of Array.from(sheet.cssRules)) {
              allCssRules += rule.cssText + '\n';
            }
          }
        } catch (e) {
          if (sheet.href) {
            try {
              const res = await fetch(sheet.href);
              if (res.ok) {
                allCssRules += (await res.text()) + '\n';
              }
            } catch (err) {
              console.warn('Failed to fetch stylesheet:', sheet.href, err);
            }
          }
        }
      }

      document.querySelectorAll('style').forEach((s) => {
        if (s.textContent) {
          allCssRules += s.textContent + '\n';
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 60));

      const targetElement = document.getElementById('invoice-print-card');
      if (!targetElement) {
        throw new Error('Target element invoice-print-card not found');
      }

      const canvas = await html2canvas(targetElement, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        windowWidth: 1200,
        windowHeight: 1600,
        ignoreElements: (el) => {
          if (el.id === 'invoice-print-card') return false;
          try {
            return (el.classList && el.classList.contains('no-print')) || el.tagName === 'BUTTON';
          } catch {
            return false;
          }
        },
        onclone: (clonedDoc) => {
          try {
            const base = clonedDoc.createElement('base');
            base.href = window.location.origin;
            clonedDoc.head.appendChild(base);

            const styleEl = clonedDoc.createElement('style');
            styleEl.textContent = allCssRules;
            clonedDoc.head.appendChild(styleEl);

            if (document.documentElement.className) {
              clonedDoc.documentElement.className = document.documentElement.className;
            }
            if (document.body.className) {
              clonedDoc.body.className = document.body.className;
            }
            if (clonedDoc.documentElement) {
              clonedDoc.documentElement.style.width = '1200px';
              clonedDoc.documentElement.style.minWidth = '1200px';
            }
            if (clonedDoc.body) {
              clonedDoc.body.style.width = '1200px';
              clonedDoc.body.style.minWidth = '1200px';
              clonedDoc.body.style.backgroundColor = '#FFFFFF';
              clonedDoc.body.style.margin = '0';
              clonedDoc.body.style.padding = '0';
            }

            const clonedCard = clonedDoc.getElementById('invoice-print-card');
            if (clonedCard) {
              clonedCard.style.transform = 'none';
              clonedCard.style.margin = '0 auto';
              clonedCard.style.boxShadow = 'none';
              clonedCard.style.width = '800px';
              clonedCard.style.minWidth = '800px';
              clonedCard.style.maxWidth = '800px';
              clonedCard.style.padding = '32px 40px';

              // Hide mobile view and show desktop table on PDF
              clonedCard.querySelectorAll('.invoice-card-mobile').forEach((el) => {
                (el as HTMLElement).style.display = 'none';
              });
              clonedCard.querySelectorAll('.invoice-table-desktop').forEach((el) => {
                (el as HTMLElement).style.display = 'block';
              });

              // Ensure top header is horizontal on PDF
              const topHeader = clonedCard.querySelector('div[class*="border-b-2"]') as HTMLElement;
              if (topHeader) {
                topHeader.style.display = 'flex';
                topHeader.style.flexDirection = 'row';
                topHeader.style.justifyContent = 'space-between';
                topHeader.style.alignItems = 'flex-start';
              }

              // Ensure grids display in desktop 2 columns
              const twoColGrids = clonedCard.querySelectorAll('div[class*="grid-cols-1 md:grid-cols-2"]');
              twoColGrids.forEach((g) => {
                const el = g as HTMLElement;
                el.style.display = 'grid';
                el.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
                el.style.gap = '16px';
                el.style.width = '100%';
              });

              // Signatures line widths
              clonedCard.querySelectorAll('.invoice-sig-line').forEach((el) => {
                (el as HTMLElement).style.width = '192px';
              });
            }
          } catch (e) {
            console.warn('onclone error in invoice:', e);
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const pdfWidth = 210;
      const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      const sanitizedClientName = booking.client.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Invoice_${sanitizedClientName}_${booking.id}.pdf`);
    } catch (err) {
      console.error('Error generating invoice PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  };

  return createPortal(
    <AnimatePresence>
      <div 
        id="invoice-print-overlay" 
        className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 no-print"
        />

        {/* Invoice Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative z-10 w-full max-w-[850px] my-auto flex flex-col min-w-0"
        >
          {/* Header Action Bar (Excluded from PDF / Print) */}
          <div className={cn(
            "w-full rounded-2xl mb-2 sm:mb-3 px-3 sm:px-5 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xl border no-print",
            isDarkMode 
              ? "bg-[#1E1B1A] border-white/10 text-white" 
              : "bg-white border-neutral-200 text-neutral-900"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#FF5C35]/15 text-[#FF5C35] flex items-center justify-center font-black shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider leading-none truncate">
                  Client Invoice / Factura
                </h3>
                <span className="text-[10px] font-bold opacity-60 font-mono truncate block mt-0.5">
                  {booking.client} • {booking.vehicle} ({booking.plate})
                </span>
              </div>
            </div>

            {/* Seal Selection & Action Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {/* Seals selector */}
              <div className="flex items-center gap-1 sm:gap-1.5 mr-1 sm:mr-2 pr-1 sm:pr-2 border-r border-neutral-300 dark:border-neutral-700 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-wider opacity-60 mr-1 hidden md:inline-block">
                  Stamp:
                </span>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'bih' ? null : 'bih')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'bih'
                      ? "bg-purple-600 text-white ring-2 ring-purple-300 scale-105"
                      : "bg-purple-600 hover:bg-purple-700 text-white opacity-85 hover:opacity-100"
                  )}
                  title="Apply BIH seal stamp"
                >
                  BIH
                </button>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'momo' ? null : 'momo')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'momo'
                      ? "bg-[#ff5c35] text-white ring-2 ring-orange-300 scale-105"
                      : "bg-[#ff5c35]/80 hover:bg-[#ff5c35] text-white"
                  )}
                  title="Apply MOMO seal stamp"
                >
                  MOMO
                </button>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'skp' ? null : 'skp')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'skp'
                      ? "bg-blue-600 text-white ring-2 ring-blue-300 scale-105"
                      : "bg-blue-500 hover:bg-blue-600 text-white opacity-85 hover:opacity-100"
                  )}
                  title="Apply SKP seal stamp"
                >
                  SKP
                </button>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'go' ? null : 'go')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'go'
                      ? "bg-yellow-400 text-zinc-900 ring-2 ring-yellow-200 scale-105"
                      : "bg-yellow-400 hover:bg-yellow-500 text-zinc-900 opacity-85 hover:opacity-100"
                  )}
                  title="Apply GO seal stamp"
                >
                  GO
                </button>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'ks' ? null : 'ks')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'ks'
                      ? "bg-black text-white ring-2 ring-neutral-400 scale-105"
                      : "bg-black hover:bg-neutral-900 text-white opacity-85 hover:opacity-100"
                  )}
                  title="Apply KS seal stamp"
                >
                  KS
                </button>
                <button
                  onClick={() => setSelectedSeal(selectedSeal === 'alb' ? null : 'alb')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[9px] uppercase shadow-sm active:scale-95 cursor-pointer transition-all",
                    selectedSeal === 'alb'
                      ? "bg-red-600 text-white ring-2 ring-red-300 scale-105"
                      : "bg-red-600 hover:bg-red-700 text-white opacity-85 hover:opacity-100"
                  )}
                  title="Apply ALB seal stamp"
                >
                  ALB
                </button>
              </div>

              {/* PDF & Print & Close Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className={cn(
                    "px-2.5 sm:px-3.5 h-7 sm:h-8 rounded-xl flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 active:scale-95 text-[#FF5C35] font-black text-[10px] sm:text-[11px] uppercase cursor-pointer disabled:opacity-50",
                    isDarkMode ? "bg-[#FF5C35]/15 hover:bg-[#FF5C35]/25" : "bg-[#FF5C35]/10 hover:bg-[#FF5C35]/20"
                  )}
                  title="Download Invoice as PDF"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 text-[#FF5C35]" />
                  )}
                  <span>{isGeneratingPDF ? 'Creating...' : 'PDF'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-[#FF5C35] cursor-pointer",
                    isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"
                  )}
                  title="Print Invoice"
                >
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={onClose}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer",
                    isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                  )}
                  title="Close Window"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Printable Invoice Card */}
          <div
            id="invoice-print-card"
            className="invoice-card-container w-full bg-white text-neutral-900 rounded-[20px] sm:rounded-[28px] shadow-2xl p-3.5 sm:p-6 md:p-10 border border-neutral-200/80 overflow-hidden font-sans relative min-w-0"
            style={{ color: '#171717' }}
          >
            {/* Top Invoice Header */}
            <div className="flex flex-col sm:flex-row items-start justify-between border-b-2 border-neutral-900 pb-4 sm:pb-6 mb-4 sm:mb-6 gap-3 sm:gap-0">
              {/* Company Identity */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-[#FF5C35] text-white flex items-center justify-center font-black shadow-sm shrink-0">
                    <Receipt className="w-4 sm:w-5 h-4 sm:h-5" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-black tracking-tight text-neutral-900 leading-none">
                      Rental Invoice
                    </h1>
                    <span className="text-[8px] sm:text-[9px] font-extrabold tracking-widest text-[#FF5C35] uppercase">
                      Premium Vehicle Rental Services
                    </span>
                  </div>
                </div>
                
                <div className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] text-neutral-600 leading-snug space-y-0.5 font-medium">
                  <p>Skopje Airport, Terminal Building Alexander The Great, Ilinden, Skopje 1043</p>
                  <p>Tel: +389 76 33 66 33 • Email: info@momo.mk • www.momo.mk</p>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="flex flex-col items-start sm:items-end sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2.5 sm:pt-0 border-neutral-200">
                <div className="px-2.5 sm:px-3 py-1 bg-neutral-900 text-white rounded-lg font-black text-xs sm:text-sm tracking-wider uppercase mb-1.5 sm:mb-2">
                  INVOICE / ФАКТУРА
                </div>
                
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 mb-1">
                  <span className="text-[9.5px] sm:text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Invoice No:</span>
                  {isGeneratingPDF ? (
                    <span className="text-xs font-black font-mono text-neutral-900 text-right py-0.5 px-1 min-w-[100px] leading-normal">
                      {invoiceNumber || `INV-${String(booking.id).padStart(6, '0')}`}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="text-xs font-black font-mono text-neutral-900 bg-transparent border-b border-dashed border-neutral-300 focus:border-[#FF5C35] outline-none text-right px-1 py-0.5 h-6 sm:h-7 leading-normal w-[120px] sm:w-[130px]"
                      placeholder="INV-000000"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 mb-1">
                  <span className="text-[9.5px] sm:text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Issue Date:</span>
                  {isGeneratingPDF ? (
                    <span className="text-xs font-bold font-mono text-neutral-900 text-right py-0.5 px-1 min-w-[90px] leading-normal">
                      {invoiceDate}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="text-xs font-bold font-mono text-neutral-900 bg-transparent border-b border-dashed border-neutral-300 focus:border-[#FF5C35] outline-none text-right px-1 py-0.5 h-6 sm:h-7 leading-normal w-[100px] sm:w-[110px]"
                      placeholder="DD/MM/YYYY"
                    />
                  )}
                </div>

                <div className="mt-1 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 sm:px-2.5 py-0.5 rounded-md self-start sm:self-end">
                  <FileCheck2 className="w-3 h-3 text-emerald-600" />
                  <span className="text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider text-emerald-700">
                    PAID IN FULL
                  </span>
                </div>
              </div>
            </div>

            {/* Bill-To Section Grid: Client on Left, Company / Editable Space on Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Client / Individual Details */}
              <div className="p-3 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-neutral-200/80">
                    <User className="w-3.5 h-3.5 text-[#FF5C35]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5C35]">
                      Client / Renter Details
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-neutral-900 uppercase mb-2">
                    {booking.client}
                  </h3>

                  <div className="space-y-1 text-[11px] text-neutral-700">
                    {booking.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="font-semibold">{booking.phone}</span>
                      </div>
                    )}
                    {booking.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="font-semibold truncate">{booking.email}</span>
                      </div>
                    )}
                    {booking.driverLicenseId && (
                      <div className="flex items-center gap-2">
                        <Contact className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="text-neutral-500 font-bold text-[10px]">License:</span>
                        <span className="font-mono font-bold">{booking.driverLicenseId}</span>
                      </div>
                    )}
                    {booking.passportId && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="text-neutral-500 font-bold text-[10px]">Passport ID:</span>
                        <span className="font-mono font-bold">{booking.passportId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Company / Corporate Bill-To (Blank Space / Editable) */}
              <div className="p-3 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/70 flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200/80">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#FF5C35]" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5C35]">
                        Company / Billed Entity Details
                      </span>
                    </div>
                    <span className="text-[8.5px] font-bold text-neutral-400 uppercase no-print">
                      (Optional / Editable)
                    </span>
                  </div>

                  {isGeneratingPDF ? (
                    <div className="space-y-1.5 py-0.5">
                      {companyName ? (
                        <p className="text-xs font-black uppercase text-neutral-900 leading-normal">
                          {companyName}
                        </p>
                      ) : (
                        <p className="text-[11px] font-bold text-neutral-400 italic leading-normal">
                          Direct Client Rental
                        </p>
                      )}
                      {companyTaxId && (
                        <p className="text-[11px] font-mono font-bold text-neutral-800 leading-normal">
                          VAT / Tax ID: {companyTaxId}
                        </p>
                      )}
                      {(companyAddress || companyCity) && (
                        <p className="text-[11px] font-medium text-neutral-700 leading-normal">
                          {[companyAddress, companyCity].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Company / Entity Name (e.g. Acme Corp Ltd)"
                          className="w-full text-xs font-black uppercase text-neutral-900 bg-transparent border-b border-neutral-200/80 focus:border-[#FF5C35] outline-none py-1 h-7 leading-normal placeholder:text-neutral-400 placeholder:normal-case placeholder:font-normal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={companyTaxId}
                          onChange={(e) => setCompanyTaxId(e.target.value)}
                          placeholder="VAT Number / Tax ID (e.g. MK4080001234567)"
                          className="w-full text-[11px] font-mono font-bold text-neutral-800 bg-transparent border-b border-neutral-200/80 focus:border-[#FF5C35] outline-none py-1 h-7 leading-normal placeholder:text-neutral-400 placeholder:normal-case placeholder:font-normal"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          placeholder="Billing Address"
                          className="text-[11px] font-medium text-neutral-800 bg-transparent border-b border-neutral-200/80 focus:border-[#FF5C35] outline-none py-1 h-7 leading-normal placeholder:text-neutral-400"
                        />
                        <input
                          type="text"
                          value={companyCity}
                          onChange={(e) => setCompanyCity(e.target.value)}
                          placeholder="City, Country"
                          className="text-[11px] font-medium text-neutral-800 bg-transparent border-b border-neutral-200/80 focus:border-[#FF5C35] outline-none py-1 h-7 leading-normal placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Itemized Service Card (Phone PWA friendly - 0 horizontal scroll) */}
            <div className="block md:hidden mb-4 border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50 invoice-card-mobile">
              {/* Card Header with Service Title & Total */}
              <div className="bg-neutral-900 text-white p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[8.5px] font-bold text-[#FF5C35] uppercase tracking-wider block">
                    Service #1
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-tight">
                    Vehicle Rental: {booking.vehicle}
                  </h4>
                  <div className="text-[10px] text-neutral-300 font-mono mt-0.5 truncate">
                    Plate: <span className="font-bold text-white">{booking.plate}</span>
                    {booking.chassisNumber && ` • VIN: ${booking.chassisNumber}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[8px] font-bold uppercase text-neutral-400 block tracking-wider">
                    Total
                  </span>
                  <span className="text-sm font-black font-mono text-[#FF5C35]">
                    €{totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Card Details Body */}
              <div className="p-3 space-y-2 text-xs text-neutral-800">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/80 gap-2">
                  <div className="min-w-0">
                    <span className="text-[8.5px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Rental Period
                    </span>
                    <span className="font-semibold text-[10.5px] text-neutral-900 whitespace-nowrap">
                      {booking.start} — {booking.end}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[8.5px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Duration & Rate
                    </span>
                    <span className="font-mono text-[10.5px] font-bold text-neutral-900">
                      {booking.days} Days @ €{dailyRate}/d
                    </span>
                  </div>
                </div>

                {/* Route Details */}
                {(booking.fromLocation || booking.toLocation) && (
                  <div className="flex items-center justify-between py-1 text-[10.5px] border-b border-neutral-200/60 gap-2">
                    <span className="text-neutral-500 font-medium shrink-0">Pick-up / Drop-off:</span>
                    <span className="font-bold text-neutral-800 uppercase text-right truncate">
                      {booking.fromLocation || 'Skopje'} → {booking.toLocation || 'Skopje'}
                    </span>
                  </div>
                )}

                {/* Authorized Countries */}
                {booking.countries && booking.countries.length > 0 && (
                  <div className="flex items-center justify-between py-1 text-[10.5px] border-b border-neutral-200/60 gap-2">
                    <span className="text-neutral-500 font-medium shrink-0">Cross-Border:</span>
                    <span className="font-bold text-neutral-800 text-right truncate">
                      {booking.countries.join(', ')}
                    </span>
                  </div>
                )}

                {/* Insurance Coverage */}
                {booking.insurance && (
                  <div className="flex items-center justify-between py-1 text-[10.5px] gap-2">
                    <span className="text-neutral-500 font-medium shrink-0">Insurance:</span>
                    <span className="font-bold text-neutral-800 text-right truncate">
                      {String(booking.insurance.type).toLowerCase() === 'full' ? 'Full Insurance' : `Franchise Insurance (€ ${booking.insurance.price?.toLocaleString('de-DE') || booking.insurance.type})`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Itemized Services Table (Untouched PC layout) */}
            <div className="hidden md:block mb-6 border border-neutral-200 rounded-xl overflow-hidden invoice-table-desktop">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-900 text-white font-black text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Service Description</th>
                    <th className="py-2.5 px-3">Rental Period</th>
                    <th className="py-2.5 px-3 text-center">Days</th>
                    <th className="py-2.5 px-3 text-right">Daily Rate</th>
                    <th className="py-2.5 px-3 text-right">Total (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-800 font-medium">
                  <tr className="hover:bg-neutral-50/50">
                    <td className="py-3 px-3 text-center font-bold text-neutral-400">1</td>
                    <td className="py-3 px-3">
                      <div className="font-black text-neutral-900 uppercase">
                        Vehicle Rental: {booking.vehicle}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        Plate: <span className="font-bold text-neutral-800">{booking.plate}</span>
                        {booking.chassisNumber && ` • VIN: ${booking.chassisNumber}`}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[11px] font-semibold text-neutral-700">
                      {booking.start} — {booking.end}
                    </td>
                    <td className="py-3 px-3 text-center font-black">{booking.days}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">€{dailyRate}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-neutral-900">
                      €{totalPrice.toFixed(2)}
                    </td>
                  </tr>

                  {/* Route details subrow */}
                  {(booking.fromLocation || booking.toLocation) && (
                    <tr className="bg-neutral-50/40 text-[10px] text-neutral-600">
                      <td className="py-1.5 px-3 text-center">•</td>
                      <td colSpan={2} className="py-1.5 px-3">
                        <span className="font-bold text-neutral-700 uppercase">Pick-up / Drop-off:</span>{' '}
                        {booking.fromLocation || 'Skopje'} → {booking.toLocation || 'Skopje'}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono"></td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">Included</td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">€0.00</td>
                    </tr>
                  )}

                  {/* Authorized countries subrow */}
                  {booking.countries && booking.countries.length > 0 && (
                    <tr className="bg-neutral-50/40 text-[10px] text-neutral-600">
                      <td className="py-1.5 px-3 text-center">•</td>
                      <td colSpan={2} className="py-1.5 px-3">
                        <span className="font-bold text-neutral-700 uppercase">Cross-Border Authorization:</span>{' '}
                        {booking.countries.join(', ')}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono"></td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">Included</td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">€0.00</td>
                    </tr>
                  )}

                  {/* Insurance subrow */}
                  {booking.insurance && (
                    <tr className="bg-neutral-50/40 text-[10px] text-neutral-600">
                      <td className="py-1.5 px-3 text-center">•</td>
                      <td colSpan={2} className="py-1.5 px-3">
                        <span className="font-bold text-neutral-700 uppercase">Insurance Coverage:</span>{' '}
                        {String(booking.insurance.type).toLowerCase() === 'full' ? 'Full Insurance' : `Franchise Insurance (€ ${booking.insurance.price?.toLocaleString('de-DE') || booking.insurance.type})`}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono"></td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">Included</td>
                      <td className="py-1.5 px-3 text-right font-mono text-neutral-500">€0.00</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Totals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
              {/* Payment & Terms Note */}
              <div className="p-3 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 block mb-1">
                    Payment Method & Notes
                  </span>
                  <p className="text-[10.5px] sm:text-[11px] text-neutral-600 leading-relaxed font-medium">
                    {invoiceNotes}
                  </p>
                </div>
                <div className="mt-2 sm:mt-3 pt-2 border-t border-neutral-200 text-[9.5px] sm:text-[10px] text-neutral-500 font-medium">
                  This electronic invoice is issued in accordance with local tax regulations.
                </div>
              </div>

              {/* Totals Table */}
              <div className="space-y-1.5 bg-neutral-50/80 p-3 sm:p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span className="font-medium">Subtotal (Excl. VAT):</span>
                  <span className="font-mono font-bold">€{netSubtotal}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span className="font-medium">VAT (18% Included):</span>
                  <span className="font-mono font-bold">€{vatAmount}</span>
                </div>
                <div className="border-t border-neutral-300 my-1.5 sm:my-2 pt-1.5 sm:pt-2 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-black uppercase text-neutral-900">
                    Total Invoice Amount:
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-[#FF5C35]">
                    €{totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between text-[10.5px] sm:text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded gap-1">
                  <span>Amount Paid:</span>
                  <span className="font-mono">€{totalPrice.toFixed(2)} (Balance: €0.00)</span>
                </div>
              </div>
            </div>

            {/* Signatures & Seal Box */}
            <div className="grid grid-cols-2 gap-3 sm:gap-8 pt-3 sm:pt-4 border-t border-neutral-200 relative">
              {/* Authorized Issuer Stamp & Signature */}
              <div className="flex flex-col items-center justify-end text-center relative h-24 sm:h-28">
                {/* Dynamic Seal Stamp positioned here */}
                {selectedSeal && (
                  <div className="absolute top-0 transform -translate-y-2 pointer-events-none">
                    <Image
                      src={selectedSeal === 'bih' ? '/seal/bih.png?v=2' : `/seal/${selectedSeal}.png`}
                      alt={`${selectedSeal.toUpperCase()} Seal`}
                      width={80}
                      height={80}
                      className="sm:w-[100px] sm:h-[100px] object-contain opacity-95"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="invoice-sig-line w-full max-w-[130px] sm:max-w-[192px] sm:w-48 border-b border-neutral-400 mb-1 z-10" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-700 z-10 leading-tight">
                  Authorized Signature & Seal
                </span>
                <span className="text-[8px] sm:text-[9px] text-neutral-400 font-medium z-10 hidden sm:block">Authorized Rental Company</span>
              </div>

              {/* Client Receiver Signature */}
              <div className="flex flex-col items-center justify-end text-center h-24 sm:h-28">
                <div className="invoice-sig-line w-full max-w-[130px] sm:max-w-[192px] sm:w-48 border-b border-neutral-400 mb-1" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-700 leading-tight">
                  Client / Receiver Signature
                </span>
                <span className="text-[8px] sm:text-[9px] text-neutral-400 font-medium truncate max-w-[130px] sm:max-w-none">{booking.client}</span>
              </div>
            </div>

            {/* Legal / Confirmation Footer */}
            <div className="mt-4 sm:mt-6 pt-2.5 sm:pt-3 border-t border-neutral-200 text-center text-[8.5px] sm:text-[9px] text-neutral-400 uppercase tracking-widest font-semibold">
              This invoice serves as valid proof of vehicle rental services rendered.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
