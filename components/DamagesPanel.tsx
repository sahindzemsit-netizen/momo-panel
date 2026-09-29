'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas-pro';
import {
  ShieldAlert,
  Copy,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Car,
  DollarSign,
  AlertTriangle,
  FileText,
  User,
  Phone,
  Calendar,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  Wrench,
  CreditCard,
  Banknote,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/context';
import { DamageReport, DamageSeverity, Vehicle } from '@/types';
import CarSkeletonPicker, { getPartName } from '@/components/CarSkeletonPicker';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';

interface DamagesPanelProps {
  isDarkMode: boolean;
}

function getDamageDaysOrRepairedStatus(damage: DamageReport): {
  isRepaired: boolean;
  label: string;
  days: number;
  reportDateStr: string;
  repairedDateStr?: string;
} {
  // Determine report date
  let reportDate: Date;
  if (damage.date && typeof damage.date === 'string') {
    const trimmed = damage.date.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.substring(0, 10).split('-').map(Number);
      reportDate = new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})/.test(trimmed)) {
      const match = trimmed.match(/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
      if (match) {
        reportDate = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      } else {
        reportDate = new Date(trimmed);
      }
    } else {
      const d = new Date(trimmed);
      reportDate = isNaN(d.getTime()) ? new Date() : d;
    }
  } else if (damage.createdAt && !isNaN(Number(damage.createdAt))) {
    const d = new Date(Number(damage.createdAt));
    reportDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else {
    reportDate = new Date();
  }

  const startOfReport = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()).getTime();
  const reportDateStr = format(reportDate, 'dd/MM/yyyy');

  if (damage.isRepaired) {
    let repairedDate: Date;
    if (damage.repairedAt && !isNaN(Number(damage.repairedAt))) {
      repairedDate = new Date(Number(damage.repairedAt));
    } else if (damage.updatedAt && !isNaN(Number(damage.updatedAt))) {
      repairedDate = new Date(Number(damage.updatedAt));
    } else {
      repairedDate = reportDate;
    }

    const endOfRepair = new Date(repairedDate.getFullYear(), repairedDate.getMonth(), repairedDate.getDate()).getTime();
    // Calculate calendar days between incident report date and actual repair completion date
    const diffDays = Math.max(0, Math.round((endOfRepair - startOfReport) / (1000 * 60 * 60 * 24)));
    const days = diffDays === 0 ? 1 : diffDays;
    const repairedDateFormatted = format(repairedDate, 'dd/MM/yyyy');

    return {
      isRepaired: true,
      label: `${repairedDateFormatted} repaired`,
      days,
      reportDateStr,
      repairedDateStr: repairedDateFormatted,
    };
  }

  // Active / In Workshop: calculate calendar days since report until today
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.max(0, Math.round((startOfToday - startOfReport) / (1000 * 60 * 60 * 24)));
  const days = diffDays === 0 ? 1 : diffDays;

  return {
    isRepaired: false,
    label: `${days} ${days === 1 ? 'day' : 'days'}`,
    days,
    reportDateStr,
  };
}

function formatDamageDate(dateVal?: string | number | Date | null): string {
  if (!dateVal) return 'No Date';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.substring(0, 10).split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (/^\d{2}[\/\.]\d{2}[\/\.]\d{4}/.test(trimmed)) {
      return trimmed.replace(/\./g, '/');
    }
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return format(d, 'dd/MM/yyyy');
  }
  return String(dateVal);
}

const FIVE_ORIGINAL_COUNTRIES = ["Macedonia", "Kosovo", "Albania", "Bosnia", "Montenegro"];

const TURKISH_CAR_PARTS: Record<string, string> = {
  // Top View
  top_front_bumper: 'ön tampon',
  top_hood: 'motor kaputu',
  top_windshield: 'ön cam',
  top_roof: 'tavan',
  top_rear_windshield: 'arka cam',
  top_trunk: 'bagaj kapağı',
  top_rear_bumper: 'arka tampon',
  top_mirror_left: 'sol dikiz aynası',
  top_mirror_right: 'sağ dikiz aynası',
  top_fender_front_left: 'ön sol çamurluk',
  top_fender_front_right: 'ön sağ çamurluk',
  top_doors_left: 'sol kapılar',
  top_doors_right: 'sağ kapılar',
  top_quarter_rear_left: 'arka sol çamurluk',
  top_quarter_rear_right: 'arka sağ çamurluk',

  // Left Side View
  side_l_front_bumper: 'ön tampon',
  side_l_front_fender: 'ön sol çamurluk',
  side_l_wheel_front: 'sol ön jant',
  side_l_mirror: 'sol ayna',
  side_l_front_door: 'ön sol kapı',
  side_l_front_window: 'sol ön cam',
  side_l_rear_door: 'arka sol kapı',
  side_l_rear_window: 'sol arka cam',
  side_l_skirt: 'sol marşpiyel',
  side_l_rear_quarter: 'arka sol çamurluk',
  side_l_wheel_rear: 'sol arka jant',
  side_l_rear_bumper: 'arka tampon',

  // Right Side View
  side_r_front_bumper: 'ön tampon',
  side_r_front_fender: 'ön sağ çamurluk',
  side_r_wheel_front: 'sağ ön jant',
  side_r_mirror: 'sağ ayna',
  side_r_front_door: 'ön sağ kapı',
  side_r_front_window: 'sağ ön cam',
  side_r_rear_door: 'arka sağ kapı',
  side_r_rear_window: 'sağ arka cam',
  side_r_skirt: 'sağ marşpiyel',
  side_r_rear_quarter: 'arka sağ çamurluk',
  side_r_wheel_rear: 'sağ arka jant',
  side_r_rear_bumper: 'arka tampon',

  // Front View
  front_hood_edge: 'kaput ön ucu',
  front_windshield: 'ön cam',
  front_headlight_left: 'sol ön far',
  front_grille: 'ön panjur',
  front_headlight_right: 'sağ ön far',
  front_bumper_main: 'ön tampon',
  front_lower_lip: 'ön karlık',

  // Rear View
  rear_windshield: 'arka cam',
  rear_trunk_door: 'bagaj kapağı',
  rear_taillight_left: 'sol arka stop',
  rear_taillight_right: 'sağ arka stop',
  rear_bumper_main: 'arka tampon',
  rear_diffuser: 'arka difüzör',
};

function formatTurkishZones(partIds: string[]): { text: string; suffix: string } {
  if (!partIds || partIds.length === 0) {
    return { text: 'gövde', suffix: 'bölgesinde' };
  }
  const translatedSet = new Set<string>();
  partIds.forEach(id => {
    const tr = TURKISH_CAR_PARTS[id] || getPartName(id).toLowerCase();
    translatedSet.add(tr);
  });
  const uniqueParts = Array.from(translatedSet);
  if (uniqueParts.length === 1) {
    return { text: uniqueParts[0], suffix: 'bölgesinde' };
  }
  if (uniqueParts.length === 2) {
    return { text: `${uniqueParts[0]} ve ${uniqueParts[1]}`, suffix: 'bölgelerinde' };
  }
  const last = uniqueParts[uniqueParts.length - 1];
  const initial = uniqueParts.slice(0, -1).join(', ');
  return { text: `${initial} ve ${last}`, suffix: 'bölgelerinde' };
}

function formatTurkishDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

function formatTurkishSeverity(severity?: DamageSeverity): string {
  switch (severity) {
    case 'LOW':
      return 'düşük şiddetli';
    case 'MEDIUM':
      return 'orta şiddetli';
    case 'HIGH':
      return 'yüksek şiddetli';
    case 'CRITICAL':
      return 'yüksek şiddetli';
    default:
      return 'tespit edilen';
  }
}

function formatTurkishStatusSentence(damage: DamageReport): string {
  if (damage.isRepaired) {
    return 'Aracın onarım işlemleri tamamlanmıştır.';
  }
  return 'Araç şu an kullanımda olup, belirtilen onarım için ilerleyen süreçte servise gönderilecektir.';
}

function generateTurkishWhatsAppMessage(damage: DamageReport): string {
  const greeting = damage.clientName?.trim()
    ? `Sayın ${damage.clientName.trim()},`
    : 'Sayın Müşterimiz,';

  const formattedDate = formatTurkishDate(damage.date) || 'belirtilen tarihte';
  const plateText = damage.plate?.trim() ? `${damage.plate.trim()} plakalı` : 'Kiraladığınız';
  const { text: zonesText, suffix: zonesSuffix } = formatTurkishZones(damage.damagedParts || []);
  const severityText = formatTurkishSeverity(damage.severity);
  const costText = `€${(damage.price || 0).toLocaleString()}`;
  const statusSentence = formatTurkishStatusSentence(damage);

  return `${greeting}\n\n${plateText} araçla ilgili olarak ${formattedDate} tarihinde ${zonesText} ${zonesSuffix} tespit edilen ${severityText} hasara ilişkin onarım bedeli ${costText} olarak belirlenmiştir. ${statusSentence}\n\nİşlemlerin planlanabilmesi ve ödeme detayları için bizimle iletişime geçmenizi rica ederiz.`;
}

function getWhatsAppUrl(damage: DamageReport): string {
  if (!damage.clientPhone) return '#';
  const cleanPhone = damage.clientPhone.replace(/[^\d]/g, '');
  const message = generateTurkishWhatsAppMessage(damage);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export default function DamagesPanel({ isDarkMode }: DamagesPanelProps) {
  const {
    vehicles = [],
    damages = [],
    user
  } = useAppState();

  // Filter only original fleet vehicles from the 5 countries (exclude EXTRA cars)
  const fleetVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (v.isExtra) return false;
      if (v.category === 'EXTRA' || (v.name && v.name.toUpperCase().includes('EXTRA'))) return false;
      if (v.isRetired) return false;
      if (v.country && !FIVE_ORIGINAL_COUNTRIES.includes(v.country)) return false;
      return true;
    });
  }, [vehicles]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [repairFilter, setRepairFilter] = useState<'ALL' | 'UNREPAIRED' | 'REPAIRED'>('UNREPAIRED');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | DamageSeverity>('ALL');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [datePickerCoords, setDatePickerCoords] = useState<{ top: number; left: number } | null>(null);
  const dateFilterBtnRef = useRef<HTMLButtonElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 5;

  const handleToggleDatePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDatePickerOpen) {
      setIsDatePickerOpen(false);
    } else if (dateFilterBtnRef.current) {
      const rect = dateFilterBtnRef.current.getBoundingClientRect();
      const popoverWidth = 288;
      let left = rect.right - popoverWidth;
      if (left < 12) left = Math.max(12, rect.left);
      if (typeof window !== 'undefined' && left + popoverWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popoverWidth - 12);
      }
      setDatePickerCoords({
        top: rect.bottom + 6,
        left,
      });
      setIsDatePickerOpen(true);
    }
  };

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const updatePos = () => {
      if (dateFilterBtnRef.current) {
        const rect = dateFilterBtnRef.current.getBoundingClientRect();
        const popoverWidth = 288;
        let left = rect.right - popoverWidth;
        if (left < 12) left = Math.max(12, rect.left);
        if (typeof window !== 'undefined' && left + popoverWidth > window.innerWidth - 12) {
          left = Math.max(12, window.innerWidth - popoverWidth - 12);
        }
        setDatePickerCoords({
          top: rect.bottom + 6,
          left,
        });
      }
    };
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isDatePickerOpen]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formPlate, setFormPlate] = useState('');
  const [formVehicleName, setFormVehicleName] = useState('');
  const [formVehicleId, setFormVehicleId] = useState<string>('');
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formIsPaid, setFormIsPaid] = useState<boolean>(false);
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('Cash');
  const [formPaidBy, setFormPaidBy] = useState<'Client' | 'Company'>('Client');
  const [formIsRepaired, setFormIsRepaired] = useState<boolean>(false);
  const [formSeverity, setFormSeverity] = useState<DamageSeverity>('MEDIUM');
  const [formDate, setFormDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formDamagedParts, setFormDamagedParts] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [plateSearchFeedback, setPlateSearchFeedback] = useState<string | null>(null);

  // Workshop & Payment Confirmation Modals State
  const [workshopPromptDamage, setWorkshopPromptDamage] = useState<DamageReport | null>(null);
  const [isUpdatingWorkshop, setIsUpdatingWorkshop] = useState(false);
  const [paymentPromptDamage, setPaymentPromptDamage] = useState<DamageReport | null>(null);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'Cash' | 'Card'>('Cash');
  const [paidByChoice, setPaidByChoice] = useState<'Client' | 'Company'>('Client');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  // Expanded Cards State
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [copyingBlueprintId, setCopyingBlueprintId] = useState<string | null>(null);
  const [copiedBlueprintSuccessId, setCopiedBlueprintSuccessId] = useState<string | null>(null);

  const copyBlueprintAndOpenWhatsApp = async (e: React.MouseEvent, damage: DamageReport) => {
    e.preventDefault();
    if (!damage.clientPhone) return;

    setCopyingBlueprintId(damage.id);

    try {
      const containerEl = document.getElementById('damage-blueprint-' + damage.id);
      if (containerEl && navigator.clipboard && window.ClipboardItem) {
        const canvas = await html2canvas(containerEl, {
          backgroundColor: isDarkMode ? '#1E1B1A' : '#FFFFFF',
          scale: 2,
          useCORS: true,
          logging: false
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopiedBlueprintSuccessId(damage.id);
          setTimeout(() => setCopiedBlueprintSuccessId(null), 4000);
        }
      }
    } catch (err) {
      console.warn('Could not copy blueprint to clipboard:', err);
    } finally {
      setCopyingBlueprintId(null);
      const url = getWhatsAppUrl(damage);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Plate lookup helper - strictly searches fleet vehicles of original 5 countries
  const searchAndApplyPlate = (plateInput: string) => {
    const raw = plateInput.trim();
    if (!raw) {
      setPlateSearchFeedback(null);
      return;
    }

    const cleanInput = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Look for exact or fuzzy match in original fleet
    const matched = fleetVehicles.find(v => {
      const cleanPlate = (v.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanPlate === cleanInput || cleanPlate.includes(cleanInput);
    });

    if (matched) {
      setFormPlate(matched.plate || raw);
      setFormVehicleName(matched.name || '');
      setFormVehicleId(String(matched.id || ''));
      setPlateSearchFeedback(`Found: ${matched.name} (${matched.country || 'Fleet'})`);
    } else {
      setFormPlate(raw);
      setPlateSearchFeedback('Not in 5-country fleet (manual entry)');
    }
  };

  // Reset & Open Form
  const openCreateModal = (prefillVehicle?: Vehicle) => {
    setEditingDamage(null);
    setFormError(null);
    setPlateSearchFeedback(null);

    if (prefillVehicle) {
      setFormPlate(prefillVehicle.plate || '');
      setFormVehicleName(prefillVehicle.name || '');
      setFormVehicleId(String(prefillVehicle.id || ''));
      setPlateSearchFeedback(`Vehicle: ${prefillVehicle.name}`);
    } else {
      setFormPlate('');
      setFormVehicleName('');
      setFormVehicleId('');
    }

    // Client Name & Phone are always manual inputs
    setFormClientName('');
    setFormClientPhone('');
    setFormPrice('');
    setFormIsPaid(false);
    setFormPaymentMethod('Cash');
    setFormPaidBy('Client');
    setFormIsRepaired(false);
    setFormSeverity('MEDIUM');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDamagedParts([]);
    setFormDescription('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (damage: DamageReport) => {
    setEditingDamage(damage);
    setFormError(null);
    setPlateSearchFeedback(null);
    setFormPlate(damage.plate || '');
    setFormVehicleName(damage.vehicleName || '');
    setFormVehicleId(String(damage.vehicleId || ''));
    setFormClientName(damage.clientName || '');
    setFormClientPhone(damage.clientPhone || '');
    setFormPrice(String(damage.price || ''));
    setFormIsPaid(Boolean(damage.isPaid));
    setFormPaymentMethod(damage.paymentMethod || 'Cash');
    setFormPaidBy((damage.paidBy as any) === 'Company' ? 'Company' : 'Client');
    setFormIsRepaired(Boolean(damage.isRepaired));
    setFormSeverity(damage.severity || 'MEDIUM');
    setFormDate(damage.date || format(new Date(), 'yyyy-MM-dd'));
    setFormDamagedParts(damage.damagedParts || []);
    setFormDescription(damage.description || '');
    setIsAddModalOpen(true);
  };

  // Submit Handler
  const handleSaveDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formPlate.trim()) {
      setFormError('Please enter a vehicle license plate.');
      return;
    }
    if (!formClientName.trim()) {
      setFormError('Please provide the client name responsible for the damage.');
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid price amount (€).');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const payload: Partial<DamageReport> = {
        plate: formPlate.trim().toUpperCase(),
        vehicleName: formVehicleName.trim() || 'Vehicle',
        vehicleId: formVehicleId || '',
        clientName: formClientName.trim(),
        clientPhone: formClientPhone.trim() || '',
        date: formDate || format(new Date(), 'yyyy-MM-dd'),
        damagedParts: formDamagedParts,
        price: priceNum,
        isPaid: editingDamage ? Boolean(editingDamage.isPaid) : false,
        paymentMethod: editingDamage ? (editingDamage.paymentMethod || 'Pending') : 'Pending',
        paidBy: editingDamage ? (editingDamage.paidBy || null) : null,
        paidAt: editingDamage ? (editingDamage.paidAt || null) : null,
        isRepaired: editingDamage ? Boolean(editingDamage.isRepaired) : false,
        repairedAt: editingDamage ? (editingDamage.repairedAt || null) : null,
        severity: formSeverity,
        description: formDescription.trim() || '',
        reportedBy: user?.email || 'Staff',
        updatedAt: now,
      };

      if (editingDamage) {
        await updateDoc(doc(db, 'damages', editingDamage.id), payload);
      } else {
        payload.createdAt = now;
        await addDoc(collection(db, 'damages'), payload);
      }

      setIsAddModalOpen(false);
      setEditingDamage(null);
    } catch (err) {
      console.error('Error saving damage report:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save damage report');
      handleFirestoreError(err, editingDamage ? OperationType.UPDATE : OperationType.CREATE, 'damages');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Payment & Liability Prompt Panel
  const openPaymentPrompt = (damage: DamageReport) => {
    setPaymentPromptDamage(damage);
    setPaymentMethodChoice((damage.paymentMethod as any) === 'Card' ? 'Card' : 'Cash');
    setPaidByChoice((damage.paidBy as any) === 'Company' ? 'Company' : 'Client');
  };

  // Confirm / Update Payment Status
  const handleConfirmPayment = async () => {
    if (!paymentPromptDamage) return;
    try {
      setIsUpdatingPayment(true);
      await updateDoc(doc(db, 'damages', paymentPromptDamage.id), {
        isPaid: true,
        paymentMethod: paymentMethodChoice,
        paidBy: paidByChoice,
        paidAt: paymentPromptDamage.isPaid ? (paymentPromptDamage.paidAt || Date.now()) : Date.now(),
        updatedAt: Date.now()
      });
      setPaymentPromptDamage(null);
    } catch (err) {
      console.error('Error updating payment status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `damages/${paymentPromptDamage.id}`);
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  // Confirm / Toggle Workshop Repair Status
  const handleConfirmWorkshopStatus = async () => {
    if (!workshopPromptDamage) return;
    try {
      setIsUpdatingWorkshop(true);
      const newRepaired = !workshopPromptDamage.isRepaired;
      await updateDoc(doc(db, 'damages', workshopPromptDamage.id), {
        isRepaired: newRepaired,
        repairedAt: newRepaired ? Date.now() : null,
        updatedAt: Date.now()
      });
      setWorkshopPromptDamage(null);
    } catch (err) {
      console.error('Error updating workshop repair status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `damages/${workshopPromptDamage.id}`);
    } finally {
      setIsUpdatingWorkshop(false);
    }
  };

  // Quick Toggle Paid Status (Opens prompt modal)
  const handleTogglePaid = (damage: DamageReport) => {
    openPaymentPrompt(damage);
  };

  // Quick Toggle Repaired Status (Opens prompt modal)
  const handleToggleRepaired = (damage: DamageReport) => {
    setWorkshopPromptDamage(damage);
  };


  // Filtered List
  const filteredDamages = useMemo(() => {
    return damages.filter(d => {
      // Payment Status filter
      if (statusFilter === 'UNPAID' && d.isPaid) return false;
      if (statusFilter === 'PAID' && !d.isPaid) return false;

      // Workshop Repair Status filter
      if (repairFilter === 'UNREPAIRED' && d.isRepaired) return false;
      if (repairFilter === 'REPAIRED' && !d.isRepaired) return false;

      // Severity filter
      if (severityFilter !== 'ALL' && d.severity !== severityFilter) return false;

      // Vehicle filter
      if (selectedVehicleFilter !== 'ALL' && d.plate !== selectedVehicleFilter) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPlate = d.plate?.toLowerCase().includes(q);
        const matchesVehicle = d.vehicleName?.toLowerCase().includes(q);
        const matchesClient = d.clientName?.toLowerCase().includes(q);
        const matchesPhone = d.clientPhone?.toLowerCase().includes(q);
        const matchesDesc = d.description?.toLowerCase().includes(q);
        const matchesParts = d.damagedParts?.some(p => getPartName(p).toLowerCase().includes(q));
        if (!matchesPlate && !matchesVehicle && !matchesClient && !matchesPhone && !matchesDesc && !matchesParts) {
          return false;
        }
      }

      // Exact Incident Date filter
      if (selectedDateFilter) {
        const dDate = (d.date || '').trim();
        let matches = dDate.startsWith(selectedDateFilter);
        if (!matches && dDate) {
          try {
            const parsed = new Date(dDate);
            if (!isNaN(parsed.getTime())) {
              matches = format(parsed, 'yyyy-MM-dd') === selectedDateFilter;
            }
          } catch {}
        }
        if (!matches && !dDate && d.createdAt) {
          try {
            matches = format(new Date(d.createdAt), 'yyyy-MM-dd') === selectedDateFilter;
          } catch {}
        }
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [damages, statusFilter, repairFilter, severityFilter, selectedVehicleFilter, searchQuery, selectedDateFilter]);

  // Reset pagination on filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, repairFilter, severityFilter, selectedVehicleFilter, selectedDateFilter]);

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredDamages.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDamages = useMemo(() => {
    return filteredDamages.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDamages, startIndex]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let totalUnpaidAmount = 0;
    let totalPaidAmount = 0;
    let totalDamageAmount = 0;
    let unpaidCount = 0;
    let paidCount = 0;
    let repairedCount = 0;
    let unrepairedCount = 0;
    const affectedPlates = new Set<string>();

    damages.forEach(d => {
      const price = Number(d.price) || 0;
      totalDamageAmount += price;
      if (d.plate) affectedPlates.add(d.plate);

      if (d.isPaid) {
        paidCount++;
        totalPaidAmount += price;
      } else {
        unpaidCount++;
        totalUnpaidAmount += price;
      }

      if (d.isRepaired) {
        repairedCount++;
      } else {
        unrepairedCount++;
      }
    });

    const totalCount = damages.length;
    const repairRate = totalCount > 0 ? Math.round((repairedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      totalDamageAmount,
      unpaidCount,
      paidCount,
      totalUnpaidAmount,
      totalPaidAmount,
      repairedCount,
      unrepairedCount,
      repairRate,
      affectedVehiclesCount: affectedPlates.size
    };
  }, [damages]);

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-6 space-y-6 flex flex-col">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>
                  CAR DAMAGES LOG
                </h1>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                  Skeleton blueprint damage mapping &amp; client liability tracking
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => openCreateModal()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider transition-all shadow-lg shadow-red-600/20 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>ADD DAMAGE RECORD</span>
          </button>
        </div>

        {/* Stats Summary Bar with Sleek Sports Car Silhouette Shaped Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Unpaid Balance Card (Warm Red / Rose Hue - Coupe Silhouette Shape) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setStatusFilter(statusFilter === 'UNPAID' ? 'ALL' : 'UNPAID')}
            className={cn(
              "px-6 pt-5 pb-4 transition-all duration-300 flex flex-col justify-between relative overflow-hidden cursor-pointer group hover:scale-[1.02] active:scale-[0.98]",
              "rounded-tl-[36px] rounded-tr-[18px] rounded-bl-[16px] rounded-br-[28px] border",
              isDarkMode
                ? "bg-gradient-to-br from-[#381616]/95 via-[#231111]/95 to-[#160A0A] border-red-500/30 text-white shadow-[0_12px_36px_rgba(239,68,68,0.16)] hover:shadow-[0_16px_44px_rgba(239,68,68,0.28)]"
                : "bg-gradient-to-br from-red-50/95 via-rose-50/80 to-red-100/70 border-red-200/90 text-gray-900 shadow-[0_12px_32px_rgba(239,68,68,0.12)] hover:shadow-[0_16px_40px_rgba(239,68,68,0.20)]",
              statusFilter === 'UNPAID' ? (isDarkMode ? "ring-2 ring-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)]" : "ring-2 ring-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.25)]") : ""
            )}
          >
            {/* Aerodynamic Roofline & Windshield Contour Indicator (Car Roof Silhouette) */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent pointer-events-none" />
            
            {/* Headlight / Tail-light Beam Ambient Accents */}
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-red-500/20 group-hover:scale-135 transition-transform duration-500" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none bg-rose-500/10" />

            {/* Subtle Watermark Car Silhouette Vector in Background */}
            <div className="absolute -right-4 -bottom-3 text-red-500/8 dark:text-red-400/10 pointer-events-none transform -rotate-3 group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-500">
              <Car className="w-28 h-28 stroke-[1.2]" />
            </div>

            {/* Header: Front Headlight Pill + Hood Badge */}
            <div className="flex items-center justify-between z-10">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                isDarkMode ? "text-red-400" : "text-red-600"
              )}>
                {/* Sleek Headlamp style icon pod */}
                <span className="w-6 h-6 rounded-tl-xl rounded-br-xl rounded-tr-sm rounded-bl-sm bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-red-500/25 transition-colors">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                Unpaid by Clients
              </span>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 shadow-xs">
                {stats.unpaidCount} records
              </span>
            </div>
            
            {/* Main Value Display */}
            <div className="my-2.5 z-10">
              <span className={cn("text-3xl sm:text-[32px] font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-950")}>
                €{stats.totalUnpaidAmount.toLocaleString()}
              </span>
            </div>
            
            {/* Footer with Twin Wheels & Aero Underbody Line */}
            <div className="z-10 pt-1 border-t border-red-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Front Wheel Hub */}
                <div className="w-3 h-3 rounded-full border-2 border-red-500/50 bg-red-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-red-500" />
                </div>
                <span className={cn("text-[11px] font-medium truncate max-w-[140px] sm:max-w-none", isDarkMode ? "text-red-300/80" : "text-red-700/90")}>
                  Pending recovery
                </span>
              </div>
              {/* Rear Wheel Hub */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-red-500 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">Filter →</span>
                <div className="w-3 h-3 rounded-full border-2 border-red-500/50 bg-red-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-red-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Paid / Recovered Card (Emerald / Green Hue - Coupe Silhouette Shape) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')}
            className={cn(
              "px-6 pt-5 pb-4 transition-all duration-300 flex flex-col justify-between relative overflow-hidden cursor-pointer group hover:scale-[1.02] active:scale-[0.98]",
              "rounded-tl-[36px] rounded-tr-[18px] rounded-bl-[16px] rounded-br-[28px] border",
              isDarkMode
                ? "bg-gradient-to-br from-[#133221]/95 via-[#0D2116]/95 to-[#08160E] border-emerald-500/30 text-white shadow-[0_12px_36px_rgba(16,185,129,0.16)] hover:shadow-[0_16px_44px_rgba(16,185,129,0.28)]"
                : "bg-gradient-to-br from-emerald-50/95 via-teal-50/80 to-emerald-100/70 border-emerald-200/90 text-gray-900 shadow-[0_12px_32px_rgba(16,185,129,0.12)] hover:shadow-[0_16px_40px_rgba(16,185,129,0.20)]",
              statusFilter === 'PAID' ? (isDarkMode ? "ring-2 ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]" : "ring-2 ring-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.25)]") : ""
            )}
          >
            {/* Aerodynamic Roofline */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent pointer-events-none" />

            {/* Ambient Lighting */}
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-emerald-500/20 group-hover:scale-135 transition-transform duration-500" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none bg-teal-500/10" />

            {/* Car Watermark */}
            <div className="absolute -right-4 -bottom-3 text-emerald-500/8 dark:text-emerald-400/10 pointer-events-none transform -rotate-3 group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-500">
              <Car className="w-28 h-28 stroke-[1.2]" />
            </div>

            {/* Header: Front Headlight Pod */}
            <div className="flex items-center justify-between z-10">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                isDarkMode ? "text-emerald-400" : "text-emerald-700"
              )}>
                <span className="w-6 h-6 rounded-tl-xl rounded-br-xl rounded-tr-sm rounded-bl-sm bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-emerald-500/25 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                Paid / Recovered
              </span>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                {stats.paidCount} settled
              </span>
            </div>

            {/* Main Metric */}
            <div className="my-2.5 z-10">
              <span className={cn("text-3xl sm:text-[32px] font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-950")}>
                €{stats.totalPaidAmount.toLocaleString()}
              </span>
            </div>

            {/* Footer with Twin Wheels & Aero Line */}
            <div className="z-10 pt-1 border-t border-emerald-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
                <span className={cn("text-[11px] font-medium truncate max-w-[140px] sm:max-w-none", isDarkMode ? "text-emerald-300/80" : "text-emerald-700/90")}>
                  Collected &amp; settled
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-500 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">Filter →</span>
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Total Damages Card (Ocean Blue / Indigo Hue - Coupe Silhouette Shape) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "px-6 pt-5 pb-4 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]",
              "rounded-tl-[36px] rounded-tr-[18px] rounded-bl-[16px] rounded-br-[28px] border",
              isDarkMode
                ? "bg-gradient-to-br from-[#152844]/95 via-[#0F1D32]/95 to-[#09121F] border-blue-500/30 text-white shadow-[0_12px_36px_rgba(59,130,246,0.16)] hover:shadow-[0_16px_44px_rgba(59,130,246,0.28)]"
                : "bg-gradient-to-br from-blue-50/95 via-indigo-50/80 to-blue-100/70 border-blue-200/90 text-gray-900 shadow-[0_12px_32px_rgba(59,130,246,0.12)] hover:shadow-[0_16px_40px_rgba(59,130,246,0.20)]"
            )}
          >
            {/* Aerodynamic Roofline */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none" />

            {/* Ambient Lighting */}
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-blue-500/20 group-hover:scale-135 transition-transform duration-500" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none bg-indigo-500/10" />

            {/* Car Watermark */}
            <div className="absolute -right-4 -bottom-3 text-blue-500/8 dark:text-blue-400/10 pointer-events-none transform -rotate-3 group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-500">
              <Car className="w-28 h-28 stroke-[1.2]" />
            </div>

            {/* Header: Front Headlight Pod */}
            <div className="flex items-center justify-between z-10">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                isDarkMode ? "text-blue-400" : "text-blue-700"
              )}>
                <span className="w-6 h-6 rounded-tl-xl rounded-br-xl rounded-tr-sm rounded-bl-sm bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-blue-500/25 transition-colors">
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
                Total Damages
              </span>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-xs">
                {stats.totalCount} records
              </span>
            </div>

            {/* Main Metric */}
            <div className="my-2.5 z-10">
              <span className={cn("text-3xl sm:text-[32px] font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-950")}>
                €{stats.totalDamageAmount.toLocaleString()}
              </span>
            </div>

            {/* Footer with Twin Wheels & Aero Line */}
            <div className="z-10 pt-1 border-t border-blue-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500/50 bg-blue-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-500" />
                </div>
                <span className={cn("text-[11px] font-medium truncate max-w-[140px] sm:max-w-none", isDarkMode ? "text-blue-300/80" : "text-blue-700/90")}>
                  Assessed liability
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-blue-500 opacity-60">Fleet</span>
                <div className="w-3 h-3 rounded-full border-2 border-blue-500/50 bg-blue-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-500" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Total Repaired Card (Emerald / Workshop Green Hue - Coupe Silhouette Shape) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => setRepairFilter(repairFilter === 'REPAIRED' ? 'UNREPAIRED' : 'REPAIRED')}
            className={cn(
              "px-6 pt-5 pb-4 transition-all duration-300 flex flex-col justify-between relative overflow-hidden cursor-pointer group hover:scale-[1.02] active:scale-[0.98]",
              "rounded-tl-[36px] rounded-tr-[18px] rounded-bl-[16px] rounded-br-[28px] border",
              isDarkMode
                ? "bg-gradient-to-br from-[#132E22]/95 via-[#0D2218]/95 to-[#081610] border-emerald-500/30 text-white shadow-[0_12px_36px_rgba(16,185,129,0.16)] hover:shadow-[0_16px_44px_rgba(16,185,129,0.28)]"
                : "bg-gradient-to-br from-emerald-50/95 via-teal-50/80 to-emerald-100/70 border-emerald-200/90 text-gray-900 shadow-[0_12px_32px_rgba(16,185,129,0.12)] hover:shadow-[0_16px_40px_rgba(16,185,129,0.20)]",
              repairFilter === 'REPAIRED' ? (isDarkMode ? "ring-2 ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]" : "ring-2 ring-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.25)]") : ""
            )}
          >
            {/* Aerodynamic Roofline */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent pointer-events-none" />

            {/* Ambient Lighting */}
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-2xl pointer-events-none bg-emerald-500/20 group-hover:scale-135 transition-transform duration-500" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none bg-teal-500/10" />

            {/* Car Watermark */}
            <div className="absolute -right-4 -bottom-3 text-emerald-500/8 dark:text-emerald-400/10 pointer-events-none transform -rotate-3 group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-500">
              <Car className="w-28 h-28 stroke-[1.2]" />
            </div>

            {/* Header: Front Headlight Pod */}
            <div className="flex items-center justify-between z-10">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                isDarkMode ? "text-emerald-400" : "text-emerald-700"
              )}>
                <span className="w-6 h-6 rounded-tl-xl rounded-br-xl rounded-tr-sm rounded-bl-sm bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-emerald-500/25 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </span>
                Total Repaired
              </span>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                {stats.repairRate}% Repaired
              </span>
            </div>

            {/* Main Metric */}
            <div className="my-2.5 z-10">
              <span className={cn("text-3xl sm:text-[32px] font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-950")}>
                {stats.repairedCount} / {stats.totalCount}
              </span>
            </div>

            {/* Footer with Twin Wheels & Aero Line */}
            <div className="z-10 pt-1 border-t border-emerald-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
                <span className={cn("text-[11px] font-medium truncate max-w-[140px] sm:max-w-none", isDarkMode ? "text-emerald-300/80" : "text-emerald-700/90")}>
                  {stats.unrepairedCount} in workshop
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-500 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">Filter →</span>
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filter & Search Bar */}
        <div className={cn(
          "p-2.5 sm:p-3 rounded-2xl border flex items-center gap-2.5 shadow-sm overflow-x-auto no-scrollbar",
          isDarkMode ? "bg-[#231F1D] border-white/5" : "bg-white border-gray-100"
        )}>
          {/* Search Input */}
          <div className="relative w-64 sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search plate, client, car, damage zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-8 py-2 rounded-xl text-xs font-medium border focus:outline-none transition-colors",
                isDarkMode
                  ? "bg-[#1E1B1A] border-white/10 text-white placeholder-gray-500 focus:border-red-500"
                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls: strictly in single horizontal row */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Dedicated Primary Repair Status Buttons / Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
              <button
                id="btn-filter-workshop"
                onClick={() => setRepairFilter('UNREPAIRED')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  repairFilter === 'UNREPAIRED'
                    ? "bg-amber-500 text-white shadow-xs font-black"
                    : isDarkMode
                      ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 hover:text-amber-200"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 hover:text-amber-950"
                )}
              >
                <Clock className={cn("w-3.5 h-3.5", repairFilter === 'UNREPAIRED' ? "text-white" : isDarkMode ? "text-amber-400" : "text-amber-700")} />
                <span className={cn(repairFilter === 'UNREPAIRED' ? "text-white" : isDarkMode ? "text-amber-300" : "text-amber-900")}>
                  In Workshop
                </span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                  repairFilter === 'UNREPAIRED'
                    ? "bg-black/25 text-white"
                    : isDarkMode
                      ? "bg-amber-500/25 text-amber-300"
                      : "bg-amber-200/90 text-amber-950"
                )}>
                  {stats.unrepairedCount}
                </span>
              </button>

              <button
                id="btn-filter-repaired"
                onClick={() => setRepairFilter('REPAIRED')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  repairFilter === 'REPAIRED'
                    ? "bg-emerald-600 text-white shadow-xs font-black"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Repaired</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                  repairFilter === 'REPAIRED' ? "bg-black/20 text-white" : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                )}>
                  {stats.repairedCount}
                </span>
              </button>

              <button
                id="btn-filter-all-repairs"
                onClick={() => setRepairFilter('ALL')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  repairFilter === 'ALL'
                    ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white font-black"
                    : isDarkMode
                      ? "text-gray-400 hover:text-white hover:bg-white/5"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/80"
                )}
              >
                <span>All Fleet</span>
                <span className="text-[10px] opacity-70">({damages.length})</span>
              </button>
            </div>

            {/* Payment Status Segmented Filter */}
            <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-white/5">
              <button
                id="btn-status-all"
                onClick={() => setStatusFilter('ALL')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                  statusFilter === 'ALL'
                    ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                All
              </button>
              <button
                id="btn-status-unpaid"
                onClick={() => setStatusFilter('UNPAID')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  statusFilter === 'UNPAID'
                    ? "bg-white dark:bg-[#2A2726] shadow-sm text-red-500"
                    : "text-gray-500 hover:text-red-500"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Unpaid ({stats.unpaidCount})
              </button>
              <button
                id="btn-status-paid"
                onClick={() => setStatusFilter('PAID')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  statusFilter === 'PAID'
                    ? "bg-white dark:bg-[#2A2726] shadow-sm text-emerald-500"
                    : "text-gray-500 hover:text-emerald-500"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Paid ({stats.paidCount})
              </button>
            </div>

            {/* Vehicle Dropdown (Filtered only to original fleet 5 countries) */}
            <select
              id="select-fleet-vehicle"
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer shrink-0",
                isDarkMode
                  ? "bg-[#1E1B1A] border-white/10 text-white"
                  : "bg-gray-50 border-gray-200 text-gray-800"
              )}
            >
              <option value="ALL">All Fleet Cars ({fleetVehicles.length})</option>
              {fleetVehicles.map((v) => (
                <option key={v.id} value={v.plate}>
                  {v.plate} - {v.name}
                </option>
              ))}
            </select>

            {/* Clickable Calendar Date Filter positioned to the RIGHT of All Fleet Cars */}
            <div className="flex items-center shrink-0">
              <button
                id="btn-damage-date-filter"
                ref={dateFilterBtnRef}
                type="button"
                onClick={handleToggleDatePicker}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-xs cursor-pointer select-none whitespace-nowrap",
                  selectedDateFilter
                    ? "bg-[#FF5C35]/15 text-[#FF5C35] border-[#FF5C35]/50 ring-2 ring-[#FF5C35]/20 hover:bg-[#FF5C35]/25"
                    : isDarkMode
                    ? "bg-[#1E1B1A] border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300"
                )}
                title="Click to choose a specific date or quick preset"
              >
                <Calendar className="w-4 h-4 shrink-0 text-[#FF5C35]" />
                <span className="font-extrabold">
                  {selectedDateFilter
                    ? format(new Date(selectedDateFilter + 'T00:00:00'), 'dd MMM yyyy')
                    : 'Filter Date'}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", isDatePickerOpen && "rotate-180")} />
              </button>

              {selectedDateFilter && (
                <button
                  id="btn-clear-date-filter"
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter('');
                    setIsDatePickerOpen(false);
                  }}
                  title="Clear date filter (show all dates)"
                  className="ml-1.5 p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer border border-transparent hover:border-red-500/20 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Date Filter Banner */}
        {selectedDateFilter && (
          <div className={cn(
            "p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs",
            isDarkMode ? "bg-[#FF5C35]/10 border-[#FF5C35]/30 text-white" : "bg-orange-50 border-orange-200 text-orange-950"
          )}>
            <div className="flex items-center gap-2 font-bold">
              <Calendar className="w-4 h-4 text-[#FF5C35] shrink-0" />
              <span>
                Filtered by Date: <strong className="font-black text-[#FF5C35]">{format(new Date(selectedDateFilter + 'T00:00:00'), 'EEEE, dd MMMM yyyy')}</strong>
              </span>
              <span className="opacity-40">•</span>
              <span>{filteredDamages.length} car record{filteredDamages.length === 1 ? '' : 's'} on this date</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDateFilter('')}
              className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 underline cursor-pointer"
            >
              Clear filter (view all dates)
            </button>
          </div>
        )}

        {/* Damages List */}
        {filteredDamages.length === 0 ? (
          <div className={cn(
            "p-12 rounded-3xl border text-center flex flex-col items-center justify-center gap-3 transition-colors",
            isDarkMode ? "bg-[#231F1D] border-white/5" : "bg-white border-gray-100 shadow-sm"
          )}>
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 opacity-70" />
            </div>
            <h3 className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
              No Damage Records Found
            </h3>
            <p className="text-xs text-gray-500 max-w-sm">
              {repairFilter === 'REPAIRED'
                ? 'No repaired vehicle damage records yet. When vehicles complete workshop repair, click "IN WORKSHOP" on any card to move them here as Repaired.'
                : repairFilter === 'UNREPAIRED'
                ? 'All vehicle damages are currently repaired! No vehicles currently waiting in workshop.'
                : searchQuery || statusFilter !== 'ALL' || selectedVehicleFilter !== 'ALL'
                ? 'No damage reports match the selected filters. Try adjusting your query.'
                : 'No vehicle damage reports have been registered yet. Click "Add Damage Record" to record a new incident.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedDamages.map((damage) => {
              const isExpanded = Boolean(expandedCardIds[damage.id]);
              const partsCount = damage.damagedParts?.length || 0;

              // Compute severity background styling hues - turning green when repaired
              const severityBgClass = damage.isRepaired
                ? isDarkMode
                  ? "bg-gradient-to-r from-emerald-950/20 via-[#231F1D] to-[#231F1D] border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_4px_20px_rgba(16,185,129,0.08)]"
                  : "bg-gradient-to-r from-emerald-500/[0.06] via-emerald-500/[0.01] to-white border-emerald-200 hover:border-emerald-300 shadow-[0_4px_20px_rgba(16,185,129,0.05)]"
                : isDarkMode
                ? damage.severity === 'CRITICAL'
                  ? "bg-gradient-to-r from-red-950/40 via-[#231F1D] to-[#231F1D] border-red-500/30 hover:border-red-500/50 shadow-[0_4px_20px_rgba(239,68,68,0.1)]"
                  : damage.severity === 'HIGH'
                  ? "bg-gradient-to-r from-orange-950/40 via-[#231F1D] to-[#231F1D] border-orange-500/30 hover:border-orange-500/50 shadow-[0_4px_20px_rgba(249,115,22,0.1)]"
                  : damage.severity === 'MEDIUM'
                  ? "bg-gradient-to-r from-amber-950/40 via-[#231F1D] to-[#231F1D] border-amber-500/30 hover:border-amber-500/50 shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
                  : damage.severity === 'LOW'
                  ? "bg-gradient-to-r from-blue-950/40 via-[#231F1D] to-[#231F1D] border-blue-500/30 hover:border-blue-500/50 shadow-[0_4px_20px_rgba(59,130,246,0.1)]"
                  : "bg-[#231F1D] border-white/5"
                : damage.severity === 'CRITICAL'
                ? "bg-gradient-to-r from-red-500/[0.08] via-red-500/[0.02] to-white border-red-200 hover:border-red-300 shadow-[0_4px_20px_rgba(239,68,68,0.06)]"
                : damage.severity === 'HIGH'
                ? "bg-gradient-to-r from-orange-500/[0.08] via-orange-500/[0.02] to-white border-orange-200 hover:border-orange-300 shadow-[0_4px_20px_rgba(249,115,22,0.06)]"
                : damage.severity === 'MEDIUM'
                ? "bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.02] to-white border-amber-200 hover:border-amber-300 shadow-[0_4px_20px_rgba(245,158,11,0.06)]"
                : damage.severity === 'LOW'
                ? "bg-gradient-to-r from-blue-500/[0.08] via-blue-500/[0.02] to-white border-blue-200 hover:border-blue-300 shadow-[0_4px_20px_rgba(59,130,246,0.06)]"
                : "bg-white border-gray-100 shadow-sm";

              return (
                <motion.div
                  key={damage.id}
                  layout
                  className={cn(
                    "p-5 rounded-3xl border transition-all duration-200 flex flex-col gap-4 relative overflow-hidden",
                    severityBgClass
                  )}
                >
                  {/* Left severity / repaired accent indicator bar */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1.5",
                      damage.isRepaired
                        ? "bg-emerald-500"
                        : damage.severity === 'CRITICAL'
                        ? "bg-red-500"
                        : damage.severity === 'HIGH'
                        ? "bg-orange-500"
                        : damage.severity === 'MEDIUM'
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    )}
                  />

                  {/* Card Header Row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-1">
                    {/* Vehicle Plate + Info in Structured Order */}
                    <div className="flex flex-col gap-2.5">
                      {/* Top Row: Plate higher up + Vehicle Name + Severity / Repaired Status */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* EU License Plate Badge */}
                        <div className="flex items-stretch rounded-lg overflow-hidden border border-black/40 shadow-sm font-mono tracking-tight font-black text-xs shrink-0 select-none">
                          <div className="bg-[#003399] text-white px-1.5 py-1 flex flex-col items-center justify-center text-[7px] leading-none">
                            <span>★</span>
                            <span className="font-bold">MK</span>
                          </div>
                          <div className="bg-black text-white px-2.5 py-1 flex flex-col justify-center">
                            <span className="text-[7px] tracking-widest text-white/50 leading-none">PLATE</span>
                            <span className="font-extrabold text-xs sm:text-sm tracking-widest">{damage.plate}</span>
                          </div>
                        </div>

                        <h4 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>
                          {damage.vehicleName || 'Vehicle'}
                        </h4>

                        {damage.isRepaired ? (
                          <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Repaired
                          </span>
                        ) : damage.severity ? (
                          <span className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                            damage.severity === 'CRITICAL' && "bg-red-500/20 text-red-500 border border-red-500/30",
                            damage.severity === 'HIGH' && "bg-orange-500/20 text-orange-500 border border-orange-500/30",
                            damage.severity === 'MEDIUM' && "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
                            damage.severity === 'LOW' && "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                          )}>
                            {damage.severity} Severity
                          </span>
                        ) : null}
                      </div>

                      {/* Underneath the Plate: Client Name -> Phone Number -> Date (in order with matching background and black text) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Client Name Pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 shadow-xs">
                          <User className="w-3.5 h-3.5 text-[#FF5C35] shrink-0" />
                          <span className={cn(
                            "text-xs sm:text-sm font-black tracking-tight capitalize",
                            isDarkMode ? "text-white" : "text-gray-950"
                          )}>
                            {damage.clientName || 'Unknown Client'}
                          </span>
                        </div>

                        {/* 2. Phone Number Pill (Automated WhatsApp Turkish Message Trigger) */}
                        {damage.clientPhone ? (
                          <a
                            href={getWhatsAppUrl(damage)}
                            onClick={(e) => copyBlueprintAndOpenWhatsApp(e, damage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 shadow-xs hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer group",
                              copyingBlueprintId === damage.id && "opacity-70 pointer-events-none"
                            )}
                            title="WhatsApp mesajını açar ve araç hasar krokisini otomatik panoya kopyalar (Ctrl+V ile sohbete yapıştırabilirsiniz)"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#FF5C35] shrink-0 group-hover:scale-110 transition-transform" />
                            <span className={cn(
                              "text-xs sm:text-sm font-black tracking-tight",
                              isDarkMode ? "text-white" : "text-gray-950"
                            )}>
                              {damage.clientPhone}
                            </span>
                            {copiedBlueprintSuccessId === damage.id && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md ml-1 animate-pulse">
                                <Check className="w-3 h-3" /> Kroki Panoda (Ctrl+V)
                              </span>
                            )}
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 shadow-xs">
                            <Phone className="w-3.5 h-3.5 text-[#FF5C35] shrink-0 opacity-40" />
                            <span className={cn(
                              "text-xs sm:text-sm font-bold tracking-tight opacity-60",
                              isDarkMode ? "text-white" : "text-gray-950"
                            )}>
                              No Phone
                            </span>
                          </div>
                        )}

                        {/* 3. Date Pill (Same background color with black text, formatted as DD/MM/YYYY) */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 shadow-xs">
                          <Calendar className="w-3.5 h-3.5 text-[#FF5C35] shrink-0" />
                          <span className={cn(
                            "text-xs sm:text-sm font-black tracking-tight",
                            isDarkMode ? "text-white" : "text-gray-950"
                          )}>
                            {formatDamageDate(damage.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Status Panel: Larger, beautifully styled dashboard panel with arc/badge styling */}
                    {(() => {
                      const statusInfo = getDamageDaysOrRepairedStatus(damage);
                      const isRepaired = statusInfo.isRepaired;
                      const days = statusInfo.days;
                      // Calculate an arc progress percentage:
                      // If repaired: 100% complete.
                      // If active: e.g. day 1 is 20%, day 3 is 50%, day 7 is 85%, capped at 100%
                      const progressPct = isRepaired ? 100 : Math.min(100, Math.max(15, Math.round((days / 7) * 80)));
                      const strokeDash = 94.2;
                      const strokeOffset = strokeDash - (strokeDash * (progressPct / 100));
                      const gradId = `gauge-grad-${damage.id}-${isRepaired ? 'repaired' : 'active'}`;

                      return (
                        <div className="flex items-center justify-start lg:justify-center my-2 md:my-0 shrink-0">
                          <div
                            className={cn(
                              "relative px-4 py-3 rounded-2xl border transition-all duration-300 select-none flex flex-col justify-between min-w-[215px] sm:min-w-[235px] hover:-translate-y-0.5",
                              "before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:rounded-t-2xl before:pointer-events-none",
                              isDarkMode
                                ? isRepaired
                                  ? "bg-gradient-to-b from-emerald-950/40 via-[#1E1B1A] to-[#171514] border-emerald-500/50 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.8),0_0_24px_rgba(16,185,129,0.24)] ring-1 ring-inset ring-white/10 before:bg-gradient-to-r before:from-transparent before:via-emerald-400/50 before:to-transparent"
                                  : "bg-gradient-to-b from-orange-950/40 via-[#1E1B1A] to-[#171514] border-[#FF5C35]/50 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.8),0_0_24px_rgba(255,92,53,0.28)] ring-1 ring-inset ring-white/10 before:bg-gradient-to-r before:from-transparent before:via-orange-400/50 before:to-transparent"
                                : isRepaired
                                ? "bg-gradient-to-b from-emerald-50/90 via-white to-white border-emerald-400 shadow-[0_14px_28px_-6px_rgba(16,185,129,0.28),0_6px_14px_-3px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-white before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent"
                                : "bg-gradient-to-b from-orange-50/90 via-white to-white border-orange-400 shadow-[0_14px_28px_-6px_rgba(255,92,53,0.32),0_6px_14px_-3px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-white before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent"
                            )}
                          >
                            {/* Card Header Title */}
                            <div className="flex items-center justify-between gap-2 border-b pb-1.5 border-black/5 dark:border-white/5">
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                                isRepaired
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-[#FF5C35] dark:text-[#FF7D5C]"
                              )}>
                                {isRepaired ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>REPAIR COMPLETED</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-[#FF5C35] dark:text-[#FF7D5C] shrink-0" />
                                    <span>WORKSHOP DURATION</span>
                                  </>
                                )}
                              </span>
                              <span className={cn(
                                "text-[9px] font-black px-2.5 py-0.5 rounded-lg border tracking-wider",
                                isRepaired
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 shadow-[0_2px_6px_rgba(16,185,129,0.18)]"
                                  : "bg-orange-500/15 text-[#FF5C35] dark:text-orange-300 border-orange-400/40 shadow-[0_2px_6px_rgba(255,92,53,0.20)]"
                              )}>
                                {isRepaired ? 'READY' : 'IN REPAIR'}
                              </span>
                            </div>

                            {/* Card Body: Radial Gauge Arc + Detailed Metric Numbers */}
                            <div className="flex items-center justify-between gap-3 pt-2">
                              {/* Semi-Circle / Arc Gauge Visual */}
                              <div className="relative flex flex-col items-center justify-center shrink-0 w-16 h-14">
                                <svg className="w-16 h-14 overflow-visible" viewBox="0 0 80 50">
                                  <defs>
                                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                                      {isRepaired ? (
                                        <>
                                          <stop offset="0%" stopColor="#34D399" />
                                          <stop offset="100%" stopColor="#059669" />
                                        </>
                                      ) : (
                                        <>
                                          <stop offset="0%" stopColor="#FFA07A" />
                                          <stop offset="50%" stopColor="#FF5C35" />
                                          <stop offset="100%" stopColor="#EA580C" />
                                        </>
                                      )}
                                    </linearGradient>
                                  </defs>
                                  {/* Background Track */}
                                  <path
                                    d="M 10 45 A 30 30 0 0 1 70 45"
                                    fill="none"
                                    stroke={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                  />
                                  {/* Active Glowing Progress Arc */}
                                  <path
                                    d="M 10 45 A 30 30 0 0 1 70 45"
                                    fill="none"
                                    stroke={`url(#${gradId})`}
                                    strokeWidth="6.5"
                                    strokeLinecap="round"
                                    strokeDasharray={strokeDash}
                                    strokeDashoffset={strokeOffset}
                                    style={{
                                      filter: isRepaired
                                        ? 'drop-shadow(0 3px 5px rgba(16,185,129,0.4))'
                                        : 'drop-shadow(0 3px 5px rgba(255,92,53,0.45))'
                                    }}
                                    className="transition-all duration-700 ease-out"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 text-center">
                                  <span className={cn(
                                    "text-xs font-black leading-none",
                                    isDarkMode ? "text-white" : "text-gray-900"
                                  )}>
                                    {isRepaired ? '100%' : `${days}d`}
                                  </span>
                                  <span className={cn(
                                    "text-[7px] font-black uppercase tracking-wider leading-none mt-0.5",
                                    isRepaired
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-[#FF5C35] dark:text-[#FF7D5C]"
                                  )}>
                                    {isRepaired ? 'DONE' : 'CYCLE'}
                                  </span>
                                </div>
                              </div>

                              {/* Right Details: Date & Status Description */}
                              <div className="flex flex-col text-right justify-center">
                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 leading-tight">
                                  {isRepaired ? 'COMPLETION DATE' : 'INCIDENT DURATION'}
                                </span>
                                <div className={cn(
                                  "text-sm font-black tracking-tight leading-snug",
                                  isRepaired
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-[#FF5C35] dark:text-[#FF7D5C]"
                                )}>
                                  {statusInfo.label}
                                </div>
                                <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                  {isRepaired
                                    ? `In shop: ${days} ${days === 1 ? 'day' : 'days'}`
                                    : `Reported: ${statusInfo.reportDateStr}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Price, Payment & Repaired Status Section */}
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 dark:border-white/5">
                      {/* Price Tag */}
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">
                          Assessed Price
                        </span>
                        <div className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>
                          €{(damage.price || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Payment Status Panel / Toggle */}
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 hidden md:block">
                          Liability Status
                        </span>
                        <button
                          id={`btn-toggle-liability-${damage.id}`}
                          onClick={() => handleTogglePaid(damage)}
                          title="Click to toggle payment / liability status"
                          className={cn(
                            "inline-flex items-center gap-2 p-1 pr-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 border",
                            damage.isPaid
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/30 px-3 py-1.5"
                          )}
                        >
                          {damage.isPaid ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>PAID ({damage.paymentMethod || 'Cash'})</span>
                              </div>
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-xs shrink-0 border",
                                  (damage.paidBy || 'Client').toLowerCase() === 'company'
                                    ? "bg-blue-600 text-white border-blue-400 shadow-blue-500/30"
                                    : "bg-[#FF5C35] text-white border-orange-400 shadow-orange-500/30"
                                )}
                              >
                                {(damage.paidBy || 'Client').toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>UNPAID</span>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Repaired Status Panel / Toggle */}
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 hidden md:block">
                          Workshop Status
                        </span>
                        <button
                          onClick={() => handleToggleRepaired(damage)}
                          title="Click to toggle repair status"
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95",
                            damage.isRepaired
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
                          )}
                        >
                          {damage.isRepaired ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>REPAIRED</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              <span>IN WORKSHOP</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleCardExpansion(damage.id)}
                          title={isExpanded ? "Hide Blueprint" : "Show Skeleton Blueprint"}
                          className={cn(
                            "p-2 rounded-xl border transition-colors cursor-pointer",
                            isExpanded
                              ? damage.isRepaired
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                : "bg-red-500/10 border-red-500/30 text-red-500"
                              : isDarkMode
                                ? "border-white/10 hover:bg-white/5 text-gray-400 hover:text-white"
                                : "border-gray-200 hover:bg-gray-100 text-gray-600"
                          )}
                        >
                          <Car className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEditModal(damage)}
                          title="Edit Damage Record"
                          className={cn(
                            "p-2 rounded-xl border transition-colors cursor-pointer",
                            isDarkMode
                              ? "border-white/10 hover:bg-white/5 text-gray-400 hover:text-white"
                              : "border-gray-200 hover:bg-gray-100 text-gray-600"
                          )}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                      </div>
                    </div>
                  </div>

                  {/* Damaged / Repaired Parts Summary Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      damage.isRepaired ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                    )}>
                      {damage.isRepaired ? 'Repaired Parts' : 'Damaged Zones'} ({partsCount}):
                    </span>
                    {partsCount === 0 ? (
                      <span className="text-xs text-gray-400 italic">No specific zone tagged</span>
                    ) : (
                      damage.damagedParts?.map((partId) => (
                        <span
                          key={partId}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors",
                            damage.isRepaired
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-500 border border-red-500/20"
                          )}
                        >
                          {damage.isRepaired ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          )}
                          {getPartName(partId)}
                        </span>
                      ))
                    )}

                    <button
                      onClick={() => toggleCardExpansion(damage.id)}
                      className={cn(
                        "ml-auto text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors",
                        damage.isRepaired
                          ? "text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                          : "text-red-500 hover:text-red-400"
                      )}
                    >
                      <span>{isExpanded ? 'Hide Blueprint' : 'View Skeleton Blueprint'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Optional Description */}
                  {damage.description && (
                    <div className={cn(
                      "p-3 rounded-xl text-xs leading-relaxed",
                      isDarkMode ? "bg-[#1A1817] text-gray-300" : "bg-gray-50 text-gray-600"
                    )}>
                      <strong className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider block mb-0.5">Notes:</strong>
                      {damage.description}
                    </div>
                  )}

                  {/* Expanded Interactive Skeleton Visualizer (Read Only) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-4 border-t border-gray-100 dark:border-white/5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            damage.isRepaired ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"
                          )}>
                            {damage.isRepaired ? 'Vehicle Repaired Blueprint Map' : 'Vehicle Damage Blueprint Map'}
                          </span>
                          <span className={cn("text-[11px] font-bold", damage.isRepaired ? "text-emerald-500" : "text-red-500")}>
                            {damage.isRepaired ? '✓ Green areas indicate successfully repaired parts' : 'Red areas indicate confirmed damage locations'}
                          </span>
                        </div>
                        <div id={'damage-blueprint-' + damage.id} className="rounded-2xl p-2 bg-gray-50 dark:bg-[#1E1B1A]">
                          <CarSkeletonPicker
                            selectedParts={damage.damagedParts || []}
                            readOnly={true}
                            isDarkMode={isDarkMode}
                            isRepaired={damage.isRepaired}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                    {/* Hidden Off-screen Blueprint for instant Clipboard Capture when card is collapsed */}
                    {!expandedCardIds[damage.id] && (
                      <div
                        id={'damage-blueprint-' + damage.id}
                        aria-hidden="true"
                        style={{
                          position: 'fixed',
                          left: '-9999px',
                          top: 0,
                          width: '800px',
                          pointerEvents: 'none',
                          opacity: 1,
                          zIndex: -1
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1A]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            {damage.plate || 'Vehicle'} - {damage.isRepaired ? 'Vehicle Repaired Blueprint Map' : 'Vehicle Damage Blueprint Map'}
                          </span>
                          <span className="text-[11px] font-bold text-red-500">
                            {damage.isRepaired ? '✓ Repaired' : 'Damage Locations'}
                          </span>
                        </div>
                        <CarSkeletonPicker
                          selectedParts={damage.damagedParts || []}
                          readOnly={true}
                          isDarkMode={isDarkMode}
                          isRepaired={damage.isRepaired}
                        />
                      </div>
                    )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredDamages.length > 0 && (
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t",
            isDarkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
          )}>
            <div className="text-xs font-semibold">
              Showing <span className="font-bold text-gray-900 dark:text-white">{Math.min(filteredDamages.length, startIndex + 1)}</span> to{" "}
              <span className="font-bold text-gray-900 dark:text-white">{Math.min(filteredDamages.length, startIndex + ITEMS_PER_PAGE)}</span> of{" "}
              <span className="font-bold text-gray-900 dark:text-white">{filteredDamages.length}</span> records
              {selectedDateFilter && (
                <span className="ml-1 text-[#FF5C35] font-bold">
                  (for {format(new Date(selectedDateFilter + 'T00:00:00'), 'dd MMM yyyy')})
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-damages-prev-page"
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="Previous Page"
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs",
                    isDarkMode ? "border-white/10 hover:bg-white/5 text-white" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-900"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    let startPage = 1;
                    let endPage = totalPages;
                    if (totalPages > 5) {
                      startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                      endPage = startPage + 4;
                    }
                    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-xl font-black text-xs transition-all cursor-pointer shadow-xs",
                          currentPage === pageNum
                            ? "bg-[#FF5C35] text-white shadow-md shadow-[#FF5C35]/20"
                            : isDarkMode
                            ? "text-gray-400 hover:bg-white/5 hover:text-white"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  id="btn-damages-next-page"
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  title="Next Page"
                  className={cn(
                    "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs",
                    isDarkMode ? "border-white/10 hover:bg-white/5 text-white" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-900"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Add / Edit Damage Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={cn(
                "w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden my-auto",
                isDarkMode ? "bg-[#231F1D] border-white/10" : "bg-white border-gray-200"
              )}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className={cn("text-base font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
                      {editingDamage ? 'Edit Damage Report' : 'Add Vehicle Damage Report'}
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      Tag damaged parts on the car skeleton and record repair cost &amp; client payment
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveDamage} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Top Section: Vehicle & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Car Plate / Selection with Small Search Button */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-[#FF5C35]" />
                        Car License Plate *
                      </span>
                      {plateSearchFeedback && (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {plateSearchFeedback}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          list="fleet-vehicles-5countries"
                          placeholder="e.g. SK 7297 BH"
                          value={formPlate}
                          onChange={(e) => {
                            setFormPlate(e.target.value);
                            setPlateSearchFeedback(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              searchAndApplyPlate(formPlate);
                            }
                          }}
                          required
                          className={cn(
                            "w-full px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase border focus:outline-none transition-colors",
                            isDarkMode
                              ? "bg-[#1E1B1A] border-white/10 text-white focus:border-red-500"
                              : "bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500"
                          )}
                        />
                        <datalist id="fleet-vehicles-5countries">
                          {fleetVehicles.map((v) => (
                            <option key={v.id} value={v.plate}>
                              {v.plate} - {v.name} ({v.country || 'Fleet'})
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {/* Small Search Button to immediately find plate in 5-country fleet */}
                      <button
                        type="button"
                        onClick={() => searchAndApplyPlate(formPlate)}
                        title="Find car in 5-country fleet"
                        className="px-3 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-red-600/20 active:scale-95 cursor-pointer shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Find</span>
                      </button>
                    </div>
                  </div>

                  {/* Incident Date */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      Date of Damage *
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition-colors",
                        isDarkMode
                          ? "bg-[#1E1B1A] border-white/10 text-white focus:border-red-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500"
                      )}
                    />
                  </div>
                </div>

                {/* Client Details Row (Pure Manual Input) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client Name - Pure Manual Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-emerald-500" />
                      Client Name (Responsible) *
                    </label>
                    <input
                      type="text"
                      placeholder="Type client full name..."
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      required
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border focus:outline-none transition-colors",
                        isDarkMode
                          ? "bg-[#1E1B1A] border-white/10 text-white focus:border-red-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500"
                      )}
                    />
                  </div>

                  {/* Client Phone - Pure Manual Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-purple-500" />
                      Client Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +389 70 123 456"
                      value={formClientPhone}
                      onChange={(e) => setFormClientPhone(e.target.value)}
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border focus:outline-none transition-colors",
                        isDarkMode
                          ? "bg-[#1E1B1A] border-white/10 text-white focus:border-red-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500"
                      )}
                    />
                  </div>
                </div>

                {/* Price & Severity Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 items-start">
                  {/* Damage Price Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      Assessed Price (€) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">
                        €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        required
                        className={cn(
                          "w-full pl-8 pr-3.5 py-2.5 rounded-xl text-xs font-extrabold border focus:outline-none transition-colors",
                          isDarkMode
                            ? "bg-[#1E1B1A] border-white/10 text-white focus:border-red-500"
                            : "bg-white border-gray-200 text-gray-900 focus:border-red-500"
                        )}
                      />
                    </div>
                  </div>

                  {/* Severity Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Damage Severity
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as DamageSeverity[]).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setFormSeverity(sev)}
                          className={cn(
                            "py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer text-center",
                            formSeverity === sev
                              ? sev === 'CRITICAL'
                                ? "bg-red-500/20 border-red-500 text-red-500 shadow-sm"
                                : sev === 'HIGH'
                                ? "bg-orange-500/20 border-orange-500 text-orange-500 shadow-sm"
                                : sev === 'MEDIUM'
                                ? "bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm"
                                : "bg-blue-500/20 border-blue-500 text-blue-500 shadow-sm"
                              : isDarkMode
                                ? "border-white/10 text-gray-400 hover:bg-white/5"
                                : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Interactive Car Skeleton Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={cn("text-xs font-bold uppercase tracking-wider", isDarkMode ? "text-white" : "text-gray-900")}>
                        Interactive Car Blueprint (Click parts to tag damage)
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Select damaged zones across Top, Left, Right, Front and Rear views
                      </p>
                    </div>
                    {formDamagedParts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormDamagedParts([])}
                        className="text-[11px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Clear All ({formDamagedParts.length})
                      </button>
                    )}
                  </div>

                  <CarSkeletonPicker
                    selectedParts={formDamagedParts}
                    onChange={setFormDamagedParts}
                    isDarkMode={isDarkMode}
                    isRepaired={formIsRepaired}
                  />
                </div>

                {/* Incident Description / Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Incident Description &amp; Staff Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe how the damage occurred, customer explanation, police report reference, etc..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={cn(
                      "w-full p-3 rounded-xl text-xs font-medium border focus:outline-none transition-colors",
                      isDarkMode
                        ? "bg-[#1E1B1A] border-white/10 text-white placeholder-gray-500 focus:border-red-500"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500"
                    )}
                  />
                </div>

                {/* Form Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer",
                      isDarkMode ? "border-white/10 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-gray-700"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingDamage ? 'Update Report' : 'Save Damage Report'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Workshop Status Confirmation Prompt Modal */}
        {workshopPromptDamage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-md rounded-2xl border shadow-2xl p-6 relative overflow-hidden",
                isDarkMode ? "bg-[#252120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <button
                type="button"
                onClick={() => setWorkshopPromptDamage(null)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                  workshopPromptDamage.isRepaired
                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                )}>
                  {workshopPromptDamage.isRepaired ? (
                    <Wrench className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {workshopPromptDamage.isRepaired ? "Send Car to Workshop?" : "Mark Car as Repaired?"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {workshopPromptDamage.isRepaired
                      ? "Reopen active repair status for this vehicle"
                      : "Confirm vehicle repairs are completed"}
                  </p>
                </div>
              </div>

              {/* Vehicle Summary Card */}
              <div className={cn(
                "p-3.5 rounded-xl border mb-4 flex items-center justify-between",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
              )}>
                <div>
                  <div className="text-xs font-black tracking-wider uppercase">
                    {workshopPromptDamage.vehicleName || 'Fleet Vehicle'}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-gray-500 mt-0.5">
                    {workshopPromptDamage.plate}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Current Status
                  </span>
                  <span className={cn(
                    "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mt-0.5",
                    workshopPromptDamage.isRepaired
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  )}>
                    {workshopPromptDamage.isRepaired ? "REPAIRED" : "IN WORKSHOP"}
                  </span>
                </div>
              </div>

              <p className={cn("text-xs leading-relaxed mb-6", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                {workshopPromptDamage.isRepaired
                  ? "This vehicle will be moved back to In Workshop status. The DAMAGES indicator number in your sidebar will increase."
                  : "This vehicle will be marked as Repaired and removed from the active workshop view. The DAMAGES indicator number in your sidebar will decrease."}
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWorkshopPromptDamage(null)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer",
                    isDarkMode ? "border-white/10 hover:bg-white/5 text-gray-300" : "border-gray-200 hover:bg-gray-100 text-gray-700"
                  )}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isUpdatingWorkshop}
                  onClick={handleConfirmWorkshopStatus}
                  className={cn(
                    "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5",
                    workshopPromptDamage.isRepaired
                      ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  )}
                >
                  {isUpdatingWorkshop ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : workshopPromptDamage.isRepaired ? (
                    <Wrench className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{workshopPromptDamage.isRepaired ? "Move to In Workshop" : "Mark as Repaired"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Payment & Liability Status Prompt Panel */}
        {paymentPromptDamage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-md rounded-2xl border shadow-2xl p-6 relative overflow-hidden",
                isDarkMode ? "bg-[#252120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <button
                type="button"
                onClick={() => setPaymentPromptDamage(null)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    Damage Payment &amp; Liability
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {paymentPromptDamage.isPaid
                      ? 'Update payment method and responsible party'
                      : 'Select payment method and responsible party'}
                  </p>
                </div>
              </div>

              {/* Vehicle & Price Summary Card */}
              <div className={cn(
                "p-3.5 rounded-xl border mb-5 flex items-center justify-between",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
              )}>
                <div>
                  <div className="text-xs font-black tracking-wider uppercase">
                    {paymentPromptDamage.vehicleName || 'Fleet Vehicle'}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-gray-500 mt-0.5">
                    {paymentPromptDamage.plate}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Assessed Damage
                  </span>
                  <span className="text-base font-black text-red-500">
                    €{(paymentPromptDamage.price || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Step 1: Payment Method (CASH or CARD) */}
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                  1. Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodChoice('Cash')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      paymentMethodChoice === 'Cash'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                        : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethodChoice('Card')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      paymentMethodChoice === 'Card'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                        : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>CARD</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Paid By (CLIENT or COMPANY) */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                  2. Paid By
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaidByChoice('Client')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      paidByChoice === 'Client'
                        ? "bg-[#FF5C35] text-white border-[#FF5C35] shadow-md shadow-[#FF5C35]/20"
                        : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <User className="w-4 h-4" />
                    <span>Paid by Client</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaidByChoice('Company')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      paidByChoice === 'Company'
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                        : isDarkMode
                          ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Paid by Company</span>
                  </button>
                </div>
              </div>

              {/* Preview of Status */}
              <div className={cn(
                "p-3 rounded-xl border mb-5 text-[11px] font-bold flex items-center justify-between",
                isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
              )}>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>{paymentPromptDamage.isPaid ? 'Payment Status: PAID' : 'Mark as PAID:'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wider font-black text-xs">
                    {paymentMethodChoice}
                  </span>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs border",
                      paidByChoice === 'Company'
                        ? "bg-blue-600 text-white border-blue-400 shadow-blue-500/20"
                        : "bg-[#FF5C35] text-white border-orange-400 shadow-[#FF5C35]/20"
                    )}
                  >
                    {paidByChoice.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentPromptDamage(null)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer",
                    isDarkMode ? "border-white/10 hover:bg-white/5 text-gray-300" : "border-gray-200 hover:bg-gray-100 text-gray-700"
                  )}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={handleConfirmPayment}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  {isUpdatingPayment ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{paymentPromptDamage.isPaid ? 'Save Changes' : 'Confirm Paid'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Date Filter Dropdown Popover via Portal to avoid any container overflow clipping */}
      {isDatePickerOpen && datePickerCoords && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10005] pointer-events-none">
          {/* Backdrop click outside */}
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setIsDatePickerOpen(false)}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: datePickerCoords.top,
              left: datePickerCoords.left,
              width: 288,
            }}
            className={cn(
              "p-3.5 rounded-2xl shadow-2xl border pointer-events-auto",
              isDarkMode
                ? "bg-[#1E1B1A] border-white/15 text-white shadow-black/80"
                : "bg-white border-gray-200 text-gray-900 shadow-xl"
            )}
          >
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#FF5C35]" />
                <span className="text-xs font-black uppercase tracking-wider">Filter by Date</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Native Date Input with visible styling */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Choose Specific Date:
              </label>
              <input
                id="input-damage-filter-picker"
                type="date"
                value={selectedDateFilter}
                onChange={(e) => {
                  setSelectedDateFilter(e.target.value);
                }}
                className={cn(
                  "w-full px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-[#FF5C35] cursor-pointer",
                  isDarkMode
                    ? "bg-black/30 border-white/15 text-white [color-scheme:dark]"
                    : "bg-gray-50 border-gray-200 text-gray-900 [color-scheme:light]"
                )}
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDateFilter(format(new Date(), 'yyyy-MM-dd'));
                  setIsDatePickerOpen(false);
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer text-center",
                  selectedDateFilter === format(new Date(), 'yyyy-MM-dd')
                    ? "bg-[#FF5C35]/15 border-[#FF5C35]/40 text-[#FF5C35]"
                    : "border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedDateFilter(format(yesterday, 'yyyy-MM-dd'));
                  setIsDatePickerOpen(false);
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer text-center",
                  (() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    return selectedDateFilter === format(y, 'yyyy-MM-dd');
                  })()
                    ? "bg-[#FF5C35]/15 border-[#FF5C35]/40 text-[#FF5C35]"
                    : "border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                )}
              >
                Yesterday
              </button>
              {selectedDateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter('');
                    setIsDatePickerOpen(false);
                  }}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-black text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Done button */}
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-[#FF5C35] hover:bg-[#FF5C35]/90 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
